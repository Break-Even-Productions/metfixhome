import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { F1_A11Y_ROUTES, prepareVisualPage, settleForCapture, VIEWPORTS } from "./harness";

test.describe("F1 a11y (T-F-31, T-F-32)", () => {
  for (const route of F1_A11Y_ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route} @ ${vp.name}: 0 serious/critical + color-contrast`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prepareVisualPage(page);
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await settleForCapture(page);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const blocking = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);

        const contrast = results.violations.filter((v) => v.id === "color-contrast");
        expect(contrast, JSON.stringify(contrast, null, 2)).toEqual([]);
      });
    }
  }
});
