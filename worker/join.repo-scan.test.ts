import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BEP_WHOP_COMPANY_ID, WHOP_ALLOWED_COMPANY_IDS } from "../shared/join/membership-domain";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|css|jsonc|json|html|map)$/.test(name)) out.push(p);
  }
  return out;
}

function isTestFile(file: string): boolean {
  return /\.test\.(ts|tsx|js|jsx)$/.test(file) || file.includes("__fixtures__");
}

/** Real scanner — returns every hit (file + match), not a fixture-only regex. */
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
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      hits.push({ file: file.replace(ROOT + "/", ""), match: m[0] });
    }
  }
  return hits;
}

describe("WJ-WHOP-1 / WT-J1 / WT-J5 / WT-J6 repo scans", () => {
  const client = walk(join(ROOT, "client/src"));
  const worker = walk(join(ROOT, "worker")).filter((f) => !f.includes("__fixtures__"));
  const shared = walk(join(ROOT, "shared"));
  const wrangler = [join(ROOT, "wrangler.jsonc")];
  const distRoot = join(ROOT, "dist/public");
  const distPublic = walk(distRoot);
  const all = [...client, ...worker, ...shared, ...wrangler];
  const withDist = [...all, ...distPublic];

  it("WT-J1: dist/public must exist when MFX_REQUIRE_DIST=1 (after build:cf)", () => {
    // Vacuity guard — empty walk would green-pass Whop scans without a bundle.
    // Early `npm test` skips; CI post-build step sets MFX_REQUIRE_DIST=1.
    if (process.env.MFX_REQUIRE_DIST !== "1") return;
    expect(existsSync(distRoot), "dist/public missing — run npm run build:cf first").toBe(true);
    expect(distPublic.length, "dist/public has no scannable assets").toBeGreaterThan(0);
  });

  it("self-check: real scanHits detects curie + foreign biz_ (2 hits)", () => {
    const dir = mkdtempSync(join(tmpdir(), "wj-whop-self-"));
    const fixturePath = join(dir, "fixture.txt");
    writeFileSync(fixturePath, "checkout https://curie.whop.com/x biz_FOREIGN123 plan_xyz\n");
    const curie = scanHits([fixturePath], /curie/i, { includeTests: true });
    const foreignBiz = scanHits([fixturePath], /biz_[A-Za-z0-9]+/g, { includeTests: true }).filter(
      (h) => !(WHOP_ALLOWED_COMPANY_IDS as readonly string[]).includes(h.match),
    );
    expect(curie.length + foreignBiz.length).toBe(2);
    expect(foreignBiz).toHaveLength(1);
    expect(BEP_WHOP_COMPANY_ID).toBe("biz_u15G8d34g9c0B0");
  });

  it("zero bare curie (case-insensitive) outside deny-guard allowlist files", () => {
    // Deny-guards in membership-domain intentionally mention curie — exclude that file only.
    const cleaned = scanHits(withDist, /curie/i).filter(
      (h) => !h.file.endsWith("shared/join/membership-domain.ts"),
    );
    expect(cleaned).toEqual([]);
  });

  it("every biz_* literal equals BEP company id (or none)", () => {
    const hits = scanHits(withDist, /biz_[A-Za-z0-9]+/g);
    const foreign = hits.filter(
      (h) => !(WHOP_ALLOWED_COMPANY_IDS as readonly string[]).includes(h.match),
    );
    expect(foreign).toEqual([]);
  });

  it("zero foreign plan_* / prod_* Whop identifiers", () => {
    const hits = scanHits(withDist, /\b(?:plan|prod)_[A-Za-z0-9]+/g);
    expect(hits).toEqual([]);
  });

  it("zero Curie Whop URL shapes in client/worker/shared/wrangler (+ dist)", () => {
    const hits = scanHits(
      withDist,
      /curie\.whop|whop\.com\/[^\s"']*curie/i,
    );
    expect(hits).toEqual([]);
  });

  it("zero legacy pricing / demo persistence keys in production sources", () => {
    const hits = scanHits(
      all,
      /\$1,000|100000|\$400 one-time|\$166\.60|metfix-join-demo|jordan\.hale@gmail\.com|googleAccounts|test-recaptcha-token/,
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

  it("uses BEP_WHOP_COMPANY_ID as the sole allowed company constant", () => {
    expect([...WHOP_ALLOWED_COMPANY_IDS]).toEqual([BEP_WHOP_COMPANY_ID]);
  });
});
