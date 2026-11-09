/**
 * Gerber to SVG renderer.
 * Converts parsed Gerber files to SVG format for visualization.
 */

import type { GerberFile } from "../GerberFile.ts"
import type { GerberNode } from "../ast/GerberNode.ts"
import {
  ApertureDefinition,
  FormatSpecification,
  UnitMode,
  SelectAperture,
  SetInterpolationMode,
  LoadPolarity,
  Operation,
  RegionStart,
  RegionEnd,
  type Unit,
} from "../ast/commands.ts"

export interface RenderOptions {
  /** Scale factor (default: 1) */
  scale?: number
  /** Stroke color for traces (default: "#000") */
  strokeColor?: string
  /** Fill color for pads (default: "#000") */
  fillColor?: string
  /** Background color (default: "none") */
  backgroundColor?: string
  /** Padding in user units (default: 0.1) */
  padding?: number
}

interface Point {
  x: number
  y: number
}

interface Aperture {
  code: number
  template: string
  params: number[]
}

interface Graphic {
  svg: string
  clearPath: string
  polarity: "dark" | "clear"
}

interface RenderState {
  x: number
  y: number
  aperture: Aperture | null
  interpolation: "linear" | "cw" | "ccw"
  regionMode: boolean
  polarity: "dark" | "clear"
  unit: Unit
  formatSpec: FormatSpecification | null
}

