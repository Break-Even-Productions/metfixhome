import { describe, expect, it } from "vitest";
import { VISUAL_HOOK_PATTERN } from "./hookPattern";

describe("VISUAL_HOOK_PATTERN (ER-4)", () => {
  it("hits data-visual, spaced attr, and VITE_VISUAL_MODE", () => {
    expect(VISUAL_HOOK_PATTERN.test("data-visual")).toBe(true);
    expect(VISUAL_HOOK_PATTERN.test('data-visual ="x"')).toBe(true);
    expect(VISUAL_HOOK_PATTERN.test("data-visual-mask")).toBe(true);
    expect(VISUAL_HOOK_PATTERN.test("VITE_VISUAL_MODE")).toBe(true);
    expect(VISUAL_HOOK_PATTERN.test("navigator.webdriver")).toBe(true);
  });

  it("misses out-of-scope MODE/TEST tokens", () => {
    expect(VISUAL_HOOK_PATTERN.test('import.meta.env.MODE==="test"')).toBe(false);
    expect(VISUAL_HOOK_PATTERN.test("VITE_TEST_MODE")).toBe(false);
  });
});
