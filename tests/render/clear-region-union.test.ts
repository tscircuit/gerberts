import { expect, test } from "bun:test"
import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { parseGerberFile, renderGerberToSvg } from "../../lib/index.ts"

const svgTestRequire = createRequire(
  realpathSync(new URL(import.meta.resolve("bun-match-svg"))),
)
const looksSame = svgTestRequire("looks-same") as (
  actual: Buffer,
  reference: Buffer,
  options: {
    strict: boolean
    ignoreAntialiasing: boolean
    ignoreCaret: boolean
  },
) => Promise<{ equal: boolean }>

type Position = [number, number]

const polygon = (points: Position[]) =>
  points.map(([x, y], i) => `X${x * 1e6}Y${y * 1e6}D0${i ? 1 : 2}*`).join("\n")
const rectangle = ({
  x1,
  y1,
  x2,
  y2,
  reverse = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  reverse?: boolean
}) => {
  const points: Position[] = [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
    [x1, y1],
  ]
  return polygon(reverse ? points.reverse() : points)
}
const region = (contours: string[]) => `G36*\n${contours.join("\n")}\nG37*\n`
const a = rectangle({ x1: 1, y1: 1, x2: 5, y2: 5 })
const b = rectangle({ x1: 3, y1: 3, x2: 7, y2: 7, reverse: true })
const union = "M1 1H5V3H7V7H3V5H1Z"
const cutPoints: Position[] = [
  [1, 1],
  [7, 1],
  [7, 7],
  [1, 7],
  [1, 3],
  [3, 3],
  [3, 5],
  [5, 5],
  [5, 3],
  [3, 3],
  [1, 3],
  [1, 1],
]
const cut = polygon(cutPoints)
const cutReference = "M1 1H7V7H1Z M3 3H5V5H3Z"
const header = `%FSLAX26Y26*%
%MOMM*%
%ADD10R,10X10*%
%ADD11R,1X1*%
%ADD12C,2*%
G01*
X0Y0D02*
X10000000Y10000000D02*`
const dark = "D10*\nX5000000Y5000000D03*\n"

// Ucamco 2026.05 section 4.10 unions independently closed D02 contours.
// A hole belongs to a single valid cut-in contour, not a nested D02 contour.
const cases = [
  { name: "opposed overlap", clear: region([a, b]), shape: union },
  {
    name: "same-direction overlap",
    clear: region([a, rectangle({ x1: 3, y1: 3, x2: 7, y2: 7 })]),
    shape: union,
  },
  {
    name: "nested independent contours",
    clear: region([
      rectangle({ x1: 1, y1: 1, x2: 7, y2: 7 }),
      rectangle({ x1: 3, y1: 3, x2: 5, y2: 5, reverse: true }),
    ]),
    shape: "M1 1H7V7H1Z",
  },
  {
    name: "opposed duplicate",
    clear: region([
      rectangle({ x1: 2, y1: 2, x2: 6, y2: 6 }),
      rectangle({ x1: 2, y1: 2, x2: 6, y2: 6, reverse: true }),
    ]),
    shape: "M2 2H6V6H2Z",
  },
  { name: "single cut-in hole", clear: region([cut]), shape: cutReference },
  {
    name: "duplicate cut-in hole",
    clear: region([cut, polygon([...cutPoints].reverse())]),
    shape: cutReference,
  },
  {
    name: "independent contour fills a cut-in hole",
    clear: region([cut, rectangle({ x1: 3, y1: 3, x2: 5, y2: 5 })]),
    shape: "M1 1H7V7H1Z",
  },
  {
    name: "disjoint contours",
    clear: region([
      rectangle({ x1: 1, y1: 1, x2: 3, y2: 3 }),
      rectangle({ x1: 5, y1: 5, x2: 7, y2: 7, reverse: true }),
    ]),
    shape: "M1 1H3V3H1Z M5 5H7V7H5Z",
  },
  {
    name: "adjacent contours",
    clear: region([
      rectangle({ x1: 1, y1: 1, x2: 3.125, y2: 5 }),
      rectangle({ x1: 3.125, y1: 1, x2: 5, y2: 5, reverse: true }),
    ]),
    shape: "M1 1H5V5H1Z",
  },
  {
    name: "separate statements",
    clear: region([a]) + region([b]),
    shape: union,
  },
  {
    name: "later dark restoration",
    clear: region([a, b]),
    shape: union,
    later: "D11*\nX4000000Y4000000D03*\n",
    laterSvg: '<rect x="3.5" y="3.5" width="1" height="1" fill="FILL"/>',
  },
  {
    name: "clear before dark",
    clear: region([a, b]),
    shape: union,
    beforeDark: true,
  },
  {
    name: "independent mixed-color paints",
    clear: region([a, b]),
    shape: union,
    dark: dark + "D12*\nX1000000Y5000000D02*\nX9000000Y5000000D01*\n",
    darkSvg:
      '<rect width="10" height="10" fill="FILL"/><line x1="1" y1="5" x2="9" y2="5" stroke="STROKE" stroke-width="2" stroke-linecap="round"/>',
  },
]

for (const fixture of cases) {
  test(`clear region union: ${fixture.name}`, async () => {
    for (const style of [
      { fillColor: "#000", strokeColor: "#dc1428", backgroundColor: "none" },
      {
        fillColor: "#2070c080",
        strokeColor: "#dc142880",
        backgroundColor: "none",
      },
      {
        fillColor: "#2070c080",
        strokeColor: "#dc142880",
        backgroundColor: "#f0e0d0",
      },
    ]) {
      const paints = fixture.dark ?? dark
      const source =
        `${header}\n` +
        (fixture.beforeDark
          ? `%LPC*%\n${fixture.clear}%LPD*%\n${paints}`
          : `${paints}%LPC*%\n${fixture.clear}%LPD*%\n${fixture.later ?? ""}`) +
        "M02*\n"
      const actual = renderGerberToSvg(parseGerberFile(source), {
        ...style,
        padding: 0,
        scale: 40,
      })
      const paint = (
        fixture.darkSvg ?? '<rect width="10" height="10" fill="FILL"/>'
      )
        .replaceAll("FILL", style.fillColor)
        .replaceAll("STROKE", style.strokeColor)
      const content = fixture.beforeDark
        ? paint
        : `<defs><clipPath id="reference-complement"><path d="M0 0H10V10H0Z ${fixture.shape}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#reference-complement)">${paint}</g>` +
          (fixture.laterSvg ?? "").replaceAll("FILL", style.fillColor)
      const background =
        style.backgroundColor === "none"
          ? ""
          : `<rect width="10" height="10" fill="${style.backgroundColor}"/>`
      const expected = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 10 10">${background}<g transform="translate(0,10) scale(1,-1)">${content}</g></svg>`
      const result = await looksSame(
        Buffer.from(actual),
        Buffer.from(expected),
        {
          strict: true,
          ignoreAntialiasing: false,
          ignoreCaret: false,
        },
      )
      expect(result.equal).toBe(true)
    }
  })
}
