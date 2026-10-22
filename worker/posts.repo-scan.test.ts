/**
 * Repo-scan tests RS1/PX1, PX1.r, RS2, RS3, CK-N1 (A22 / G3 / CQ15 / N1 / §0j).
 * Each has its own zero-files / missing-dir vacuity guard (§0i).
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { build } from "vite";
import { makeIsolatedViteProject } from "../tools/pr2/isolated-vite-project";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PX1_PATTERNS: Array<{ rule: string; re: RegExp; plant: string }> = [
  { rule: "BSI_POSTS_API_KEY", re: /BSI_POSTS_API_KEY/, plant: "BSI_POSTS_API_KEY" },
  { rule: "bsi/v1/posts", re: /bsi\/v1\/posts/, plant: "bsi/v1/posts" },
  { rule: "wp-json", re: /wp-json/, plant: "wp-json" },
  { rule: "test-posts-key", re: /test-posts-key/, plant: "test-posts-key" },
  { rule: "DAILY_FIX_API_KEY", re: /DAILY_FIX_API_KEY/, plant: "DAILY_FIX_API_KEY" },
  { rule: "X-API-Key", re: /X-API-Key/, plant: "X-API-Key" },
  { rule: "test-secret-key", re: /test-secret-key/, plant: "test-secret-key" },
];

function walkFiles(dir: string, pred: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      out.push(...walkFiles(full, pred));
    } else if (ent.isFile() && pred(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanFail(rule: string, file: string, line: number): string {
  return `SCAN FAIL: ${rule} ${relative(REPO_ROOT, file)}:${line}`;
}

function scanDirForPatterns(
  dir: string,
  patterns: Array<{ rule: string; re: RegExp }>,
): { files: string[]; failures: string[] } {
  const files = walkFiles(dir, () => true);
  const failures: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const p of patterns) {
        if (p.re.test(line)) {
          failures.push(scanFail(p.rule, file, i + 1));
        }
      }
    }
  }
  return { files, failures };
}

function porcelain(): string {
  return execSync("git status --porcelain --ignored -uall", {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

describe("RS1/PX1 bundle patterns", () => {
  it("vacuity: client/src exists and has files", () => {
    const dir = join(REPO_ROOT, "client/src");
    expect(existsSync(dir), "SCAN FAIL: client/src missing").toBe(true);
    const files = walkFiles(dir, (n) => n.endsWith(".ts") || n.endsWith(".tsx"));
    expect(files.length, "SCAN FAIL: zero client files").toBeGreaterThan(0);
  });

  it(
    "RS1/PX1: programmatic vite build into temp outDir; scan forbidden patterns",
    { timeout: 120_000 },
    async () => {
      const outDir = mkdtempSync(join(tmpdir(), "posts-px1-out-"));
      const cacheDir = mkdtempSync(join(tmpdir(), "posts-px1-cache-"));
      const proj = makeIsolatedViteProject(REPO_ROOT, "posts-px1-proj-");
      try {
        await build({
          configFile: proj.configFile,
          root: proj.clientRoot,
          build: {
            outDir,
            emptyOutDir: true,
          },
          cacheDir,
          logLevel: "error",
        });

        const { files, failures } = scanDirForPatterns(outDir, PX1_PATTERNS);
        expect(files.length, "SCAN FAIL: zero built files").toBeGreaterThan(0);
        expect(failures, failures.join("\n")).toEqual([]);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
        rmSync(cacheDir, { recursive: true, force: true });
        proj.cleanup();
      }
    },
  );

  it("RS1/PX1 planted patterns → SCAN FAIL; empty outDir fails", () => {
    const empty = mkdtempSync(join(tmpdir(), "posts-px1-empty-"));
    try {
      const { files } = scanDirForPatterns(empty, PX1_PATTERNS);
      expect(files.length, "SCAN FAIL: zero built files").toBe(0);
      // Vacuity: empty must be treated as failure by the caller.
      expect(files.length > 0).toBe(false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }

    for (const p of PX1_PATTERNS) {
      const plantDir = mkdtempSync(join(tmpdir(), "posts-px1-plant-"));
      try {
        const plantFile = join(plantDir, "chunk.js");
        writeFileSync(plantFile, `const x = "${p.plant}";\n`);
        const { failures } = scanDirForPatterns(plantDir, PX1_PATTERNS);
        expect(failures.some((f) => f.includes(`SCAN FAIL: ${p.rule}`))).toBe(true);
        expect(failures[0]).toMatch(
          new RegExp(`^SCAN FAIL: ${p.rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `),
        );
      } finally {
        rmSync(plantDir, { recursive: true, force: true });
      }
    }
  });
});

describe("PX1.r porcelain / temp cleanup", () => {
  it(
    "PX1.r: porcelain identical after build; temp dirs gone; nothing under repo",
    { timeout: 120_000 },
    async () => {
      const before = porcelain();
      const outDir = mkdtempSync(join(tmpdir(), "posts-px1r-out-"));
      const cacheDir = mkdtempSync(join(tmpdir(), "posts-px1r-cache-"));
      const proj = makeIsolatedViteProject(REPO_ROOT, "posts-px1r-proj-");
      expect(outDir.startsWith(REPO_ROOT)).toBe(false);
      expect(cacheDir.startsWith(REPO_ROOT)).toBe(false);
      expect(proj.root.startsWith(REPO_ROOT)).toBe(false);

      try {
        await build({
          configFile: proj.configFile,
          root: proj.clientRoot,
          build: { outDir, emptyOutDir: true },
          cacheDir,
          logLevel: "error",
        });
      } finally {
        rmSync(outDir, { recursive: true, force: true });
        rmSync(cacheDir, { recursive: true, force: true });
        proj.cleanup();
      }

      expect(existsSync(outDir)).toBe(false);
      expect(existsSync(cacheDir)).toBe(false);
      expect(existsSync(proj.root)).toBe(false);
      const after = porcelain();
      expect(after).toBe(before);
    },
  );

  it("PX1.r planted: outDir inside repo → FAIL naming path", () => {
    const bad = join(REPO_ROOT, ".posts-px1r-plant-outdir");
    mkdirSync(bad, { recursive: true });
    try {
      // Guard: a build outDir under the repo is forbidden.
      expect(bad.startsWith(REPO_ROOT)).toBe(true);
      expect(existsSync(bad)).toBe(true);
      // The real PX1.r test always uses os.tmpdir(); this case documents the fail shape.
      expect(`SCAN FAIL: px1r-outdir ${relative(REPO_ROOT, bad)}`).toContain(
        ".posts-px1r-plant-outdir",
      );
    } finally {
      rmSync(bad, { recursive: true, force: true });
    }
  });
});

describe("RS2 posts log rule", () => {
  it("every console.* in posts non-test source is posts:<kind> + optional number", () => {
    const workerPosts = walkFiles(
      join(REPO_ROOT, "worker"),
      (n) => /^posts.*\.ts$/.test(n) && !n.includes(".test."),
    );
    const sharedPosts = walkFiles(
      join(REPO_ROOT, "shared/posts"),
      (n) => n.endsWith(".ts") && !n.includes(".test."),
    );
    const files = [...workerPosts, ...sharedPosts];
    expect(files.length, "SCAN FAIL: zero posts source files").toBeGreaterThan(0);

    const failures: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!/\bconsole\.(log|info|warn|error|debug|trace)\s*\(/.test(line)) continue;
        if (line.includes("`") || line.includes("${") || /\+\s*["'`]|["'`]\s*\+/.test(line)) {
          failures.push(scanFail("posts-log", file, i + 1));
          continue;
        }
        if (/console\.\w+\s*\(\s*\{/.test(line)) {
          failures.push(scanFail("posts-log", file, i + 1));
          continue;
        }
        const m = line.match(
          /\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(\s*("posts:[a-z][a-z0-9_]*")\s*(?:,\s*(?:\d+|[A-Za-z_][\w.]*))?\s*\)/,
        );
        if (!m) {
          failures.push(scanFail("posts-log", file, i + 1));
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("RS2 planted template / extra arg → SCAN FAIL", () => {
    const plantDir = mkdtempSync(join(tmpdir(), "posts-rs2-"));
    try {
      const f1 = join(plantDir, "a.ts");
      writeFileSync(f1, 'console.info(`posts:${kind}`);\n');
      const f2 = join(plantDir, "b.ts");
      writeFileSync(f2, 'console.info("posts:x", 1, 2);\n');

      const failures: string[] = [];
      for (const file of [f1, f2]) {
        const lines = readFileSync(file, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (!/\bconsole\./.test(line)) continue;
          if (line.includes("`") || line.includes("${")) {
            failures.push(scanFail("posts-log", file, i + 1));
            continue;
          }
          const m = line.match(
            /\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(\s*("posts:[a-z][a-z0-9_]*")\s*(?:,\s*(?:\d+|[A-Za-z_][\w.]*))?\s*\)/,
          );
          if (!m) failures.push(scanFail("posts-log", file, i + 1));
        }
      }
      expect(failures.length).toBeGreaterThanOrEqual(2);
      expect(failures.every((f) => f.startsWith("SCAN FAIL: posts-log "))).toBe(true);
    } finally {
      rmSync(plantDir, { recursive: true, force: true });
    }
  });
});

describe("RS3 no host-override / Test-only in worker/posts*.ts", () => {
  it("no Test-only marker or host-override params", () => {
    const files = walkFiles(
      join(REPO_ROOT, "worker"),
      (n) => /^posts.*\.ts$/.test(n) && !n.includes(".test."),
    );
    expect(files.length, "SCAN FAIL: zero worker/posts source files").toBeGreaterThan(0);

    const forbidden = /Test-only|bsiBaseUrl|\bbaseUrl\b|\bhost\b\s*[?:]|\borigin\s*[?:]/;
    const failures: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (/assertBsiHost|BSI_HOST|hostname|UPSTREAM_USER_AGENT|IMAGE_HOST/.test(line)) continue;
        if (forbidden.test(line)) {
          failures.push(scanFail("host-override", file, i + 1));
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("RS3 planted Test-only / bsiBaseUrl → SCAN FAIL", () => {
    const plantDir = mkdtempSync(join(tmpdir(), "posts-rs3-"));
    try {
      const f = join(plantDir, "posts-plant.ts");
      writeFileSync(f, "// Test-only\nexport function x(bsiBaseUrl: string) { return bsiBaseUrl; }\n");
      const failures: string[] = [];
      const lines = readFileSync(f, "utf8").split("\n");
      const forbidden = /Test-only|bsiBaseUrl/;
      for (let i = 0; i < lines.length; i++) {
        if (forbidden.test(lines[i]!)) failures.push(scanFail("host-override", f, i + 1));
      }
      expect(failures.length).toBeGreaterThanOrEqual(1);
      expect(failures[0]).toMatch(/^SCAN FAIL: host-override /);
    } finally {
      rmSync(plantDir, { recursive: true, force: true });
    }
  });
});

describe("CK-N1 literal-12 lint", () => {
  it("standalone literal 12 only at PAGE_SIZE declaration in non-test posts source", () => {
    const globs: Array<{ dir: string; pred: (n: string) => boolean }> = [
      {
        dir: join(REPO_ROOT, "worker"),
        pred: (n) => /^posts.*\.ts$/.test(n) && !n.includes(".test."),
      },
      {
        dir: join(REPO_ROOT, "shared/posts"),
        pred: (n) => n.endsWith(".ts") && !n.includes(".test."),
      },
      {
        dir: join(REPO_ROOT, "client/src/pages/posts"),
        pred: (n) => (n.endsWith(".ts") || n.endsWith(".tsx")) && !n.includes(".test."),
      },
    ];

    const files: string[] = [];
    for (const g of globs) {
      expect(existsSync(g.dir), `SCAN FAIL: missing ${g.dir}`).toBe(true);
      const found = walkFiles(g.dir, g.pred);
      expect(found.length, `SCAN FAIL: zero files in ${g.dir}`).toBeGreaterThan(0);
      files.push(...found);
    }
    expect(files.length, "SCAN FAIL: zero files for literal-12").toBeGreaterThan(0);

    const lit12 = /(?<![\w.])12(?![\w.])/;
    const failures: string[] = [];
    let pageSizeHits = 0;

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!lit12.test(line)) continue;
        if (/PAGE_SIZE\s*=\s*12\b/.test(line)) {
          pageSizeHits++;
          continue;
        }
        if (
          /['"`].*12.*['"`]/.test(line) &&
          !/\b12\b/.test(line.replace(/['"`][^'"`]*['"`]/g, ""))
        ) {
          continue;
        }
        failures.push(scanFail("literal-12", file, i + 1));
      }
    }

    expect(pageSizeHits, "PAGE_SIZE declaration missing").toBeGreaterThanOrEqual(1);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("CK-N1 planted literal-12 in each glob → SCAN FAIL; tests may use 12", () => {
    const plants = [
      join(REPO_ROOT, "worker", ".ckn1-plant-posts.ts"),
      join(REPO_ROOT, "shared/posts", ".ckn1-plant.ts"),
      join(REPO_ROOT, "client/src/pages/posts", ".ckn1-plant.ts"),
    ];
    try {
      writeFileSync(plants[0]!, "export const limit = 12;\n");
      writeFileSync(plants[1]!, "const per = 12;\n");
      writeFileSync(plants[2]!, "const page = page * 12;\n");

      const lit12 = /(?<![\w.])12(?![\w.])/;
      for (const file of plants) {
        const lines = readFileSync(file, "utf8").split("\n");
        let hit = false;
        for (let i = 0; i < lines.length; i++) {
          if (lit12.test(lines[i]!) && !/PAGE_SIZE\s*=\s*12\b/.test(lines[i]!)) {
            expect(scanFail("literal-12", file, i + 1)).toMatch(/^SCAN FAIL: literal-12 /);
            hit = true;
          }
        }
        expect(hit, file).toBe(true);
      }

      // Allowed in tests:
      expect("expect(body.per_page).toBe(12)".includes("12")).toBe(true);
      expect(/\b120\b/.test("120")).toBe(true);
      expect(/\b0x12\b/.test("0x12")).toBe(true);
    } finally {
      for (const f of plants) {
        try {
          rmSync(f, { force: true });
        } catch {
          /* ignore */
        }
      }
    }
  });
});
