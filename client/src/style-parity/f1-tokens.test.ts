import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VISUAL_HOOK_PATTERN } from "../../../tests/visual/hookPattern";

const root = path.resolve(import.meta.dirname, "../..");
const indexCss = readFileSync(path.join(root, "src/index.css"), "utf8");
const appTsx = readFileSync(path.join(root, "src/App.tsx"), "utf8");
const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "../package.json"), "utf8"));
const loginTsx = readFileSync(path.join(root, "src/pages/Login.tsx"), "utf8");

/** ER-7: exactly one @theme / @theme inline block. */
function themeBlock(css: string): string {
  const re = /@theme( inline)?\s*\{/g;
  const opens = css.match(re) ?? [];
  expect(opens.length, "exactly one @theme block").toBe(1);
  const m = css.match(/@theme( inline)?\s*\{([\s\S]*?)\n\}/);
  expect(m, "@theme block").toBeTruthy();
  return m![2];
}

function normHex(v: string): string {
  return v.trim().toLowerCase();
}

function countDecl(block: string, name: string): number {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "g");
  return (block.match(re) ?? []).length;
}

function relLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const rgb = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a: string, b: string): number {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

describe("F1 tokens (T-F-23, T-F-41, T-F-55)", () => {
  it("defines AA text tokens once in index.css @theme/:root", () => {
    expect(indexCss).toMatch(/--color-accent-text:\s*#775f37/i);
    expect(indexCss).toMatch(/--color-muted:\s*#686158/i);
    expect(indexCss).toMatch(/--color-danger-text:\s*#9a4a2e/i);
    expect(indexCss).toMatch(/--color-cream:\s*#f3eee4/i);
    expect(indexCss).toMatch(/--color-cream-2:\s*#e9e1d2/i);
    expect(indexCss).toMatch(/--color-paper:\s*#faf7f1/i);
    expect(indexCss).toMatch(/--color-backdrop:\s*rgb\(0 0 0 \/ 0\.5\)/);
    expect(indexCss).not.toMatch(/tokens\.css/);
    expect((indexCss.match(/^@theme\b/gm) ?? []).length).toBe(1);
  });

  it("meets contrast matrix ratios (±0.05)", () => {
    const pairs: [string, string, number][] = [
      ["#775f37", "#f3eee4", 5.22],
      ["#775f37", "#faf7f1", 5.65],
      ["#775f37", "#e9e1d2", 4.65],
      ["#686158", "#f3eee4", 5.28],
      ["#686158", "#faf7f1", 5.71],
      ["#686158", "#e9e1d2", 4.7],
      ["#9a4a2e", "#f3eee4", 5.35],
      ["#9a4a2e", "#faf7f1", 5.79],
      ["#9a4a2e", "#e9e1d2", 4.76],
      ["#171512", "#c4a46c", 7.7],
    ];
    for (const [fg, bg, expected] of pairs) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(expected - 0.05);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("bans muted-2 #8a8378 and old muted as text allowlist failures", () => {
    expect(indexCss).toMatch(/--color-muted-2:\s*#8a8378/i);
    // Self-check: #8a8378 fails AA on cream
    expect(contrast("#8a8378", "#f3eee4")).toBeLessThan(4.5);
  });
});

describe("F1 light theme (T-F-36, T-F-52)", () => {
  it("App.tsx defaultTheme is light", () => {
    expect(appTsx).toMatch(/defaultTheme="light"/);
    expect(appTsx).not.toMatch(/defaultTheme="dark"/);
  });

  it("has no dark mode CSS hooks", () => {
    expect(indexCss).not.toMatch(/@custom-variant\s+dark/);
    expect(indexCss).not.toMatch(/(^|\n)\.dark\s*\{/);
  });

  it("ui components have no dark: variants", () => {
    const uiDir = path.join(root, "src/components/ui");
    for (const name of readdirSync(uiDir)) {
      if (!name.endsWith(".tsx")) continue;
      const src = readFileSync(path.join(uiDir, name), "utf8");
      expect(src, name).not.toMatch(/dark:\S/);
      if (name === "chart.tsx") {
        expect(src).not.toMatch(/dark:\s*["']\.dark["']/);
      }
    }
  });
});

describe("F1 fonts (T-F-22)", () => {
  it("index.html loads only Playfair + Plus Jakarta with display=swap", () => {
    expect(indexHtml).toMatch(/fonts\.googleapis\.com/);
    expect(indexHtml).toMatch(/display=swap/);
    expect(indexHtml).toMatch(/Playfair\+Display/);
    expect(indexHtml).toMatch(/Plus\+Jakarta\+Sans/);
    expect(indexHtml).not.toMatch(/DM\+Sans|DM\+Mono|family=Inter|Instrument\+Serif|JetBrains/);
  });

  it("fallback metric @font-face present", () => {
    expect(indexCss).toMatch(/size-adjust/);
    expect(indexCss).toMatch(/ascent-override/);
  });
});

describe("F1 tokens T-F-72 / T-F-52 (FN-3 / ER-2 / ER-7)", () => {
  it("declares paper, cream-2, footer-band exactly once with exact values", () => {
    const block = themeBlock(indexCss);
    expect(countDecl(block, "--color-paper")).toBe(1);
    expect(countDecl(block, "--color-cream-2")).toBe(1);
    expect(countDecl(block, "--color-footer-band")).toBe(1);
    const paper = block.match(/--color-paper:\s*([^;]+);/i)?.[1] ?? "";
    const cream2 = block.match(/--color-cream-2:\s*([^;]+);/i)?.[1] ?? "";
    const band = block.match(/--color-footer-band:\s*([^;]+);/i)?.[1] ?? "";
    expect(normHex(paper)).toBe("#faf7f1");
    expect(normHex(cream2)).toBe("#e9e1d2");
    expect(normHex(band)).toBe("#100e0c");
  });

  it("exemptions are name-keyed: one footer-band + one backdrop in @theme", () => {
    const block = themeBlock(indexCss);
    expect(countDecl(block, "--color-backdrop")).toBe(1);
    expect(countDecl(block, "--color-footer-band")).toBe(1);
    const planted = `${block}\n  --color-footer-band: #100e0c;\n`;
    expect(countDecl(planted, "--color-footer-band")).toBe(2);
  });
});

describe("F1 tooling (T-F-60, T-F-62, T-F-65, T-F-67, T-F-69, T-F-71)", () => {
  it("pins playwright and axe exactly", () => {
    expect(pkg.devDependencies["@playwright/test"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies["@axe-core/playwright"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies["axe-core"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("hide-recaptcha fixture lives only under tests/", () => {
    const hide = readFileSync(
      path.join(root, "../tests/visual/fixtures/hide-recaptcha.css"),
      "utf8",
    );
    expect(hide).toMatch(/\.grecaptcha-badge/);
    expect(indexCss).not.toMatch(/grecaptcha-badge/);
  });

  it("VISUAL_HOOK_PATTERN finds 0 matches in client/src (T-F-65)", () => {
    function walk(dir: string, out: string[] = []) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, name.name);
        if (name.isDirectory()) walk(fp, out);
        else if (/\.(tsx?|css|html)$/.test(name.name) && !name.name.includes(".test.")) {
          out.push(fp);
        }
      }
      return out;
    }
    for (const fp of walk(path.join(root, "src"))) {
      const src = readFileSync(fp, "utf8");
      expect(src, fp).not.toMatch(VISUAL_HOOK_PATTERN);
    }
  });

  it("vendors fonts with OFL, sha256 manifest, ≤1.5MB (FONTS1 / T-F-67)", () => {
    const fontRoot = path.join(root, "../tests/visual/fonts");
    const families = [
      "playfair-display",
      "plus-jakarta-sans",
      "montserrat",
      "oswald",
      "outfit",
      "poppins",
    ];
    let total = 0;
    const seenHash = new Set<string>();
    for (const fam of families) {
      const ofl = path.join(fontRoot, fam, "OFL.txt");
      expect(readFileSync(ofl, "utf8")).toMatch(/SIL Open Font License/i);
      for (const name of readdirSync(path.join(fontRoot, fam))) {
        const fp = path.join(fontRoot, fam, name);
        const buf = readFileSync(fp);
        total += buf.byteLength;
        if (name.endsWith(".woff2")) {
          const h = createHash("sha256").update(buf).digest("hex");
          expect(seenHash.has(h), `duplicate font hash ${fam}/${name}`).toBe(false);
          seenHash.add(h);
        }
      }
    }
    expect(total).toBeLessThanOrEqual(1_572_864);
    const manifest = JSON.parse(
      readFileSync(path.join(root, "../tests/visual/manifest.json"), "utf8"),
    );
    expect(Object.keys(manifest.fontHashes || {}).length).toBeGreaterThanOrEqual(6);
    for (const [rel, hash] of Object.entries(manifest.fontHashes as Record<string, string>)) {
      const fp = path.join(fontRoot, rel);
      expect(existsSync(fp), rel).toBe(true);
      expect(createHash("sha256").update(readFileSync(fp)).digest("hex")).toBe(hash);
    }
    for (const build of ["target.css", "beta.css"]) {
      const css = readFileSync(path.join(fontRoot, "css", build), "utf8");
      expect(css).toMatch(/@font-face/);
      expect(css).toMatch(/fonts\.gstatic\.com/);
      // latin + latin-ext only (no cyrillic / vietnamese / greek blocks)
      expect(css).not.toMatch(/\/\*\s*cyrillic/);
      expect(css).not.toMatch(/\/\*\s*vietnamese/);
    }
  });

  it("FOOTER_LINK_ALLOWLIST is defined once in siteFooterLinks.ts", () => {
    const allow = readFileSync(
      path.join(root, "src/components/siteFooterLinks.ts"),
      "utf8",
    );
    expect(allow).toMatch(/export const FOOTER_LINK_ALLOWLIST/);
    expect(allow).toMatch(/terms-and-conditions/);
    expect(allow).not.toContain(["terms-of", "use"].join("-"));
  });

  it("T-F-71: login Terms href is brokenscience terms-and-conditions; old path gone", () => {
    expect(loginTsx).toMatch(
      /href=["']https:\/\/brokenscience\.org\/terms-and-conditions\/["']/,
    );
    // Old 404 path split so this file does not self-match the scan needle.
    const oldTerms = ["terms-of", "use"].join("-");
    expect(loginTsx).not.toContain(oldTerms);
    function walk(dir: string, out: string[] = []) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, name.name);
        if (name.isDirectory()) walk(fp, out);
        else if (
          /\.(tsx?|css)$/.test(name.name) &&
          !name.name.includes(".test.")
        ) {
          out.push(fp);
        }
      }
      return out;
    }
    for (const fp of walk(path.join(root, "src"))) {
      const src = readFileSync(fp, "utf8");
      expect(src, fp).not.toContain(oldTerms);
    }
  });

  it("scrims use bg-backdrop and ban raw bg-black", () => {
    for (const name of ["dialog.tsx", "sheet.tsx", "drawer.tsx", "alert-dialog.tsx"]) {
      const src = readFileSync(path.join(root, "src/components/ui", name), "utf8");
      expect(src, name).toMatch(/bg-backdrop/);
      expect(src, name).not.toMatch(/bg-black/);
    }
  });

  it("manifest beta SHA is 95f67814 (T-F-68)", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(root, "../tests/visual/manifest.json"), "utf8"),
    );
    expect(String(manifest.betaSha || manifest.beta || "")).toMatch(/^95f67814/);
  });
});

describe("F1 CSS hygiene (T-F-56)", () => {
  it("!important count does not exceed ceiling 91", () => {
    const cssFiles: string[] = [];
    function walk(dir: string) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, name.name);
        if (name.isDirectory()) walk(fp);
        else if (name.name.endsWith(".css")) cssFiles.push(fp);
      }
    }
    walk(path.join(root, "src"));
    let count = 0;
    for (const fp of cssFiles) {
      count += (readFileSync(fp, "utf8").match(/!important/g) ?? []).length;
    }
    expect(count).toBeLessThanOrEqual(91);
  });

  it("no hand-rolled .hidden / md: utilities in index.css", () => {
    expect(indexCss).not.toMatch(/\.hidden\s*\{\s*display:\s*none\s*!important/);
  });
});
