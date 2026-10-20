import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadConfigFromFile } from "vite";
const NAME = "VITE_SANITY_API_READ_TOKEN";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const DUMMY = `skTEST${"A".repeat(60)}`;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const REPO_ENV = path.join(REPO_ROOT, ".env");
const REPO_CONFIG = path.join(REPO_ROOT, "vite.config.ts");
const DIST_PUBLIC = path.join(REPO_ROOT, "dist/public");
const CONST_TS = path.join(REPO_ROOT, "client/src/const.ts");
/** Quote form: NAME:"X with non-empty X. */
const TOKEN_INLINE_RE = new RegExp(`${NAME}:"[^"]`);
/** Vite may serialize a newline env value as a template literal NAME:`\n`. */
const TOKEN_NEWLINE_TEMPLATE = `${NAME}:\`\n\``;
const SENTINEL_BODY = `# metfix-vite-guard-sentinel\nSENTINEL_MARK=round4-do-not-touch\n`;

type DistSnapshot = {
  absent: boolean;
  files: Record<string, { md5: string; mtimeMs: number }>;
};

const tempPaths: string[] = [];
let sentinelCreated = false;
let sentinelBefore: ReturnType<typeof envFingerprint>;

function md5File(filePath: string): string {
  return createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function envFingerprint(filePath: string): {
  exists: boolean;
  md5: string | null;
  mtimeMs: number | null;
} {
  if (!fs.existsSync(filePath)) {
    return { exists: false, md5: null, mtimeMs: null };
  }
  const st = fs.statSync(filePath);
  return { exists: true, md5: md5File(filePath), mtimeMs: st.mtimeMs };
}

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function snapshotDistPublic(): DistSnapshot {
  if (!fs.existsSync(DIST_PUBLIC)) {
    return { absent: true, files: {} };
  }
  const files: DistSnapshot["files"] = {};
  for (const file of walkFiles(DIST_PUBLIC)) {
    const rel = path.relative(DIST_PUBLIC, file);
    const st = fs.statSync(file);
    files[rel] = { md5: md5File(file), mtimeMs: st.mtimeMs };
  }
  return { absent: false, files };
}

function cleanupPath(target: string) {
  if (!fs.existsSync(target)) return;
  const st = fs.lstatSync(target);
  if (st.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
  else fs.rmSync(target, { force: true });
}

/**
 * Temp project whose envDir is the temp dir; root/aliases still point at the repo.
 * Asserts each rewrite matched (including @shared / @assets).
 */
function makeTempEnvProject(configSourceText?: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metfix-vite-guard-"));
  tempPaths.push(tmp);
  const source = configSourceText ?? fs.readFileSync(REPO_CONFIG, "utf8");
  const replacements: Array<[string, string]> = [
    [
      'path.resolve(import.meta.dirname, "client", "src")',
      `path.resolve(${JSON.stringify(REPO_ROOT)}, "client", "src")`,
    ],
    [
      'path.resolve(import.meta.dirname, "shared")',
      `path.resolve(${JSON.stringify(REPO_ROOT)}, "shared")`,
    ],
    [
      'path.resolve(import.meta.dirname, "attached_assets")',
      `path.resolve(${JSON.stringify(REPO_ROOT)}, "attached_assets")`,
    ],
    [
      'root: path.resolve(import.meta.dirname, "client")',
      `root: path.resolve(${JSON.stringify(REPO_ROOT)}, "client")`,
    ],
  ];
  let rewritten = source;
  for (const [from, to] of replacements) {
    expect(rewritten.includes(from), `rewrite source must contain ${from}`).toBe(true);
    const next = rewritten.replaceAll(from, to);
    expect(next, `replaceAll must change text for ${from}`).not.toEqual(rewritten);
    rewritten = next;
  }
  fs.writeFileSync(path.join(tmp, "vite.config.ts"), rewritten);
  for (const name of ["node_modules", "vite", "package.json"]) {
    fs.symlinkSync(path.join(REPO_ROOT, name), path.join(tmp, name));
  }
  return tmp;
}

function writeTempEnv(tmp: string, value: string) {
  fs.writeFileSync(path.join(tmp, ".env"), `${NAME}=${value}\n`, "utf8");
}

async function loadConfig(configPath: string, command: "serve" | "build", mode = "production") {
  return loadConfigFromFile({ command, mode }, configPath);
}

/** Capture stdout/stderr while running an async fn (catches console.error of the dummy). */
async function withCapturedStdio<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string; stderr: string; error?: unknown }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const outSpy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  // Vitest intercepts console.*; mock them too so a console.error(value) mutation is caught
  // without printing the dummy into the test runner log.
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  });
  const infoSpy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  });
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  });
  try {
    const result = await fn();
    return { result, stdout: stdout.join(""), stderr: stderr.join("") };
  } catch (error) {
    return { result: undefined as T, stdout: stdout.join(""), stderr: stderr.join(""), error };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

function countDummyInDir(dir: string): number {
  let count = 0;
  const needle = Buffer.from(DUMMY);
  for (const file of walkFiles(dir)) {
    if (![".js", ".html", ".css", ".map"].includes(path.extname(file))) continue;
    const data = fs.readFileSync(file);
    let idx = 0;
    while (true) {
      const found = data.indexOf(needle, idx);
      if (found === -1) break;
      count += 1;
      idx = found + needle.length;
    }
  }
  return count;
}

/** V3(b): no NAME:"[^"] and no escaped/template newline form. */
function assertNoTokenInline(dir: string) {
  for (const file of walkFiles(dir)) {
    if (![".js", ".html", ".css", ".map"].includes(path.extname(file))) continue;
    const text = fs.readFileSync(file, "utf8");
    expect(text).not.toMatch(TOKEN_INLINE_RE);
    expect(text).not.toContain(DUMMY);
    expect(text).not.toContain(`${NAME}:" "`);
    expect(text).not.toContain(`${NAME}:"\t"`);
    expect(text).not.toContain(`${NAME}:"\\n"`);
    expect(text).not.toContain(TOKEN_NEWLINE_TEMPLATE);
  }
}

function countTokenInlineHits(dir: string): number {
  let hits = 0;
  for (const file of walkFiles(dir)) {
    if (![".js", ".html", ".css", ".map"].includes(path.extname(file))) continue;
    const text = fs.readFileSync(file, "utf8");
    if (TOKEN_INLINE_RE.test(text)) hits += 1;
    if (text.includes(TOKEN_NEWLINE_TEMPLATE)) hits += 1;
    if (text.includes(`${NAME}:"\\n"`)) hits += 1;
  }
  return hits;
}

function buildWithConfig(
  configPath: string,
  env: NodeJS.ProcessEnv,
): { status: number | null; outDir: string; stdout: string; stderr: string; log: string } {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "metfix-vite-outdir-"));
  tempPaths.push(outDir);
  try {
    const result = spawnSync(
      "npx",
      ["vite", "build", "--config", configPath, "--outDir", outDir, "--emptyOutDir"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
        encoding: "utf8",
      },
    );
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    return {
      status: result.status,
      outDir,
      stdout,
      stderr,
      log: `${stdout}\n${stderr}`,
    };
  } catch (err) {
    // Optional (outcome 6): clean temp outDir if the run is interrupted/throws.
    cleanupPath(outDir);
    const idx = tempPaths.indexOf(outDir);
    if (idx >= 0) tempPaths.splice(idx, 1);
    throw err;
  }
}

