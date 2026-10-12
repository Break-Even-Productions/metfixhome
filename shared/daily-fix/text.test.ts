import { describe, expect, it } from "vitest";
import { buildDescription, cutDescription, prepareTitle } from "./text";

describe("W26–W27 description + truncation", () => {
  it("builds exact form and omits pillars without titles", () => {
    expect(
      buildDescription("261004", { belly: "A", body: "B", brain: "C" }),
    ).toBe("The Daily Fix 261004: Belly - A. Body - B. Brain - C.");
    expect(buildDescription("261004", { body: "B" })).toBe(
      "The Daily Fix 261004: Body - B.",
    );
    expect(buildDescription("261004", {})).toBe(
      "The Daily Fix 261004: one recipe (Belly), one workout (Body) and one article (Brain) from MetFix.",
    );
  });

  it("truncates >155 code points", () => {
    const long = "A".repeat(100) + " " + "B".repeat(60);
    const cut = cutDescription(`The Daily Fix 261004: Belly - ${long}.`);
    expect(Array.from(cut).length).toBeLessThanOrEqual(155);
    expect(cut.endsWith("\u2026")).toBe(true);

    const at155 = "x".repeat(155);
    expect(cutDescription(at155)).toBe(at155);
    const at156 = "x".repeat(156);
    expect(cutDescription(at156).endsWith("\u2026")).toBe(true);
  });

  it("W29 prepareTitle strips tags and decodes once", () => {
    expect(prepareTitle(`Tom "&" <b>Jerry</b> 's &amp;#8211; x`)).toBe(
      `Tom "&" Jerry 's &#8211; x`,
    );
  });
});
