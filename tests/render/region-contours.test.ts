import { expect, test } from "bun:test"
import { GerberFile, parseGerberFile, renderGerberToSvg } from "../../lib/index.ts"

// Gerber 2026.05 section 4.10.1: each D02 starts a separate contour.
// Filled contours are combined by union, including when they overlap.
const first = [
  "X0Y0D02*\nX4000000Y0D01*\nX4000000Y4000000D01*\nX0Y4000000D01*\nX0Y0D01*",
  "X0Y0D02*\nX0Y4000000D01*\nX4000000Y4000000D01*\nX4000000Y0D01*\nX0Y0D01*",
]
const second = [
  "X2000000Y2000000D02*\nX6000000Y2000000D01*\nX6000000Y6000000D01*\nX2000000Y6000000D01*\nX2000000Y2000000D01*",
  "X2000000Y2000000D02*\nX2000000Y6000000D01*\nX6000000Y6000000D01*\nX6000000Y2000000D01*\nX2000000Y2000000D01*",
]

function source(contours: string[]): string {
  return `%FSLAX26Y26*%\n%MOMM*%\nG01*\nG36*\n${contours.join("\n")}\nG37*\nM02*`
}

function render(file: GerberFile): string {
  return renderGerberToSvg(file, {
    scale: 100,
    padding: 0,
    backgroundColor: "#fff",
  })
}

for (const [a, contourA] of first.entries()) {
  for (const [b, contourB] of second.entries()) {
    test(`overlapping contours are filled for winding combination ${a}/${b}`, async () => {
      const svg = render(parseGerberFile(source([contourA, contourB])))
      // The reference is two hand-authored SVG rectangles, not renderer output.
      await expect(svg).toMatchSvgSnapshot(import.meta.path, "overlap")
    })
  }
}

test("a nested contour does not erase the enclosing contour", async () => {
  const inner =
    "X1000000Y1000000D02*\nX1000000Y3000000D01*\nX3000000Y3000000D01*\nX3000000Y1000000D01*\nX1000000Y1000000D01*"
  const file = new GerberFile()
  file.addCommand(source([first[0]!, inner]))
  await expect(render(file)).toMatchSvgSnapshot(import.meta.path, "nested")
})

test("disjoint contours retain the unfilled area between them", async () => {
  const svg = render(
    parseGerberFile(
      source([
        "X0Y0D02*\nX2000000Y0D01*\nX2000000Y2000000D01*\nX0Y2000000D01*\nX0Y0D01*",
        "X4000000Y0D02*\nX6000000Y0D01*\nX6000000Y2000000D01*\nX4000000Y2000000D01*\nX4000000Y0D01*",
      ]),
    ),
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "disjoint")
})

test("a cut-in hole remains within its single contour", async () => {
  // The inner loop is connected to the outer loop by a horizontal cut-in.
  const contour =
    "X0Y0D02*\nX6000000Y0D01*\nX6000000Y6000000D01*\nX0Y6000000D01*\nX0Y2000000D01*\nX2000000Y2000000D01*\nX2000000Y4000000D01*\nX4000000Y4000000D01*\nX4000000Y2000000D01*\nX2000000Y2000000D01*\nX0Y2000000D01*\nX0Y0D01*"
  await expect(render(parseGerberFile(source([contour])))).toMatchSvgSnapshot(
    import.meta.path,
    "cut-in",
  )
})

test("separate region statements retain the same union", async () => {
  const input = source([first[0]!, `G37*\nG36*\n${second[0]!}`])
  await expect(render(parseGerberFile(input))).toMatchSvgSnapshot(
    import.meta.path,
    "overlap",
  )
})

