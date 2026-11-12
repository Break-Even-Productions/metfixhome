import { describe, expect, it } from "vitest";
import {
  DAILY_FIX_WHEEL_PATH,
  isWheelPath,
  recipeHrefFromLastUsed,
  wheelRecipesQueryString,
} from "./wheel";

describe("daily-fix wheel helpers", () => {
  it("builds query strings with clamped limit and optional filters", () => {
    expect(wheelRecipesQueryString()).toBe("limit=12");
    expect(wheelRecipesQueryString({ limit: 99, excludeId: 7, proteinIds: [1, 3] })).toBe(
      "limit=40&exclude_id=7&protein_ids=1%2C3",
    );
    expect(wheelRecipesQueryString({ excludeId: 0, proteinIds: [] })).toBe("limit=12");
  });

  it("maps last_used YYMMDD to belly Daily Fix href", () => {
    expect(recipeHrefFromLastUsed("261004")).toBe("/the-daily-fix/261004?tab=belly");
    expect(recipeHrefFromLastUsed(null)).toBeNull();
    expect(recipeHrefFromLastUsed("bad")).toBeNull();
  });

  it("recognizes the wheel path with optional trailing slash", () => {
    expect(isWheelPath(DAILY_FIX_WHEEL_PATH)).toBe(true);
    expect(isWheelPath("/the-daily-fix/wheel/")).toBe(true);
    expect(isWheelPath("/the-daily-fix/261004")).toBe(false);
  });
});
