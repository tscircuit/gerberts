/**
 * Gerber parser - converts tokens into AST nodes.
 */

import { GerberNode, UnknownCommand } from "../ast/GerberNode.ts"
import {
  FormatSpecification,
  UnitMode,
  ApertureDefinition,
  ApertureMacro,
  LoadPolarity,
  LoadMirroring,
  LoadRotation,
  LoadScaling,
  StepRepeat,
  FileAttribute,
  ApertureAttribute,
  ObjectAttribute,
  DeleteAttribute,
  SetInterpolationMode,
  Comment,
  RegionStart,
  RegionEnd,
  createOperation,
  SelectAperture,
  EndOfFile,
  SetImagePolarity,
  SetOffset,
  type Unit,
  type ZeroOmission,
  type CoordinateMode,
  type Polarity,
  type Mirroring,
  type InterpolationMode,
  type DCode,
  type ImagePolarity,
} from "../ast/commands.ts"
import { tokenize, type Token } from "./tokenizer.ts"

export class Parser {
  private tokens: Token[] = []
  private pos = 0

  constructor(source: string) {
    this.tokens = tokenize(source)
  }

  private peek(): Token {
    return (
      this.tokens[this.pos] ?? { type: "EOF", value: "", line: 0, column: 0 }
    )
  }

  private advance(): Token {
    const token = this.peek()
    this.pos++
    return token
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF"
  }

  parse(): GerberNode[] {
    const nodes: GerberNode[] = []

    while (!this.isAtEnd()) {
      const token = this.advance()
      const node = this.parseToken(token)
      if (node) {
        nodes.push(node)
      }
    }

    return nodes
  }

  private parseToken(token: Token): GerberNode | null {
    if (token.type === "EXTENDED_COMMAND") {
      return this.parseExtendedCommand(token.value)
    }

    if (token.type === "COMMAND") {
      return this.parseCommand(token.value)
    }

    return null
  }

  private parseExtendedCommand(value: string): GerberNode {
    // Remove trailing * if present
    const content = value.endsWith("*") ? value.slice(0, -1) : value

    // Format Specification: FSLAX24Y24
    if (content.startsWith("FS")) {
      return this.parseFormatSpec(content)
    }

    // Unit Mode: MOMM or MOIN
    if (content.startsWith("MO")) {
      const unit = content.slice(2) as Unit
      return new UnitMode(unit)
    }

    // Aperture Definition: ADD10C,0.5
    if (content.startsWith("AD")) {
      return this.parseApertureDefinition(content)
    }

    // Aperture Macro: AMname*content
    if (content.startsWith("AM")) {
      return this.parseApertureMacro(content)
    }

    // Load Polarity: LPD or LPC
    if (content.startsWith("LP")) {
      const polarity = content.slice(2) as Polarity
      return new LoadPolarity(polarity)
    }

    // Load Mirroring: LMN, LMX, LMY, LMXY
    if (content.startsWith("LM")) {
      const mirroring = content.slice(2) as Mirroring
      return new LoadMirroring(mirroring)
    }

    // Load Rotation: LR45
    if (content.startsWith("LR")) {
      const angle = parseFloat(content.slice(2))
      return new LoadRotation(angle)
    }

    // Load Scaling: LS1.5
    if (content.startsWith("LS")) {
      const scale = parseFloat(content.slice(2))
      return new LoadScaling(scale)
    }

    // Step and Repeat: SRX2Y3I1.0J1.5
    if (content.startsWith("SR")) {
      return this.parseStepRepeat(content)
    }

    // File Attribute: TF.Part,Single
    if (content.startsWith("TF.")) {
      return this.parseAttribute(content, "TF.", FileAttribute)
    }

    // Aperture Attribute: TA.AperFunction,Conductor
    if (content.startsWith("TA.")) {
      return this.parseAttribute(content, "TA.", ApertureAttribute)
    }

    // Object Attribute: TO.N,net_name
    if (content.startsWith("TO.")) {
      return this.parseAttribute(content, "TO.", ObjectAttribute)
    }

    // Delete Attribute: TD or TD.name
    if (content.startsWith("TD")) {
      const rest = content.slice(2)
      if (rest.startsWith(".")) {
        return new DeleteAttribute(rest.slice(1))
      }
      return new DeleteAttribute()
    }

    // Legacy: Image Polarity: IPPOS or IPNEG
    if (content.startsWith("IP")) {
      const polarity = content.slice(2) as ImagePolarity
      return new SetImagePolarity(polarity)
    }

    // Legacy: Offset: OFA0B0
    if (content.startsWith("OF")) {
      const aMatch = content.match(/A([+-]?\d*\.?\d+)/)
      const bMatch = content.match(/B([+-]?\d*\.?\d+)/)
      return new SetOffset(
        aMatch ? parseFloat(aMatch[1]!) : 0,
        bMatch ? parseFloat(bMatch[1]!) : 0,
      )
    }

    // Unknown extended command
    return new UnknownCommand(`%${value}%`)
  }

