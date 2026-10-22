import { describe, expect, it } from "vitest";
import { isUnlockedPost } from "./locked";

/** Plain unlocked shape (PW30 control). */
function unlocked(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    title: "T",
    excerpt: "E",
    date: "2026-10-19T10:00:00+00:00",
    access_levels: [],
    content_access_display: {
      has_content_access: false,
      user_has_access: true,
      has_preview: false,
      access: "full",
      is_exclusive: false,
      show_same: 0,
      show_video_in_preview: false,
      access_group_labels: [],
    },
    ...overrides,
  };
}

describe("isUnlockedPost (D8 / PW30)", () => {
  it("keeps the plain unlocked control", () => {
    expect(isUnlockedPost(unlocked())).toBe(true);
  });

  it("keeps expired-exclusive reported unlocked with leftover exclusive fields (OQ-P2)", () => {
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            access: "full",
            is_exclusive: false,
            access_group_labels: ["Members"],
            show_same: 2,
            has_preview: true,
          },
        }),
      ),
    ).toBe(true);
  });

  it("drops bad access_levels", () => {
    expect(isUnlockedPost(unlocked({ access_levels: undefined }))).toBe(false);
    const missing = unlocked();
    delete missing.access_levels;
    expect(isUnlockedPost(missing)).toBe(false);
    expect(isUnlockedPost(unlocked({ access_levels: null }))).toBe(false);
    expect(isUnlockedPost(unlocked({ access_levels: {} }))).toBe(false);
    expect(isUnlockedPost(unlocked({ access_levels: ["x"] }))).toBe(false);
    expect(isUnlockedPost(unlocked({ access_levels: [""] }))).toBe(false);
  });

  it("drops missing / non-object content_access_display (PM22)", () => {
    const missing = unlocked();
    delete missing.content_access_display;
    expect(isUnlockedPost(missing)).toBe(false);
    expect(isUnlockedPost(unlocked({ content_access_display: null }))).toBe(false);
    expect(isUnlockedPost(unlocked({ content_access_display: [] }))).toBe(false);
    expect(isUnlockedPost(unlocked({ content_access_display: "full" }))).toBe(false);
  });

  it("drops bad has_content_access", () => {
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: true,
            is_exclusive: false,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: "false",
            is_exclusive: false,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            is_exclusive: false,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
  });

  it("drops bad is_exclusive", () => {
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            is_exclusive: true,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            is_exclusive: "false",
            access: "full",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            is_exclusive: 0,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
  });

  it("drops bad access", () => {
    for (const access of ["preview", "none", "Full", null]) {
      expect(
        isUnlockedPost(
          unlocked({
            content_access_display: {
              has_content_access: false,
              is_exclusive: false,
              access,
            },
          }),
        ),
      ).toBe(false);
    }
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            is_exclusive: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it("drops expired exclusive still flagged locked", () => {
    expect(
      isUnlockedPost(
        unlocked({
          content_access_display: {
            has_content_access: false,
            is_exclusive: true,
            access: "full",
          },
        }),
      ),
    ).toBe(false);
    expect(isUnlockedPost(unlocked({ access_levels: ["x"] }))).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isUnlockedPost(null)).toBe(false);
    expect(isUnlockedPost([])).toBe(false);
    expect(isUnlockedPost("x")).toBe(false);
  });
});
