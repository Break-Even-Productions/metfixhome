import { expect, test } from "@playwright/test";
import path from "node:path";
import { prepareVisualPage, settleForCapture } from "./harness";

/**
 * T-F-70 / FN-4: production CSS/layout must not hide the reCAPTCHA badge.
 * Uses offline stub; does not prove Google renders a live badge.
 */
const STUB = path.join(import.meta.dirname, "../fixtures/recaptcha-stub.js");

test.describe("F1 prod-badge (T-F-70)", () => {
  test.use({
    // No hide-recaptcha fixture in this project (see playwright.config).
  });

  test("/the-daily-fix badge visible under stub", async ({ page }) => {
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (/google\.com\/recaptcha\/api\.js|recaptcha\//.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          path: STUB,
        });
        return;
      }
      // Block other external hosts
      const u = new URL(url);
      if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
        await route.abort();
        return;
      }
      await route.continue();
    });

    await prepareVisualPage(page);
    // Intentionally do NOT call settleForCapture (that injects hide-recaptcha).
    await page.goto("/the-daily-fix", { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: STUB });
    await page.waitForTimeout(50);

    const badge = page.locator(".grecaptcha-badge");
    await expect(badge).toBeAttached();
    const box = await badge.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    const style = await badge.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        visibility: s.visibility,
        display: s.display,
        opacity: Number(s.opacity),
      };
    });
    expect(style.visibility).not.toBe("hidden");
    expect(style.display).not.toBe("none");
    expect(style.opacity).toBeGreaterThan(0);
  });
});
