/**
 * PR2 r1.24 — retarget TOK / parseRetryAfter / username / leaderboard cant-runs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(path.join(REPO, rel), "utf8");
}
function write(rel, text) {
  writeFileSync(path.join(REPO, rel), text);
}
function replaceOnce(rel, search, replace, label) {
  const t = read(rel);
  const i = t.indexOf(search);
  if (i < 0) throw new Error(`${label}: search not found in ${rel}`);
  if (t.indexOf(search, i + 1) !== -1) {
    throw new Error(`${label}: search not unique in ${rel}`);
  }
  write(rel, t.slice(0, i) + replace + t.slice(i + search.length));
}

/** @type {Record<string, { apply?: () => void, files?: string[], typeCheck?: boolean }>} */
export const R12_OVERRIDES = {
  "M-TOK1": {
    files: ["client/src/lib/sanity.ts", "vite.config.ts"],
    apply() {
      const N = ["VITE", "SANITY", "API", "READ", "TOKEN"].join("_");
      const defineKey = "import.meta.env." + N;
      replaceOnce(
        "vite.config.ts",
        "export default defineConfig({",
        `export default defineConfig({\n  // MUTANT M-TOK1\n  define: { "${defineKey}": JSON.stringify(process.env.SANITY_API_READ_TOKEN) },`,
        "M-TOK1-vite",
      );
      replaceOnce(
        "client/src/lib/sanity.ts",
        "const token = (import.meta.env.VITE_SANITY_API_READ_TOKEN as string | undefined)?.trim();",
        // Contiguous N via join so source still plants the env name for TK2 / bundle for TK1.
        `const token = (import.meta.env[["VITE","SANITY","API","READ","TOKEN"].join("_") as "VITE_SANITY_API_READ_TOKEN"] as string | undefined)?.trim(); // MUTANT M-TOK1`,
        "M-TOK1-sanity",
      );
    },
  },
  "M-TOK2": {
    files: [".env.example"],
    apply() {
      const N = ["VITE", "SANITY", "API", "READ", "TOKEN"].join("_");
      const abs = path.join(REPO, ".env.example");
      const line = `${N}=\n`;
      if (existsSync(abs)) {
        const cur = readFileSync(abs, "utf8");
        if (!cur.includes(N)) {
          write(".env.example", cur.endsWith("\n") ? cur + line : `${cur}\n${line}`);
        }
      } else {
        write(".env.example", line);
      }
    },
  },
  "M-TOK5": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        "  // (d) define object (vite.config.*)\n  const base = rel.includes(\"/\") ? rel.slice(rel.lastIndexOf(\"/\") + 1) : rel;\n  if (base.startsWith(\"vite.config.\")) {\n    let searchFrom = 0;\n    while (searchFrom < content.length) {\n      const keyIdx = content.indexOf(\"define\", searchFrom);\n      if (keyIdx < 0) break;\n      const after = content.slice(keyIdx);\n      const head = /^(define\\s*:\\s*)/.exec(after);\n      if (!head) {\n        searchFrom = keyIdx + 6;\n        continue;\n      }\n      let p = keyIdx + head[0]!.length;\n      while (p < content.length && /\\s/.test(content[p]!)) p++;\n      const bal = extractBalanced(content, p);\n      if (!bal) {\n        searchFrom = keyIdx + 6;\n        continue;\n      }\n      let ni = bal.inner.indexOf(N);\n      while (ni >= 0) {\n        hitLines.add(lineOfIndex(content, bal.start + ni));\n        ni = bal.inner.indexOf(N, ni + 1);\n      }\n      searchFrom = bal.end + 1;\n    }\n\n    // (e) envPrefix",
        "  // MUTANT M-TOK5: define-object scan dropped\n  const base = rel.includes(\"/\") ? rel.slice(rel.lastIndexOf(\"/\") + 1) : rel;\n  if (base.startsWith(\"vite.config.\")) {\n    // (e) envPrefix",
        "M-TOK5",
      );
    },
  },
  "M-TOK6": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        "    // (e) envPrefix\n    const reEp = /envPrefix\\s*:\\s*/g;",
        "    // MUTANT M-TOK6: envPrefix check dropped\n    const reEp = /envPrefix_DISABLED_MUTANT\\s*:\\s*/g;",
        "M-TOK6",
      );
    },
  },
  "M-TOK7": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      const from = ["  const D = String.raw`", String.raw`\s*(?:\?\.|\.)\s*`, "`;"].join("");
      const to = [
        "  const D = String.raw`",
        String.raw`\.`,
        "`; // MUTANT M-TOK7: literal . only, no ?. / whitespace",
      ].join("");
      replaceOnce("tools/pr2/gates/repo-scan.test.ts", from, to, "M-TOK7");
    },
  },
  "M-TOK8": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        "  // (a2) destructuring\n",
        "  // MUTANT M-TOK8: destructuring and static alias dropped\n  if (false) {\n  // (a2) destructuring\n",
        "M-TOK8-open",
      );
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        "  // (b) N: or N=\n",
        "  } // end M-TOK8 dead block\n\n  // (b) N: or N=\n",
        "M-TOK8-close",
      );
    },
  },
  "M-TOK9": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      const fromInner =
        "\\\\b(?:secrets|vars)(?:${D}${nRe}\\\\b|\\\\s*\\\\[\\\\s*${Q}${nRe}${Q}\\\\s*\\\\])";
      const toInner = "\\\\b(?:secrets|vars)${D}${nRe}\\\\b";
      const from = [
        "  // (c) secrets/vars\n  const reC = new RegExp(\n    `",
        fromInner,
        "`,\n    \"gm\",\n  );",
      ].join("");
      const to = [
        "  // MUTANT M-TOK9: bracket forms of secrets/vars dropped\n  const reC = new RegExp(\n    `",
        toInner,
        "`,\n    \"gm\",\n  );",
      ].join("");
      replaceOnce("tools/pr2/gates/repo-scan.test.ts", from, to, "M-TOK9");
    },
  },
  "M-TOK10": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        "function scanTk2Content(rel: string, contentRaw: string, N: string): string[] {\n  const content = normalizeLf(contentRaw);\n  const hitLines = new Set<number>();",
        "function scanTk2Content(rel: string, contentRaw: string, N: string): string[] {\n  // MUTANT M-TOK10: skip lines containing // or #\n  const content = normalizeLf(contentRaw)\n    .split(\"\\n\")\n    .filter((ln) => !ln.includes(\"//\") && !ln.includes(\"#\"))\n    .join(\"\\n\");\n  const hitLines = new Set<number>();",
        "M-TOK10",
      );
    },
  },
  M71: {
    files: ["worker/auth/auth-rate-limit.ts"],
    apply() {
      replaceOnce(
        "worker/auth/auth-rate-limit.ts",
        "  const ok = await limitOrDeny(env.USERNAME_CHECK_LIMITER, `username:${ip}`);\n  return ok ? { allowed: true } : { allowed: false };\n}",
        "  // MUTANT M71: no username-check rate limit\n  void env; void ip; void limitOrDeny;\n  return { allowed: true };\n}",
        "M71",
      );
    },
  },
  M124: {
    files: ["worker/auth/auth-rate-limit.ts"],
    apply() {
      replaceOnce(
        "worker/auth/auth-rate-limit.ts",
        "  const ok = await limitOrDeny(env.USERNAME_CHECK_LIMITER, `username:${ip}`);\n  return ok ? { allowed: true } : { allowed: false };\n}",
        "  // MUTANT M124: share signup 5/60 write bucket (not username 20/60)\n  const ok = await limitOrDeny(env.SIGNUP_LIMITER, `signup:${ip}`);\n  return ok ? { allowed: true } : { allowed: false };\n}",
        "M124",
      );
    },
  },
  M149: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        "async function allowLb(env: { LEADERBOARD_LIMITER?: RateLimitBinding }, userId: string): Promise<boolean> {\n  const binding = env.LEADERBOARD_LIMITER;\n  if (!binding) return false;\n  const r = await binding.limit({ key: `lb:${userId}` });\n  return r.success === true;\n}",
        "async function allowLb(env: { LEADERBOARD_LIMITER?: RateLimitBinding }, userId: string): Promise<boolean> {\n  // MUTANT M149: remove 10/60 per-user leaderboard limit\n  void env; void userId;\n  return true;\n}",
        "M149",
      );
    },
  },
};

export default R12_OVERRIDES;
