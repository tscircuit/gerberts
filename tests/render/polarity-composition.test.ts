import { expect, test } from "bun:test"
import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { parseGerberFile, renderGerberToSvg } from "../../lib/index.ts"

// Use the same installed SVG consumer as bun-match-svg, but do not allow its
// color tolerance or antialias suppression to hide compositing regressions.
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

const header = `%FSLAX26Y26*%
%MOMM*%
%ADD10R,6X6*%
%ADD11R,4X4*%
%ADD12R,2X2*%
%ADD13R,1.5X2*%
%ADD14C,0.5*%
%ADD15C,2*%
%ADD16R,3X2*%
G01*
X0Y0D02*
X10000000Y10000000D02*`

async function compare({
  commands,
  reference,
  fillColor = "#000",
  strokeColor = fillColor,
  backgroundColor = "#fff",
}: {
  commands: string
  reference: string
  fillColor?: string
  strokeColor?: string
  backgroundColor?: string
}) {
  const actual = renderGerberToSvg(
    parseGerberFile(`${header}\n${commands}\nM02*`),
    { padding: 0, scale: 20, fillColor, strokeColor, backgroundColor },
  )
  const expected = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 10 10"><rect width="10" height="10" fill="${backgroundColor}"/><g transform="translate(0, 10) scale(1, -1)">${reference}</g></svg>`
  const result = await looksSame(Buffer.from(actual), Buffer.from(expected), {
    strict: true,
    ignoreAntialiasing: false,
    ignoreCaret: false,
  })
  expect(result.equal).toBe(true)
}

async function compareCommands(first: string, second: string) {
  const render = (commands: string) =>
    renderGerberToSvg(parseGerberFile(`${header}\n${commands}\nM02*`), {
      padding: 0,
      scale: 20,
      backgroundColor: "#fff",
    })
  const result = await looksSame(
    Buffer.from(render(first)),
    Buffer.from(render(second)),
    { strict: true, ignoreAntialiasing: false, ignoreCaret: false },
  )
  expect(result.equal).toBe(true)
}

test("a distant clear preserves each translucent paint over the background", async () => {
  await compare({
    commands: `D10*\nX3000000Y3000000D03*\nD11*\nX4000000Y4000000D03*\n%LPC*%\nD14*\nX9000000Y9000000D03*`,
    reference:
      '<rect width="6" height="6" fill="#2070c080"/><rect x="2" y="2" width="4" height="4" fill="#2070c080"/>',
    fillColor: "#2070c080",
    strokeColor: "#2070c080",
    backgroundColor: "#f0e0d0",
  })
})

test("repeated clear silhouettes do not blend their edges twice", async () => {
  await compareCommands(
    `D10*\nX3000000Y3000000D03*\n%LPC*%\nD12*\nX3125000Y3125000D03*\nX3125000Y3125000D03*`,
    `D10*\nX3000000Y3000000D03*\n%LPC*%\nD12*\nX3125000Y3125000D03*`,
  )
})

test("adjacent clear silhouettes have no seam at their common edge", async () => {
  await compareCommands(
    `D10*\nX3000000Y3000000D03*\n%LPC*%\nD13*\nX2000000Y3125000D03*\nX3500000Y3125000D03*`,
    `D10*\nX3000000Y3000000D03*\n%LPC*%\nD16*\nX2750000Y3125000D03*`,
  )
})

test("different primitive colors retain their creation order", async () => {
  await compare({
    commands: `D12*\nX3000000Y3000000D03*\nD15*\nX1000000Y3000000D02*\nX5000000Y3000000D01*`,
    reference:
      '<rect x="2" y="2" width="2" height="2" fill="#2070c0"/><line x1="1" y1="3" x2="5" y2="3" stroke="#dc1428" stroke-width="2" stroke-linecap="round"/>',
    fillColor: "#2070c0",
    strokeColor: "#dc1428",
  })
})

test("separately rendered boards retain their own clear geometry when inlined", async () => {
  for (let repeat = 0; repeat < 3; repeat++) {
    const boards = [3, 7].map((x) =>
      renderGerberToSvg(
        parseGerberFile(
          `${header}\nD10*\nX5000000Y5000000D03*\n%LPC*%\nD12*\nX${x * 1000000}Y5000000D03*\nM02*`,
        ),
        { padding: 0, scale: 20, backgroundColor: "#fff" },
      ),
    )
    const actual = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">${boards[0]}<g transform="translate(200,0)">${boards[1]}</g></svg>`
    const expected = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 20 10"><rect width="20" height="10" fill="#fff"/><path d="M2 2H8V8H2Z M2 4H4V6H2Z M12 2H18V8H12Z M16 4H18V6H16Z" fill="#000" fill-rule="evenodd"/></svg>`
    const result = await looksSame(Buffer.from(actual), Buffer.from(expected), {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })
    expect(result.equal).toBe(true)
  }
})

for (const pairs of [16, 64, 256, 512]) {
  test(`alternating polarity stays compact for ${pairs} distinct clears`, async () => {
    const commands = Array.from({ length: pairs }, (_, i) => {
      const point = `X${2000000 + (i % 20) * 100000}Y${2000000 + Math.floor(i / 20) * 100000}D03*`
      return `%LPD*%\nD12*\n${point}\n%LPC*%\n${point}`
    }).join("\n")
    const source = `${header}\n${commands}\nM02*`
    const svg = renderGerberToSvg(parseGerberFile(source), {
      padding: 0,
      scale: 20,
      backgroundColor: "#fff",
    })
    const reference =
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/></svg>'
    const result = await looksSame(Buffer.from(svg), Buffer.from(reference), {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    })
    expect(result.equal).toBe(true)
    // Each pair needs one original paint and one clear silhouette. In addition
    // to the background, do not serialize copies of every later clear.
    const geometryCount = (
      svg.match(/<(?:path|rect|circle|line|ellipse|polygon|polyline)\b/g) ?? []
    ).length
    expect(geometryCount).toBeLessThanOrEqual(pairs * 2 + 1)
  })
}
