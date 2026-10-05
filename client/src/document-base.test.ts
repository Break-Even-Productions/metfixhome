import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");

function pagesAssetPath(pagePath: string) {
  const origin = "https://metfix.org";
  const base = indexHtml.match(/<base\s+href="([^"]+)"\s*\/?>/i)?.[1];
  expect(base, "document base must be the site root").toBe("/");
  const documentUrl = new URL(pagePath, origin);
  return new URL("./assets/index.js", new URL(base, documentUrl)).pathname;
}

describe("GitHub Pages document base", () => {
  it("pins the document base to the site root with no first-segment heuristic", () => {
    expect(indexHtml).toMatch(/<base\s+href="\/"\s*\/?>/i);
    expect(indexHtml).not.toMatch(/known\[first\]/);
    expect(indexHtml).not.toMatch(/"\/" \+ first/);
    expect(indexHtml).toContain('property="og:url" content="https://metfix.org/"');
    expect(indexHtml).toContain('rel="canonical" href="https://metfix.org/"');
  });

  it("resolves Pages relative assets from the site root on nested Daily Fix and unknown paths", () => {
    const pages = [
      "/",
      "/classes",
      "/courses",
      "/become-an-affiliate",
      "/affiliate-seminars",
      "/the-daily-fix",
      "/the-daily-fix/250210",
      "/the-daily-fix/250210#brain",
      "/the-daily-fix/25/02/10",
      "/the-daily-fix/2025-02-10",
      "/the-daily-fix/20250210",
      "/the-daily-fix/25/02/10/belly",
      "/not-a-route",
    ];
    for (const path of pages) {
      expect(pagesAssetPath(path), path).toBe("/assets/index.js");
      expect(pagesAssetPath(path)).not.toMatch(/^\/the-daily-fix\//);
      expect(pagesAssetPath(path)).not.toMatch(/^\/not-a-route\//);
      expect(pagesAssetPath(path)).not.toMatch(/^\/25\//);
    }
  });
});
