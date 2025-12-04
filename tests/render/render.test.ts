import { expect, test, describe } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { parseGerberFile, renderGerberToSvg } from "../../lib/index.ts"

const fixturesDir = join(import.meta.dir, "../fixtures/gerbers")

describe("GerberToSvg", () => {
  test("renders simple.gbr to SVG", async () => {
    const source = readFileSync(join(fixturesDir, "simple.gbr"), "utf-8")
    const gerber = parseGerberFile(source)
    const svg = renderGerberToSvg(gerber, {
      scale: 100,
      strokeColor: "#00aa00",
      fillColor: "#00aa00",
      backgroundColor: "#1a1a1a",
    })

    expect(svg).toContain("<svg")
    expect(svg).toContain("</svg>")
    expect(svg).toContain("<line") // Should have traces
    expect(svg).toContain("<rect") // Should have rectangular pad

    await expect(svg).toMatchSvgSnapshot(import.meta.path, "simple")
  })

  test("renders complex top_copper.GTL to SVG", async () => {
    const source = readFileSync(join(fixturesDir, "top_copper.GTL"), "utf-8")
    const gerber = parseGerberFile(source)
    const svg = renderGerberToSvg(gerber, {
      scale: 50,
      strokeColor: "#c87533",
      fillColor: "#c87533",
      backgroundColor: "#1a1a2e",
    })

    expect(svg).toContain("<svg")
    expect(svg).toContain("</svg>")

    // Verify it parsed the complex file with many operations
    expect(gerber.operations.length).toBeGreaterThan(100)
    expect(gerber.apertureDefinitions.length).toBeGreaterThan(10)

    await expect(svg).toMatchSvgSnapshot(import.meta.path, "top_copper")
  })

  test("renders with default options", () => {
    const source = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,0.1*%
D10*
X0Y0D02*
X1000000Y1000000D01*
M02*`

    const gerber = parseGerberFile(source)
    const svg = renderGerberToSvg(gerber)

    expect(svg).toContain("<svg")
    expect(svg).toContain("<line")
    expect(svg).toContain('stroke="#000"')
  })

  test("handles circular aperture flash", () => {
    const source = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,0.5*%
D10*
X500000Y500000D03*
M02*`

    const gerber = parseGerberFile(source)
    const svg = renderGerberToSvg(gerber)

    expect(svg).toContain("<circle")
    expect(svg).toContain('r="0.25"') // radius = diameter/2
  })

  test("handles rectangular aperture flash", () => {
    const source = `%FSLAX26Y26*%
%MOMM*%
%ADD11R,1.0X0.5*%
D11*
X500000Y500000D03*
M02*`

    const gerber = parseGerberFile(source)
    const svg = renderGerberToSvg(gerber)

    expect(svg).toContain("<rect")
    expect(svg).toContain('width="1"')
    expect(svg).toContain('height="0.5"')
  })
})
