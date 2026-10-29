import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

/** Main's run_worker_first before PR3 posts entries (A16 / PH1). */
const MAIN_RUN_WORKER_FIRST = [
  "/the-daily-fix",
  "/the-daily-fix/*",
  "/api/*",
  "/sitemap-daily-fix.xml",
] as const;

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

describe("B1/B5/B6/B7 build config", () => {
  it("B1 build:cf is vite build and base is /", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    expect(pkg.scripts["build:cf"]).toBe("vite build");
    const vite = readFileSync(fileURLToPath(new URL("../vite.config.ts", import.meta.url)), "utf8");
    expect(vite).toMatch(/base:\s*"\/"/);
    expect(vite).not.toMatch(/GITHUB_PAGES/);
    expect(vite).not.toMatch(/isPagesBuild/);
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

  it("A16/PH1 run_worker_first = main + /posts + /library; no sitemap-posts", () => {
    const raw = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    expect(json.assets.run_worker_first).toEqual([
      ...MAIN_RUN_WORKER_FIRST,
      "/posts",
      "/posts/*",
      "/library",
      "/library/*",
    ]);
    expect(json.assets.run_worker_first).not.toContain("/sitemap-posts.xml");
    const workerSrc = readFileSync(
      fileURLToPath(new URL("./index.ts", import.meta.url)),
      "utf8",
    );
    expect(workerSrc).not.toMatch(/sitemap-posts/);
  });

  it("R19 workers_dev is false", () => {
    const wrangler = readFileSync(
      fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
      "utf8",
    );
    expect(wrangler).toMatch(/"workers_dev"\s*:\s*false/);
  });

  it("preview_urls is true while workers_dev stays false", () => {
    const raw = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    expect(json.workers_dev).toBe(false);
    expect(json.preview_urls).toBe(true);
  });

  it("previews mirrors vars, preview KV, DO bindings, and 9 ratelimits", () => {
    const raw = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    const previews = json.previews;
    expect(previews).toBeTruthy();
    // STAGING_AUTH_HOSTS is preview-only — must never appear in top-level / production vars.
    expect(json.vars.STAGING_AUTH_HOSTS).toBeUndefined();
    expect(previews.vars.STAGING_AUTH_HOSTS).toBe(
      "staging-metfixhome.wispy-mode-982d.workers.dev",
    );
    const { STAGING_AUTH_HOSTS: _stagingOnly, ...previewVarsRest } = previews.vars;
    expect(previewVarsRest).toEqual(json.vars);
    expect(previews.kv_namespaces).toEqual([
      {
        binding: "AUTH_SESSIONS",
        id: "6976f8cf9e934258bd253b1d65bb4ece",
      },
    ]);
    // DP-CFG-2: preview KV id must equal top-level preview_id
    expect(previews.kv_namespaces[0].id).toBe(json.kv_namespaces[0].preview_id);
    expect(previews.durable_objects.bindings).toEqual(json.durable_objects.bindings);
    expect(previews.ratelimits).toHaveLength(9);
    expect(json.ratelimits).toHaveLength(9);
    expect(previews.ratelimits.map((r: { name: string }) => r.name)).toEqual(
      json.ratelimits.map((r: { name: string }) => r.name),
    );
    expect(previews.ratelimits.map((r: { simple: unknown }) => r.simple)).toEqual(
      json.ratelimits.map((r: { simple: unknown }) => r.simple),
    );
    expect(previews.ratelimits.map((r: { namespace_id: string }) => r.namespace_id)).toEqual([
      "27201",
      "27202",
      "27203",
      "27204",
      "27205",
      "27206",
      "27212",
      "27213",
      "27214",
    ]);
  });

  it("CI push branches include main and staging", () => {
    const ci = readFileSync(
      fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)),
      "utf8",
    );
    expect(ci).toMatch(/push:\s*\n\s*branches:\s*\[main,\s*staging\]/);
  });

  it("LOCAL_AUTH is never enabled in wrangler.jsonc (dev-only via .dev.vars)", () => {
    const wrangler = readFileSync(
      fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
      "utf8",
    );
    expect(wrangler).not.toMatch(/LOCAL_AUTH/);
    expect(wrangler).not.toMatch(/BSI_ORIGIN/);
  });

  it("STAGING_AUTH_HOSTS is only under previews.vars, never top-level vars", () => {
    const raw = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    expect(Object.prototype.hasOwnProperty.call(json.vars, "STAGING_AUTH_HOSTS")).toBe(false);
    expect(json.previews.vars.STAGING_AUTH_HOSTS).toBe(
      "staging-metfixhome.wispy-mode-982d.workers.dev",
    );
  });
});

