import { describe, expect, it } from "vitest";
import { normalizeCanModerate } from "./upstream";

describe("normalizeCanModerate (CM6 / CW12.2)", () => {
  it("only JSON true is moderator", () => {
    expect(normalizeCanModerate(true)).toBe(true);
    expect(normalizeCanModerate(false)).toBe(false);
    expect(normalizeCanModerate(undefined)).toBe(false);
    expect(normalizeCanModerate(null)).toBe(false);
    expect(normalizeCanModerate("true")).toBe(false);
    expect(normalizeCanModerate(1)).toBe(false);
    expect(normalizeCanModerate({})).toBe(false);
  });
});
