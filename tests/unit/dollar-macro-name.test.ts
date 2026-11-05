import { expect, test } from "bun:test"
import {
  ApertureDefinition,
  GerberFile,
  parseGerber,
  parseGerberFile,
} from "../../lib/index.ts"

// Gerber 2026.05 section 3.4.5: user_name = /[_a-zA-Z$][_a-zA-Z0-9]*/.
for (const name of ["$", "$PAD", "$1", "$_Pad12"]) {
  for (const params of [[], [0.5, 1.25]]) {
    test(`preserves aperture macro ${name} with ${params.length} parameters`, () => {
      const original = new ApertureDefinition({ code: 23, template: name, params })
      const parsed = parseGerber(original.getString())[0] as ApertureDefinition

      expect(parsed).toBeInstanceOf(ApertureDefinition)
      expect(parsed.code).toBe(23)
      expect(parsed.template).toBe(name)
      expect(parsed.params).toEqual(params)
      expect(parsed.getString()).toBe(original.getString())
    })
  }
}

for (const name of ["C", "PAD", "_Pad12"]) {
  test(`continues to parse existing aperture name ${name}`, () => {
    const source = `%ADD23${name},0.5*%`
    const parsed = parseGerber(source)[0] as ApertureDefinition

    expect(parsed.code).toBe(23)
    expect(parsed.template).toBe(name)
    expect(parsed.params).toEqual([0.5])
    expect(parsed.getString()).toBe(source)
  })
}

test("keeps dollar-prefixed aperture definitions bound to their macro", () => {
  const source = [
    "%FSLAX26Y26*%",
    "%MOMM*%",
    "%AM$PAD*1,1,$1,0,0*%",
    "%ADD23$PAD,0.5*%",
    "D23*",
    "X0Y0D03*",
    "M02*",
  ].join("\n")
  const file = parseGerberFile(source)
  const aperture = file.apertureDefinitions[0]!

  expect(file.apertureMacros[0]?.name).toBe("$PAD")
  expect(aperture.code).toBe(23)
  expect(aperture.template).toBe(file.apertureMacros[0]?.name)
  expect(aperture.params).toEqual([0.5])
  expect(file.getString()).toContain("%ADD23$PAD,0.5*%")
  expect(parseGerberFile(file.getString()).apertureDefinitions[0]?.template).toBe(
    "$PAD",
  )
})

test("accepts a dollar-prefixed aperture through addCommand", () => {
  const file = new GerberFile()
  file.addCommand("%ADD42$PAD,0.75*%")

  expect(file.apertureDefinitions[0]?.code).toBe(42)
  expect(file.apertureDefinitions[0]?.template).toBe("$PAD")
  expect(file.getString()).toBe("%ADD42$PAD,0.75*%\n")
})