// Isolate references across calls and separately loaded copies of the library.
// IDs are internal SVG names, not security tokens.
const svgIdPrefix = `gerber-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
let nextSvgId = 0

export class GerberToSvg {
  private state: RenderState
  private apertures: Map<number, Aperture> = new Map()
  private graphics: Graphic[] = []
  private regionPaths: string[] = []
  private bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  }
  private options: Required<RenderOptions>

  constructor(options: RenderOptions = {}) {
    this.options = {
      scale: options.scale ?? 1,
      strokeColor: options.strokeColor ?? "#000",
      fillColor: options.fillColor ?? "#000",
      backgroundColor: options.backgroundColor ?? "none",
      padding: options.padding ?? 0.1,
    }
    this.state = {
      x: 0,
      y: 0,
      aperture: null,
      interpolation: "linear",
      regionMode: false,
      polarity: "dark",
      unit: "IN",
      formatSpec: null,
    }
  }

  render(gerber: GerberFile): string {
    // First pass: collect apertures and format info
    for (const cmd of gerber.commands) {
      this.processCommand(cmd)
    }

    // Calculate viewBox
    const padding = this.options.padding
    const width = this.bounds.maxX - this.bounds.minX + padding * 2
    const height = this.bounds.maxY - this.bounds.minY + padding * 2
    const viewMinX = this.bounds.minX - padding
    const viewMinY = this.bounds.minY - padding

    // Build SVG
    const scale = this.options.scale
    const svgWidth = width * scale
    const svgHeight = height * scale

    // Flip Y axis (Gerber uses bottom-left origin, SVG uses top-left)
    const transform = `translate(0, ${height}) scale(1, -1) translate(${-viewMinX}, ${-viewMinY})`

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}">\n`

    if (this.options.backgroundColor !== "none") {
      svg += `  <rect width="100%" height="100%" fill="${this.options.backgroundColor}"/>\n`
    }

    svg += `  <g transform="${transform}">\n`

    svg += this.renderGraphics({ x: viewMinX, y: viewMinY, width, height })

    svg += "  </g>\n"
    svg += "</svg>"

    return svg
  }

  private addGraphic(svg: string, clearPath: string): void {
    this.graphics.push({ svg, clearPath, polarity: this.state.polarity })
  }

  private createRegion(region: string): string {
    return `<path d="${region}" fill="${this.options.fillColor}" stroke="none" fill-rule="evenodd"/>`
  }

  private renderGraphics({
    x,
    y,
    width,
    height,
  }: {
    x: number
    y: number
    width: number
    height: number
  }): string {
    const namespace = `${svgIdPrefix}-${nextSvgId++}`
    const frame = this.rectanglePath({ x, y, width, height })
    const definitions: string[] = []
    let scene = ""
    let stage = 0
    for (const graphic of this.graphics) {
      if (graphic.polarity === "dark") {
        scene += `    ${graphic.svg}\n`
      } else if (scene) {
        const id = `${namespace}-clear-${stage++}`
        // Clip the previous paints to the geometric complement of this clear.
        // Clipping keeps their original colors/alpha and intersects geometry,
        // rather than repeatedly blending a black eraser at antialiased edges.
        definitions.push(
          `<clipPath id="${id}-clip" clipPathUnits="userSpaceOnUse"><path d="${frame} ${graphic.clearPath}" clip-rule="evenodd"/></clipPath>`,
          `<g id="${id}" clip-path="url(#${id}-clip)">${scene}</g>`,
        )
        // A normal drawing reference shares the preceding scene once. Keeping
        // these groups in defs avoids both copied suffixes and deep XML nesting.
        scene = `    <use href="#${id}"/>\n`
      }
    }
    return definitions.length
      ? `    <defs>${definitions.join("")}</defs>\n${scene}`
      : scene
  }

  private rectanglePath({
    x,
    y,
    width,
    height,
    radius = 0,
  }: {
    x: number
    y: number
    width: number
    height: number
    radius?: number
  }): string {
    if (radius === 0) {
      return `M${x} ${y}H${x + width}V${y + height}H${x}Z`
    }
    return (
      `M${x + radius} ${y}H${x + width - radius}` +
      `A${radius} ${radius} 0 0 1 ${x + width} ${y + radius}` +
      `V${y + height - radius}A${radius} ${radius} 0 0 1 ${x + width - radius} ${y + height}` +
      `H${x + radius}A${radius} ${radius} 0 0 1 ${x} ${y + height - radius}` +
      `V${y + radius}A${radius} ${radius} 0 0 1 ${x + radius} ${y}Z`
    )
  }

  private circlePath({
    x,
    y,
    radius,
  }: {
    x: number
    y: number
    radius: number
  }): string {
    return (
      `M${x - radius} ${y}A${radius} ${radius} 0 1 0 ${x + radius} ${y}` +
      `A${radius} ${radius} 0 1 0 ${x - radius} ${y}Z`
    )
  }

  private tracePath({
    x,
    y,
    width,
  }: {
    x: number
    y: number
    width: number
  }): string {
    const fromX = this.state.x
    const fromY = this.state.y
    const dx = x - fromX
    const dy = y - fromY
    const length = Math.hypot(dx, dy)
    const radius = width / 2
    if (length === 0) return this.circlePath({ x, y, radius })
    const nx = (-dy / length) * radius
    const ny = (dx / length) * radius
    return (
      `M${fromX - nx} ${fromY - ny}L${x - nx} ${y - ny}` +
      `A${radius} ${radius} 0 0 1 ${x + nx} ${y + ny}` +
      `L${fromX + nx} ${fromY + ny}` +
      `A${radius} ${radius} 0 0 1 ${fromX - nx} ${fromY - ny}Z`
    )
  }

  private processCommand(cmd: GerberNode): void {
    if (cmd instanceof FormatSpecification) {
      this.state.formatSpec = cmd
      return
    }

    if (cmd instanceof UnitMode) {
      this.state.unit = cmd.unit
      return
    }

    if (cmd instanceof ApertureDefinition) {
      this.apertures.set(cmd.code, {
        code: cmd.code,
        template: cmd.template,
        params: cmd.params,
      })
      return
    }

    if (cmd instanceof SelectAperture) {
      this.state.aperture = this.apertures.get(cmd.code) ?? null
      return
    }

    if (cmd instanceof SetInterpolationMode) {
      const mode = cmd.mode
      if (mode === "G01") {
        this.state.interpolation = "linear"
      } else if (mode === "G02") {
        this.state.interpolation = "cw"
      } else if (mode === "G03") {
        this.state.interpolation = "ccw"
      }
      return
    }

    if (cmd instanceof LoadPolarity) {
      this.state.polarity = cmd.polarity === "D" ? "dark" : "clear"
      return
    }

    if (cmd instanceof RegionStart) {
      this.state.regionMode = true
      this.regionPaths = []
      return
    }

    if (cmd instanceof RegionEnd) {
      // Independent contours in a clear region remove their union. Applying
      // each complete contour's complement intersects the remaining image,
      // while preserving holes formed by a cut-in within one contour.
      const paths =
        this.state.polarity === "clear"
          ? this.regionPaths
          : [this.regionPaths.join(" ")]
      for (const path of paths) {
        if (path) {
          const region = path + " Z"
          this.addGraphic(this.createRegion(region), region)
        }
      }
      this.state.regionMode = false
      this.regionPaths = []
      return
    }

    if (cmd instanceof Operation) {
      this.handleOperation(cmd)
      return
    }
  }

  private handleOperation(op: Operation): void {
    const newX =
      op.x !== undefined ? this.convertCoordinate(op.x) : this.state.x
    const newY =
      op.y !== undefined ? this.convertCoordinate(op.y) : this.state.y

    this.updateBounds(newX, newY)

    switch (op.dcode) {
      case "D01": // Interpolate (draw)
        if (this.state.regionMode) {
          if (this.regionPaths.length === 0) {
            this.regionPaths.push(`M ${this.state.x} ${this.state.y}`)
          }
          this.regionPaths[this.regionPaths.length - 1] += ` L ${newX} ${newY}`
        } else if (this.state.aperture) {
          const strokeWidth = this.getApertureWidth()
          this.addGraphic(
            `<line x1="${this.state.x}" y1="${this.state.y}" x2="${newX}" y2="${newY}" ` +
              `stroke="${this.options.strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
            this.tracePath({ x: newX, y: newY, width: strokeWidth }),
          )
        }
        break

      case "D02": // Move
        if (this.state.regionMode && this.regionPaths.length > 0) {
          this.regionPaths.push(`M ${newX} ${newY}`)
        }
        break

      case "D03": // Flash
        if (this.state.aperture) {
          const flash = this.createFlash(newX, newY)
          if (flash) {
            this.addGraphic(flash.svg, flash.clearPath)
          }
        }
        break
    }

    this.state.x = newX
    this.state.y = newY
  }

  private convertCoordinate(value: number): number {
    if (!this.state.formatSpec) {
      // Default: assume 2.4 format (integer part 2, decimal part 4)
      return value / 10000
    }
    const decimalDigits = this.state.formatSpec.xDecimalDigits
    return value / Math.pow(10, decimalDigits)
  }

  private getApertureWidth(): number {
    if (!this.state.aperture) return 0.01
    const params = this.state.aperture.params
    if (params.length === 0) return 0.01
    return params[0] ?? 0.01
  }

  private createFlash(
    x: number,
    y: number,
  ): { svg: string; clearPath: string } | null {
    const ap = this.state.aperture
    if (!ap) return null

    const fill = this.options.fillColor

    switch (ap.template) {
      case "C": {
        // Circle
        const diameter = ap.params[0] ?? 0.01
        const r = diameter / 2
        this.updateBounds(x - r, y - r)
        this.updateBounds(x + r, y + r)
        return {
          svg: `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`,
          clearPath: this.circlePath({ x, y, radius: r }),
        }
      }

      case "R": {
        // Rectangle
        const width = ap.params[0] ?? 0.01
        const height = ap.params[1] ?? width
        const rx = x - width / 2
        const ry = y - height / 2
        this.updateBounds(rx, ry)
        this.updateBounds(rx + width, ry + height)
        return {
          svg: `<rect x="${rx}" y="${ry}" width="${width}" height="${height}" fill="${fill}"/>`,
          clearPath: this.rectanglePath({ x: rx, y: ry, width, height }),
        }
      }

      case "O": {
        // Obround (pill shape)
        const width = ap.params[0] ?? 0.01
        const height = ap.params[1] ?? width
        const radius = Math.min(width, height) / 2
        const rx = x - width / 2
        const ry = y - height / 2
        this.updateBounds(rx, ry)
        this.updateBounds(rx + width, ry + height)
        return {
          svg: `<rect x="${rx}" y="${ry}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}"/>`,
          clearPath: this.rectanglePath({
            x: rx,
            y: ry,
            width,
            height,
            radius,
          }),
        }
      }

      default:
        // For unknown apertures, draw a small circle
        return {
          svg: `<circle cx="${x}" cy="${y}" r="0.005" fill="${fill}"/>`,
          clearPath: this.circlePath({ x, y, radius: 0.005 }),
        }
    }
  }

  private updateBounds(x: number, y: number): void {
    this.bounds.minX = Math.min(this.bounds.minX, x)
    this.bounds.minY = Math.min(this.bounds.minY, y)
    this.bounds.maxX = Math.max(this.bounds.maxX, x)
    this.bounds.maxY = Math.max(this.bounds.maxY, y)
  }
}

/**
 * Render a GerberFile to SVG string.
 */
export function renderGerberToSvg(
  gerber: GerberFile,
  options?: RenderOptions,
): string {
  return new GerberToSvg(options).render(gerber)
}
