/**
 * PR B account repo-scan gates (CQ §5.3 / QA r1.1): zero Curie Whop, cancel_med,
 * manus, dangerouslySetInnerHTML in account/member pages, Rule-4 test hooks,
 * BEP biz pin, dist/ scan, COACH1 100000, CERT2 shared ltv import.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BEP_WHOP_COMPANY_ID } from "../shared/account/whop";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function walkFiles(dir: string, pred: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      out.push(...walkFiles(full, pred));
    } else if (ent.isFile() && pred(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanLines(
  files: string[],
  re: RegExp,
  opts?: { allow?: (file: string, line: string) => boolean },
): string[] {
  const failures: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!re.test(line)) continue;
      if (opts?.allow?.(file, line)) continue;
      failures.push(`${relative(REPO_ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  return failures;
}

const SRC_PRED = (n: string) =>
  n.endsWith(".ts") ||
  n.endsWith(".tsx") ||
  n.endsWith(".js") ||
  n.endsWith(".jsx") ||
  n.endsWith(".jsonc") ||
  n.endsWith(".json");

function sourceFiles(): string[] {
  const dirs = ["client/src", "worker", "shared"].map((d) => join(REPO_ROOT, d));
  return [
    ...dirs.flatMap((d) => walkFiles(d, SRC_PRED)),
    join(REPO_ROOT, "wrangler.jsonc"),
  ].filter((f) => existsSync(f));
}

describe("account.repo-scan", () => {
  it("DP-WHOP-1 / T4: zero Curie Whop identifiers outside allowlisted reject logic", () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(0);

    const failures = scanLines(files, /curie/i, {
      allow: (file, line) => {
        const rel = relative(REPO_ROOT, file);
        if (rel === "shared/account/url-allowlist.ts" && /FORBIDDEN_WHOP|curie/.test(line)) {
          return true;
        }
        if (rel === "shared/account/url-allowlist.test.ts") return true;
        if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) {
          return /reject|forbid|zero|never|curie|plant/i.test(line);
        }
        return false;
      },
    });
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("DP-WHOP-1: only BEP biz_ literal lives in shared/account/whop.ts; planted foreign fails", () => {
    const files = sourceFiles().filter((f) => {
      const rel = relative(REPO_ROOT, f);
      return !/\.test\.(ts|tsx)$/.test(rel);
    });
    const bizRe = /biz_[A-Za-z0-9]+/g;
    const foreign: string[] = [];
    const bepFiles: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = relative(REPO_ROOT, file);
      for (const m of text.matchAll(bizRe)) {
        if (m[0] !== BEP_WHOP_COMPANY_ID) {
          foreign.push(`${rel}: ${m[0]}`);
        } else if (rel !== "shared/account/whop.ts") {
          bepFiles.push(rel);
        }
      }
    }
    expect(foreign, foreign.join("\n")).toEqual([]);
    expect(bepFiles, `BEP literal must only appear in whop.ts; also in:\n${bepFiles.join("\n")}`).toEqual(
      [],
    );

    // Planted foreign biz_ must fail the scanner.
    const plantDir = mkdtempSync(join(tmpdir(), "whop1-plant-"));
    try {
      const plant = join(plantDir, "plant.js");
      writeFileSync(plant, `const x = "biz_FOREIGN123";\n`);
      const plantHits: string[] = [];
      for (const m of readFileSync(plant, "utf8").matchAll(bizRe)) {
        if (m[0] !== BEP_WHOP_COMPANY_ID) plantHits.push(m[0]);
      }
      expect(plantHits).toContain("biz_FOREIGN123");
    } finally {
      rmSync(plantDir, { recursive: true, force: true });
    }

    const distDir = join(REPO_ROOT, "dist/public");
    if (existsSync(distDir)) {
      const distFiles = walkFiles(distDir, (n) =>
        n.endsWith(".js") || n.endsWith(".html") || n.endsWith(".css") || n.endsWith(".map"),
      );
      const distCurie = scanLines(distFiles, /curie/i);
      expect(distCurie, distCurie.join("\n")).toEqual([]);
      const distForeign: string[] = [];
      for (const file of distFiles) {
        for (const m of readFileSync(file, "utf8").matchAll(bizRe)) {
          if (m[0] !== BEP_WHOP_COMPANY_ID) {
            distForeign.push(`${relative(REPO_ROOT, file)}: ${m[0]}`);
          }
        }
      }
      expect(distForeign, distForeign.join("\n")).toEqual([]);
    }
  });

  it("N1: client/ does not import shared account URL allowlist module", () => {
    const files = walkFiles(join(REPO_ROOT, "client/src"), SRC_PRED).filter(
      (f) => !/\.test\.(ts|tsx)$/.test(f),
    );
    const failures = scanLines(files, /@shared\/account\/url-allowlist|sanitizeExternalBillingUrl/);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("DP-T-COACH1: no 100000 / $1,000 coach LTV threshold in coach module", () => {
    const coach = join(REPO_ROOT, "shared/account/foundations-coach.ts");
    const src = readFileSync(coach, "utf8");
    expect(src).not.toMatch(/100000|1000_00|\$1,000/);
    expect(src).not.toMatch(/total_ltv|ltv_cents/);
  });

  it("DP-T-CERT2: shared ltv.ts imported by worker and client account pages", () => {
    const worker = readFileSync(join(REPO_ROOT, "worker/account.ts"), "utf8");
    expect(worker).toMatch(/from ["'].*shared\/account\/ltv["']/);
    const clientFiles = walkFiles(join(REPO_ROOT, "client/src/pages/account"), SRC_PRED).filter(
      (f) => !/\.test\.(ts|tsx)$/.test(f),
    );
    const importsLtv = clientFiles.some((f) =>
      /from ["']@shared\/account\/ltv["']|from ["'].*shared\/account\/ltv["']/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(importsLtv).toBe(true);
  });

  it("DP-T-COACH5: never OR BSI foundations_coach badge", () => {
    const src = readFileSync(join(REPO_ROOT, "worker/account.ts"), "utf8");
    expect(src).not.toMatch(/badges\.foundations_coach\s*\|\|/);
    expect(src).not.toMatch(/foundations_coach\s*\|\|\s*badges/);
  });

  it("T11: zero cancel_med_subscription", () => {
    const files = walkFiles(REPO_ROOT, SRC_PRED).filter((f) => {
      const rel = relative(REPO_ROOT, f);
      return (
        !rel.startsWith("node_modules/") &&
        !rel.startsWith("dist/") &&
        !rel.includes("account.repo-scan.test.ts")
      );
    });
    const failures = scanLines(files, /cancel_med_subscription/);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("zero manus references in production worker/client/shared", () => {
    const files = ["client/src", "worker", "shared"]
      .flatMap((d) => walkFiles(join(REPO_ROOT, d), SRC_PRED))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)));
    const failures = scanLines(files, /manus/i);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("T10: zero dangerouslySetInnerHTML in account/member pages when present", () => {
    const dirs = [
      join(REPO_ROOT, "client/src/pages/account"),
      join(REPO_ROOT, "client/src/pages/members"),
      join(REPO_ROOT, "client/src/pages/member"),
    ];
    const existing = dirs.filter((d) => existsSync(d));
    if (existing.length === 0) {
      expect(existing.length).toBe(0);
      return;
    }
    const files = existing
      .flatMap((d) => walkFiles(d, SRC_PRED))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)));
    const failures = scanLines(files, /dangerouslySetInnerHTML|role_badges_html/);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("Rule 4: zero test-only hooks in production worker/client/shared", () => {
    const files = ["client/src", "worker", "shared"]
      .flatMap((d) => walkFiles(join(REPO_ROOT, d), SRC_PRED))
      .filter((f) => {
        const rel = relative(REPO_ROOT, f);
        return !/\.test\.(ts|tsx)$/.test(rel) && !rel.includes("__fixtures__");
      });
    const patterns = [
      /__TEST__/,
      /process\.env\.VITEST/,
      /NODE_ENV\s*===\s*["']test["']/,
      /import\.meta\.env\.MODE\s*===\s*["']test["']/,
    ];
    const failures: string[] = [];
    for (const re of patterns) {
      failures.push(...scanLines(files, re));
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("T1: worker/account.ts never raw-fetches BSI without runUserBsiCall path helpers", () => {
    const file = join(REPO_ROOT, "worker/account.ts");
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).toContain("runUserBsiCall");
    expect(src).toContain("bsiAccountBearerHeaders");
    expect(src).not.toMatch(/DAILY_FIX_API_KEY/);
    expect(src).not.toMatch(/bsiBearerHeaders\(/);
    expect(src).not.toMatch(/bsiGetHeaders\(/);
    expect(src).not.toMatch(/bsiJsonHeaders\(/);
  });

  it("DP-T-CFG1: wrangler prod account limiter ids 27112-27114", () => {
    const raw = readFileSync(join(REPO_ROOT, "wrangler.jsonc"), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    const byName = Object.fromEntries(
      (json.ratelimits as Array<{ name: string; namespace_id: string; simple: { limit: number; period: number } }>).map(
        (r) => [r.name, r],
      ),
    );
    expect(byName.ACCOUNT_READ_LIMITER).toMatchObject({
      namespace_id: "27112",
      simple: { limit: 60, period: 60 },
    });
    expect(byName.ACCOUNT_WRITE_LIMITER).toMatchObject({
      namespace_id: "27113",
      simple: { limit: 15, period: 60 },
    });
    expect(byName.ACCOUNT_PORTAL_LIMITER).toMatchObject({
      namespace_id: "27114",
      simple: { limit: 10, period: 60 },
    });
  });
});
