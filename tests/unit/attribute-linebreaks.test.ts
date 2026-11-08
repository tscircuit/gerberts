import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  ApertureAttribute,
  FileAttribute,
  GerberFile,
  GerberNode,
  ObjectAttribute,
  parseGerber,
  parseGerberFile,
} from "../../lib/index.ts"

// Gerber 2026.05 section 3.1 permits CR and LF after a comma without
// changing the interpretation of the file.
for (const [prefix, Ctor, name, values] of [
  ["TF", FileAttribute, "FileFunction", ["Copper", "L1", "Top"]],
  ["TA", ApertureAttribute, "AperFunction", ["SMDPad", "CuDef"]],
  ["TO", ObjectAttribute, "P", ["U1", "1"]],
] as const) {
  for (const [label, newline] of [
    ["LF", "\n"],
    ["CR", "\r"],
    ["CRLF", "\r\n"],
  ] as const) {
    test(`${prefix} ignores ${label} after attribute value separators`, () => {
      const node = parseGerber(
        `%${prefix}.${name},${newline}${values.join(`,${newline}`)}*%`,
      )[0]

      expect(node).toBeInstanceOf(Ctor)
      expect((node as FileAttribute).name).toBe(name)
      expect((node as FileAttribute).values).toEqual([...values])
      expect(node?.getString()).toBe(`%${prefix}.${name},${values.join(",")}*%`)
    })
  }
}

test("keeps meaningful spaces, empty fields, Unicode and escaped newlines", () => {
  const node = GerberNode.parse(
    "%TO.N,\r\n  VCC ,\n,\r\nμ supply,\\u000A*%",
  ) as ObjectAttribute

  expect(node.values).toEqual(["  VCC ", "", "μ supply", "\\u000A"])
  expect(node.getString()).toBe("%TO.N,  VCC ,,μ supply,\\u000A*%")
})

test("preserves unwrapped attributes and attributes without values", () => {
  for (const source of [
    "%TF.Part,Single*%",
    "%TA.AperFunction,Conductor*%",
    "%TO.P,U1,1*%",
    "%TO.N*%",
    "%TO.N,*%",
    "%TO.N,,*%",
  ]) {
    expect(GerberNode.parse(source).getString()).toBe(source)
  }
})

test("wrapped attributes keep fixture metadata through a full-file round trip", () => {
  const source = readFileSync(
    join(import.meta.dir, "../fixtures/gerbers/with-attributes.gbr"),
    "utf-8",
  )
  const wrapped = source
    .split("\n")
    .map((line) =>
      /^%T[FAO]\./.test(line) ? line.replaceAll(",", ",\r\n") : line,
    )
    .join("\n")
  const file = parseGerberFile(wrapped)

  expect(file.fileAttributes.find((a) => a.name === "FileFunction")?.values).toEqual(
    ["Copper", "L1", "Top"],
  )
  expect(file.getString()).toBe(parseGerberFile(source).getString())
  expect(parseGerberFile(file.getString()).getString()).toBe(file.getString())
})

test("addCommand accepts wrapped file, aperture and object attributes", () => {
  const file = new GerberFile()
  file.addCommand("%TF.Part,\nSingle*%\n%TA.AperFunction,\r\nConductor*%")
  file.addCommand("%TO.P,\rU1,\r1*%")

  expect(file.getString()).toBe(
    "%TF.Part,Single*%\n%TA.AperFunction,Conductor*%\n%TO.P,U1,1*%\n",
  )
})
