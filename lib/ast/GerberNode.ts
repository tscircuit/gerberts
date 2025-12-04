/**
 * Base class for all Gerber AST nodes.
 * Provides common interface for tree navigation and serialization.
 */
export abstract class GerberNode {
  abstract readonly type: string

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
