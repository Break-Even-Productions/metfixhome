import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("B1/B5/B6/B7 build config", () => {
  it("B1 build:cf is vite build and base is /", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    expect(pkg.scripts["build:cf"]).toBe("vite build");
    const vite = readFileSync(fileURLToPath(new URL("../vite.config.ts", import.meta.url)), "utf8");
    expect(vite).toMatch(/base:\s*"\/"/);
    const pagesEnv = ["GITHUB", "PAGES"].join("_");
    const pagesFlag = "isPages" + "Build";
    expect(vite.includes(pagesEnv)).toBe(false);
    expect(vite.includes(pagesFlag)).toBe(false);
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

  it("B7 sitemap references daily-fix sitemap and keeps 6 urls", () => {
    const sm = readFileSync(
      fileURLToPath(new URL("../client/public/sitemap.xml", import.meta.url)),
      "utf8",
    );
    expect(sm).toContain("https://metfix.org/sitemap-daily-fix.xml");
    expect((sm.match(/<url>/g) || []).length).toBe(6);
  });
});
