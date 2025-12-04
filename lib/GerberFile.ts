/**
 * Root class representing a complete Gerber file.
 * Provides parsing and serialization capabilities.
 */

import { GerberNode } from "./ast/GerberNode.ts"
import {
  FormatSpecification,
  UnitMode,
  ApertureDefinition,
  ApertureMacro,
  LoadPolarity,
  FileAttribute,
  ApertureAttribute,
  ObjectAttribute,
  Operation,
  Interpolate,
  Move,
  Flash,
  SelectAperture,
  Comment,
  RegionStart,
  RegionEnd,
  EndOfFile,
  SetInterpolationMode,
} from "./ast/commands.ts"
import { parseGerber } from "./parser/parser.ts"

export interface GerberFileInit {
  commands?: GerberNode[]
}

export class GerberFile extends GerberNode {
  readonly type = "GerberFile"

  commands: GerberNode[]

  constructor(init: GerberFileInit = {}) {
    super()
    this.commands = init.commands ?? []
  }

  /**
   * Parse a Gerber file from source text.
   */
  static override parse(source: string): GerberFile {
    const commands = parseGerber(source)
    return new GerberFile({ commands })
  }

  /**
   * Get all direct child nodes.
   */
  override getChildren(): GerberNode[] {
    return this.commands
  }

  /**
   * Serialize the Gerber file back to text.
   */
  getString(): string {
    return this.commands.map((cmd) => cmd.getString()).join("\n") + "\n"
  }

  // =========================================================================
  // Convenience accessors
  // =========================================================================

  /**
   * Get the format specification command.
   */
  get formatSpecification(): FormatSpecification | undefined {
    return this.commands.find(
      (cmd) => cmd.type === "FormatSpecification"
    ) as FormatSpecification | undefined
  }

  /**
   * Get the unit mode command.
   */
  get unitMode(): UnitMode | undefined {
    return this.commands.find((cmd) => cmd.type === "UnitMode") as
      | UnitMode
      | undefined
  }

  /**
   * Get all aperture definitions.
   */
  get apertureDefinitions(): ApertureDefinition[] {
    return this.commands.filter(
      (cmd) => cmd.type === "ApertureDefinition"
    ) as ApertureDefinition[]
  }

  /**
   * Get all aperture macros.
   */
  get apertureMacros(): ApertureMacro[] {
    return this.commands.filter(
      (cmd) => cmd.type === "ApertureMacro"
    ) as ApertureMacro[]
  }

  /**
   * Get all file attributes.
   */
  get fileAttributes(): FileAttribute[] {
    return this.commands.filter(
      (cmd) => cmd.type === "FileAttribute"
    ) as FileAttribute[]
  }

  /**
   * Get all operations (D01, D02, D03).
   */
  get operations(): Operation[] {
    return this.commands.filter((cmd) => cmd instanceof Operation) as Operation[]
  }

  /**
   * Get all comments.
   */
  get comments(): Comment[] {
    return this.commands.filter((cmd) => cmd.type === "Comment") as Comment[]
  }

  // =========================================================================
  // Convenience methods for adding commands
  // =========================================================================

  /**
   * Add a command to the file.
   * Accepts either a GerberNode instance or a Gerber command string.
   *
   * @example
   * // Using a GerberNode instance
   * gerber.addCommand(new Move({ x: 0, y: 0 }))
   *
   * // Using a string (parsed automatically)
   * gerber.addCommand("X0Y0D02*")
   *
   * // Using GerberNode.parse explicitly
   * gerber.addCommand(GerberNode.parse("X1000000Y1000000D01*"))
   */
  addCommand(command: GerberNode | string): void {
    if (typeof command === "string") {
      const parsed = parseGerber(command)
      for (const node of parsed) {
        this.commands.push(node)
      }
    } else {
      this.commands.push(command)
    }
  }

  /**
   * Add an aperture definition.
   */
  addApertureDefinition(aperture: ApertureDefinition): void {
    this.commands.push(aperture)
  }

  /**
   * Add an operation.
   */
  addOperation(operation: Operation): void {
    this.commands.push(operation)
  }

  /**
   * Ensure the file ends with M02.
   */
  ensureEndOfFile(): void {
    const hasEnd = this.commands.some((cmd) => cmd.type === "EndOfFile")
    if (!hasEnd) {
      this.commands.push(new EndOfFile())
    }
  }
}

/**
 * Parse a Gerber file from source text.
 * Convenience function that delegates to GerberFile.parse().
 */
export function parseGerberFile(source: string): GerberFile {
  return GerberFile.parse(source)
}