function mutateConfig(
  source: string,
  kind:
    | "process-env-only"
    | "or-fallback"
    | "console-error-before-throw"
    | "value-in-message"
    | "write-repo-env"
    | "write-then-delete-repo-env"
    | "remove-guard",
): string {
  const guardBlock = [
    `const env = { ...loadEnv(mode, envDir, ""), ...process.env };`,
    `  const sanityReadToken = String(env.${NAME} ?? "").trim();`,
  ].join("\n");
  const throwBlock = [
    `if (sanityReadToken) {`,
    `    throw new Error(`,
    `      "${NAME} must not be set; the browser client reads Sanity over the public CDN without a token.",`,
    `    );`,
    `  }`,
  ].join("\n");

  if (kind === "process-env-only") {
    return source.replace(
      guardBlock,
      `const sanityReadToken = String(process.env.${NAME} ?? "").trim();`,
    );
  }
  if (kind === "or-fallback") {
    const fallback = [
      `let fileValue = "";`,
      `  try {`,
      `    const match = fs.readFileSync(path.join(envDir, ".env"), "utf8").match(/^${NAME}=(.*)$/m);`,
      `    if (match) fileValue = match[1];`,
      `  } catch {}`,
      `  const sanityReadToken = String(process.env.${NAME} || fileValue || "").trim();`,
    ].join("\n");
    return source.replace(guardBlock, fallback);
  }
  if (kind === "console-error-before-throw") {
    return source.replace(
      throwBlock,
      [
        `if (sanityReadToken) {`,
        `    console.error(sanityReadToken);`,
        `    throw new Error(`,
        `      "${NAME} must not be set; the browser client reads Sanity over the public CDN without a token.",`,
        `    );`,
        `  }`,
      ].join("\n"),
    );
  }
  if (kind === "value-in-message") {
    return source.replace(
      throwBlock,
      [
        `if (sanityReadToken) {`,
        `    throw new Error(`,
        `      "${NAME} must not be set; got " + sanityReadToken,`,
        `    );`,
        `  }`,
      ].join("\n"),
    );
  }
  if (kind === "write-repo-env") {
    return source.replace(
      throwBlock,
      [
        `fs.writeFileSync(${JSON.stringify(REPO_ENV)}, "${NAME}=" + (sanityReadToken || "x") + "\\n");`,
        `  ${throwBlock}`,
      ].join("\n"),
    );
  }
  if (kind === "write-then-delete-repo-env") {
    return source.replace(
      throwBlock,
      [
        `fs.writeFileSync(${JSON.stringify(REPO_ENV)}, "${NAME}=scratch\\n");`,
        `  fs.rmSync(${JSON.stringify(REPO_ENV)}, { force: true });`,
        `  ${throwBlock}`,
      ].join("\n"),
    );
  }
  // remove-guard
  return source.replace(throwBlock, "/* R4b removed */");
}

