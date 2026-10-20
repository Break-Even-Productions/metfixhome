import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const MAIN_BASE = "9f7129d7";

describe("PR2 gate A1", () => {
  it("A1.1 merge-base includes main and data.ts/data.test.ts diff is empty", () => {
    execSync(`git merge-base --is-ancestor ${MAIN_BASE} HEAD`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    const diff = execSync(
      `git diff ${MAIN_BASE} HEAD -- client/src/pages/the-daily-fix/data.ts client/src/pages/the-daily-fix/data.test.ts`,
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(diff.trim()).toBe("");
  });

  it("A1.3 no BFF host in client/src and data.test uses Worker ISO URL", () => {
    const rg = execSync(
      `git grep -n "metfix-bff\\|wispy-mode-982d" -- client/src || true`,
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(rg.trim()).toBe("");
    const dataTest = readFileSync(
      path.join(REPO_ROOT, "client/src/pages/the-daily-fix/data.test.ts"),
      "utf8",
    );
    expect(dataTest).toMatch(/asks the Worker for an ISO date, never a YYMMDD path segment/);
    expect(dataTest).toMatch(/DAILY_FIX_BFF_URL\]\?date=2025-02-10/);
    expect(dataTest).toMatch(/DAILY_FIX_BFF_URL\)\.toBe\("\/api\/daily-fix"\)/);
  });
});
