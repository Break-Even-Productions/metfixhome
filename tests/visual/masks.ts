import type { Locator, Page } from "@playwright/test";

/**
 * Visual masks are Playwright locators only (rev1.0.7 §15b / DEF4).
 * Never add data-visual-* attributes to production markup.
 * Each mask carries a one-line reason naming the non-deterministic source.
 */
export type MaskConfig = {
  path: string | RegExp;
  /** Locator factories evaluated on the page after load */
  locators: (page: Page) => Locator[];
  /** DEF4: required reason when a fixture cannot make the region deterministic */
  reason: string;
};

export const VISUAL_MASKS: MaskConfig[] = [
  {
    path: "/become-an-affiliate",
    reason: "CMS/Sanity hero + testimonial images not fixture-pinned yet",
    locators: (page) => [
      page.getByRole("img"),
      page.locator("[data-stat], .stat-number"),
    ],
  },
  {
    path: "/affiliate-seminars",
    reason: "Live seminar dates/prices/locations vary per Sanity feed",
    locators: (page) => [
      page.getByRole("img"),
      page.locator("time"),
      page.getByText(/\$\d/),
    ],
  },
  {
    path: "/the-daily-fix",
    reason: "Meal photo + avatar assets; date/day/comments come from fixtures",
    locators: (page) => [
      page.locator("img[alt*='meal' i], img[alt*='photo' i], img.df-meal, .df-meal img"),
      page.locator("img[alt*='avatar' i], .avatar img, img.df-avatar"),
    ],
  },
];

export function masksForPath(page: Page, path: string): Locator[] {
  const matched = VISUAL_MASKS.filter((m) => {
    if (!m.reason || !m.reason.trim()) {
      throw new Error(`DEF4: mask for ${String(m.path)} missing reason`);
    }
    return typeof m.path === "string" ? path.startsWith(m.path) : m.path.test(path);
  });
  return matched.flatMap((m) => m.locators(page));
}
