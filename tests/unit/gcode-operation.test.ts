import { expect, test, describe } from "bun:test"
import {
  parseGerber,
  Interpolate,
  Move,
  SetInterpolationMode,
} from "../../lib/index.ts"

describe("G-code combined with coordinate operation", () => {
  test("G01X...D01 produces an Interpolate operation", () => {
    const nodes = parseGerber("G01X001000Y002000D01*")
    const ops = nodes.filter((n) => n instanceof Interpolate)
    expect(ops.length).toBe(1)
    expect(ops[0]).toMatchObject({ x: 1000, y: 2000 })
  })

  test("G1X...D01 and G01X...D01 parse the same way", () => {
    const short = parseGerber("G1X001000Y002000D01*")
    const long = parseGerber("G01X001000Y002000D01*")
    expect(short.filter((n) => n instanceof Interpolate).length).toBe(1)
    expect(long.filter((n) => n instanceof Interpolate).length).toBe(1)
  })

  test("G02X...Y...I...J...D01 produces an Interpolate with arc offsets", () => {
    const nodes = parseGerber("G02X1000Y2000I500J250D01*")
    const ops = nodes.filter((n) => n instanceof Interpolate)
    expect(ops.length).toBe(1)
    expect(ops[0]).toMatchObject({ x: 1000, y: 2000, i: 500, j: 250 })
  })

  test("G01X...D02 produces a Move operation", () => {
    const nodes = parseGerber("G01X005000Y006000D02*")
    const ops = nodes.filter((n) => n instanceof Move)
    expect(ops.length).toBe(1)
    expect(ops[0]).toMatchObject({ x: 5000, y: 6000 })
  })

  test("bare G01 still produces SetInterpolationMode", () => {
    const nodes = parseGerber("G01*")
    expect(nodes.length).toBe(1)
    expect(nodes[0]).toBeInstanceOf(SetInterpolationMode)
    expect((nodes[0] as SetInterpolationMode).mode).toBe("G01")
  })
})
