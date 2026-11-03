/**
 * Gerber to SVG renderer.
 * Converts parsed Gerber files to SVG format for visualization.
 */

import {
  ApertureDefinition,
  FormatSpecification,
  LoadPolarity,
  Operation,
  RegionEnd,
  RegionStart,
  SelectAperture,
  SetInterpolationMode,
  type Unit,
  UnitMode,
} from "../ast/commands.ts"
import type { GerberNode } from "../ast/GerberNode.ts"
import type { GerberFile } from "../GerberFile.ts"

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

export class GerberToSvg {
  private state: RenderState
  private apertures: Map<number, Aperture> = new Map()
  private paths: string[] = []
  private flashes: string[] = []
  private regionPath = ""
  private regions: string[] = []
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
    // A renderer may be reused: no state from the previous file belongs here.
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
    this.apertures.clear()
    this.paths = []
    this.flashes = []
    this.regionPath = ""
    this.regions = []
    this.bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }

    // First pass: collect apertures and format info
    for (const cmd of gerber.commands) {
      this.processCommand(cmd)
    }

    // A file without coordinates still needs a valid, finite viewBox.
    if (this.bounds.minX === Infinity) {
      this.bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    }

    // Calculate viewBox
    const padding = this.options.padding
    let width = this.bounds.maxX - this.bounds.minX + padding * 2
    let height = this.bounds.maxY - this.bounds.minY + padding * 2
    let viewMinX = this.bounds.minX - padding
    let viewMinY = this.bounds.minY - padding
    // A point or straight line can have zero extent with zero padding.
    if (width === 0) {
      width = 1
      viewMinX -= 0.5
    }
    if (height === 0) {
      height = 1
      viewMinY -= 0.5
    }

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

    // Render regions first (they're usually filled areas)
    for (const region of this.regions) {
      svg += `    <path d="${region}" fill="${this.options.fillColor}" stroke="none" fill-rule="evenodd"/>\n`
    }

    // Render paths (traces)
    for (const path of this.paths) {
      svg += `    ${path}\n`
    }

    // Render flashes (pads)
    for (const flash of this.flashes) {
      svg += `    ${flash}\n`
    }

    svg += "  </g>\n"
    svg += "</svg>"

    return svg
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
      this.regionPath = ""
      return
    }

    if (cmd instanceof RegionEnd) {
      if (this.regionPath) {
        this.regions.push(this.regionPath + " Z")
      }
      this.state.regionMode = false
      this.regionPath = ""
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
          if (!this.regionPath) {
            this.regionPath = `M ${this.state.x} ${this.state.y}`
          }
          this.regionPath += ` L ${newX} ${newY}`
        } else if (this.state.aperture) {
          const strokeWidth = this.getApertureWidth()
          this.paths.push(
            `<line x1="${this.state.x}" y1="${this.state.y}" x2="${newX}" y2="${newY}" ` +
              `stroke="${this.options.strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
          )
        }
        break

      case "D02": // Move
        if (this.state.regionMode && this.regionPath) {
          this.regionPath += ` M ${newX} ${newY}`
        }
        break

      case "D03": // Flash
        if (this.state.aperture) {
          const flash = this.createFlash(newX, newY)
          if (flash) {
            this.flashes.push(flash)
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
    return value / 10 ** decimalDigits
  }

  private getApertureWidth(): number {
    if (!this.state.aperture) return 0.01
    const params = this.state.aperture.params
    if (params.length === 0) return 0.01
    return params[0] ?? 0.01
  }

  private createFlash(x: number, y: number): string | null {
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
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
      }

      case "R": {
        // Rectangle
        const width = ap.params[0] ?? 0.01
        const height = ap.params[1] ?? width
        const rx = x - width / 2
        const ry = y - height / 2
        this.updateBounds(rx, ry)
        this.updateBounds(rx + width, ry + height)
        return `<rect x="${rx}" y="${ry}" width="${width}" height="${height}" fill="${fill}"/>`
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
        return `<rect x="${rx}" y="${ry}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}"/>`
      }

      default:
        // For unknown apertures, draw a small circle
        return `<circle cx="${x}" cy="${y}" r="0.005" fill="${fill}"/>`
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
