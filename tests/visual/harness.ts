import fs from "node:fs";
import path from "node:path";
import { type Page } from "@playwright/test";

export const BETA_SHA = "95f67814edd3e16d4fb3ba0f32de5d7f49111380";
export const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "390", width: 390, height: 844 },
] as const;

const FONT_DIR = path.join(import.meta.dirname, "fonts");
const HIDE_RECAPTCHA = path.join(import.meta.dirname, "fixtures/hide-recaptcha.css");

/** Route Google Fonts to vendored woff2 (LR-F23). */
export async function routeVendoredFonts(page: Page): Promise<void> {
  const playfair = path.join(
    FONT_DIR,
    "playfair-display",
    "playfair-display-latin-400-normal.woff2",
  );
  const jakarta = path.join(
    FONT_DIR,
    "plus-jakarta-sans",
    "plus-jakarta-sans-latin-400-normal.woff2",
  );

  await page.route(/fonts\.googleapis\.com\/css2/, async (route) => {
    const css = `
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/playfair/v1/playfair.woff2') format('woff2');
}
@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/jakarta/v1/jakarta.woff2') format('woff2');
}
`;
    await route.fulfill({ status: 200, contentType: "text/css", body: css });
  });

  await page.route(/fonts\.gstatic\.com\/.*playfair/, async (route) => {
    if (!fs.existsSync(playfair)) {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "font/woff2",
      body: fs.readFileSync(playfair),
    });
  });

  await page.route(/fonts\.gstatic\.com\/.*jakarta/, async (route) => {
    if (!fs.existsSync(jakarta)) {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "font/woff2",
      body: fs.readFileSync(jakarta),
    });
  });
}

/** Stub Worker/Sanity/BSI network (SR-4). */
export async function stubApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("recaptcha-site-key")) {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.__MFX_RECAPTCHA_SITE_KEY__='test';",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
}

export async function prepareVisualPage(page: Page): Promise<void> {
  await routeVendoredFonts(page);
  await stubApi(page);
  await page.addInitScript(() => {
    // Freeze clock to Chicago noon pin
    const fixed = new Date("2026-10-29T17:00:00.000Z").valueOf();
    Date.now = () => fixed;
  });
}

export async function settleForCapture(page: Page): Promise<void> {
  await page.addStyleTag({ path: HIDE_RECAPTCHA });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  await page.waitForFunction(() => {
    const okJakarta = document.fonts.check('16px "Plus Jakarta Sans"');
    const okPlayfair = document.fonts.check('16px "Playfair Display"');
    return okJakarta && okPlayfair;
  });
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  });
}

export const F1_A11Y_ROUTES = [
  "/become-an-affiliate",
  "/affiliate-seminars",
  "/the-daily-fix",
  "/posts",
  "/library",
  "/account",
  "/404",
] as const;
