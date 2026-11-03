import { describe, expect, test } from "bun:test"
import { parseGerberFile } from "../../lib/GerberFile.ts"
import { GerberToSvg, renderGerberToSvg } from "../../lib/render/GerberToSvg.ts"

const file = (x: string) =>
  parseGerberFile(
    `%FSLAX24Y24*%\n%MOMM*%\n%ADD10C,0.5*%\nD10*\nX${x}Y${x}D03*\nM02*`,
  )
describe("renderer lifecycle", () => {
  test("each invocation is isolated on a reused instance", () => {
    const renderer = new GerberToSvg({ fillColor: "red" })
    renderer.render(file("010000"))
    const second = renderer.render(file("020000"))
    expect(second).toBe(renderGerberToSvg(file("020000"), { fillColor: "red" }))
    expect((second.match(/<circle/g) ?? []).length).toBe(1)
  })
  test("empty files produce finite positive SVG bounds", () => {
    for (const padding of [0, 0.1]) {
      const svg = renderGerberToSvg(parseGerberFile("M02*"), { padding })
      expect(svg).not.toMatch(/Infinity|NaN/)
      const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
      expect(box).not.toBeNull()
      expect(Number(box![1])).toBeGreaterThan(0)
      expect(Number(box![2])).toBeGreaterThan(0)
    }
  })
})

test("move-only geometry has a valid viewBox even with no padding", () => {
  const svg = renderGerberToSvg(parseGerberFile("X010000Y010000D02*\nM02*"), {
    padding: 0,
  })
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  expect(box).not.toBeNull()
  expect(Number(box![1])).toBeGreaterThan(0)
  expect(Number(box![2])).toBeGreaterThan(0)
})
