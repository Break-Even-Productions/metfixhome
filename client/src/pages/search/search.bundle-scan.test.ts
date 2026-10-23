/**
 * @vitest-environment node
 * Bundle / source scan: search modules must not import Map; SearchPage has no isFreeOpen.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SEARCH_DIR = join(ROOT, "client/src/pages/search");
const DIST = join(ROOT, "dist/public");

function walkJs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkJs(p));
    else if (/\.(js|mjs|css|html|map)$/.test(name)) out.push(p);
  }
  return out;
}

describe("search bundle / source scan", () => {
  it("search modules do not import Map", () => {
    for (const file of readdirSync(SEARCH_DIR)) {
      if (!/\.(ts|tsx)$/.test(file) || file.includes(".test.")) continue;
      const src = readFileSync(join(SEARCH_DIR, file), "utf8");
      expect(src).not.toMatch(/from\s+["'][^"']*Map["']/);
      expect(src).not.toMatch(/import\s*\(\s*["'][^"']*Map["']/);
      expect(src).not.toMatch(/pages\/Map/);
      expect(src).not.toMatch(/VITE_FRONTEND_FORGE/);
    }
  });

  it("SearchPage.tsx does not reference isFreeOpen", () => {
    const src = readFileSync(join(SEARCH_DIR, "SearchPage.tsx"), "utf8");
    expect(src).not.toMatch(/isFreeOpen/);
  });

  it("if dist/public exists, no Map forge marker in search-ish chunks", () => {
    if (!existsSync(DIST)) return;
    const files = walkJs(DIST);
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      expect(body).not.toContain("VITE_FRONTEND_FORGE");
    }
  });
});
