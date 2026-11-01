import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ApertureMacro, parseGerberFile } from "../../lib/index.ts"

test("preserves the aperture macro in the existing copper fixture", () => {
  const source = readFileSync(
    join(import.meta.dir, "../fixtures/gerbers/top_copper.GTL"),
    "utf-8",
  )
  const gerber = parseGerberFile(source)
  const macro = gerber.apertureMacros.find((macro) => macro.name === "OC8")
  expect(macro?.content).toBe("5,1,8,0,0,1.08239,22.5")
  expect(macro?.getString()).toBe("%AMOC8*5,1,8,0,0,1.08239,22.5*%")
  const serialized = gerber.getString()
  expect(serialized).toContain("%AMOC8*5,1,8,0,0,1.08239,22.5*%")
  const reparsed = parseGerberFile(serialized)
  expect(reparsed.apertureMacros[0]?.content).toBe(macro?.content)
  expect(reparsed.getString()).toBe(serialized)
})

test("terminates constructed macro bodies without duplicating existing terminators", () => {
  for (const [content, expected] of [
    ["1,1,0.5,0,0", "%AMPAD*1,1,0.5,0,0*%"],
    ["1,1,0.5,0,0*", "%AMPAD*1,1,0.5,0,0*%"],
    ["$1=0.5*1,1,$1,0,0", "%AMPAD*$1=0.5*1,1,$1,0,0*%"],
  ] as const) {
    const macro = new ApertureMacro({ name: "PAD", content })
    expect(macro.getString()).toBe(expected)
  }
})

test("preserves a multiline macro with whitespace after its final terminator", () => {
  const source = "%AMPAD*\n1,1,0.5,0,0*\n%\n"
  expect(parseGerberFile(source).getString()).toBe(source)
})
