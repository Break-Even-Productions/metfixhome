import type { Locator, Page } from "@playwright/test";

/**
 * Visual masks are Playwright locators only (rev1.0.7 §15b).
 * Never add data-visual-* attributes to production markup.
 */
export type MaskConfig = {
  /** Page path prefix or exact path */
  path: string | RegExp;
  /** Locator factories evaluated on the page after load */
  locators: (page: Page) => Locator[];
};

export const VISUAL_MASKS: MaskConfig[] = [
  {
    path: "/become-an-affiliate",
    locators: (page) => [
      page.getByRole("img"),
      // testimonials / stats counters when present
      page.locator("[data-stat], .stat-number"),
    ],
  },
  {
    path: "/affiliate-seminars",
    locators: (page) => [
      page.getByRole("img"),
      // event dates / locations / prices
      page.locator("time"),
      page.getByText(/\$\d/),
    ],
  },
  {
    path: "/the-daily-fix",
    locators: (page) => [
      // meal photos + avatars only (§4)
      page.locator("img[alt*='meal' i], img[alt*='photo' i], img.df-meal, .df-meal img"),
      page.locator("img[alt*='avatar' i], .avatar img, img.df-avatar"),
    ],
  },
];

export function masksForPath(page: Page, path: string): Locator[] {
  const matched = VISUAL_MASKS.filter((m) =>
    typeof m.path === "string" ? path.startsWith(m.path) : m.path.test(path),
  );
  return matched.flatMap((m) => m.locators(page));
}
