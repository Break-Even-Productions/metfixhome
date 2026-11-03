import { expect, test } from "@playwright/test";
import { prepareVisualPage, settleForCapture, VIEWPORTS } from "./harness";
import { masksForPath } from "./masks";

/**
 * F1 visual gates (T-F-1..3). Baselines vs beta 95f67814 under
 * tests/visual/f1.visual.spec.ts-snapshots/. CI compares only (never regenerates).
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
      test(`${pageDef.name} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prepareVisualPage(page);
        await page.goto(pageDef.path, { waitUntil: "domcontentloaded" });
        await settleForCapture(page);

        const maskLocators = masksForPath(page, pageDef.path);
        await expect(page).toHaveScreenshot(`${pageDef.name}-${vp.name}.png`, {
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

  test("FONTS1 per-build css files exist", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.join(import.meta.dirname, "fonts/css");
    expect(fs.existsSync(path.join(root, "target.css"))).toBe(true);
    expect(fs.existsSync(path.join(root, "beta.css"))).toBe(true);
    const target = fs.readFileSync(path.join(root, "target.css"), "utf8");
    expect(target).toMatch(/Playfair Display/);
    expect(target).toMatch(/Plus Jakarta Sans/);
  });
});
