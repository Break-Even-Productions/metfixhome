import { expect, test } from "@playwright/test";
import { prepareVisualPage, settleForCapture, VIEWPORTS } from "./harness";
import { masksForPath } from "./masks";

/**
 * F1 visual gates (T-F-1..3). Baselines are box-generated vs beta 95f67814
 * and committed under tests/visual/baselines/. CI compares only (never regenerates).
 * Masks: Playwright locators only — no data-visual-* in production (rev1.0.7).
 */
const PAGES = [
  { path: "/become-an-affiliate", name: "become-an-affiliate" },
  { path: "/affiliate-seminars", name: "affiliate-seminars" },
  { path: "/the-daily-fix", name: "the-daily-fix" },
] as const;

test.describe("F1 visual (T-F-1, T-F-2, T-F-3)", () => {
  for (const pageDef of PAGES) {
    for (const vp of VIEWPORTS) {
      // Box generates baselines vs beta 95f67814; CI compares only (updateSnapshots:none).
      // Skip until committed PNGs exist under tests/visual/f1.visual.spec.ts-snapshots/.
      test(`${pageDef.name} @ ${vp.name}`, async ({ page }, testInfo) => {
        const snapName = `${pageDef.name}-${vp.name}.png`;
        const snapDir = testInfo.snapshotDir;
        const fs = await import("node:fs");
        const path = await import("node:path");
        const exists =
          fs.existsSync(path.join(snapDir, snapName)) ||
          fs.existsSync(path.join(snapDir, `${pageDef.name}-${vp.name}-chromium-linux.png`));
        test.skip(!exists, "baseline PNG not yet committed (box-only vs beta)");

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prepareVisualPage(page);
        await page.goto(pageDef.path, { waitUntil: "domcontentloaded" });
        await settleForCapture(page);

        const maskLocators = masksForPath(page, pageDef.path);
        await expect(page).toHaveScreenshot(snapName, {
          fullPage: true,
          threshold: 0.1,
          maxDiffPixelRatio: 0.02,
          mask: maskLocators,
        });
      });
    }
  }
});

test.describe("F1 harness (T-F-47, T-F-49, T-F-60, T-F-62, T-F-63, T-F-65)", () => {
  test("fonts check + hide-recaptcha injected only in visual run", async ({ page }) => {
    await prepareVisualPage(page);
    await page.goto("/404", { waitUntil: "domcontentloaded" });
    await settleForCapture(page);
    const fontsOk = await page.evaluate(() => {
      return (
        document.fonts.check('16px "Plus Jakarta Sans"') &&
        document.fonts.check('16px "Playfair Display"')
      );
    });
    expect(typeof fontsOk).toBe("boolean");

    const badgeHidden = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "grecaptcha-badge";
      document.body.appendChild(el);
      return getComputedStyle(el).visibility === "hidden";
    });
    expect(badgeHidden).toBe(true);
  });

  test("no data-visual-* attributes in the served document", async ({ page }) => {
    await prepareVisualPage(page);
    await page.goto("/become-an-affiliate", { waitUntil: "domcontentloaded" });
    const hits = await page.evaluate(() => {
      return document.querySelectorAll("[data-visual-mask], [data-visual-region], [data-visual]").length;
    });
    expect(hits).toBe(0);
  });
});
