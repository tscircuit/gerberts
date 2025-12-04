import { GerberNode } from "./GerberNode.ts"

// ============================================================================
// Coordinate Types
// ============================================================================

export interface Coordinate {
  x?: number
  y?: number
  i?: number
  j?: number
}

export type CoordinateInput = Coordinate | [number, number]

export function normalizeCoordinate(input: CoordinateInput): Coordinate {
  if (Array.isArray(input)) {
    return { x: input[0], y: input[1] }
  }
  return input
}

// ============================================================================
// Format Specification (FS)
// ============================================================================

export type ZeroOmission = "L" | "T" // Leading or Trailing
export type CoordinateMode = "A" | "I" // Absolute or Incremental

export interface FormatSpecInit {
  zeroOmission?: ZeroOmission
  coordinateMode?: CoordinateMode
  xIntegerDigits?: number
  xDecimalDigits?: number
  yIntegerDigits?: number
  yDecimalDigits?: number
}

export class FormatSpecification extends GerberNode {
  readonly type = "FormatSpecification"

  zeroOmission: ZeroOmission
  coordinateMode: CoordinateMode
  xIntegerDigits: number
  xDecimalDigits: number
  yIntegerDigits: number
  yDecimalDigits: number

  constructor(init: FormatSpecInit = {}) {
    super()
    this.zeroOmission = init.zeroOmission ?? "L"
    this.coordinateMode = init.coordinateMode ?? "A"
    this.xIntegerDigits = init.xIntegerDigits ?? 2
    this.xDecimalDigits = init.xDecimalDigits ?? 6
    this.yIntegerDigits = init.yIntegerDigits ?? 2
    this.yDecimalDigits = init.yDecimalDigits ?? 6
  }

  getString(): string {
    return `%FS${this.zeroOmission}${this.coordinateMode}X${this.xIntegerDigits}${this.xDecimalDigits}Y${this.yIntegerDigits}${this.yDecimalDigits}*%`
  }
}

// ============================================================================
// Unit Mode (MO)
// ============================================================================

export type Unit = "MM" | "IN"

export class UnitMode extends GerberNode {
  readonly type = "UnitMode"

  constructor(public unit: Unit) {
    super()
  }

  getString(): string {
    return `%MO${this.unit}*%`
  }
}

// ============================================================================
// Aperture Definition (AD)
// ============================================================================

export type ApertureTemplate = "C" | "R" | "O" | "P" | string

export interface ApertureDefinitionInit {
  code: number
  template: ApertureTemplate
  params?: number[]
}

export class ApertureDefinition extends GerberNode {
  readonly type = "ApertureDefinition"

  code: number
  template: ApertureTemplate
  params: number[]

  constructor(init: ApertureDefinitionInit) {
    super()
    this.code = init.code
    this.template = init.template
    this.params = init.params ?? []
  }

  getString(): string {
    const paramsStr =
      this.params.length > 0 ? `,${this.params.join("X")}` : ""
    return `%ADD${this.code}${this.template}${paramsStr}*%`
  }
}

// ============================================================================
// Aperture Macro (AM)
// ============================================================================

export interface ApertureMacroInit {
  name: string
  content: string
}

export class ApertureMacro extends GerberNode {
  readonly type = "ApertureMacro"

  name: string
  content: string

  constructor(init: ApertureMacroInit) {
    super()
    this.name = init.name
    this.content = init.content
  }

  getString(): string {
    return `%AM${this.name}*${this.content}%`
  }
}

// ============================================================================
// Load Polarity (LP)
// ============================================================================

export type Polarity = "D" | "C" // Dark or Clear

export class LoadPolarity extends GerberNode {
  readonly type = "LoadPolarity"

  constructor(public polarity: Polarity) {
    super()
  }

  getString(): string {
    return `%LP${this.polarity}*%`
  }
}

// ============================================================================
// Load Mirroring (LM)
// ============================================================================

export type Mirroring = "N" | "X" | "Y" | "XY"

export class LoadMirroring extends GerberNode {
  readonly type = "LoadMirroring"

  constructor(public mirroring: Mirroring) {
    super()
  }

  getString(): string {
    return `%LM${this.mirroring}*%`
  }
}

// ============================================================================
// Load Rotation (LR)
// ============================================================================

export class LoadRotation extends GerberNode {
  readonly type = "LoadRotation"

  constructor(public angle: number) {
    super()
  }

  getString(): string {
    return `%LR${this.angle}*%`
  }
}

// ============================================================================
// Load Scaling (LS)
// ============================================================================

export class LoadScaling extends GerberNode {
  readonly type = "LoadScaling"

  constructor(public scale: number) {
    super()
  }

  getString(): string {
    return `%LS${this.scale}*%`
  }
}

// ============================================================================
// Step and Repeat (SR)
// ============================================================================

export interface StepRepeatInit {
  x?: number
  y?: number
  i?: number
  j?: number
}

export class StepRepeat extends GerberNode {
  readonly type = "StepRepeat"

  x: number
  y: number
  i: number
  j: number

  constructor(init: StepRepeatInit = {}) {
    super()
    this.x = init.x ?? 1
    this.y = init.y ?? 1
    this.i = init.i ?? 0
    this.j = init.j ?? 0
  }

  getString(): string {
    if (this.x === 1 && this.y === 1 && this.i === 0 && this.j === 0) {
      return "%SR*%"
    }
    return `%SRX${this.x}Y${this.y}I${this.i}J${this.j}*%`
  }
}

