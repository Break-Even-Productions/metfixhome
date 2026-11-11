import { describe, expect, it } from "vitest";
import { isFirstParagraphPreview } from "./access";

describe("isFirstParagraphPreview", () => {
  it("is only the first-paragraph show_same modes", () => {
    expect(isFirstParagraphPreview(3)).toBe(true);
    expect(isFirstParagraphPreview(4)).toBe(true);
    expect(isFirstParagraphPreview(0)).toBe(false);
    expect(isFirstParagraphPreview(1)).toBe(false);
    expect(isFirstParagraphPreview(2)).toBe(false);
  });
});
