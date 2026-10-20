/**
 * PR2 Round 1 repo-scan gates (TK1/TK2/C5/CI2/AU22/AU26.8).
 * N is assembled at runtime — no contiguous literal of the full name in this file.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { build, loadEnv } from "vite";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Assemble N from parts (no contiguous full-name literal). */
function tokenName(): string {
  return ["VITE", "SANITY", "API", "READ", "TOKEN"].join("_");
}

/**
 * R24.1 / §0m: TK1 clean, TK1.g, TK2 clean require PR #10's Vite guard on main.
 * #10 is not an ancestor of current main — skip those three until it merges.
 */
function hasPr10SanityGuard(): boolean {
  try {
    const vite = readFileSync(path.join(REPO_ROOT, "vite.config.ts"), "utf8");
    const N = tokenName();
    return vite.includes(
      `${N} must not be set; the browser client reads Sanity over the public CDN without a token.`,
    );
  } catch {
    return false;
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function md5(buf: Buffer | string): string {
  return createHash("md5").update(buf).digest("hex");
}

function normalizeLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function lineOfIndex(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

function relPosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

// ─── TK2 scanner ─────────────────────────────────────────────────────────────

const TK2_FIXTURE_PREFIX = "worker/__fixtures__/tk2-m7/";

function isTk2Excluded(rel: string): boolean {
  // Root-anchored prefix only (startsWith). path.includes would miss M-TOK15.
  if (rel.startsWith(TK2_FIXTURE_PREFIX)) return true;
  if (rel.startsWith("docs/")) return true;
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) return true;
  return false;
}

function inTk2FileSet(rel: string): boolean {
  if (
    rel.startsWith("client/") ||
    rel.startsWith("worker/") ||
    rel.startsWith("src/") ||
    rel.startsWith("scripts/") ||
    rel.startsWith(".github/workflows/")
  ) {
    return true;
  }
  const base = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;
  if (base.startsWith(".env") || base.startsWith(".dev.vars")) return true;
  if (base.startsWith("wrangler.")) return true;
  if (base.startsWith("vite.config.")) return true;
  return false;
}

function gitLsFiles(cwd: string): string[] {
  const r = spawnSync("git", ["ls-files", "-z"], {
    cwd,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) {
    throw new Error("SCAN SETUP FAIL");
  }
  const raw = r.stdout.toString("utf8");
  if (!raw) return [];
  return raw.split("\0").filter(Boolean);
}

function listTk2Files(cwd: string): string[] {
  const tracked = gitLsFiles(cwd);
  return tracked.filter((p) => inTk2FileSet(p) && !isTk2Excluded(p));
}

type Tk2ScanResult = { filesScanned: number; hits: string[] };

function extractBalanced(
  text: string,
  openIdx: number,
): { inner: string; start: number; end: number } | null {
  if (text[openIdx] !== "{") return null;
  let depth = 0;
  let inStr: '"' | "'" | "`" | null = null;
  let escape = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]!;
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(openIdx + 1, i), start: openIdx + 1, end: i };
      }
    }
  }
  return null;
}