// ============================================================================
// Attribute Commands (TF, TA, TO, TD)
// ============================================================================

export class FileAttribute extends GerberNode {
  readonly type = "FileAttribute"

  constructor(
    public name: string,
    public values: string[] = []
  ) {
    super()
  }

  getString(): string {
    const valuesStr = this.values.length > 0 ? `,${this.values.join(",")}` : ""
    return `%TF.${this.name}${valuesStr}*%`
  }
}

export class ApertureAttribute extends GerberNode {
  readonly type = "ApertureAttribute"

  constructor(
    public name: string,
    public values: string[] = []
  ) {
    super()
  }

  getString(): string {
    const valuesStr = this.values.length > 0 ? `,${this.values.join(",")}` : ""
    return `%TA.${this.name}${valuesStr}*%`
  }
}

export class ObjectAttribute extends GerberNode {
  readonly type = "ObjectAttribute"

  constructor(
    public name: string,
    public values: string[] = []
  ) {
    super()
  }

  getString(): string {
    const valuesStr = this.values.length > 0 ? `,${this.values.join(",")}` : ""
    return `%TO.${this.name}${valuesStr}*%`
  }
}

export class DeleteAttribute extends GerberNode {
  readonly type = "DeleteAttribute"

  constructor(public name?: string) {
    super()
  }

  getString(): string {
    return this.name ? `%TD.${this.name}*%` : "%TD*%"
  }
}

// ============================================================================
// G-Codes (Graphic State Commands)
// ============================================================================

export type InterpolationMode = "G01" | "G02" | "G03" | "G74" | "G75"

export class SetInterpolationMode extends GerberNode {
  readonly type = "SetInterpolationMode"

  constructor(public mode: InterpolationMode) {
    super()
  }

  getString(): string {
    return `${this.mode}*`
  }
}

export class Comment extends GerberNode {
  readonly type = "Comment"

  constructor(public text: string) {
    super()
  }

  getString(): string {
    return `G04 ${this.text}*`
  }
}

export class RegionStart extends GerberNode {
  readonly type = "RegionStart"

  getString(): string {
    return "G36*"
  }
}

export class RegionEnd extends GerberNode {
  readonly type = "RegionEnd"

  getString(): string {
    return "G37*"
  }
}

// ============================================================================
// D-Codes (Operation Commands)
// ============================================================================

export type DCode = "D01" | "D02" | "D03"

export interface CoordinateInit {
  x?: number
  y?: number
  i?: number
  j?: number
}

/**
 * Base class for D-code operations.
 */
export abstract class Operation extends GerberNode {
  x?: number
  y?: number
  i?: number
  j?: number

  abstract readonly dcode: DCode

  constructor(init: CoordinateInit = {}) {
    super()
    this.x = init.x
    this.y = init.y
    this.i = init.i
    this.j = init.j
  }

  getString(): string {
    let str = ""
    if (this.x !== undefined) str += `X${this.x}`
    if (this.y !== undefined) str += `Y${this.y}`
    if (this.i !== undefined) str += `I${this.i}`
    if (this.j !== undefined) str += `J${this.j}`
    str += `${this.dcode}*`
    return str
  }
}

/**
 * D01 - Interpolate (draw) operation.
 * Creates a line or arc from the current position to the specified coordinates.
 */
export class Interpolate extends Operation {
  readonly type = "Interpolate"
  readonly dcode = "D01" as const
  static override token = "D01"
}
GerberNode.register(Interpolate)

/**
 * D02 - Move operation.
 * Moves to the specified coordinates without drawing.
 */
export class Move extends Operation {
  readonly type = "Move"
  readonly dcode = "D02" as const
  static override token = "D02"
}
GerberNode.register(Move)

/**
 * D03 - Flash operation.
 * Flashes the current aperture at the specified coordinates.
 */
export class Flash extends Operation {
  readonly type = "Flash"
  readonly dcode = "D03" as const
  static override token = "D03"
}
GerberNode.register(Flash)

/**
 * Factory function to create the appropriate Operation subclass from a DCode.
 */
export function createOperation(
  dcode: DCode,
  init: CoordinateInit = {}
): Operation {
  switch (dcode) {
    case "D01":
      return new Interpolate(init)
    case "D02":
      return new Move(init)
    case "D03":
      return new Flash(init)
  }
}

// ============================================================================
// Aperture Selection (Dnn where nn >= 10)
// ============================================================================

export class SelectAperture extends GerberNode {
  readonly type = "SelectAperture"

  constructor(public code: number) {
    super()
    if (code < 10) {
      throw new Error(`Aperture code must be >= 10, got ${code}`)
    }
  }

  getString(): string {
    return `D${this.code}*`
  }
}

// ============================================================================
// End of File (M02)
// ============================================================================

export class EndOfFile extends GerberNode {
  readonly type = "EndOfFile"

  getString(): string {
    return "M02*"
  }
}

// ============================================================================
// Legacy Commands (deprecated but still found in older files)
// ============================================================================

export type ImagePolarity = "POS" | "NEG"

export class SetImagePolarity extends GerberNode {
  readonly type = "SetImagePolarity"

  constructor(public polarity: ImagePolarity) {
    super()
  }

  getString(): string {
    return `%IP${this.polarity}*%`
  }
}

export class SetOffset extends GerberNode {
  readonly type = "SetOffset"

  constructor(
    public a: number = 0,
    public b: number = 0
  ) {
    super()
  }

  getString(): string {
    return `%OFA${this.a}B${this.b}*%`
  }
}
