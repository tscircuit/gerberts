import { describe, expect, test } from "bun:test"
import { parseGerberFile, renderGerberToSvg } from "../../lib/index.ts"

const header = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,2*%
D10*`

function expectViewport(
  svg: string,
  width: number,
  height: number,
  translateX: number,
  translateY: number,
) {
  const box = svg.match(/viewBox="0 0 ([^ ]+) ([^"]+)"/)
  expect(box).not.toBeNull()
  expect(Number(box![1])).toBeCloseTo(width, 10)
  expect(Number(box![2])).toBeCloseTo(height, 10)

  const transform = svg.match(
    /translate\(0, ([^)]+)\) scale\(1, -1\) translate\(([^,]+), ([^)]+)\)/,
  )
  expect(transform).not.toBeNull()
  expect(Number(transform![1])).toBeCloseTo(height, 10)
  expect(Number(transform![2])).toBeCloseTo(translateX, 10)
  expect(Number(transform![3])).toBeCloseTo(translateY, 10)
}

describe("trace stroke bounds", () => {
  test("includes both round caps and default padding for a diagonal trace", () => {
    const svg = renderGerberToSvg(
      parseGerberFile(`${header}\nX0Y0D02*\nX1000000Y1000000D01*\nM02*`),
    )

    expect(svg).toContain('<line x1="0" y1="0" x2="1" y2="1"')
    expect(svg).toContain('stroke-width="2" stroke-linecap="round"')
    expectViewport(svg, 3.2, 3.2, 1.1, 1.1)
  })

  test.each([
    ["horizontal", "X0Y0D02*\nX3000000Y0D01*", 5, 2, 1, 1],
    ["vertical", "X0Y0D02*\nX0Y3000000D01*", 2, 5, 1, 1],
    ["zero-length", "X3000000Y4000000D02*\nX3000000Y4000000D01*", 2, 2, -2, -3],
    ["reversed", "X1000000Y2000000D02*\nX-3000000Y-4000000D01*", 6, 8, 4, 5],
    ["initial origin", "X2000000Y3000000D01*", 4, 5, 1, 1],
    ["omitted coordinate", "X0Y1000000D02*\nX3000000D01*", 5, 2, 1, 0],
  ])("contains the %s trace with zero padding", (_, operations, w, h, x, y) => {
    const svg = renderGerberToSvg(
      parseGerberFile(`${header}\n${operations}\nM02*`),
      { padding: 0 },
    )

    expect(svg).toContain("<line")
    expectViewport(svg, w, h, x, y)
  })

  test.each([
    ["larger", 2, 6, 9, 2],
    ["smaller", 6, 2, 8, 3],
  ])(
    "uses each trace's aperture when switching to a %s one",
    (_, first, second, size, offset) => {
      const source = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,${first}*%
%ADD11C,${second}*%
D10*
X0Y0D02*
X1000000Y1000000D01*
D11*
X4000000Y4000000D01*
M02*`
      const svg = renderGerberToSvg(parseGerberFile(source), { padding: 0 })

      expect(svg.match(/<line /g)).toHaveLength(2)
      expect(svg).toContain(`stroke-width="${first}"`)
      expect(svg).toContain(`stroke-width="${second}"`)
      expectViewport(svg, size, size, offset, offset)
    },
  )

  test.each(["MM", "IN"])(
    "keeps aperture width and coordinates in %s user units",
    (unit) => {
      const source = `%FSLAX24Y24*%
%MO${unit}*%
%ADD10C,0.2*%
D10*
X10000Y20000D02*
X30000Y40000D01*
M02*`
      const svg = renderGerberToSvg(parseGerberFile(source), {
        padding: 0.5,
        scale: 10,
      })

      expect(svg).toContain('<line x1="1" y1="2" x2="3" y2="4"')
      expect(svg).toContain('stroke-width="0.2"')
      expectViewport(svg, 3.2, 3.2, -0.4, -1.4)
      expect(Number(svg.match(/<svg[^>]* width="([^"]+)"/)?.[1])).toBeCloseTo(
        32,
      )
      expect(Number(svg.match(/<svg[^>]* height="([^"]+)"/)?.[1])).toBeCloseTo(
        32,
      )
    },
  )

  test("keeps region bounds at the filled contour even with a wide aperture", () => {
    const source = `${header}
G36*
X0Y0D02*
X1000000Y0D01*
X1000000Y1000000D01*
X0Y1000000D01*
X0Y0D01*
G37*
M02*`
    const svg = renderGerberToSvg(parseGerberFile(source), { padding: 0 })

    expect(svg).toContain('stroke="none"')
    expect(svg).not.toContain("<line")
    expectViewport(svg, 1, 1, 0, 0)
  })

  test.each([
    ["C,2", 2, 2, 0, -1],
    ["R,4X2", 4, 2, 1, -1],
    ["O,2X4", 2, 4, 0, 0],
  ])("preserves %s flash bounds", (aperture, w, h, x, y) => {
    const source = `%FSLAX26Y26*%
%MOMM*%
%ADD10${aperture}*%
D10*
X1000000Y2000000D03*
M02*`
    const svg = renderGerberToSvg(parseGerberFile(source), { padding: 0 })

    expect(svg).not.toContain("<line")
    expectViewport(svg, w, h, x, y)
  })
})
