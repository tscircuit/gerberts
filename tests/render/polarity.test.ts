import { expect, test } from "bun:test"
import { parseGerberFile, renderGerberToSvg } from "../../lib/index.ts"
import { polarityFixtures } from "./polarity-fixtures.ts"

// References are independently drawn final geometry. They are not regenerated
// from the renderer; removing LP subtraction must fail these visual assertions.
for (const fixture of polarityFixtures) {
  for (const background of ["transparent", "white"] as const) {
    test(`${fixture.name} on ${background}`, async () => {
      const svg = renderGerberToSvg(parseGerberFile(fixture.source), {
        padding: 0,
        scale: 20,
        fillColor: "#000",
        strokeColor: "#000",
        backgroundColor: background === "white" ? "#fff" : "none",
      })
      // A visible backing also tests transparency: the image matcher alone
      // does not distinguish black RGB pixels with different alpha values.
      const backed = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/>${svg}</svg>`
      await expect(backed).toMatchSvgSnapshot(
        import.meta.path,
        `${fixture.name}-${background}`,
      )
    })
  }
}
