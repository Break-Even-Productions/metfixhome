/**
 * LB11 / PL12 — post-prose.css imported only by the two detail pages.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = path.resolve(import.meta.dirname, "..");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const DOCS_POST_LAYOUT = path.join(REPO_ROOT, "docs/post-layout-search");

const ALLOWED_SELECTOR_PREFIXES = [
  ".post-reader",
  ".post-author",
  ".post-detail",
  ".resource-media",
  ".posts-title",
  ".library-reader-title",
  ".posts-detail-content",
  ".library-reader-body",
  ".posts-detail-header",
];

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(p, out);
    else if (/\.(tsx?|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function extractRuleSelectors(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  const re = /([^{}]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutComments)) !== null) {
    const prelude = match[1].trim();
    if (!prelude || prelude.startsWith("@")) continue;
    for (const part of prelude.split(",")) {
      const sel = part.trim();
      if (sel) selectors.push(sel);
    }
  }
  return selectors;
}

function selectorHasAllowedPrefix(selector: string): boolean {
  const trimmed = selector.trim();
  return ALLOWED_SELECTOR_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

describe("LB11 post-prose import scope (PL12)", () => {
  it("exactly two importers: PostDetailPage + LibraryDetailPage", () => {
    const files = walkTsFiles(CLIENT).filter(
      (f) => !/\.test\.(tsx?|css)$/.test(f) && !f.endsWith("post-prose.css"),
    );
    const importers: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      if (/post-prose\.css/.test(src)) {
        importers.push(path.relative(CLIENT, f));
      }
    }
    expect(importers.sort()).toEqual(
      ["pages/library/LibraryDetailPage.tsx", "pages/posts/PostDetailPage.tsx"].sort(),
    );
  });

  it("every selector is scoped under allowed class prefixes (F3)", () => {
    const prose = fs.readFileSync(path.join(import.meta.dirname, "post-prose.css"), "utf8");
    expect(prose).toMatch(/\.posts-detail-content/);
    expect(prose).toMatch(/\.library-reader-body/);
    const selectors = extractRuleSelectors(prose);
    const bad = selectors.filter((s) => !selectorHasAllowedPrefix(s));
    expect(bad).toEqual([]);
  });

  it("no tracked *cq* notes under docs/post-layout-search (TC7 / CQ-8.3)", () => {
    const names = fs.readdirSync(DOCS_POST_LAYOUT);
    expect(names.filter((f) => /cq/i.test(f))).toEqual([]);
  });

  it("/library list keeps Plus Jakarta Sans (main font token)", () => {
    const css = fs.readFileSync(
      path.resolve(import.meta.dirname, "../pages/library/library.css"),
      "utf8",
    );
    expect(css).toMatch(/--lib-font-sans:\s*"Plus Jakarta Sans"/);
    expect(css).not.toMatch(/@import[^;]*post-prose\.css/);
  });
});
