/**
 * Gerber tokenizer - breaks raw Gerber text into tokens.
 */

export type TokenType =
  | "EXTENDED_COMMAND" // %...%
  | "COMMAND" // Everything ending with *
  | "WHITESPACE"
  | "NEWLINE"
  | "EOF"

export interface Token {
  type: TokenType
  value: string
  line: number
  column: number
}

export class Tokenizer {
  private pos = 0
  private line = 1
  private column = 1
  private source: string

  constructor(source: string) {
    this.source = source
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? ""
  }

  private advance(): string {
    const char = this.source[this.pos] ?? ""
    this.pos++
    if (char === "\n") {
      this.line++
      this.column = 1
    } else {
      this.column++
    }
    return char
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length
  }

  private readUntil(terminator: string): string {
    let result = ""
    while (!this.isAtEnd() && this.peek() !== terminator) {
      result += this.advance()
    }
    return result
  }

  private readExtendedCommand(): Token {
    const startLine = this.line
    const startColumn = this.column

    this.advance() // consume opening %
    let value = ""

    while (!this.isAtEnd()) {
      const char = this.advance()
      if (char === "%") {
        break
      }
      value += char
    }

    return {
      type: "EXTENDED_COMMAND",
      value,
      line: startLine,
      column: startColumn,
    }
  }

  private readCommand(): Token {
    const startLine = this.line
    const startColumn = this.column
    let value = ""

    while (!this.isAtEnd()) {
      const char = this.advance()
      value += char
      if (char === "*") {
        break
      }
    }

    return {
      type: "COMMAND",
      value: value.slice(0, -1), // remove trailing *
      line: startLine,
      column: startColumn,
    }
  }

  private skipWhitespaceAndNewlines(): void {
    while (!this.isAtEnd()) {
      const char = this.peek()
      if (char === " " || char === "\t" || char === "\r" || char === "\n") {
        this.advance()
      } else {
        break
      }
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = []

    while (!this.isAtEnd()) {
      this.skipWhitespaceAndNewlines()

      if (this.isAtEnd()) break

      const char = this.peek()

      if (char === "%") {
        tokens.push(this.readExtendedCommand())
      } else {
        tokens.push(this.readCommand())
      }
    }

    tokens.push({
      type: "EOF",
      value: "",
      line: this.line,
      column: this.column,
    })

    return tokens
  }
}

export function tokenize(source: string): Token[] {
  return new Tokenizer(source).tokenize()
}