  private parseFormatSpec(content: string): FormatSpecification {
    // FSLAX24Y24 or FSTAX34Y34 etc.
    const rest = content.slice(2)

    const zeroOmission = rest[0] as ZeroOmission
    const coordinateMode = rest[1] as CoordinateMode

    // Parse X and Y format
    const xMatch = rest.match(/X(\d)(\d)/)
    const yMatch = rest.match(/Y(\d)(\d)/)

    return new FormatSpecification({
      zeroOmission,
      coordinateMode,
      xIntegerDigits: xMatch ? parseInt(xMatch[1]!, 10) : 2,
      xDecimalDigits: xMatch ? parseInt(xMatch[2]!, 10) : 6,
      yIntegerDigits: yMatch ? parseInt(yMatch[1]!, 10) : 2,
      yDecimalDigits: yMatch ? parseInt(yMatch[2]!, 10) : 6,
    })
  }

  private parseApertureDefinition(content: string): ApertureDefinition {
    // ADD10C,0.5 or ADD11R,0.5X0.3
    const match = content.match(/^ADD(\d+)([A-Za-z_][A-Za-z0-9_]*)(?:,(.*))?$/)

    if (!match) {
      return new ApertureDefinition({ code: 10, template: "C" })
    }

    const code = parseInt(match[1]!, 10)
    const template = match[2]!
    const paramsStr = match[3]

    let params: number[] = []
    if (paramsStr) {
      params = paramsStr.split("X").map((p) => parseFloat(p))
    }

    return new ApertureDefinition({ code, template, params })
  }

  private parseApertureMacro(content: string): ApertureMacro {
    // AMname*content or AMname*content*
    const firstStar = content.indexOf("*")
    if (firstStar === -1) {
      const name = content.slice(2)
      return new ApertureMacro({ name, content: "" })
    }

    const name = content.slice(2, firstStar)
    let macroContent = content.slice(firstStar + 1)

    // Remove trailing * if present
    if (macroContent.endsWith("*")) {
      macroContent = macroContent.slice(0, -1)
    }

    return new ApertureMacro({ name, content: macroContent })
  }

  private parseStepRepeat(content: string): StepRepeat {
    // SR or SRX2Y3I1.0J1.5
    const rest = content.slice(2)

    if (!rest || rest === "") {
      return new StepRepeat()
    }

    const xMatch = rest.match(/X(\d+)/)
    const yMatch = rest.match(/Y(\d+)/)
    const iMatch = rest.match(/I([+-]?\d*\.?\d+)/)
    const jMatch = rest.match(/J([+-]?\d*\.?\d+)/)

    return new StepRepeat({
      x: xMatch ? parseInt(xMatch[1]!, 10) : 1,
      y: yMatch ? parseInt(yMatch[1]!, 10) : 1,
      i: iMatch ? parseFloat(iMatch[1]!) : 0,
      j: jMatch ? parseFloat(jMatch[1]!) : 0,
    })
  }

  private parseAttribute<T extends GerberNode>(
    content: string,
    prefix: string,
    Ctor: new (name: string, values: string[]) => T,
  ): T {
    const rest = content.slice(prefix.length)
    const parts = rest.split(",")
    const name = parts[0] ?? ""
    const values = parts.slice(1)
    return new Ctor(name, values)
  }

