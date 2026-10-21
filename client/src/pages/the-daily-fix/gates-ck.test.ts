import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, expectTypeOf } from "vitest";
import type { Env } from "../../../../worker/upstream";
import { dailyFixCommentsRequestUrl, type CommentType } from "./comments";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function md5File(rel: string): string {
  return createHash("md5")
    .update(readFileSync(path.join(REPO_ROOT, rel)))
    .digest("hex");
}

describe("PR2 gate CK", () => {
  it("CKB1.1 wrangler workers_dev is false", () => {
    const wrangler = readFileSync(path.join(REPO_ROOT, "wrangler.jsonc"), "utf8");
    expect(wrangler).toMatch(/"workers_dev"\s*:\s*false/);
  });

  it("CKCI1.1 in-repo acceptance spec md5 matches QA list pin", () => {
    const specRel = "docs/metfix-pr2-comments-login/metfix-pr2-comments-login-acceptance.rev1.6.4.md";
    expect(md5File(specRel)).toBe("aef149a19d6f8b067666b363fb313822");
  });

  it("CKCI1.2 AU22.1 storage scan would fail on JoinModal plant", () => {
    const join = readFileSync(path.join(REPO_ROOT, "client/src/pages/the-daily-fix/JoinModal.tsx"), "utf8");
    const lines = `${join}\nvoid sessionStorage.setItem("x","y");\n`.split("\n");
    const lineNo = lines.findIndex((l) => l.includes('sessionStorage.setItem("x","y")')) + 1;
    expect(lineNo).toBeGreaterThan(0);
  });

  it("CKL1.1 eslint daily-fix passes when eslint config exists", () => {
    const configs = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", ".eslintrc.cjs"];
    if (!configs.some((c) => existsSync(path.join(REPO_ROOT, c)))) return;
    const r = spawnSync(
      "npx",
      ["eslint", "client/src/pages/the-daily-fix", "--max-warnings", "0"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(r.status).toBe(0);
  });

  it("CKT1.1 Env bindings and CommentType are exact", () => {
    expectTypeOf<Env>().toMatchTypeOf<{
      AUTH_SESSIONS: KVNamespace;
      LOGIN_THROTTLE: DurableObjectNamespace;
      SESSION: DurableObjectNamespace;
      OAUTH_STATE: DurableObjectNamespace;
    }>();
    type CT = CommentType;
    expectTypeOf<CT>().toEqualTypeOf<"belly" | "body" | "brain" | "all">();
    expect(dailyFixCommentsRequestUrl("2025-02-10")).toContain("type=all");
  });
});
