import { describe, expect, test } from "bun:test"
import { GerberFile, EndOfFile, Flash, Move } from "../../lib/index.ts"

const sourceWithoutEnd = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,0.1*%
D10*
X0Y0D03*`
const source = `${sourceWithoutEnd}\nM02*`
const editedSource = `${sourceWithoutEnd}\nX1000000Y0D03*\nM02*\n`

describe("ensureEndOfFile", () => {
  test("terminates an empty document", () => {
    const gerber = new GerberFile()
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe("M02*\n")
  })

  test("appends a missing terminator without changing commands", () => {
    const gerber = GerberFile.parse(sourceWithoutEnd)
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe(`${source}\n`)
  })

  test("retains an already terminal marker on repeated calls", () => {
    const gerber = GerberFile.parse(source)
    const commands = gerber.commands
    const marker = commands.at(-1)
    gerber.ensureEndOfFile()
    gerber.ensureEndOfFile()
    expect(gerber.commands).toBe(commands)
    expect(gerber.commands.at(-1)).toBe(marker)
    expect(gerber.getString()).toBe(`${source}\n`)
  })

  test("moves the terminator after an appended command string", () => {
    const gerber = GerberFile.parse(source)
    gerber.addCommand("X1000000Y0D03*")
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe(editedSource)
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe(editedSource)
  })

  test("moves the terminator after an appended operation object", () => {
    const gerber = GerberFile.parse(source)
    const flash = new Flash({ x: 1000000, y: 0 })
    gerber.addOperation(flash)
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe(editedSource)
    expect(gerber.commands.at(-2)).toBe(flash)
  })

  test("repairs a terminator before a constructed operation", () => {
    const gerber = new GerberFile({
      commands: [new EndOfFile(), new Move({ x: 0, y: 0 })],
    })
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe("X0Y0D02*\nM02*\n")
  })

  test("can terminate again after the document is edited", () => {
    const gerber = new GerberFile()
    gerber.ensureEndOfFile()
    gerber.addCommand(new Flash({ x: 1000000, y: 0 }))
    gerber.ensureEndOfFile()
    expect(gerber.getString()).toBe("X1000000Y0D03*\nM02*\n")
  })

  test("keeps one final marker and preserves shared command array order", () => {
    const marker = new EndOfFile()
    const move = new Move({ x: 0, y: 0 })
    const flash = new Flash({ x: 1000000, y: 0 })
    const commands = [marker, move, new EndOfFile(), flash, new EndOfFile()]
    const gerber = new GerberFile({ commands })
    gerber.ensureEndOfFile()
    expect(gerber.commands).toBe(commands)
    expect(commands).toEqual([move, flash, marker])
    expect(gerber.getString()).toBe("X0Y0D02*\nX1000000Y0D03*\nM02*\n")
  })
})
