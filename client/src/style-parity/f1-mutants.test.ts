import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  commandViolates,
  collectPlaywrightScriptSet,
} from "../../../tests/ci/checkUpdateSnapshots.mjs";
import { VISUAL_HOOK_PATTERN } from "../../../tests/visual/hookPattern";
import { expectedSearchHrefFromApp } from "./searchHref";

const root = path.resolve(import.meta.dirname, "../..");
const indexCss = readFileSync(path.join(root, "src/index.css"), "utf8");
const login = readFileSync(path.join(root, "src/pages/Login.tsx"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "../package.json"), "utf8"));

function contrast(fg: string, bg: string): number {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const rgb = [0, 2, 4].map((i) => {
      const v = parseInt(n.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const L1 = lum(fg);
  const L2 = lum(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Eight high-value mutants that must stay red (Lead: kill 8 mutants). */
describe("F1 mutant kills (★FM)", () => {
  it("FM19: muted #6b645a fails cream-2 contrast", () => {
    expect(contrast("#6b645a", "#e9e1d2")).toBeLessThan(4.5);
    expect(indexCss).toMatch(/--color-muted:\s*#686158/i);
    expect(indexCss).not.toMatch(/--color-muted:\s*#6b645a/i);
  });

  it("FM21: danger stays #9a4a2e not #c45c3a as text token", () => {
    expect(indexCss).toMatch(/--color-danger-text:\s*#9a4a2e/i);
    expect(contrast("#c45c3a", "#f3eee4")).toBeLessThan(4.5);
  });

  it("FM23: muted-2 #8a8378 fails as text on cream", () => {
    expect(contrast("#8a8378", "#f3eee4")).toBeLessThan(4.5);
  });

  it("FM27/FM48: playwright + axe pins are exact (no caret)", () => {
    for (const k of ["@playwright/test", "@axe-core/playwright", "axe-core"]) {
      expect(pkg.devDependencies[k]).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("FM64/65: login terms not terms-of-use", () => {
    const old = ["terms-of", "use"].join("-");
    expect(login).not.toContain(old);
    expect(login).toContain("https://brokenscience.org/terms-and-conditions/");
  });

  it("FM66: no data-visual hooks in client source", () => {
    expect(VISUAL_HOOK_PATTERN.test('data-visual-region="course-grid"')).toBe(true);
    expect(indexCss).not.toMatch(VISUAL_HOOK_PATTERN);
  });

  it("FM62: CI updateSnapshots path is none", () => {
    const cfg = readFileSync(path.join(root, "../playwright.config.ts"), "utf8");
    expect(cfg).toMatch(/updateSnapshots:\s*process\.env\.CI\s*\?\s*"none"/);
  });

  it("snapshot -u mutants fail checker (ER-13)", () => {
    const scripts = { "test:visual": "playwright test", test: "vitest run" };
    const set = collectPlaywrightScriptSet(scripts);
    expect(commandViolates("npx playwright test -u", set, scripts)).toBe(true);
    expect(commandViolates("diff -u a b; npx playwright test", set, scripts)).toBe(false);
  });

  it("ER-14: shadowed /library/search falls back", () => {
    const planted = [
      `<Route path={"/library/:slug"} component={Slug} />`,
      `<Route path={"/library/search"} component={LibrarySearchPage} />`,
    ].join("\n");
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });
});
