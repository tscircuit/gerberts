import { expect, test, describe } from "bun:test"
import {
  tokenize,
  parseGerber,
  FormatSpecification,
  UnitMode,
  ApertureDefinition,
  Operation,
  SelectAperture,
  Comment,
  EndOfFile,
  FileAttribute,
  LoadPolarity,
  RegionStart,
  RegionEnd,
  SetInterpolationMode,
} from "../../lib/index.ts"

describe("tokenizer", () => {
  test("tokenizes extended commands", () => {
    const tokens = tokenize("%FSLAX26Y26*%")
    expect(tokens.length).toBe(2) // command + EOF
    expect(tokens[0]?.type).toBe("EXTENDED_COMMAND")
    expect(tokens[0]?.value).toBe("FSLAX26Y26*")
  })

  test("tokenizes regular commands", () => {
    const tokens = tokenize("D10*\nX1000Y2000D01*")
    expect(tokens.length).toBe(3) // 2 commands + EOF
    expect(tokens[0]?.type).toBe("COMMAND")
    expect(tokens[0]?.value).toBe("D10")
    expect(tokens[1]?.type).toBe("COMMAND")
    expect(tokens[1]?.value).toBe("X1000Y2000D01")
  })

  test("handles mixed content", () => {
    const source = `%MOMM*%
G04 Comment*
D10*
X0Y0D02*`
    const tokens = tokenize(source)
    expect(tokens.length).toBe(5) // 4 commands + EOF
  })
})

describe("parser", () => {
  test("parses format specification", () => {
    const nodes = parseGerber("%FSLAX26Y26*%")
    expect(nodes.length).toBe(1)
    expect(nodes[0]).toBeInstanceOf(FormatSpecification)

    const fs = nodes[0] as FormatSpecification
    expect(fs.zeroOmission).toBe("L")
    expect(fs.coordinateMode).toBe("A")
    expect(fs.xIntegerDigits).toBe(2)
    expect(fs.xDecimalDigits).toBe(6)
  })

  test("parses unit mode", () => {
    const mmNodes = parseGerber("%MOMM*%")
    expect(mmNodes[0]).toBeInstanceOf(UnitMode)
    expect((mmNodes[0] as UnitMode).unit).toBe("MM")

    const inNodes = parseGerber("%MOIN*%")
    expect((inNodes[0] as UnitMode).unit).toBe("IN")
  })

  test("parses aperture definitions", () => {
    const nodes = parseGerber("%ADD10C,0.5*%")
    expect(nodes[0]).toBeInstanceOf(ApertureDefinition)

    const ad = nodes[0] as ApertureDefinition
    expect(ad.code).toBe(10)
    expect(ad.template).toBe("C")
    expect(ad.params).toEqual([0.5])
  })

  test("parses aperture with multiple params", () => {
    const nodes = parseGerber("%ADD11R,1.0X0.5*%")
    const ad = nodes[0] as ApertureDefinition
    expect(ad.template).toBe("R")
    expect(ad.params).toEqual([1.0, 0.5])
  })

  test("parses load polarity", () => {
    const darkNodes = parseGerber("%LPD*%")
    expect(darkNodes[0]).toBeInstanceOf(LoadPolarity)
    expect((darkNodes[0] as LoadPolarity).polarity).toBe("D")

    const clearNodes = parseGerber("%LPC*%")
    expect((clearNodes[0] as LoadPolarity).polarity).toBe("C")
  })

  test("parses file attributes", () => {
    const nodes = parseGerber("%TF.Part,Single*%")
    expect(nodes[0]).toBeInstanceOf(FileAttribute)

    const attr = nodes[0] as FileAttribute
    expect(attr.name).toBe("Part")
    expect(attr.values).toEqual(["Single"])
  })

  test("parses comments", () => {
    const nodes = parseGerber("G04 This is a comment*")
    expect(nodes[0]).toBeInstanceOf(Comment)
    expect((nodes[0] as Comment).text).toBe("This is a comment")
  })

  test("parses aperture selection", () => {
    const nodes = parseGerber("D10*")
    expect(nodes[0]).toBeInstanceOf(SelectAperture)
    expect((nodes[0] as SelectAperture).code).toBe(10)
  })

  test("parses operations", () => {
    const moveNodes = parseGerber("X1000Y2000D02*")
    expect(moveNodes[0]).toBeInstanceOf(Operation)

    const move = moveNodes[0] as Operation
    expect(move.x).toBe(1000)
    expect(move.y).toBe(2000)
    expect(move.dcode).toBe("D02")

    const drawNodes = parseGerber("X5000D01*")
    const draw = drawNodes[0] as Operation
    expect(draw.x).toBe(5000)
    expect(draw.y).toBeUndefined()
    expect(draw.dcode).toBe("D01")
  })

  test("parses region mode", () => {
    const startNodes = parseGerber("G36*")
    expect(startNodes[0]).toBeInstanceOf(RegionStart)

    const endNodes = parseGerber("G37*")
    expect(endNodes[0]).toBeInstanceOf(RegionEnd)
  })

  test("parses interpolation modes", () => {
    const linearNodes = parseGerber("G01*")
    expect(linearNodes[0]).toBeInstanceOf(SetInterpolationMode)
    expect((linearNodes[0] as SetInterpolationMode).mode).toBe("G01")

    const cwNodes = parseGerber("G02*")
    expect((cwNodes[0] as SetInterpolationMode).mode).toBe("G02")

    const ccwNodes = parseGerber("G03*")
    expect((ccwNodes[0] as SetInterpolationMode).mode).toBe("G03")
  })

  test("parses end of file", () => {
    const nodes = parseGerber("M02*")
    expect(nodes[0]).toBeInstanceOf(EndOfFile)
  })
})
