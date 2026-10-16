import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

describe("B1/B5/B6/B7 build config", () => {
  it("B1 build:cf is vite build and base is /", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    expect(pkg.scripts["build:cf"]).toBe("vite build");
    const vite = readFileSync(fileURLToPath(new URL("../vite.config.ts", import.meta.url)), "utf8");
    expect(vite).toMatch(/base:\s*isPagesBuild\s*\?\s*"\.\/"\s*:\s*"\/"/);
  });

  it("B5 CI has dry-run only", () => {
    const ci = readFileSync(
      fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)),
      "utf8",
    );
    expect(ci).toContain("wrangler deploy --dry-run");
    expect(ci).not.toMatch(/CLOUDFLARE_API_TOKEN/);
    expect(ci).not.toMatch(/cloudflare\/wrangler-action/);
    const deployLines = ci.split("\n").filter((l) => l.includes("wrangler deploy"));
    expect(deployLines.length).toBeGreaterThan(0);
    expect(deployLines.every((l) => l.includes("--dry-run"))).toBe(true);
  });

  it("B7 sitemap index points at pages and daily-fix", () => {
    const window = new JSDOM("").window;
    const parser = new window.DOMParser();
    const index = parser.parseFromString(
      readFileSync(fileURLToPath(new URL("../client/public/sitemap.xml", import.meta.url)), "utf8"),
      "application/xml",
    );
    expect(index.getElementsByTagName("parsererror").length).toBe(0);
    expect(index.documentElement.localName).toBe("sitemapindex");
    expect(index.documentElement.namespaceURI).toBe(SITEMAP_NS);
    expect(index.getElementsByTagNameNS(SITEMAP_NS, "url").length).toBe(0);
    const indexLocs = [...index.getElementsByTagNameNS(SITEMAP_NS, "loc")].map((el) =>
      (el.textContent ?? "").trim(),
    );
    expect([...indexLocs].sort()).toEqual([
      "https://metfix.org/sitemap-daily-fix.xml",
      "https://metfix.org/sitemap-pages.xml",
    ]);

    const pages = parser.parseFromString(
      readFileSync(fileURLToPath(new URL("../client/public/sitemap-pages.xml", import.meta.url)), "utf8"),
      "application/xml",
    );
    expect(pages.getElementsByTagName("parsererror").length).toBe(0);
    expect(pages.documentElement.localName).toBe("urlset");
    expect(pages.documentElement.namespaceURI).toBe(SITEMAP_NS);
    const pageLocs = [...pages.getElementsByTagNameNS(SITEMAP_NS, "url")].map((url) =>
      (url.getElementsByTagNameNS(SITEMAP_NS, "loc")[0]?.textContent ?? "").trim(),
    );
    expect(pageLocs).toEqual([
      "https://metfix.org/",
      "https://metfix.org/become-an-affiliate",
      "https://metfix.org/classes",
      "https://metfix.org/affiliate-seminars",
      "https://metfix.org/llms.txt",
      "https://metfix.org/llms-full.txt",
    ]);
  });
});
