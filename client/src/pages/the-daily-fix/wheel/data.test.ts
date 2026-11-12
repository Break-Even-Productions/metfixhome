import { describe, expect, it } from "vitest";
import { mergeProteins, parseWheelRecipesPayload, proteinsFromRecipes } from "./data";

describe("wheel data", () => {
  it("parses BSI wheel recipe payloads", () => {
    const parsed = parseWheelRecipesPayload({
      recipes: [
        {
          id: 7,
          last_used: "261004",
          title: "Salmon",
          excerpt: "Fast",
          protein: { id: 4, name: "seafood" },
          macros: { fat: 18, carb: 6, protein: 35 },
          assets: { low: "a.jpg", high: "b.jpg", alt: "Salmon" },
        },
      ],
      meta: { count: 1, limit: 12, excluded: null, protein_ids: [] },
    });
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.recipes[0]?.title).toBe("Salmon");
    expect(parsed.recipes[0]?.macros.carb).toBe(6);
    expect(proteinsFromRecipes(parsed.recipes)).toEqual([{ id: 4, name: "seafood" }]);
  });

  it("merges protein chips without duplicates", () => {
    expect(
      mergeProteins(
        [{ id: 1, name: "beef" }],
        [
          { id: 1, name: "beef" },
          { id: 2, name: "poultry" },
        ],
      ),
    ).toEqual([
      { id: 1, name: "beef" },
      { id: 2, name: "poultry" },
    ]);
  });
});
