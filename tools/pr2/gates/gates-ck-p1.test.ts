/**
 * CK-P1 — docs pin + gate-ids count compare (A-PIN1).
 * M-CK1 skips the header gate-count compare in tools/pr2/ck-p1.mjs (pin only).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("CK-P1", () => {
  it("CK-P1 docs pin md5 and gate-ids count match catalog", () => {
    const ckSrc = readFileSync(path.join(REPO_ROOT, "tools/pr2/ck-p1.mjs"), "utf8");
    // Vacuity: active (non-comment) header-count compare must remain (M-CK1 removes it).
    expect(ckSrc).toMatch(/^\s*if\s*\(\s*gateIds\.length\s*!==\s*headerCount\s*\)/m);

    const r = spawnSync("node", ["tools/pr2/ck-p1.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(r.status, r.stderr || r.stdout).toBe(0);
    const out = JSON.parse(r.stdout || "{}") as { ok?: boolean; gateCount?: number };
    expect(out.ok).toBe(true);

    const qa = readFileSync(
      path.join(
        REPO_ROOT,
        "docs/metfix-pr2-comments-login/metfix-pr2-comments-login-tests.r1.25.md",
      ),
      "utf8",
    );
    const header = qa.match(/`gate-ids`\s+count:\s*(\d+)/i);
    expect(header, "QA header gate-ids count").toBeTruthy();
    const fence = qa.match(/```gate-ids\s*\n([\s\S]*?)```/);
    expect(fence, "gate-ids fence").toBeTruthy();
    const ids = fence![1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(ids.length).toBe(Number(header![1]));
    expect(out.gateCount).toBe(ids.length);
  });
});