  private parseCommand(value: string): GerberNode {
    // G-codes
    if (value.startsWith("G01") || value === "G1") {
      return new SetInterpolationMode("G01")
    }
    if (value.startsWith("G02") || value === "G2") {
      return new SetInterpolationMode("G02")
    }
    if (value.startsWith("G03") || value === "G3") {
      return new SetInterpolationMode("G03")
    }
    if (value.startsWith("G74")) {
      return new SetInterpolationMode("G74")
    }
    if (value.startsWith("G75")) {
      return new SetInterpolationMode("G75")
    }

    // Comment: G04 text
    if (value.startsWith("G04") || value.startsWith("G4")) {
      const text = value.replace(/^G0?4\s*/, "")
      return new Comment(text)
    }

    // Region mode
    if (value === "G36") {
      return new RegionStart()
    }
    if (value === "G37") {
      return new RegionEnd()
    }

    // End of file
    if (
      value === "M02" ||
      value === "M00" ||
      value === "M2" ||
      value === "M0"
    ) {
      return new EndOfFile()
    }

    // Aperture selection: D10, D11, etc.
    const apertureMatch = value.match(/^D(\d+)$/)
    if (apertureMatch) {
      const code = parseInt(apertureMatch[1]!, 10)
      if (code >= 10) {
        return new SelectAperture(code)
      }
    }

    // Operation with coordinates: X1000Y2000D01, X500D02, Y300D03
    const operationMatch = value.match(
      /^(X[+-]?\d+)?(Y[+-]?\d+)?(I[+-]?\d+)?(J[+-]?\d+)?(D0?[123])$/,
    )
    if (operationMatch) {
      return this.parseOperation(value)
    }

    // Coordinate with G-code: G01X1000Y2000D01
    const gCodeOperationMatch = value.match(
      /^G0?[123](X[+-]?\d+)?(Y[+-]?\d+)?(I[+-]?\d+)?(J[+-]?\d+)?(D0?[123])?$/,
    )
    if (gCodeOperationMatch) {
      return this.parseGCodeOperation(value)
    }

    // Unknown command
    return new UnknownCommand(`${value}*`)
  }

  private parseOperation(value: string): GerberNode {
    const xMatch = value.match(/X([+-]?\d+)/)
    const yMatch = value.match(/Y([+-]?\d+)/)
    const iMatch = value.match(/I([+-]?\d+)/)
    const jMatch = value.match(/J([+-]?\d+)/)
    const dMatch = value.match(/D0?([123])/)

    const dcode = `D0${dMatch?.[1] ?? "1"}` as DCode

    return createOperation(dcode, {
      x: xMatch ? parseInt(xMatch[1]!, 10) : undefined,
      y: yMatch ? parseInt(yMatch[1]!, 10) : undefined,
      i: iMatch ? parseInt(iMatch[1]!, 10) : undefined,
      j: jMatch ? parseInt(jMatch[1]!, 10) : undefined,
    })
  }

  private parseGCodeOperation(value: string): GerberNode {
    // Extract G-code first
    const gMatch = value.match(/^G0?([123])/)
    const mode = `G0${gMatch?.[1]}` as InterpolationMode

    // Check if there's coordinate data after
    const rest = value.replace(/^G0?[123]/, "")

    if (!rest) {
      return new SetInterpolationMode(mode)
    }

    // Parse as operation
    const xMatch = rest.match(/X([+-]?\d+)/)
    const yMatch = rest.match(/Y([+-]?\d+)/)
    const iMatch = rest.match(/I([+-]?\d+)/)
    const jMatch = rest.match(/J([+-]?\d+)/)
    const dMatch = rest.match(/D0?([123])/)

    // If there's a D-code, create an operation
    if (dMatch) {
      const dcode = `D0${dMatch[1]}` as DCode
      return createOperation(dcode, {
        x: xMatch ? parseInt(xMatch[1]!, 10) : undefined,
        y: yMatch ? parseInt(yMatch[1]!, 10) : undefined,
        i: iMatch ? parseInt(iMatch[1]!, 10) : undefined,
        j: jMatch ? parseInt(jMatch[1]!, 10) : undefined,
      })
    }

    // Just coordinates without D-code - return interpolation mode
    return new SetInterpolationMode(mode)
  }
}

export function parseGerber(source: string): GerberNode[] {
  return new Parser(source).parse()
}
