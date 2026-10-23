/**
 * LB11 / PL12 — post-prose.css imported only by the two detail pages.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = path.resolve(import.meta.dirname, "..");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(p, out);
    else if (/\.(tsx?|css)$/.test(ent.name)) out.push(p);
  }
  return out;
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
    expect(importers.sort()).toEqual([
      "pages/library/LibraryDetailPage.tsx",
      "pages/posts/PostDetailPage.tsx",
    ].sort());
  });

  it("every selector is scoped under body classes; no bare p/h1/body", () => {
    const prose = fs.readFileSync(path.join(import.meta.dirname, "post-prose.css"), "utf8");
    expect(prose).toMatch(/\.posts-detail-content/);
    expect(prose).toMatch(/\.library-reader-body/);
    // Reject unscoped element selectors like `p {` or `body,` (not class-prefixed).
    const bad = prose.match(/(?:^|[,}])\s*(p|h1|body|img)\s*[,{]/gm);
    expect(bad).toBeNull();
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
