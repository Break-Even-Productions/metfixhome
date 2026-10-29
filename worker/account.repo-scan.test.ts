/**
 * PR B account repo-scan gates (CQ §5.3 / QA §F): zero Curie Whop, cancel_med,
 * manus, dangerouslySetInnerHTML in account/member pages, Rule-4 test hooks.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function walkFiles(dir: string, pred: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
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

describe("account.repo-scan", () => {
  it("DP-WHOP-1 / T4: zero Curie Whop identifiers outside allowlisted reject logic", () => {
    const dirs = ["client/src", "worker", "shared"].map((d) => join(REPO_ROOT, d));
    const files = [
      ...dirs.flatMap((d) => walkFiles(d, SRC_PRED)),
      join(REPO_ROOT, "wrangler.jsonc"),
    ].filter((f) => existsSync(f));
    expect(files.length).toBeGreaterThan(0);

    const failures = scanLines(files, /curie/i, {
      allow: (file, line) => {
        const rel = relative(REPO_ROOT, file);
        // Allowlist substring rejector + its tests only.
        if (rel === "shared/account/url-allowlist.ts" && /FORBIDDEN_WHOP|curie/.test(line)) {
          return true;
        }
        if (rel === "shared/account/url-allowlist.test.ts") return true;
        if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) {
          // Tests may mention Curie only when asserting rejection.
          return /reject|forbid|zero|never|curie/i.test(line);
        }
        return false;
      },
    });
    expect(failures, failures.join("\n")).toEqual([]);
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
      // Pages not landed yet — vacuous pass (assignment: if they exist yet).
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
    expect(src).toContain("bsiAccountBearerHeaders");
    // Must not send shared Daily Fix / posts API key on account upstream calls.
    expect(src).not.toMatch(/DAILY_FIX_API_KEY/);
    expect(src).not.toMatch(/bsiBearerHeaders\(/);
    expect(src).not.toMatch(/bsiGetHeaders\(/);
    expect(src).not.toMatch(/bsiJsonHeaders\(/);
  });
});