for (const [name, contours, fillColor, reference] of [
  [
    "repeated rgba contours",
    [first[0]!, first[1]!, first[0]!],
    "rgba(0,0,0,0.5)",
    "one-translucent-fill",
  ],
  [
    "repeated hex-alpha contours",
    [first[0]!, first[1]!, first[0]!],
    "#00000080",
    "one-translucent-fill",
  ],
  [
    "fractional shared edge",
    [
      "X0Y0D02*\nX2005000Y0D01*\nX2005000Y4000000D01*\nX0Y4000000D01*\nX0Y0D01*",
      "X2005000Y0D02*\nX4000000Y0D01*\nX4000000Y4000000D01*\nX2005000Y4000000D01*\nX2005000Y0D01*",
    ],
    "#000",
    "nested",
  ],
  [
    "diagonal shared edge",
    [
      "X0Y0D02*\nX4000000Y0D01*\nX4000000Y4000000D01*\nX0Y0D01*",
      "X0Y0D02*\nX4000000Y4000000D01*\nX0Y4000000D01*\nX0Y0D01*",
    ],
    "#000",
    "nested",
  ],
  [
    "a contour with disconnected components",
    [
      "X2000000Y1000000D02*\nX2000000Y2000000D01*\nX0Y2000000D01*\nX0Y0D01*\nX2000000Y0D01*\nX2000000Y1000000D01*\nX4000000Y1000000D01*\nX4000000Y0D01*\nX6000000Y0D01*\nX6000000Y2000000D01*\nX4000000Y2000000D01*\nX4000000Y1000000D01*\nX2000000Y1000000D01*",
      "X2000000Y1000000D02*\nX4000000Y1000000D01*\nX4000000Y2000000D01*\nX6000000Y2000000D01*\nX6000000Y0D01*\nX4000000Y0D01*\nX4000000Y1000000D01*\nX2000000Y1000000D01*\nX2000000Y0D01*\nX0Y0D01*\nX0Y2000000D01*\nX2000000Y2000000D01*\nX2000000Y1000000D01*",
    ],
    "rgba(0,0,0,0.5)",
    "components",
  ],
  [
    "a contour with two cut-in holes",
    [
      "X0Y0D02*\nX10000000Y0D01*\nX10000000Y2000000D01*\nX8000000Y2000000D01*\nX6000000Y2000000D01*\nX6000000Y4000000D01*\nX8000000Y4000000D01*\nX8000000Y2000000D01*\nX10000000Y2000000D01*\nX10000000Y6000000D01*\nX0Y6000000D01*\nX0Y2000000D01*\nX2000000Y2000000D01*\nX2000000Y4000000D01*\nX4000000Y4000000D01*\nX4000000Y2000000D01*\nX2000000Y2000000D01*\nX0Y2000000D01*\nX0Y0D01*",
      "X0Y0D02*\nX0Y2000000D01*\nX2000000Y2000000D01*\nX4000000Y2000000D01*\nX4000000Y4000000D01*\nX2000000Y4000000D01*\nX2000000Y2000000D01*\nX0Y2000000D01*\nX0Y6000000D01*\nX10000000Y6000000D01*\nX10000000Y2000000D01*\nX8000000Y2000000D01*\nX8000000Y4000000D01*\nX6000000Y4000000D01*\nX6000000Y2000000D01*\nX8000000Y2000000D01*\nX10000000Y2000000D01*\nX10000000Y0D01*\nX0Y0D01*",
    ],
    "rgba(0,0,0,0.5)",
    "two-holes",
  ],
] as const) {
  test(`${name} is painted once without internal coverage seams`, async () => {
    const svg = renderGerberToSvg(parseGerberFile(source([...contours])), {
      scale: 100,
      padding: 0,
      backgroundColor: "#fff",
      fillColor,
    })
    await expect(svg).toMatchSvgSnapshot(import.meta.path, reference)
  })
}


test("separate region statements retain independent translucent paints", async () => {
  const input = source([first[0]!, `G37*\nG36*\n${first[1]!}`])
  const svg = renderGerberToSvg(parseGerberFile(input), {
    scale: 100,
    padding: 0,
    backgroundColor: "#fff",
    fillColor: "rgba(0,0,0,0.5)",
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "separate-paints")
})


test("opposite contours retain their union at a large coordinate offset", async () => {
  const input = `%FSLAX66Y66*%
%MOMM*%
G01*
G36*
X900000000000Y900000000000D02*
X900000005000Y900000000000D01*
X900000005000Y900000005000D01*
X900000000000Y900000005000D01*
X900000000000Y900000000000D01*
X900000000000Y900000000000D02*
X900000000000Y900000005000D01*
X900000005000Y900000005000D01*
X900000005000Y900000000000D01*
X900000000000Y900000000000D01*
G37*
M02*`
  const svg = renderGerberToSvg(parseGerberFile(input), {
    scale: 80000,
    padding: 0,
    backgroundColor: "#fff",
    fillColor: "rgba(0,0,0,0.5)",
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "one-translucent-fill")
})
