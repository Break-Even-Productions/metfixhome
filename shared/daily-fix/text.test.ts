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

  it("W27 truncates >155 with astral chars, exact cut + boundaries", () => {
    const long = "A".repeat(100) + " " + "B".repeat(60);
    const cut = cutDescription(`The Daily Fix 261004: Belly - ${long}.`);
    expect(Array.from(cut).length).toBeLessThanOrEqual(155);
    expect(cut.endsWith("\u2026")).toBe(true);

    // Astral emoji counts as one code point; cut back to last space, trim .,;:- and spaces.
    const astral = `The Daily Fix 261004: Belly - ${"字".repeat(120)} 😀 trailing-words-here.,:; -`;
    expect(Array.from(astral).length).toBeGreaterThan(155);
    const cutAstral = cutDescription(astral);
    const expectedPrefix = Array.from(astral).slice(0, 154).join("");
    const space = expectedPrefix.lastIndexOf(" ");
    const expected =
      (space === -1 ? expectedPrefix : expectedPrefix.slice(0, space)).replace(
        /[.,:;\-\s]+$/,
        "",
      ) + "\u2026";
    expect(cutAstral).toBe(expected);
    expect(cutAstral).toContain("😀");

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