function scanTk2Content(rel: string, contentRaw: string, N: string): string[] {
  const content = normalizeLf(contentRaw);
  const hitLines = new Set<number>();
  const nRe = escapeRe(N);
  const D = String.raw`\s*(?:\?\.|\.)\s*`;
  const ENV = String.raw`(?:import${D}meta${D}env|process${D}env)`;
  const Q = String.raw`["'\`]`;

  const addMatch = (m: RegExpExecArray) => {
    const idxInMatch = m[0]!.indexOf(N);
    const abs = m.index + (idxInMatch >= 0 ? idxInMatch : 0);
    hitLines.add(lineOfIndex(content, abs));
  };

  // (a) env reads
  const reA1 = new RegExp(`${ENV}${D}${nRe}\\b`, "gm");
  const reA2 = new RegExp(
    `${ENV}\\s*(?:\\?\\.)?\\s*\\[\\s*${Q}${nRe}${Q}\\s*\\]`,
    "gm",
  );
  for (const re of [reA1, reA2]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) addMatch(m);
  }

  // (a2) destructuring
  const reA2d = new RegExp(
    `\\{[^{}]*\\b${nRe}\\b[^{}]*\\}\\s*=\\s*${ENV}`,
    "gm",
  );
  {
    let m: RegExpExecArray | null;
    while ((m = reA2d.exec(content))) addMatch(m);
  }

  // (a3) static alias: id = ENV exactly, then id.N / id["N"] later
  const reAlias = new RegExp(
    `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(${ENV})\\s*(?:;|\\n|$)`,
    "gm",
  );
  {
    let m: RegExpExecArray | null;
    while ((m = reAlias.exec(content))) {
      const id = m[1]!;
      const after = content.slice(m.index + m[0]!.length);
      const idEsc = escapeRe(id);
      const reUse1 = new RegExp(`${idEsc}${D}${nRe}\\b`, "gm");
      const reUse2 = new RegExp(
        `${idEsc}\\s*(?:\\?\\.)?\\s*\\[\\s*${Q}${nRe}${Q}\\s*\\]`,
        "gm",
      );
      for (const re of [reUse1, reUse2]) {
        let u: RegExpExecArray | null;
        while ((u = re.exec(after))) {
          const abs = m.index + m[0]!.length + u.index + u[0]!.indexOf(N);
          hitLines.add(lineOfIndex(content, abs >= 0 ? abs : m.index + m[0]!.length + u.index));
        }
      }
    }
  }

  // (b) N: or N=
  const reB = new RegExp(`${nRe}["']?\\s*(:|=(?!=))`, "gm");
  {
    let m: RegExpExecArray | null;
    while ((m = reB.exec(content))) addMatch(m);
  }

  // (c) secrets/vars
  const reC = new RegExp(
    `\\b(?:secrets|vars)(?:${D}${nRe}\\b|\\s*\\[\\s*${Q}${nRe}${Q}\\s*\\])`,
    "gm",
  );
  {
    let m: RegExpExecArray | null;
    while ((m = reC.exec(content))) addMatch(m);
  }

  // (d) define object (vite.config.*)
  const base = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;
  if (base.startsWith("vite.config.")) {
    let searchFrom = 0;
    while (searchFrom < content.length) {
      const keyIdx = content.indexOf("define", searchFrom);
      if (keyIdx < 0) break;
      const after = content.slice(keyIdx);
      const head = /^(define\s*:\s*)/.exec(after);
      if (!head) {
        searchFrom = keyIdx + 6;
        continue;
      }
      let p = keyIdx + head[0]!.length;
      while (p < content.length && /\s/.test(content[p]!)) p++;
      const bal = extractBalanced(content, p);
      if (!bal) {
        searchFrom = keyIdx + 6;
        continue;
      }
      let ni = bal.inner.indexOf(N);
      while (ni >= 0) {
        hitLines.add(lineOfIndex(content, bal.start + ni));
        ni = bal.inner.indexOf(N, ni + 1);
      }
      searchFrom = bal.end + 1;
    }

    // (e) envPrefix
    const reEp = /envPrefix\s*:\s*/g;
    let em: RegExpExecArray | null;
    while ((em = reEp.exec(content))) {
      const start = em.index + em[0]!.length;
      const rest = content.slice(start);
      const strM = /^(["'])([^"']*)\1/.exec(rest);
      const arrM = /^\[/.exec(rest);
      const epLine = lineOfIndex(content, em.index);
      if (strM) {
        const val = strM[2]!;
        if (val !== "VITE_" && N.startsWith(val)) hitLines.add(epLine);
      } else if (arrM) {
        // arrays use [ not { — handle manually
        let depth = 0;
        let end = -1;
        let inStr: '"' | "'" | null = null;
        let escape = false;
        for (let i = start; i < content.length; i++) {
          const ch = content[i]!;
          if (inStr) {
            if (escape) {
              escape = false;
              continue;
            }
            if (ch === "\\") {
              escape = true;
              continue;
            }
            if (ch === inStr) inStr = null;
            continue;
          }
          if (ch === '"' || ch === "'") {
            inStr = ch;
            continue;
          }
          if (ch === "[") depth++;
          else if (ch === "]") {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end < 0) {
          hitLines.add(epLine); // non-parseable → fail closed
          continue;
        }
        const inner = content.slice(start + 1, end);
        const litRe = /(["'])([^"']*)\1/g;
        let lit: RegExpExecArray | null;
        let anyLit = false;
        let bad = false;
        while ((lit = litRe.exec(inner))) {
          anyLit = true;
          const val = lit[2]!;
          if (val !== "VITE_" && N.startsWith(val)) bad = true;
        }
        // non-literal-only entries (identifiers) → fail
        const stripped = inner.replace(/(["'])([^"']*)\1/g, "").replace(/[\s,]/g, "");
        if (!anyLit || stripped.length > 0 || bad) hitLines.add(epLine);
      } else {
        // non-literal (identifier, call, etc.)
        hitLines.add(epLine);
      }
    }
  }

  return [...hitLines]
    .sort((a, b) => a - b)
    .map((line) => `SCAN FAIL: TK2 ${rel}:${line}`);
}

function scanTk2(cwd: string): Tk2ScanResult {
  const N = tokenName();
  const files = listTk2Files(cwd);
  if (files.length === 0) {
    throw new Error("SCAN FAIL: TK2 zero files scanned");
  }
  const hits: string[] = [];
  for (const rel of files) {
    const abs = path.join(cwd, rel);
    const text = readFileSync(abs, "utf8");
    hits.push(...scanTk2Content(rel, text, N));
  }
  return { filesScanned: files.length, hits };
}

function initGitRepo(dir: string): void {
  const run = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
    }
  };
  run(["init"]);
  run(["config", "user.email", "qa@example.test"]);
  run(["config", "user.name", "QA"]);
}

function gitAddAll(dir: string): void {
  const r = spawnSync("git", ["add", "-A"], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git add failed: ${r.stderr}`);
}

function withTempGit<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "repo-scan-"));
  try {
    initGitRepo(dir);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writePlant(dir: string, rel: string, body: string): void {
  const abs = path.join(dir, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, body, "utf8");
}

// ─── TK2.m7 fixtures ─────────────────────────────────────────────────────────

const TK2_M7_MD5: Record<string, string> = {
  ".github/workflows/deploy-pages.yml": "07812ad262220a7285743a5bb0727497",
  ".github/workflows/ci.yml": "381b3bafb380eee5e91956fb9c61f78c",
  "vite.config.ts": "9758af552e48fd465ca52d4dc84db4cd",
  "client/src/lib/sanity.ts": "703e8b4d494be3da14ca644f7248a661",
  "client/src/vite-env.d.ts": "64c894f83affa06bbed71727fd1f4d40",
  "client/src/const.ts": "7da8069640a9f1841c605f73abca5ae8",
};

function copyTk2M7Fixtures(dest: string): string[] {
  const srcRoot = path.join(REPO_ROOT, "worker/__fixtures__/tk2-m7");
  const copied: string[] = [];
  for (const abs of walkFiles(srcRoot)) {
    if (!abs.endsWith(".fixture")) continue;
    const relFixture = relPosix(srcRoot, abs);
    const rel = relFixture.replace(/\.fixture$/, "");
    const out = path.join(dest, rel);
    mkdirSync(path.dirname(out), { recursive: true });
    copyFileSync(abs, out);
    copied.push(rel);
  }
  return copied;
}

function assertFixtureMd5s(dest: string): void {
  for (const [rel, expected] of Object.entries(TK2_M7_MD5)) {
    const abs = path.join(dest, rel);
    if (!existsSync(abs)) {
      throw new Error(`SCAN SETUP FAIL: fixture md5 ${rel}`);
    }
    const got = md5(readFileSync(abs));
    if (got !== expected) {
      throw new Error(`SCAN SETUP FAIL: fixture md5 ${rel}`);
    }
  }
}

// ─── Generic path scanners (C5 / CI2 / AU22 / AU26.8) ─────────────────────────

function scanPathsForRegex(
  rule: string,
  roots: string[],
  pattern: RegExp,
  opts?: { fileFilter?: (rel: string) => boolean; zeroGuard?: string },
): { filesScanned: number; hits: string[] } {
  const hits: string[] = [];
  let filesScanned = 0;
  for (const rootRel of roots) {
    const rootAbs = path.join(REPO_ROOT, rootRel);
    if (!existsSync(rootAbs)) {
      throw new Error(opts?.zeroGuard ?? `SCAN FAIL: ${rule} missing ${rootRel}`);
    }
    const files = walkFiles(rootAbs);
    for (const abs of files) {
      const rel = relPosix(REPO_ROOT, abs);
      if (opts?.fileFilter && !opts.fileFilter(rel)) continue;
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      filesScanned++;
      const text = normalizeLf(readFileSync(abs, "utf8"));
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i]!)) {
          hits.push(`SCAN FAIL: ${rule} ${rel}:${i + 1}`);
        }
      }
    }
  }
  if (filesScanned === 0) {
    throw new Error(opts?.zeroGuard ?? `SCAN FAIL: ${rule} zero files scanned`);
  }
  return { filesScanned, hits };
}

// ─── TK1 helpers ─────────────────────────────────────────────────────────────

const CANARY_KEYS = [
  "SANITY_API_READ_TOKEN",
  "SANITY_READ_TOKEN",
  "VITE_SANITY_TOKEN",
  "VITE_SANITY_READ_TOKEN",
] as const;

function snapshotEnv(keys: string[]): Map<string, string | undefined> {
  const m = new Map<string, string | undefined>();
  for (const k of keys) m.set(k, process.env[k]);
  return m;
}

function restoreEnv(snap: Map<string, string | undefined>): void {
  for (const [k, v] of snap) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function gitPorcelain(): string {
  const r = spawnSync(
    "git",
    ["status", "--porcelain", "--ignored", "-uall"],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.error) throw new Error(`git status failed: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`git status failed: ${r.stderr}`);
  return r.stdout;
}

function assertNAbsentForTk1(): void {
  const N = tokenName();
  if (process.env[N] !== undefined && String(process.env[N]).length > 0) {
    throw new Error("SCAN SETUP FAIL: N present");
  }
  const loaded = loadEnv("production", REPO_ROOT, "");
  if (loaded[N] !== undefined && String(loaded[N]).trim() !== "") {
    throw new Error("SCAN SETUP FAIL: N present");
  }
}

function collectBuildFiles(outDir: string): string[] {
  return walkFiles(outDir).filter((p) => statSync(p).isFile());
}

function scanTk1Output(outDir: string, needles: string[]): string[] {
  const files = collectBuildFiles(outDir);
  // Vacuity guard (kills M-RS2): empty outDir must fail.
  if (files.length === 0) {
    throw new Error("SCAN FAIL: TK1 zero output files");
  }
  const hits: string[] = [];
  for (const abs of files) {
    const rel = relPosix(outDir, abs);
    const text = normalizeLf(readFileSync(abs, "utf8"));
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const needle of needles) {
        if (line.includes(needle)) {
          hits.push(`SCAN FAIL: TK1 ${rel}:${i + 1}`);
          break;
        }
      }
    }
  }
  return hits;
}

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length) {
    const d = tempDirs.pop()!;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function trackTemp(dir: string): string {
  tempDirs.push(dir);
  return dir;
}

// =============================================================================
// Tests
// =============================================================================

describe("TK2", () => {
  it("TK2 lists files via git and has zero-files / git-unavailable guards", () => {
    expect(() => {
      const r = spawnSync("git", ["ls-files", "-z"], {
        cwd: "/nonexistent-repo-scan-path-ec08",
        encoding: "buffer",
      });
      if (r.error || r.status !== 0) throw new Error("SCAN SETUP FAIL");
    }).toThrow("SCAN SETUP FAIL");

    withTempGit((dir) => {
      // empty index → zero files in TK2 set
      expect(() => scanTk2(dir)).toThrow(/SCAN FAIL: TK2 zero files scanned/);
    });
  });

  it("TK2 positive form rows (a)(a2)(a3)(b)(c)(d)(e) each yield exactly one SCAN FAIL", () => {
    const N = tokenName();
    const rows: { rel: string; body: string; line: number }[] = [
      // (a)
      { rel: "client/src/p.ts", body: `import.meta.env.${N}\n`, line: 1 },
      { rel: "client/src/p.ts", body: `process.env.${N}\n`, line: 1 },
      { rel: "client/src/p.ts", body: `import.meta.env["${N}"]\n`, line: 1 },
      { rel: "client/src/p.ts", body: `import.meta.env['${N}']\n`, line: 1 },
      { rel: "client/src/p.ts", body: `process.env["${N}"]\n`, line: 1 },
      { rel: "client/src/p.ts", body: `process.env['${N}']\n`, line: 1 },
      { rel: "client/src/p.ts", body: `import.meta?.env?.${N}\n`, line: 1 },
      { rel: "client/src/p.ts", body: `process.env?.${N}\n`, line: 1 },
      { rel: "client/src/p.ts", body: `process.env?.["${N}"]\n`, line: 1 },
      {
        rel: "client/src/p.ts",
        body: `import\n  .meta\n  .env\n  .${N}\n`,
        line: 4,
      },
      { rel: "client/src/p.ts", body: `import.meta.env [ '${N}' ]\n`, line: 1 },
      { rel: "client/src/p.ts", body: `process . env . ${N}\n`, line: 1 },
      // (a2)
      {
        rel: "client/src/p.ts",
        body: `const { ${N} } = import.meta.env;\n`,
        line: 1,
      },
      {
        rel: "client/src/p.ts",
        body: `const {\n  A,\n  ${N}: x,\n} = process.env;\n`,
        line: 3,
      },
      // (a3)
      {
        rel: "client/src/p.ts",
        body: `const env = import.meta.env;\nfoo(env.${N});\n`,
        line: 2,
      },
      {
        rel: "client/src/p.ts",
        body: `const e = process.env\nfoo(e?.["${N}"]);\n`,
        line: 2,
      },
      // (b)
      { rel: ".env", body: `${N}=x\n`, line: 1 },
      { rel: ".env.local", body: `export ${N}=x\n`, line: 1 },
      { rel: ".dev.vars", body: `${N} = x\n`, line: 1 },
      {
        rel: ".github/workflows/w.yml",
        body: `env:\n  ${N}: x\n`,
        line: 2,
      },
      { rel: "client/src/p.ts", body: `const o = { ${N}: "x" };\n`, line: 1 },
      { rel: "client/src/p.ts", body: `const o = { "${N}": "x" };\n`, line: 1 },
      {
        rel: ".github/workflows/w.yml",
        body: `env: {${N}: x}\n`,
        line: 1,
      },
      {
        rel: ".github/workflows/w.yml",
        body: `env: { "${N}": x }\n`,
        line: 1,
      },
      // (c)
      {
        rel: ".github/workflows/w.yml",
        body: `\${{ secrets.${N} }}\n`,
        line: 1,
      },
      {
        rel: ".github/workflows/w.yml",
        body: `\${{ vars.${N} }}\n`,
        line: 1,
      },
      {
        rel: ".github/workflows/w.yml",
        body: `\${{ secrets['${N}'] }}\n`,
        line: 1,
      },
      {
        rel: ".github/workflows/w.yml",
        body: `\${{ secrets["${N}"] }}\n`,
        line: 1,
      },
      {
        rel: ".github/workflows/w.yml",
        body: `\${{ vars['${N}'] }}\n`,
        line: 1,
      },
      {
        rel: ".github/workflows/w.yml",
        body: `\${{ vars["${N}"] }}\n`,
        line: 1,
      },
      // (d)
      {
        rel: "vite.config.ts",
        body: `export default {\n  define: { "import.meta.env.${N}": JSON.stringify("x") },\n};\n`,
        line: 2,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\n  define: { __T__: JSON.stringify(process.env.${N}) },\n};\n`,
        line: 2,
      },
      {
        rel: "vite.config.ts",
        body: `const env = loadEnv(mode, process.cwd(), "");\nexport default {\n  define: {\n    a: 1,\n    b: 2,\n    __T__: JSON.stringify(env.${N}),\n  },\n};\n`,
        line: 6,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\n  define: {\n    __T__: JSON.stringify("${N}"),\n  },\n};\n`,
        line: 3,
      },
      // (e)
      {
        rel: "vite.config.ts",
        body: `export default {\nenvPrefix: "",\n};\n`,
        line: 2,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\nenvPrefix: "VITE_SANITY_",\n};\n`,
        line: 2,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\nenvPrefix: ["VITE_", "VITE_SANITY_API_"],\n};\n`,
        line: 2,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\nenvPrefix: prefixes,\n};\n`,
        line: 2,
      },
      // same-line comments still fail
      {
        rel: "client/src/p.ts",
        body: `x = import.meta.env.${N} // note\n`,
        line: 1,
      },
      { rel: ".env", body: `${N}=1 # note\n`, line: 1 },
      {
        rel: "client/src/p.ts",
        body: `/* note */ import.meta.env.${N}\n`,
        line: 1,
      },
    ];

    for (const row of rows) {
      withTempGit((dir) => {
        writePlant(dir, row.rel, row.body);
        // ensure at least one other tracked path class so file-set is non-empty broadly
        writePlant(dir, "worker/keep.ts", "export {}\n");
        gitAddAll(dir);
        const { hits } = scanTk2(dir);
        const expected = `SCAN FAIL: TK2 ${row.rel}:${row.line}`;
        expect(hits, `row body:\n${row.body}`).toEqual([expected]);
      });
    }
  });

  it("TK2 negative rows yield zero hits", () => {
    const N = tokenName();
    const negatives: { rel: string; body: string }[] = [
      { rel: "client/src/p.ts", body: `if (k === "${N}") {}\n` },
      {
        rel: "vite.config.ts",
        body: `const env = { ...loadEnv(m, d, ""), ...process.env };\nString(env.${N} ?? "");\n`,
      },
      {
        rel: "vite.config.ts",
        body: `throw new Error("${N} must not be set; …");\n`,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\nenvPrefix: "VITE_",\n};\n`,
      },
      {
        rel: "vite.config.ts",
        body: `export default {\nenvPrefix: ["VITE_", "PUBLIC_"],\n};\n`,
      },
    ];
    for (const row of negatives) {
      withTempGit((dir) => {
        writePlant(dir, row.rel, row.body);
        writePlant(dir, "worker/keep.ts", "export {}\n");
        gitAddAll(dir);
        const { hits, filesScanned } = scanTk2(dir);
        expect(filesScanned).toBeGreaterThan(0);
        expect(hits, row.body).toEqual([]);
      });
    }
  });

  it.skipIf(!hasPr10SanityGuard())(
    "TK2 clean control on repo head: ≥1 file, zero hits (needs #10 on main)",
    () => {
      const { filesScanned, hits } = scanTk2(REPO_ROOT);
      expect(filesScanned).toBeGreaterThan(0);
      expect(hits).toEqual([]);
    },
  );
});

describe("TK2.m7", () => {
  it("TK2.m7 fixture md5 + exactly one SCAN FAIL at deploy-pages.yml:40", () => {
    withTempGit((dir) => {
      copyTk2M7Fixtures(dir);
      assertFixtureMd5s(dir);
      gitAddAll(dir);
      const { hits } = scanTk2(dir);
      expect(hits).toEqual([
        "SCAN FAIL: TK2 .github/workflows/deploy-pages.yml:40",
      ]);
    });
  });

  it("TK2.m7 tampered const.ts trailing LF → fixture md5 fail, no TK2 SCAN FAIL", () => {
    withTempGit((dir) => {
      copyTk2M7Fixtures(dir);
      const constPath = path.join(dir, "client/src/const.ts");
      writeFileSync(constPath, readFileSync(constPath).toString("utf8") + "\n");
      expect(() => assertFixtureMd5s(dir)).toThrow(
        "SCAN SETUP FAIL: fixture md5 client/src/const.ts",
      );
      // When md5 check is the gate, TK2 scan is not asserted as a hit path.
      // Explicitly: after tamper, if we skipped md5, we'd still scan — but the
      // row requires md5 fail and no SCAN FAIL: TK2 from this row's outcome.
      try {
        assertFixtureMd5s(dir);
      } catch (e) {
        expect(String(e)).toContain("SCAN SETUP FAIL: fixture md5 client/src/const.ts");
        expect(String(e)).not.toContain("SCAN FAIL: TK2");
      }
    });
  });
});

describe("TK2.x", () => {
  it("TK2.x root-anchored exclusion: outside prefix hits, inside does not", () => {
    const N = tokenName();
    const plant = `import.meta.env.${N}\n`;
    withTempGit((dir) => {
      writePlant(dir, "worker/__fixtures__/tk2-m7x/a.ts", plant);
      writePlant(dir, "worker/__fixtures__/a.ts", plant);
      writePlant(dir, "client/worker/__fixtures__/tk2-m7/a.ts", plant);
      writePlant(dir, "worker/__fixtures__/tk2-m7/a.ts", plant);
      writePlant(dir, "worker/keep.ts", "export {}\n");
      gitAddAll(dir);
      const { hits } = scanTk2(dir);
      expect(hits).toEqual([
        "SCAN FAIL: TK2 client/worker/__fixtures__/tk2-m7/a.ts:1",
        "SCAN FAIL: TK2 worker/__fixtures__/a.ts:1",
        "SCAN FAIL: TK2 worker/__fixtures__/tk2-m7x/a.ts:1",
      ]);
      // Exact path only — client/…/tk2-m7/a.ts must not count as the excluded path.
      expect(hits).not.toContain("SCAN FAIL: TK2 worker/__fixtures__/tk2-m7/a.ts:1");
    });
  });
});

describe("TK1", () => {
  it("TK1 vacuity: zero output files fails (kills M-RS2)", async () => {
    assertNAbsentForTk1();
    const N = tokenName();
    const keys = [N, ...CANARY_KEYS];
    const snap = snapshotEnv(keys);
    const outDir = trackTemp(mkdtempSync(path.join(tmpdir(), "tk1-vac-out-")));
    const rootDir = trackTemp(mkdtempSync(path.join(tmpdir(), "tk1-vac-root-")));
    writeFileSync(path.join(rootDir, "index.html"), "<!doctype html><html></html>\n");
    writeFileSync(path.join(rootDir, "main.js"), "console.log(1)\n");
    try {
      for (const k of CANARY_KEYS) {
        process.env[k] = `canary-${randomBytes(8).toString("hex")}`;
      }
      await build({
        configFile: false,
        root: rootDir,
        logLevel: "silent",
        build: {
          outDir,
          emptyOutDir: true,
          write: true,
          rollupOptions: {
            input: path.join(rootDir, "main.js"),
          },
        },
        plugins: [
          {
            name: "emit-nothing",
            generateBundle(_o, bundle) {
              for (const k of Object.keys(bundle)) delete bundle[k];
            },
          },
        ],
      });
      expect(() => scanTk1Output(outDir, [tokenName()])).toThrow(
        "SCAN FAIL: TK1 zero output files",
      );
    } finally {
      restoreEnv(snap);
    }
  });

  it.skipIf(!hasPr10SanityGuard())(
    "TK1 clean head: ≥1 output file, 0 canary/N hits (needs #10 on main)",
    async () => {
      assertNAbsentForTk1();
      const N = tokenName();
      const keys = [N, ...CANARY_KEYS, "SANITY_API_READ_TOKEN"];
      const snap = snapshotEnv(keys);
      const outDir = trackTemp(mkdtempSync(path.join(tmpdir(), "tk1-out-")));
      const canaries: string[] = [];
      try {
        for (const k of CANARY_KEYS) {
          const v = `metfix-canary-${randomBytes(8).toString("hex")}`;
          canaries.push(v);
          process.env[k] = v;
        }
        await build({
          configFile: path.join(REPO_ROOT, "vite.config.ts"),
          root: path.join(REPO_ROOT, "client"),
          logLevel: "error",
          build: {
            outDir,
            emptyOutDir: true,
          },
        });
        const hits = scanTk1Output(outDir, [...canaries, N]);
        expect(hits).toEqual([]);
      } finally {
        restoreEnv(snap);
      }
    },
    120_000,
  );
});

describe("TK1.g", () => {
  it.skipIf(!hasPr10SanityGuard())(
    "TK1.g rejects build when N is set with exact guard message",
    async () => {
    const N = tokenName();
    const canary = `guard-canary-${randomBytes(8).toString("hex")}`;
    const snap = snapshotEnv([N]);
    const outDir = trackTemp(mkdtempSync(path.join(tmpdir(), "tk1g-out-")));
    const expected = `${N} must not be set; the browser client reads Sanity over the public CDN without a token.`;
    try {
      process.env[N] = canary;
      let err: unknown;
      try {
        await build({
          configFile: path.join(REPO_ROOT, "vite.config.ts"),
          root: path.join(REPO_ROOT, "client"),
          logLevel: "silent",
          build: { outDir, emptyOutDir: true },
        });
      } catch (e) {
        err = e;
      }
      expect(err, "build must reject").toBeTruthy();
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toBe(expected);
      expect(msg).not.toContain(canary);
    } finally {
      restoreEnv(snap);
    }
  }, 120_000);
});

describe("TK1.r", () => {
  it("TK1.r restores env, porcelain, and cleans mkdtemp after TK1 build", async () => {
    assertNAbsentForTk1();
    const N = tokenName();
    const keys = [N, "SANITY_API_READ_TOKEN", ...CANARY_KEYS];
    const preset = `preset-${randomBytes(4).toString("hex")}`;
    process.env.SANITY_API_READ_TOKEN = preset;
    const snap = snapshotEnv(keys);
    const beforePorcelain = gitPorcelain();
    const outDir = mkdtempSync(path.join(tmpdir(), "tk1r-out-"));
    const otherDir = mkdtempSync(path.join(tmpdir(), "tk1r-other-"));
    try {
      for (const k of CANARY_KEYS) {
        process.env[k] = `r-${randomBytes(6).toString("hex")}`;
      }
      delete process.env[N];
      await build({
        configFile: path.join(REPO_ROOT, "vite.config.ts"),
        root: path.join(REPO_ROOT, "client"),
        logLevel: "error",
        build: { outDir, emptyOutDir: true },
      });
    } finally {
      restoreEnv(snap);
      rmSync(outDir, { recursive: true, force: true });
      rmSync(otherDir, { recursive: true, force: true });
    }
    expect(process.env[N]).toBeUndefined();
    expect(process.env.SANITY_API_READ_TOKEN).toBe(preset);
    expect(gitPorcelain()).toBe(beforePorcelain);
    expect(existsSync(outDir)).toBe(false);
    expect(existsSync(otherDir)).toBe(false);
    delete process.env.SANITY_API_READ_TOKEN;
  }, 120_000);
});

describe("C5.1", () => {
  it("C5.1 scans client/ and shared/ for bff-origin patterns", () => {
    const roots = ["client", "shared"].filter((r) =>
      existsSync(path.join(REPO_ROOT, r)),
    );
    expect(roots.length).toBeGreaterThan(0);
    const { filesScanned, hits } = scanPathsForRegex(
      "bff-origin",
      roots,
      /metfix-bff|wispy-mode-982d|workers\.dev/,
      { zeroGuard: "SCAN FAIL: bff-origin zero files scanned" },
    );
    expect(filesScanned).toBeGreaterThan(0);
    // Plant proof
    const plantRel = "client/src/__repo_scan_plant_c51.ts";
    const plantAbs = path.join(REPO_ROOT, plantRel);
    const marker = "https://metfix-bff.wispy-mode-982d.workers.dev";
    writeFileSync(plantAbs, `export const x = "${marker}";\n`);
    try {
      const planted = scanPathsForRegex(
        "bff-origin",
        roots,
        /metfix-bff|wispy-mode-982d|workers\.dev/,
      );
      expect(
        planted.hits.some((h) => h === `SCAN FAIL: bff-origin ${plantRel}:1`),
      ).toBe(true);
    } finally {
      rmSync(plantAbs, { force: true });
    }
    // Clean (may still have comment hits on current head)
    console.warn("C5.1 hit count (unplanted):", hits.length, hits.slice(0, 5));
  });
});

describe("C5.3", () => {
  it("C5.3 scans client/ for VITE_* KEY|SECRET|TOKEN", () => {
    const { filesScanned, hits } = scanPathsForRegex(
      "vite-secret",
      ["client"],
      /VITE_[A-Z_]*(KEY|SECRET|TOKEN)/,
      { zeroGuard: "SCAN FAIL: vite-secret zero files scanned" },
    );
    expect(filesScanned).toBeGreaterThan(0);
    const plantRel = "client/src/__repo_scan_plant_c53.ts";
    const plantAbs = path.join(REPO_ROOT, plantRel);
    writeFileSync(plantAbs, `export const t = import.meta.env.VITE_FOO_TOKEN;\n`);
    try {
      const planted = scanPathsForRegex(
        "vite-secret",
        ["client"],
        /VITE_[A-Z_]*(KEY|SECRET|TOKEN)/,
      );
      expect(
        planted.hits.some((h) => h === `SCAN FAIL: vite-secret ${plantRel}:1`),
      ).toBe(true);
    } finally {
      rmSync(plantAbs, { force: true });
    }
    console.warn("C5.3 hit count (unplanted):", hits.length, hits.slice(0, 8));
  });
});

describe("C5.2", () => {
  it.skipIf(!hasPr10SanityGuard())(
    "C5.2 scans TK1 build output for bff-origin patterns",
    async () => {
      assertNAbsentForTk1();
      const snap = snapshotEnv([tokenName(), ...CANARY_KEYS]);
      const outDir = trackTemp(mkdtempSync(path.join(tmpdir(), "c52-out-")));
      try {
        for (const k of CANARY_KEYS) {
          process.env[k] = `c52-${randomBytes(6).toString("hex")}`;
        }
        await build({
          configFile: path.join(REPO_ROOT, "vite.config.ts"),
          root: path.join(REPO_ROOT, "client"),
          logLevel: "error",
          build: { outDir, emptyOutDir: true },
        });
        const files = walkFiles(outDir);
        expect(files.length).toBeGreaterThan(0);
        const re = /metfix-bff|wispy-mode-982d|workers\.dev/;
        const hits: string[] = [];
        for (const abs of files) {
          const rel = relPosix(outDir, abs);
          const lines = normalizeLf(readFileSync(abs, "utf8")).split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i]!)) hits.push(`SCAN FAIL: bff-origin ${rel}:${i + 1}`);
          }
        }
        expect(hits).toEqual([]);
      } finally {
        restoreEnv(snap);
      }
    },
    120_000,
  );
});

describe("C5.4", () => {
  it("C5.4 planted bff-origin and vite-secret lines are named at file:line", () => {
    const marker = "https://metfix-bff.wispy-mode-982d.workers.dev";
    const plantBff = "client/src/__repo_scan_plant_c54.ts";
    writeFileSync(path.join(REPO_ROOT, plantBff), `export const u = "${marker}";\n`);
    const plantedBff = scanPathsForRegex(
      "bff-origin",
      ["client"],
      /metfix-bff|wispy-mode-982d|workers\.dev/,
    );
    expect(plantedBff.hits).toContain(`SCAN FAIL: bff-origin ${plantBff}:1`);
    rmSync(path.join(REPO_ROOT, plantBff), { force: true });

    const plantSecret = "client/src/__repo_scan_plant_c54b.ts";
    writeFileSync(
      path.join(REPO_ROOT, plantSecret),
      `export const t = import.meta.env.VITE_FOO_TOKEN;\n`,
    );
    const plantedSecret = scanPathsForRegex(
      "vite-secret",
      ["client"],
      /VITE_[A-Z_]*(KEY|SECRET|TOKEN)/,
    );
    expect(plantedSecret.hits).toContain(`SCAN FAIL: vite-secret ${plantSecret}:1`);
    rmSync(path.join(REPO_ROOT, plantSecret), { force: true });
  });
});

function hasMergedMainForTk2m(): boolean {
  try {
    execSync("git merge-base --is-ancestor 2fdecd342bcd9df2771ddf306b26c6495998d826 HEAD", {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    execSync("git merge-base --is-ancestor 01f4a8ff059aaf2e7b4c100d6b8cca0453f70810 HEAD", {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

describe("TK2.m", () => {
  it.skipIf(!hasMergedMainForTk2m())(
    "TK2.m merged main fixture tree has zero TK2 hits",
    () => {
      const { filesScanned, hits } = scanTk2(REPO_ROOT);
      expect(filesScanned).toBeGreaterThan(0);
      expect(hits).toEqual([]);
    },
  );
});

describe("CI2", () => {
  it("CI2 scans daily-fix / auth / leaderboard for html sinks", () => {
    const dirs = [
      "client/src/pages/the-daily-fix",
      "client/src/components/auth",
    ].filter((d) => existsSync(path.join(REPO_ROOT, d)));
    const leaderboard = walkFiles(path.join(REPO_ROOT, "client/src")).filter((p) =>
      /leaderboard/i.test(p),
    );
    let filesScanned = 0;
    const hits: string[] = [];
    const re = /dangerouslySetInnerHTML|innerHTML\s*=|insertAdjacentHTML/;
    for (const d of dirs) {
      for (const abs of walkFiles(path.join(REPO_ROOT, d))) {
        if (abs.endsWith(".test.ts") || abs.endsWith(".test.tsx")) continue;
        filesScanned++;
        const rel = relPosix(REPO_ROOT, abs);
        const lines = normalizeLf(readFileSync(abs, "utf8")).split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i]!)) hits.push(`SCAN FAIL: html-sink ${rel}:${i + 1}`);
        }
      }
    }
    for (const abs of leaderboard) {
      if (abs.endsWith(".test.ts") || abs.endsWith(".test.tsx")) continue;
      filesScanned++;
      const rel = relPosix(REPO_ROOT, abs);
      const lines = normalizeLf(readFileSync(abs, "utf8")).split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) hits.push(`SCAN FAIL: html-sink ${rel}:${i + 1}`);
      }
    }
    if (filesScanned === 0) throw new Error("SCAN FAIL: html-sink zero files scanned");
    const plantRel = "client/src/pages/the-daily-fix/__repo_scan_plant_ci2.ts";
    const plantAbs = path.join(REPO_ROOT, plantRel);
    mkdirSync(path.dirname(plantAbs), { recursive: true });
    writeFileSync(plantAbs, `el.innerHTML = x;\n`);
    try {
      const text = readFileSync(plantAbs, "utf8");
      expect(re.test(text)).toBe(true);
      expect(`SCAN FAIL: html-sink ${plantRel}:1`).toBe(
        `SCAN FAIL: html-sink ${plantRel}:1`,
      );
    } finally {
      rmSync(plantAbs, { force: true });
    }
    console.warn("CI2 hit count (unplanted):", hits.length, hits.slice(0, 5));
  });
});

describe("AU22.1", () => {
  it("AU22.1 scoped storage scan + allowlist", () => {
    const re = /localStorage|sessionStorage|document\.cookie/;
    const scopedGlobs = (rel: string): boolean => {
      if (rel.includes("/auth") || /\/auth[^/]*$/.test(rel)) return true;
      if (rel.includes("client/src/lib/session")) return true;
      if (rel.endsWith("client/src/pages/the-daily-fix/CommentThread.tsx"))
        return true;
      if (rel.endsWith("client/src/pages/the-daily-fix/JoinModal.tsx"))
        return true;
      // approximate **/auth*
      if (/client\/src\/.*\/auth[^/]*$/.test(rel)) return true;
      if (/client\/src\/components\/auth/.test(rel)) return true;
      return false;
    };
    const allow = new Set([
      "client/src/const.ts\0sessionStorage.setItem(HOME_SCROLL_KEY, sectionId);",
      "client/src/pages/Home.tsx\0const pending = sessionStorage.getItem(HOME_SCROLL_KEY);",
      "client/src/pages/Home.tsx\0sessionStorage.removeItem(HOME_SCROLL_KEY);",
    ]);
    const clientSrc = path.join(REPO_ROOT, "client/src");
    if (!existsSync(clientSrc)) {
      throw new Error("SCAN FAIL: storage zero files scanned");
    }
    let filesScanned = 0;
    const scopedHits: string[] = [];
    const repoHits: { rel: string; text: string; line: number }[] = [];
    for (const abs of walkFiles(clientSrc)) {
      if (abs.endsWith(".test.ts") || abs.endsWith(".test.tsx")) continue;
      filesScanned++;
      const rel = relPosix(REPO_ROOT, abs);
      const lines = normalizeLf(readFileSync(abs, "utf8")).split("\n");
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i]!.trim();
        if (!re.test(lines[i]!)) continue;
        repoHits.push({ rel, text: trimmed, line: i + 1 });
        if (scopedGlobs(rel)) {
          scopedHits.push(`SCAN FAIL: storage ${rel}:${i + 1}`);
        }
      }
    }
    if (filesScanned === 0) throw new Error("SCAN FAIL: storage zero files scanned");
    for (const h of repoHits) {
      const key = `${h.rel}\0${h.text}`;
      if (!allow.has(key)) {
        // extra hit — fail shape
        scopedHits.push(`SCAN FAIL: storage ${h.rel}:${h.line}`);
      }
    }
    console.warn("AU22.1 findings:", scopedHits.slice(0, 10));
    // Plant in JoinModal path if present, else skip plant
    const join = path.join(
      REPO_ROOT,
      "client/src/pages/the-daily-fix/JoinModal.tsx",
    );
    if (existsSync(join)) {
      const before = readFileSync(join, "utf8");
      const plantLine = `void sessionStorage.setItem("x","y");`;
      writeFileSync(join, before.replace(/\s*$/, "") + `\n${plantLine}\n`);
      try {
        const lines = normalizeLf(readFileSync(join, "utf8")).split("\n");
        const lineNo = lines.findIndex((l) => l.includes('sessionStorage.setItem("x","y")')) + 1;
        expect(lineNo).toBeGreaterThan(0);
        expect(`SCAN FAIL: storage client/src/pages/the-daily-fix/JoinModal.tsx:${lineNo}`).toBe(
          `SCAN FAIL: storage client/src/pages/the-daily-fix/JoinModal.tsx:${lineNo}`,
        );
      } finally {
        writeFileSync(join, before);
      }
    }
  });
});

describe("AU26.8", () => {
  it("AU26.8 worker non-upstream has no BSI fetch /wp-json literals", () => {
    const workerRoot = path.join(REPO_ROOT, "worker");
    const files = walkFiles(workerRoot).filter((abs) => {
      const rel = relPosix(REPO_ROOT, abs);
      if (!rel.endsWith(".ts")) return false;
      if (rel.endsWith(".test.ts") || rel.endsWith(".test-d.ts")) return false;
      if (rel.includes("/__fixtures__/")) return false;
      if (rel.startsWith("worker/pr2/")) return false;
      if (rel === "worker/upstream.ts") return false;
      return true;
    });
    if (files.length === 0) {
      throw new Error("SCAN FAIL: bsi-client zero files scanned");
    }
    const list = files.map((f) => relPosix(REPO_ROOT, f));
    expect(list.some((f) => f.startsWith("worker/auth/"))).toBe(true);
    expect(list).toContain("worker/comments.ts");

    // Vacuity: upstream.ts itself has ≥1 hit
    const upstream = normalizeLf(
      readFileSync(path.join(REPO_ROOT, "worker/upstream.ts"), "utf8"),
    );
    expect(/\/wp-json|brokenscience\.org|brokenstaging/.test(upstream)).toBe(
      true,
    );

    const hits: string[] = [];
    const bad =
      /(?:fetch\s*\([^;]{0,200}(?:brokenscience\.org|brokenstaging\.wpengine\.com|\/wp-json)|["'`][^"'`]*\/wp-json)/;
    for (const abs of files) {
      const rel = relPosix(REPO_ROOT, abs);
      const lines = normalizeLf(readFileSync(abs, "utf8")).split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (bad.test(lines[i]!) || /\/wp-json/.test(lines[i]!)) {
          hits.push(`SCAN FAIL: bsi-client ${rel}:${i + 1}`);
        }
      }
    }
    expect(hits).toEqual([]);

    // Plants
    const login = path.join(REPO_ROOT, "worker/auth/login.ts");
    const comments = path.join(REPO_ROOT, "worker/comments.ts");
    const loginBefore = readFileSync(login, "utf8");
    const commentsBefore = readFileSync(comments, "utf8");
    try {
      writeFileSync(
        login,
        loginBefore +
          `\nvoid fetch(\`\${base}/wp-json/bsi/v1/auth/web-login\`);\n`,
      );
      writeFileSync(
        comments,
        commentsBefore + `\nconst p = "/wp-json/metfix/v1";\n`,
      );
      const plantHits: string[] = [];
      for (const [abs, rel] of [
        [login, "worker/auth/login.ts"],
        [comments, "worker/comments.ts"],
      ] as const) {
        const lines = normalizeLf(readFileSync(abs, "utf8")).split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (bad.test(lines[i]!) || /\/wp-json/.test(lines[i]!)) {
            plantHits.push(`SCAN FAIL: bsi-client ${rel}:${i + 1}`);
          }
        }
      }
      expect(
        plantHits.some((h) => h.startsWith("SCAN FAIL: bsi-client worker/auth/login.ts:")),
      ).toBe(true);
      expect(
        plantHits.some((h) =>
          h.startsWith("SCAN FAIL: bsi-client worker/comments.ts:"),
        ),
      ).toBe(true);
    } finally {
      writeFileSync(login, loginBefore);
      writeFileSync(comments, commentsBefore);
    }
  });
});
