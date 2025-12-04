/**
 * Base class for all Gerber AST nodes.
 * Provides common interface for tree navigation and serialization.
 */
export abstract class GerberNode {
  abstract readonly type: string

  /**
   * The gerber code token used for parsing (e.g., "D01", "D02", "D03", "G36")
   */
  static token?: string

  /**
   * Returns all direct child nodes for tree walking.
   */
  getChildren(): GerberNode[] {
    return []
  }

  /**
   * Serialize this node back to Gerber format.
   */
  abstract getString(): string

  // =========================================================================
  // Static registration and parsing
  // =========================================================================

  private static classes: Map<string, typeof GerberNode> = new Map()

  /**
   * Register a GerberNode subclass for parsing.
   * Classes with a static `token` property can be looked up by token.
   */
  static register(nodeClass: typeof GerberNode): void {
    if (!nodeClass.token) {
      throw new Error(
        `Class ${nodeClass.name} must have a static 'token' property to be registered`,
      )
    }
    GerberNode.classes.set(nodeClass.token, nodeClass)
  }

  /**
   * Get a registered class by its token.
   */
  static getRegisteredClass(token: string): typeof GerberNode | undefined {
    return GerberNode.classes.get(token)
  }

  /**
   * Parse a Gerber command string into a GerberNode.
   * This is a convenience method that uses the parser.
   */
  static parse(source: string): GerberNode {
    // Lazy import to avoid circular dependency
    const { parseGerber } = require("../parser/parser.ts")
    const nodes = parseGerber(source)
    if (nodes.length === 0) {
      throw new Error(`Failed to parse Gerber command: ${source}`)
    }
    if (nodes.length > 1) {
      throw new Error(`Expected single command, got ${nodes.length}: ${source}`)
    }
    return nodes[0]!
  }
}

/**
 * Represents an unknown/unrecognized command.
 * Preserves raw content for round-trip compatibility.
 */
export class UnknownCommand extends GerberNode {
  readonly type = "UnknownCommand"

  constructor(public readonly raw: string) {
    super()
  }

  getString(): string {
    return this.raw
  }
}
