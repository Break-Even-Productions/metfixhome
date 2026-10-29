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

/** Map gstatic basename → absolute vendored woff2 path. */
function buildFontIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const fam of fs.readdirSync(FONT_DIR, { withFileTypes: true })) {
    if (!fam.isDirectory() || fam.name === "css") continue;
    const dir = path.join(FONT_DIR, fam.name);
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".woff2")) continue;
      map.set(name, path.join(dir, name));
    }
  }
  return map;
}

const FONT_INDEX = buildFontIndex();

/** Route Google Fonts to vendored woff2 (LR-F23 / FONTS1). */
export async function routeVendoredFonts(page: Page): Promise<void> {
  await page.route(/fonts\.googleapis\.com\/css2/, async (route) => {
    // FONTS1: serve saved target CSS2 (never beta.css — FM82).
    const cssPath = path.join(FONT_DIR, "css", "target.css");
    const css = fs.readFileSync(cssPath, "utf8");
    await route.fulfill({ status: 200, contentType: "text/css", body: css });
  });

  await page.route(/fonts\.gstatic\.com\//, async (route) => {
    const url = route.request().url();
    const base = url.split("?")[0].split("/").pop() ?? "";
    let file = FONT_INDEX.get(base);
    // Never abort: a pending/aborted face blocks document.fonts.ready forever.
    if (!file || !fs.existsSync(file)) {
      file =
        FONT_INDEX.get(
          [...FONT_INDEX.keys()].find((k) => k.includes("jakarta") || k.includes("LDIo")) ?? "",
        ) ?? [...FONT_INDEX.values()][0];
    }
    if (!file || !fs.existsSync(file)) {
      await route.fulfill({ status: 200, contentType: "font/woff2", body: Buffer.alloc(0) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "font/woff2",
      body: fs.readFileSync(file),
    });
  });
}

/** 1×1 PNG — fixed placeholder so image load/fail never changes page height. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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
  // Block third-party embeds (YouTube) — their chrome fails axe and is not F1 UI.
  await page.route(/youtube\.com|youtu\.be|ytimg\.com|googlevideo\.com/, (route) =>
    route.abort(),
  );
  // Deterministic media: image requests → same 1×1 PNG (CI/local height parity).
  // Use fallback() (not continue()) so earlier **/api/** and font routes still run.
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: PIXEL_PNG });
      return;
    }
    await route.fallback();
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
  // Wait out client-side redirects (/account → /login, etc.) before injecting styles.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(100);
  await page.addStyleTag({ path: HIDE_RECAPTCHA });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Force scroll-reveal / motion layers fully visible before contrast + screenshot.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
      /* Hide scrollbars — jammy vs noble widths shift aspect-ratio box heights. */
      html {
        scrollbar-gutter: auto;
        scrollbar-width: none !important;
      }
      html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
      body {
        overflow-y: scroll;
        scrollbar-width: none !important;
      }
      .reveal, .reveal.visible, [class*="reveal"] {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
        filter: none !important;
      }
      /*
       * DF meal/pillar bands use width×aspect-ratio (+ svh max-height). Any
       * content-width delta (scrollbar, font) changes fullPage height by a few
       * px and fails toHaveScreenshot dimension checks. Pin explicit heights.
       */
      .df-meal-photo, .df-photo {
        aspect-ratio: auto !important;
        width: 100% !important;
        max-height: none !important;
        height: 360px !important;
      }
      /* In-flow images get a stable box; absolute fill imgs keep parent size. */
      img:not([style*="position: absolute"]):not(.df-meal-photo-img) {
        width: 240px !important;
        height: 160px !important;
        max-width: 100% !important;
        object-fit: cover !important;
      }
      iframe { display: none !important; height: 0 !important; }
      /* LiquidGlass canvas overhang must not inflate scrollHeight. */
      canvas { max-height: 0 !important; overflow: hidden !important; }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll(".reveal, [class*='reveal']").forEach((el) => {
      el.classList.add("visible");
      (el as HTMLElement).style.setProperty("opacity", "1", "important");
      (el as HTMLElement).style.setProperty("transform", "none", "important");
      (el as HTMLElement).style.setProperty("visibility", "visible", "important");
    });
    // Drop third-party iframes (YouTube) so axe does not score embed chrome.
    document.querySelectorAll("iframe").forEach((el) => {
      el.remove();
    });
    // Ensure every img has intrinsic box attrs so 1×1 stubs never collapse flow.
    document.querySelectorAll("img").forEach((img) => {
      if (!img.getAttribute("width")) img.setAttribute("width", "240");
      if (!img.getAttribute("height")) img.setAttribute("height", "160");
      if (!img.complete || img.naturalWidth === 0) {
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      }
    });
  });
  await page.waitForTimeout(100);
  // Explicit loads (F-T-SETTLE): avoid hanging on fonts.ready when any face pendings.
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((r) => setTimeout(r, 3_000)),
    ]);
    await Promise.all([
      document.fonts.load('400 16px "Plus Jakarta Sans"'),
      document.fonts.load('700 16px "Plus Jakarta Sans"'),
      document.fonts.load('400 16px "Playfair Display"'),
      document.fonts.load('700 16px "Playfair Display"'),
    ]).catch(() => undefined);
  });
  await page.waitForFunction(
    () =>
      document.fonts.check('16px "Plus Jakarta Sans"') &&
      document.fonts.check('16px "Playfair Display"'),
    { timeout: 15_000 },
  );
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
