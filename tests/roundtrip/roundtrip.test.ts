import { expect, test, describe } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { GerberFile, parseGerberFile } from "../../lib/index.ts"

const fixturesDir = join(import.meta.dir, "../fixtures/gerbers")

describe("roundtrip", () => {
  test("simple.gbr parses and serializes", () => {
    const source = readFileSync(join(fixturesDir, "simple.gbr"), "utf-8")
    const gerber = parseGerberFile(source)

    // Verify structure
    expect(gerber.formatSpecification).toBeDefined()
    expect(gerber.formatSpecification?.xIntegerDigits).toBe(2)
    expect(gerber.formatSpecification?.xDecimalDigits).toBe(6)

    expect(gerber.unitMode).toBeDefined()
    expect(gerber.unitMode?.unit).toBe("MM")

    expect(gerber.apertureDefinitions.length).toBe(3)
    expect(gerber.apertureDefinitions[0]?.code).toBe(10)
    expect(gerber.apertureDefinitions[0]?.template).toBe("C")

    expect(gerber.operations.length).toBeGreaterThan(0)

    // Verify serialization produces valid output
    const serialized = gerber.getString()
    expect(serialized).toContain("%FSLAX26Y26*%")
    expect(serialized).toContain("%MOMM*%")
    expect(serialized).toContain("D10*")
    expect(serialized).toContain("M02*")

    // Re-parse serialized output
    const reparsed = parseGerberFile(serialized)
    expect(reparsed.commands.length).toBe(gerber.commands.length)
  })

  test("with-attributes.gbr parses X2 attributes", () => {
    const source = readFileSync(join(fixturesDir, "with-attributes.gbr"), "utf-8")
    const gerber = parseGerberFile(source)

    // Verify file attributes
    expect(gerber.fileAttributes.length).toBe(4)

    const genSoftware = gerber.fileAttributes.find(
      (a) => a.name === "GenerationSoftware"
    )
    expect(genSoftware).toBeDefined()
    expect(genSoftware?.values).toEqual(["gerberts", "1.0.0"])

    const fileFunction = gerber.fileAttributes.find(
      (a) => a.name === "FileFunction"
    )
    expect(fileFunction).toBeDefined()
    expect(fileFunction?.values).toEqual(["Copper", "L1", "Top"])

    // Verify serialization
    const serialized = gerber.getString()
    expect(serialized).toContain("%TF.GenerationSoftware,gerberts,1.0.0*%")
    expect(serialized).toContain("%TF.FileFunction,Copper,L1,Top*%")
    expect(serialized).toContain("%TO.N,VCC*%")
  })

  test("GerberFile.parse() static method works", () => {
    const source = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,0.1*%
D10*
X0Y0D03*
M02*`

    const gerber = GerberFile.parse(source)
    expect(gerber.commands.length).toBe(6)
    expect(gerber.formatSpecification).toBeDefined()
    expect(gerber.apertureDefinitions.length).toBe(1)
  })
})
