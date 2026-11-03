import { expect, test } from "bun:test"
import {
  DeleteAttribute,
  GerberFile,
  GerberNode,
  parseGerber,
  parseGerberFile,
} from "../../lib/index.ts"

test("preserves named user-attribute deletion without clearing all attributes", () => {
  for (const source of [
    "%TDIAmATA*%",
    "%TDCustAttr*%",
    "%TDa_b*%",
    "%TDMyAttr*%",
    "%TDmyattr*%",
  ]) {
    const nodes = parseGerber(source)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.getString()).toBe(source)
  }
})

test("keeps standard attribute deletion typed and named", () => {
  const nodes = parseGerber("%TD.AperFunction*%\n%TD.N*%")
  expect(nodes).toHaveLength(2)
  expect(nodes[0]).toBeInstanceOf(DeleteAttribute)
  expect(nodes[1]).toBeInstanceOf(DeleteAttribute)
  expect(nodes[0]?.getString()).toBe("%TD.AperFunction*%")
  expect(nodes[1]?.getString()).toBe("%TD.N*%")
})

test("keeps bare TD as delete-all", () => {
  const nodes = parseGerber("%TD*%")
  expect(nodes).toHaveLength(1)
  expect(nodes[0]).toBeInstanceOf(DeleteAttribute)
  expect(nodes[0]?.getString()).toBe("%TD*%")
})

test("round-trips selective deletion among standard and user attributes", () => {
  const source = [
    "%FSLAX26Y26*%",
    "%MOMM*%",
    "%TFCustomFile,Yes*%",
    "%TA.AperFunction,Conductor*%",
    "%TAIAmATA,1*%",
    "%TOCustomObject,2*%",
    "%TDIAmATA*%",
    "%ADD10C,0.5*%",
    "D10*",
    "X0Y0D03*",
    "%TDCustomObject*%",
    "%TD*%",
    "M02*",
    "",
  ].join("\n")
  const serialized = parseGerberFile(source).getString()
  expect(serialized).toBe(source)
  expect(parseGerberFile(serialized).getString()).toBe(source)
})

test("preserves user deletion through command convenience APIs", () => {
  expect(GerberNode.parse("%TDIAmATA*%").getString()).toBe("%TDIAmATA*%")
  const file = new GerberFile()
  file.addCommand("%TAIAmATA,1*%\n%TDIAmATA*%")
  expect(file.getString()).toBe("%TAIAmATA,1*%\n%TDIAmATA*%\n")
})

test("keeps existing DeleteAttribute constructor serialization", () => {
  expect(new DeleteAttribute("N").getString()).toBe("%TD.N*%")
  expect(new DeleteAttribute().getString()).toBe("%TD*%")
})