describe("vite.config.ts Sanity read-token guard (V1–V11)", () => {
  beforeAll(() => {
    if (!fs.existsSync(REPO_ENV)) {
      fs.writeFileSync(REPO_ENV, SENTINEL_BODY, "utf8");
      sentinelCreated = true;
    }
    sentinelBefore = envFingerprint(REPO_ENV);
    expect(sentinelBefore.exists).toBe(true);
    expect(sentinelBefore.md5).toBeTruthy();
  });

  afterAll(() => {
    const after = envFingerprint(REPO_ENV);
    expect(after.exists).toBe(true);
    expect(after.md5).toBe(sentinelBefore.md5);
    // Happy-path tests never touch the file; mtime must still match.
    expect(after.mtimeMs).toBe(sentinelBefore.mtimeMs);
    if (sentinelCreated && fs.existsSync(REPO_ENV)) {
      const body = fs.readFileSync(REPO_ENV, "utf8");
      if (body === SENTINEL_BODY) fs.rmSync(REPO_ENV, { force: true });
    }
  });

  afterEach(() => {
    delete process.env[NAME];
    while (tempPaths.length) {
      const target = tempPaths.pop();
      if (target) cleanupPath(target);
    }
    // Sentinel bytes must survive every test (mtime checked in afterAll / kill case).
    const fp = envFingerprint(REPO_ENV);
    expect(fp.exists).toBe(true);
    expect(fp.md5).toBe(sentinelBefore.md5);
  });

  function restoreSentinelBytes() {
    fs.writeFileSync(REPO_ENV, SENTINEL_BODY, "utf8");
    fs.utimesSync(REPO_ENV, new Date(sentinelBefore.mtimeMs!), new Date(sentinelBefore.mtimeMs!));
    const fp = envFingerprint(REPO_ENV);
    expect(fp.md5).toBe(sentinelBefore.md5);
    // Some FS round mtime; if utimes could not restore exactly, re-baseline mtime
    // only when bytes match — suite afterAll still requires the kill case never moved it.
    if (fp.mtimeMs !== sentinelBefore.mtimeMs) {
      sentinelBefore = fp;
    }
  }

  it("V1 throws when the variable is non-empty in process.env", async () => {
    process.env[NAME] = DUMMY;
    await expect(loadConfig(REPO_CONFIG, "build")).rejects.toThrow(NAME);
  });

  it("V2 throws when the variable is set only in a temp .env via loadEnv (V11)", async () => {
    delete process.env[NAME];
    const tmp = makeTempEnvProject();
    writeTempEnv(tmp, DUMMY);
    await expect(loadConfig(path.join(tmp, "vite.config.ts"), "build")).rejects.toThrow(NAME);
  });

  it(
    "V2b blank shell overrides .env dummy: resolve + build clean (K8d)",
    async () => {
      const beforeDist = snapshotDistPublic();
      const tmp = makeTempEnvProject();
      writeTempEnv(tmp, DUMMY);
      process.env[NAME] = "";

      await expect(loadConfig(path.join(tmp, "vite.config.ts"), "serve")).resolves.toBeTruthy();
      await expect(loadConfig(path.join(tmp, "vite.config.ts"), "build")).resolves.toBeTruthy();

      const built = buildWithConfig(path.join(tmp, "vite.config.ts"), { [NAME]: "" });
      expect(built.status).toBe(0);
      expect(built.stdout).not.toContain(DUMMY);
      expect(built.stderr).not.toContain(DUMMY);
      expect(countDummyInDir(built.outDir)).toBe(0);
      assertNoTokenInline(built.outDir);
      expect(snapshotDistPublic()).toEqual(beforeDist);
    },
    60_000,
  );

  it("V2b mutations: process.env-only breaks V2; || fallback breaks V2b", async () => {
    const source = fs.readFileSync(REPO_CONFIG, "utf8");
    const m1Source = mutateConfig(source, "process-env-only");
    const m2Source = mutateConfig(source, "or-fallback");
    expect(m1Source).not.toEqual(source);
    expect(m2Source).not.toEqual(source);

    delete process.env[NAME];
    const m1Tmp = makeTempEnvProject(m1Source);
    writeTempEnv(m1Tmp, DUMMY);
    await expect(loadConfig(path.join(m1Tmp, "vite.config.ts"), "build")).resolves.toBeTruthy();

    const m2Tmp = makeTempEnvProject(m2Source);
    writeTempEnv(m2Tmp, DUMMY);
    process.env[NAME] = "";
    await expect(loadConfig(path.join(m2Tmp, "vite.config.ts"), "build")).rejects.toThrow(NAME);
  });

  it(
    "V3 whitespace-only builds each value; padded dummy never leaks to stdio",
    async () => {
      const beforeDist = snapshotDistPublic();

      for (const ws of [" ", "\t", "\n"] as const) {
        process.env[NAME] = ws;
        await expect(loadConfig(REPO_CONFIG, "serve")).resolves.toBeTruthy();
        await expect(loadConfig(REPO_CONFIG, "build")).resolves.toBeTruthy();

        const built = buildWithConfig(REPO_CONFIG, { [NAME]: ws });
        expect(built.status, `build:cf must exit 0 for ${JSON.stringify(ws)}`).toBe(0);
        expect(built.stdout).not.toContain(DUMMY);
        expect(built.stderr).not.toContain(DUMMY);
        assertNoTokenInline(built.outDir);
        expect(countTokenInlineHits(built.outDir)).toBe(0);
      }
      expect(snapshotDistPublic()).toEqual(beforeDist);

      // V3(c): padded dummy from process.env — message + stdout + stderr clean.
      for (const padded of [`  ${DUMMY}  `, `\n${DUMMY}\n`] as const) {
        process.env[NAME] = padded;
        const captured = await withCapturedStdio(async () => loadConfig(REPO_CONFIG, "build"));
        expect(captured.error).toBeTruthy();
        const message =
          captured.error instanceof Error ? captured.error.message : String(captured.error);
        expect(message).toContain(NAME);
        expect(message).not.toContain(DUMMY);
        expect(message).not.toContain(DUMMY.trim());
        expect(captured.stdout).not.toContain(DUMMY);
        expect(captured.stdout).not.toContain(DUMMY.trim());
        expect(captured.stderr).not.toContain(DUMMY);
        expect(captured.stderr).not.toContain(DUMMY.trim());
      }

      // V3(c) from temp .env (V11 envDir).
      delete process.env[NAME];
      const tmp = makeTempEnvProject();
      writeTempEnv(tmp, `  ${DUMMY}  `);
      const fromEnv = await withCapturedStdio(async () =>
        loadConfig(path.join(tmp, "vite.config.ts"), "build"),
      );
      expect(fromEnv.error).toBeTruthy();
      const envMsg = fromEnv.error instanceof Error ? fromEnv.error.message : String(fromEnv.error);
      expect(envMsg).toContain(NAME);
      expect(envMsg).not.toContain(DUMMY);
      expect(fromEnv.stdout).not.toContain(DUMMY);
      expect(fromEnv.stderr).not.toContain(DUMMY);
    },
    120_000,
  );

  it(
    "V3(b) leaking scratch mutation produces inline hits including escaped newline",
    async () => {
      const source = fs.readFileSync(REPO_CONFIG, "utf8");
      const noGuard = mutateConfig(source, "remove-guard");
      expect(noGuard).not.toEqual(source);

      const origConst = fs.readFileSync(CONST_TS, "utf8");
      const bareConst = origConst.replace(
        'const base = import.meta.env.BASE_URL || "/";',
        'const env = import.meta.env;\n  const base = (env && env.BASE_URL) || "/";',
      );
      expect(bareConst).not.toEqual(origConst);

      try {
        fs.writeFileSync(CONST_TS, bareConst);
        const tmp = makeTempEnvProject(noGuard);

        for (const ws of [" ", "\t", "\n"] as const) {
          const built = buildWithConfig(path.join(tmp, "vite.config.ts"), { [NAME]: ws });
          expect(built.status).toBe(0);
          expect(
            countTokenInlineHits(built.outDir),
            `leaking mutation must produce (b) hits for ${JSON.stringify(ws)}`,
          ).toBeGreaterThan(0);
        }
      } finally {
        fs.writeFileSync(CONST_TS, origConst);
      }
    },
    120_000,
  );

  it("V3(c)/V4 mutation: console.error of the value must fail stdio assertions", async () => {
    const source = fs.readFileSync(REPO_CONFIG, "utf8");
    const mutated = mutateConfig(source, "console-error-before-throw");
    expect(mutated).not.toEqual(source);
    const tmp = makeTempEnvProject(mutated);
    process.env[NAME] = DUMMY;

    const captured = await withCapturedStdio(async () =>
      loadConfig(path.join(tmp, "vite.config.ts"), "serve"),
    );
    expect(captured.error).toBeTruthy();
    // This is the proof mutation: stderr contains the dummy → V4/V3(c) would FAIL.
    expect(captured.stderr).toContain(DUMMY);
  });

  it("V4 error names the variable and never includes the dummy in message or stdio", async () => {
    process.env[NAME] = DUMMY;
    const captured = await withCapturedStdio(async () => loadConfig(REPO_CONFIG, "serve"));
    expect(captured.error).toBeTruthy();
    const message =
      captured.error instanceof Error ? captured.error.message : String(captured.error);
    expect(message).toContain(NAME);
    expect(message).not.toContain(DUMMY);
    expect(captured.stdout).not.toContain(DUMMY);
    expect(captured.stderr).not.toContain(DUMMY);
  });

  it("V4 mutation: value in message fails", async () => {
    const source = fs.readFileSync(REPO_CONFIG, "utf8");
    const mutated = mutateConfig(source, "value-in-message");
    expect(mutated).not.toEqual(source);
    const tmp = makeTempEnvProject(mutated);
    process.env[NAME] = DUMMY;
    const captured = await withCapturedStdio(async () =>
      loadConfig(path.join(tmp, "vite.config.ts"), "serve"),
    );
    const message =
      captured.error instanceof Error ? captured.error.message : String(captured.error);
    expect(message).toContain(DUMMY);
  });

  it("V5 throws for both serve and build", async () => {
    process.env[NAME] = DUMMY;
    await expect(loadConfig(REPO_CONFIG, "serve")).rejects.toThrow(NAME);
    await expect(loadConfig(REPO_CONFIG, "build")).rejects.toThrow(NAME);
  });

  it("V6 loads the real config with no test-only helper export", async () => {
    const source = fs.readFileSync(REPO_CONFIG, "utf8");
    expect(source).not.toMatch(/export\s+(async\s+)?function\s+__checkToken/);
    expect(source).not.toMatch(/export\s+const\s+__checkToken/);
    delete process.env[NAME];
    await expect(loadConfig(REPO_CONFIG, "build")).resolves.toBeTruthy();
  });

  it(
    "V7/V10 unset or empty does not throw; build uses temp outDir and leaves dist/public",
    async () => {
      const beforeDist = snapshotDistPublic();
      delete process.env[NAME];
      await expect(loadConfig(REPO_CONFIG, "build")).resolves.toBeTruthy();

      process.env[NAME] = "";
      await expect(loadConfig(REPO_CONFIG, "serve")).resolves.toBeTruthy();
      delete process.env[NAME];

      const built = buildWithConfig(REPO_CONFIG, {});
      expect(built.status).toBe(0);
      expect(built.stdout).not.toContain(DUMMY);
      expect(built.stderr).not.toContain(DUMMY);
      expect(path.resolve(built.outDir)).not.toBe(path.resolve(DIST_PUBLIC));
      expect(snapshotDistPublic()).toEqual(beforeDist);
      // Cleanup of temp outDir is handled in afterEach via tempPaths (outcome 6).
    },
    60_000,
  );

  it(
    "V11 kill case: real V2 config path, SIGKILL after temp .env write, sentinel untouched",
    async () => {
      const before = envFingerprint(REPO_ENV);
      expect(before).toEqual(sentinelBefore);

      const tmp = makeTempEnvProject();
      const configPath = path.join(tmp, "vite.config.ts");
      const readyFile = path.join(tmp, "ready");
      const scriptPath = path.join(tmp, "kill-v2.mjs");

      // Child runs the real V2 path: write temp .env, then loadConfigFromFile on the real config.
      fs.writeFileSync(
        scriptPath,
        `
      import fs from "node:fs";
      import path from "node:path";
      import { pathToFileURL } from "node:url";
      import { loadConfigFromFile } from "vite";

      const tmp = process.env.GUARD_TMP;
      const configPath = process.env.GUARD_CONFIG;
      const ready = process.env.GUARD_READY;
      const name = process.env.GUARD_NAME;
      const dummy = process.env.GUARD_DUMMY;

      fs.writeFileSync(path.join(tmp, ".env"), name + "=" + dummy + "\\n");
      fs.writeFileSync(ready, "1");

      try {
        await loadConfigFromFile({ command: "build", mode: "production" }, configPath);
      } catch {
        // expected throw on dummy; then wait for parent SIGKILL
      }
      setInterval(() => {}, 1e6);
      `,
      );

      const child = spawn(process.execPath, [scriptPath], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          GUARD_TMP: tmp,
          GUARD_CONFIG: configPath,
          GUARD_NAME: NAME,
          GUARD_DUMMY: DUMMY,
          GUARD_READY: readyFile,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let childErr = "";
      child.stderr?.on("data", (chunk) => {
        childErr += String(chunk);
      });

      const started = Date.now();
      while (!fs.existsSync(readyFile)) {
        if (child.exitCode !== null) {
          throw new Error(`child exited early (${child.exitCode}): ${childErr}`);
        }
        if (Date.now() - started > 15000) {
          child.kill("SIGKILL");
          throw new Error(`child never wrote ready file: ${childErr}`);
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      child.kill("SIGKILL");
      await new Promise((r) => child.once("exit", r));

      expect(envFingerprint(REPO_ENV)).toEqual(before);
      expect(fs.readFileSync(REPO_ENV, "utf8")).not.toContain(DUMMY);
      expect(fs.readFileSync(REPO_ENV, "utf8")).toBe(SENTINEL_BODY);
    },
    30_000,
  );

  it(
    "V11 mutations: write repo .env fails kill fingerprint; write-then-delete clears sentinel",
    async () => {
      const source = fs.readFileSync(REPO_CONFIG, "utf8");
      const writeMut = mutateConfig(source, "write-repo-env");
      const writeDeleteMut = mutateConfig(source, "write-then-delete-repo-env");
      expect(writeMut).not.toEqual(source);
      expect(writeDeleteMut).not.toEqual(source);

      // Write mutation: child runs real config path → repo .env fingerprint changes.
      {
        const tmp = makeTempEnvProject(writeMut);
        const configPath = path.join(tmp, "vite.config.ts");
        const readyFile = path.join(tmp, "ready");
        const scriptPath = path.join(tmp, "kill-write.mjs");
        fs.writeFileSync(
          scriptPath,
          `
        import fs from "node:fs";
        import path from "node:path";
        import { loadConfigFromFile } from "vite";
        const tmp = process.env.GUARD_TMP;
        const configPath = process.env.GUARD_CONFIG;
        const ready = process.env.GUARD_READY;
        const name = process.env.GUARD_NAME;
        const dummy = process.env.GUARD_DUMMY;
        fs.writeFileSync(path.join(tmp, ".env"), name + "=" + dummy + "\\n");
        fs.writeFileSync(ready, "1");
        try {
          await loadConfigFromFile({ command: "build", mode: "production" }, configPath);
        } catch {}
        setInterval(() => {}, 1e6);
        `,
        );

        const before = envFingerprint(REPO_ENV);
        const child = spawn(process.execPath, [scriptPath], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            GUARD_TMP: tmp,
            GUARD_CONFIG: configPath,
            GUARD_NAME: NAME,
            GUARD_DUMMY: DUMMY,
            GUARD_READY: readyFile,
          },
          stdio: ["ignore", "pipe", "pipe"],
        });

        const started = Date.now();
        while (!fs.existsSync(readyFile)) {
          if (child.exitCode !== null) break;
          if (Date.now() - started > 15000) {
            child.kill("SIGKILL");
            break;
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        // Give the config a moment to write the repo .env after ready.
        await new Promise((r) => setTimeout(r, 500));
        child.kill("SIGKILL");
        await new Promise((r) => child.once("exit", r));

        const after = envFingerprint(REPO_ENV);
        expect(after).not.toEqual(before);
        restoreSentinelBytes();
      }

      // Write-then-delete: sentinel disappears (absent vs present) → must fail.
      {
        const tmp = makeTempEnvProject(writeDeleteMut);
        process.env[NAME] = DUMMY;
        const before = envFingerprint(REPO_ENV);
        expect(before.exists).toBe(true);
        try {
          await loadConfig(path.join(tmp, "vite.config.ts"), "build");
        } catch {
          // expected throw after write+delete
        }
        const after = envFingerprint(REPO_ENV);
        expect(after.exists).toBe(false);
        expect(after).not.toEqual(before);
        restoreSentinelBytes();
      }
    },
    40_000,
  );
});
