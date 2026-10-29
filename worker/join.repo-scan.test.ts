import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|jsonc|json|css)$/.test(name)) out.push(p);
  }
  return out;
}

function isTestFile(file: string): boolean {
  return /\.test\.(ts|tsx|js|jsx)$/.test(file) || file.includes("__fixtures__");
}

function scanHits(
  files: string[],
  pattern: RegExp,
  opts?: { includeTests?: boolean },
): Array<{ file: string; match: string }> {
  const hits: Array<{ file: string; match: string }> = [];
  for (const file of files) {
    if (file.includes("join.repo-scan.test.ts")) continue;
    if (!opts?.includeTests && isTestFile(file)) continue;
    const text = readFileSync(file, "utf8");
    const m = text.match(pattern);
    if (m) hits.push({ file: file.replace(ROOT + "/", ""), match: m[0] });
  }
  return hits;
}

describe("WJ-WHOP-1 / WT-J1 / WT-J5 / WT-J6 repo scans", () => {
  const client = walk(join(ROOT, "client/src"));
  const worker = walk(join(ROOT, "worker")).filter((f) => !f.includes("__fixtures__"));
  const shared = walk(join(ROOT, "shared"));
  const wrangler = [join(ROOT, "wrangler.jsonc")];
  const all = [...client, ...worker, ...shared, ...wrangler];

  it("self-check: scanner detects curie + foreign biz_ on fixture text", () => {
    const fixture = "checkout https://curie.whop.com biz_FOREIGN123 plan_xyz";
    const curie = fixture.match(/curie/i);
    const biz = fixture.match(/biz_[A-Za-z0-9]+/g) ?? [];
    expect(curie).toBeTruthy();
    expect(biz.filter((b) => b !== "biz_u15G8d34g9c0B0")).toHaveLength(1);
  });

  it("zero Curie Whop identifiers in client/worker/shared/wrangler", () => {
    const hits = scanHits(
      all,
      /curie\.whop|whop\.com\/[^\s"']*curie|biz_(?!u15G8d34g9c0B0)[A-Za-z0-9]+/i,
    );
    expect(hits).toEqual([]);
  });

  it("zero legacy pricing / demo persistence keys in production sources", () => {
    const hits = scanHits(
      all,
      /\$1,000|100000|\$400 one-time|\$166\.60|metfix-join-demo|jordan\.hale@gmail\.com|googleAccounts/,
    );
    expect(hits).toEqual([]);
  });

  it("zero flat $90 certificate threshold copy in client production", () => {
    const hits = scanHits(client, /\$90/);
    expect(hits).toEqual([]);
  });

  it("zero localStorage/sessionStorage in client/src/join production", () => {
    const joinFiles = client.filter((f) => f.includes("/join/") && !isTestFile(f));
    const hits = scanHits(joinFiles, /localStorage|sessionStorage/);
    expect(hits).toEqual([]);
  });

  it("zero Manus references in join/membership production sources", () => {
    const targets = all.filter(
      (f) =>
        !isTestFile(f) &&
        (f.includes("/join/") ||
          f.endsWith("Membership.tsx") ||
          f.endsWith("worker/join.ts")),
    );
    const hits = scanHits(targets, /manus/i);
    expect(hits).toEqual([]);
  });

  it("zero NODE_ENV===test / __TEST__ hooks in join production files", () => {
    const prod = all.filter(
      (f) =>
        !isTestFile(f) &&
        (f.includes("/join/") || f.endsWith("worker/join.ts") || f.endsWith("Membership.tsx")),
    );
    const hits = scanHits(
      prod,
      /NODE_ENV\s*===\s*["']test["']|import\.meta\.env\.MODE\s*===\s*["']test["']|__TEST__/,
    );
    expect(hits).toEqual([]);
  });
});
