import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadConfigFromFile, loadEnv } from "vite";
const NAME = "VITE_SANITY_API_READ_TOKEN";
import { afterEach, describe, expect, it, vi } from "vitest";

const DUMMY = `skTEST${"A".repeat(60)}`;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const REPO_ENV = path.join(REPO_ROOT, ".env");
const REPO_CONFIG = path.join(REPO_ROOT, "vite.config.ts");
const DIST_PUBLIC = path.join(REPO_ROOT, "dist/public");
const REPO_CONST_TS = path.join(REPO_ROOT, "client/src/const.ts");
const THIS_TEST_FILE = path.join(import.meta.dirname, "sanity.vite-guard.test.ts");
/** Quote form: NAME:"X with non-empty X. */
const TOKEN_INLINE_RE = new RegExp(`${NAME}:"[^"]`);
/** Vite may serialize a newline env value as a template literal NAME:`\n`. */
const TOKEN_NEWLINE_TEMPLATE = `${NAME}:\`\n\``;
const CANARY_ENV_BODY = "MY_DEV_SECRET=keepme\n";
const CANARY_UNTRACKED = path.join(REPO_ROOT, ".metfix-v12-canary-untracked");
const START_PREFIX = path.join(os.tmpdir(), "metfix-v12-start-");

type DistSnapshot = {
  absent: boolean;
  files: Record<string, { md5: string; mtimeMs: number }>;
};

type TempProject = {
  root: string;
  configPath: string;
  constPath: string;
};

const tempPaths: string[] = [];

function md5File(filePath: string): string {
  return createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
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

/** Resolve + realpath (follows symlinks); require target under tempRoot. */
function assertUnderTemp(tempRoot: string, target: string): string {
  const tempReal = fs.realpathSync(tempRoot);
  const resolved = path.resolve(target);
  let finalPath: string;
  if (fs.existsSync(resolved)) {
    // Follow symlinks so a link inside temp → repo file is rejected.
    finalPath = fs.realpathSync(resolved);
  } else {
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      throw new Error(`Refusing write: parent does not exist for ${resolved}`);
    }
    finalPath = path.join(fs.realpathSync(parent), path.basename(resolved));
  }
  const underTemp =
    finalPath === tempReal ||
    finalPath.startsWith(tempReal.endsWith(path.sep) ? tempReal : tempReal + path.sep);
  if (!underTemp) {
    throw new Error(`Refusing write outside temp project: ${finalPath} (temp=${tempReal})`);
  }
  return finalPath;
}

function safeWriteFile(tempRoot: string, target: string, data: string | NodeJS.ArrayBufferView) {
  assertUnderTemp(tempRoot, target);
  fs.writeFileSync(target, data);
}

function safeRm(tempRoot: string, target: string) {
  assertUnderTemp(tempRoot, target);
  fs.rmSync(target, { force: true, recursive: true });
}

function signalTestStart(label: string) {
  fs.writeFileSync(`${START_PREFIX}${label}`, `${Date.now()}\n`, "utf8");
}

/**
 * Full temp copy of the project (no node_modules / .git / dist).
 * Symlinks node_modules from the repo. All mutations happen here.
 */
function makeTempProject(configSourceText?: string): TempProject {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "metfix-v12-"));
  tempPaths.push(root);

  for (const name of ["client", "shared", "vite", "attached_assets"]) {
    const src = path.join(REPO_ROOT, name);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(root, name);
    assertUnderTemp(root, dest);
    fs.cpSync(src, dest, { recursive: true });
  }
  for (const name of ["vite.config.ts", "package.json", "tsconfig.json", "wrangler.jsonc"]) {
    const src = path.join(REPO_ROOT, name);
    if (!fs.existsSync(src)) continue;
    safeWriteFile(root, path.join(root, name), fs.readFileSync(src));
  }

  if (configSourceText != null) {
    safeWriteFile(root, path.join(root, "vite.config.ts"), configSourceText);
  }

  const nm = path.join(root, "node_modules");
  assertUnderTemp(root, nm);
  fs.symlinkSync(path.join(REPO_ROOT, "node_modules"), nm);

  return {
    root,
    configPath: path.join(root, "vite.config.ts"),
    constPath: path.join(root, "client/src/const.ts"),
  };
}

function writeTempEnv(project: TempProject, value: string, quoted = false) {
  const body = quoted ? `${NAME}="${value}"\n` : `${NAME}=${value}\n`;
  safeWriteFile(project.root, path.join(project.root, ".env"), body);
}

async function loadConfig(configPath: string, command: "serve" | "build", mode = "production") {
  return loadConfigFromFile({ command, mode }, configPath);
}

/** Capture stdout/stderr (including console.*) without printing the dummy. */
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
  project: TempProject,
  env: NodeJS.ProcessEnv,
): { status: number | null; outDir: string; stdout: string; stderr: string; log: string } {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "metfix-vite-outdir-"));
  tempPaths.push(outDir);
  const result = spawnSync(
    "npx",
    ["vite", "build", "--config", project.configPath, "--outDir", outDir, "--emptyOutDir"],
    {
      cwd: project.root,
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
}

function mutateConfig(
  source: string,
  kind:
    | "process-env-only"
    | "or-fallback"
    | "console-error-before-throw"
    | "value-in-message"
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
  return source.replace(throwBlock, "/* R4b removed */");
}

/** V12(a) static scan: flag write/spawn patterns that target the repo. */
function staticFindUnsafeWrites(source: string): string[] {
  // Drop the V12 canary harness (only place allowed to touch the real clone).
  const scan = source.replace(/\/\/ V12_HARNESS_BEGIN[\s\S]*?\/\/ V12_HARNESS_END/g, "\n");

  const issues: string[] = [];
  if (/fs\.writeFileSync\(\s*REPO_ENV\b/.test(scan)) issues.push("M-a1: writeFileSync(REPO_ENV)");
  if (/fs\.writeFileSync\(\s*REPO_CONST_TS\b/.test(scan)) issues.push("M-a2: writeFileSync(REPO_CONST_TS)");
  if (/const\s+t\s*=\s*REPO_CONST_TS[\s\S]{0,200}?fs\.writeFileSync\(\s*t\s*,/.test(scan)) {
    issues.push("M-a2: writeFileSync via alias");
  }
  if (/spawnSync\(\s*["']sh["'][\s\S]{0,160}REPO_ENV/.test(scan)) {
    issues.push("M-a3: spawnSync sh write to REPO_ENV");
  }
  if (/echo\s+[^\n]*\s*>\s*[^\n]*REPO_ENV/.test(scan)) {
    issues.push("M-a3: shell redirect to REPO_ENV");
  }
  if (/fs\.writeFileSync\(\s*path\.join\(\s*REPO_ROOT\s*,/.test(scan)) {
    issues.push("writeFileSync(path.join(REPO_ROOT,…))");
  }
  return issues;
}

function snippetFailsStatic(snippet: string): boolean {
  return staticFindUnsafeWrites(snippet).length > 0;
}

function gitPorcelain(): string {
  const r = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.stdout ?? "";
}

function headConstBytes(): Buffer {
  const r = spawnSync("git", ["show", "HEAD:client/src/const.ts"], {
    cwd: REPO_ROOT,
    encoding: "buffer",
  });
  if (r.status !== 0) throw new Error("git show HEAD:client/src/const.ts failed");
  return r.stdout as Buffer;
}

// V12_HARNESS_BEGIN
/** V12 harness only: stage canary files in the real clone for (b)/(c) proofs. */
function stageRepoCanary(): { envMd5: string; porcelain: string; createdEnv: boolean } {
  const createdEnv = !fs.existsSync(REPO_ENV);
  if (createdEnv) {
    fs.writeFileSync(REPO_ENV, CANARY_ENV_BODY, "utf8");
  }
  fs.writeFileSync(CANARY_UNTRACKED, "v12-canary\n", "utf8");
  return {
    envMd5: md5File(REPO_ENV),
    porcelain: gitPorcelain(),
    createdEnv,
  };
}

function unstageRepoCanary(createdEnv: boolean) {
  if (fs.existsSync(CANARY_UNTRACKED)) fs.rmSync(CANARY_UNTRACKED, { force: true });
  if (createdEnv && fs.existsSync(REPO_ENV)) {
    const body = fs.readFileSync(REPO_ENV, "utf8");
    if (body === CANARY_ENV_BODY) fs.rmSync(REPO_ENV, { force: true });
  }
}
// V12_HARNESS_END

function runGuardTests(testNamePattern: string): { status: number | null; stdout: string; stderr: string } {
  // Same entrypoint as CI (`npm test` → vitest with vite.config root=client).
  const result = spawnSync(
    "npm",
    ["test", "--", "--run", "src/lib/sanity.vite-guard.test.ts", "-t", testNamePattern],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("vite.config.ts Sanity read-token guard (V1–V10)", () => {
  afterEach(() => {
    delete process.env[NAME];
    while (tempPaths.length) {
      const target = tempPaths.pop();
      if (target) cleanupPath(target);
    }
  });

  it("V1 throws when the variable is non-empty in process.env", async () => {
    const project = makeTempProject();
    process.env[NAME] = DUMMY;
    await expect(loadConfig(project.configPath, "build")).rejects.toThrow(NAME);
  });

  it("V2 throws when the variable is set only in a temp .env via loadEnv", async () => {
    signalTestStart("V2");
    delete process.env[NAME];
    const project = makeTempProject();
    writeTempEnv(project, DUMMY);
    await expect(loadConfig(project.configPath, "build")).rejects.toThrow(NAME);
  });

  it(
    "V2b blank shell overrides .env dummy: resolve + build clean (K8d)",
    async () => {
      signalTestStart("V2b");
      const beforeDist = snapshotDistPublic();
      const project = makeTempProject();
      writeTempEnv(project, DUMMY);
      process.env[NAME] = "";

      await expect(loadConfig(project.configPath, "serve")).resolves.toBeTruthy();
      await expect(loadConfig(project.configPath, "build")).resolves.toBeTruthy();

      const built = buildWithConfig(project, { [NAME]: "" });
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
    const m1 = makeTempProject(m1Source);
    writeTempEnv(m1, DUMMY);
    await expect(loadConfig(m1.configPath, "build")).resolves.toBeTruthy();

    const m2 = makeTempProject(m2Source);
    writeTempEnv(m2, DUMMY);
    process.env[NAME] = "";
    await expect(loadConfig(m2.configPath, "build")).rejects.toThrow(NAME);
  });

  it(
    "V3 whitespace-only builds each value; padded dummy never leaks to stdio",
    async () => {
      const beforeDist = snapshotDistPublic();
      const project = makeTempProject();

      for (const ws of [" ", "\t", "\n"] as const) {
        process.env[NAME] = ws;
        await expect(loadConfig(project.configPath, "serve")).resolves.toBeTruthy();
        await expect(loadConfig(project.configPath, "build")).resolves.toBeTruthy();

        const built = buildWithConfig(project, { [NAME]: ws });
        expect(built.status, `build must exit 0 for ${JSON.stringify(ws)}`).toBe(0);
        expect(built.stdout).not.toContain(DUMMY);
        expect(built.stderr).not.toContain(DUMMY);
        assertNoTokenInline(built.outDir);
        expect(countTokenInlineHits(built.outDir)).toBe(0);
      }
      expect(snapshotDistPublic()).toEqual(beforeDist);

      // V3(c) process.env padded forms — message + stdout + stderr; no no-op trim asserts.
      for (const padded of [`  ${DUMMY}  `, `\n${DUMMY}\n`] as const) {
        process.env[NAME] = padded;
        const captured = await withCapturedStdio(async () => loadConfig(project.configPath, "build"));
        expect(captured.error).toBeTruthy();
        const message =
          captured.error instanceof Error ? captured.error.message : String(captured.error);
        expect(message).toContain(NAME);
        expect(message).not.toContain(DUMMY);
        expect(message).not.toContain(padded);
        expect(captured.stdout).not.toContain(DUMMY);
        expect(captured.stdout).not.toContain(padded);
        expect(captured.stderr).not.toContain(DUMMY);
        expect(captured.stderr).not.toContain(padded);
      }
    },
    120_000,
  );

  it(
    "V3(b) leaking scratch mutation produces inline hits including escaped newline",
    async () => {
      signalTestStart("V3(b)");
      const source = fs.readFileSync(REPO_CONFIG, "utf8");
      const noGuard = mutateConfig(source, "remove-guard");
      expect(noGuard).not.toEqual(source);

      const project = makeTempProject(noGuard);
      const origConst = fs.readFileSync(project.constPath, "utf8");
      const bareConst = origConst.replace(
        'const base = import.meta.env.BASE_URL || "/";',
        'const env = import.meta.env;\n  const base = (env && env.BASE_URL) || "/";',
      );
      expect(bareConst).not.toEqual(origConst);
      safeWriteFile(project.root, project.constPath, bareConst);

      for (const ws of [" ", "\t", "\n"] as const) {
        const built = buildWithConfig(project, { [NAME]: ws });
        expect(built.status).toBe(0);
        expect(
          countTokenInlineHits(built.outDir),
          `leaking mutation must produce (b) hits for ${JSON.stringify(ws)}`,
        ).toBeGreaterThan(0);
      }
    },
    120_000,
  );

  it(
    "V3(c) padded dummy from temp .env: spaces and newline-quoted form",
    async () => {
      signalTestStart("V3(c)");
      delete process.env[NAME];

      // Space-padded .env
      {
        const project = makeTempProject();
        writeTempEnv(project, `  ${DUMMY}  `);
        const padded = `  ${DUMMY}  `;
        const captured = await withCapturedStdio(async () => loadConfig(project.configPath, "build"));
        expect(captured.error).toBeTruthy();
        const message =
          captured.error instanceof Error ? captured.error.message : String(captured.error);
        expect(message).toContain(NAME);
        expect(message).not.toContain(DUMMY);
        expect(message).not.toContain(padded);
        expect(captured.stdout).not.toContain(DUMMY);
        expect(captured.stderr).not.toContain(DUMMY);
      }

      // Newline-padded .env written as NAME="\nsk…\n" so dotenv expands \n.
      {
        const project = makeTempProject();
        writeTempEnv(project, `\\n${DUMMY}\\n`, true);
        const loaded = loadEnv("production", project.root, "");
        const fileVal = loaded[NAME] ?? "";
        expect(fileVal.startsWith("\n"), "loadEnv value must start with newline").toBe(true);
        expect(fileVal.endsWith("\n"), "loadEnv value must end with newline").toBe(true);
        expect(fileVal).toContain(DUMMY);

        const captured = await withCapturedStdio(async () => loadConfig(project.configPath, "build"));
        expect(captured.error).toBeTruthy();
        const message =
          captured.error instanceof Error ? captured.error.message : String(captured.error);
        expect(message).toContain(NAME);
        expect(message).not.toContain(DUMMY);
        expect(message).not.toContain(fileVal);
        expect(captured.stdout).not.toContain(DUMMY);
        expect(captured.stderr).not.toContain(DUMMY);
      }
    },
    60_000,
  );

  it("V3(c)/V4 mutation: console.error of the value must fail stdio assertions", async () => {
    const source = fs.readFileSync(REPO_CONFIG, "utf8");
    const mutated = mutateConfig(source, "console-error-before-throw");
    expect(mutated).not.toEqual(source);
    const project = makeTempProject(mutated);
    process.env[NAME] = DUMMY;

    const captured = await withCapturedStdio(async () => loadConfig(project.configPath, "serve"));
    expect(captured.error).toBeTruthy();
    expect(captured.stderr).toContain(DUMMY);
  });

  it("V4 error names the variable and never includes the dummy in message or stdio", async () => {
    const project = makeTempProject();
    process.env[NAME] = DUMMY;
    const captured = await withCapturedStdio(async () => loadConfig(project.configPath, "serve"));
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
    const project = makeTempProject(mutated);
    process.env[NAME] = DUMMY;
    const captured = await withCapturedStdio(async () => loadConfig(project.configPath, "serve"));
    const message =
      captured.error instanceof Error ? captured.error.message : String(captured.error);
    expect(message).toContain(DUMMY);
  });

  it("V5 throws for both serve and build", async () => {
    const project = makeTempProject();
    process.env[NAME] = DUMMY;
    await expect(loadConfig(project.configPath, "serve")).rejects.toThrow(NAME);
    await expect(loadConfig(project.configPath, "build")).rejects.toThrow(NAME);
  });

  it("V6 loads the real config with no test-only helper export", async () => {
    const source = fs.readFileSync(REPO_CONFIG, "utf8");
    expect(source).not.toMatch(/export\s+(async\s+)?function\s+__checkToken/);
    expect(source).not.toMatch(/export\s+const\s+__checkToken/);
    delete process.env[NAME];
    const project = makeTempProject();
    await expect(loadConfig(project.configPath, "build")).resolves.toBeTruthy();
  });

  it(
    "V7/V10 unset or empty does not throw; build uses temp outDir and leaves dist/public",
    async () => {
      signalTestStart("V7");
      const beforeDist = snapshotDistPublic();
      const project = makeTempProject();
      delete process.env[NAME];
      await expect(loadConfig(project.configPath, "build")).resolves.toBeTruthy();

      process.env[NAME] = "";
      await expect(loadConfig(project.configPath, "serve")).resolves.toBeTruthy();
      delete process.env[NAME];

      const built = buildWithConfig(project, {});
      expect(built.status).toBe(0);
      expect(built.stdout).not.toContain(DUMMY);
      expect(built.stderr).not.toContain(DUMMY);
      expect(path.resolve(built.outDir)).not.toBe(path.resolve(DIST_PUBLIC));
      expect(snapshotDistPublic()).toEqual(beforeDist);
    },
    60_000,
  );
});

describe("V12 temp-copy isolation", () => {
  afterEach(() => {
    delete process.env[NAME];
    while (tempPaths.length) {
      const target = tempPaths.pop();
      if (target) cleanupPath(target);
    }
  });

  it("V12(a) static check: this file has no unsafe repo writes", () => {
    const source = fs.readFileSync(THIS_TEST_FILE, "utf8");
    expect(staticFindUnsafeWrites(source)).toEqual([]);
  });

  it("V12(a) M-a1: writing repo .env fails the helper", () => {
    const project = makeTempProject();
    expect(() => safeWriteFile(project.root, REPO_ENV, "x=1\n")).toThrow(/outside temp/);
  });

  it("V12(a) M-a2: writing const.ts via alias fails the helper", () => {
    const project = makeTempProject();
    const t = REPO_CONST_TS;
    expect(() => safeWriteFile(project.root, t, "export {}\n")).toThrow(/outside temp/);
  });

  it("V12(a) M-a3: spawn sh redirect to REPO_ENV fails the static check", () => {
    // Assemble the bite-proof snippet without embedding the banned contiguous source pattern.
    const snippet = ["spawnSync(", '"sh"', ', ["-c", "echo x > " + REPO', "_ENV])"].join("");
    expect(snippet).toContain("REPO_ENV");
    expect(snippetFailsStatic(snippet)).toBe(true);
  });

  it("V12(a) M-a4: symlink into the repo is caught by realpath", () => {
    const project = makeTempProject();
    const link = path.join(project.root, "pkg-link");
    fs.symlinkSync(path.join(REPO_ROOT, "package.json"), link);
    expect(() => safeWriteFile(project.root, link, "{}\n")).toThrow(/outside temp/);
  });

  it(
    "V12(b) normal run leaves git porcelain and .env md5 unchanged",
    () => {
      const canary = stageRepoCanary();
      try {
        const beforePorcelain = canary.porcelain;
        const beforeMd5 = canary.envMd5;
        // Run the guard suite only (exclude V12 harness to avoid recursion / re-entry).
        const run = runGuardTests("Sanity read-token guard \\(V1–V10\\)");
        expect(run.status, run.stderr.slice(-2000)).toBe(0);
        expect(gitPorcelain()).toBe(beforePorcelain);
        expect(md5File(REPO_ENV)).toBe(beforeMd5);
      } finally {
        unstageRepoCanary(canary.createdEnv);
      }
    },
    180_000,
  );

  it(
    "V12(c) SIGKILL during V2, V2b, V3(b), V3(c), V7 leaves repo untouched",
    async () => {
      const canary = stageRepoCanary();
      const constBefore = headConstBytes();
      try {
        // Patterns match the full vitest title (describe + test). No leading ^.
        const cases: Array<{ label: string; pattern: string }> = [
          { label: "V2", pattern: "V2 throws when the variable is set only in a temp" },
          { label: "V2b", pattern: "V2b blank shell overrides .env dummy" },
          { label: "V3(b)", pattern: "V3\\(b\\) leaking scratch mutation" },
          { label: "V3(c)", pattern: "V3\\(c\\) padded dummy from temp \\.env" },
          { label: "V7", pattern: "V7/V10 unset or empty does not throw" },
        ];

        for (const { label, pattern } of cases) {
          const startFile = `${START_PREFIX}${label}`;
          if (fs.existsSync(startFile)) fs.rmSync(startFile, { force: true });

          const child = spawn(
            "npm",
            ["test", "--", "--run", "src/lib/sanity.vite-guard.test.ts", "-t", pattern],
            {
              cwd: REPO_ROOT,
              env: { ...process.env },
              stdio: ["ignore", "pipe", "pipe"],
            },
          );

          let stderr = "";
          let stdout = "";
          child.stderr?.on("data", (c) => {
            stderr += String(c);
          });
          child.stdout?.on("data", (c) => {
            stdout += String(c);
          });

          const startedAt = Date.now();
          while (!fs.existsSync(startFile)) {
            if (child.exitCode !== null) {
              throw new Error(
                `V12(c) ${label}: vitest exited before start signal (${child.exitCode}): ${(stderr + stdout).slice(-2000)}`,
              );
            }
            if (Date.now() - startedAt > 90_000) {
              child.kill("SIGKILL");
              throw new Error(
                `V12(c) ${label}: no start signal within 90s: ${(stderr + stdout).slice(-2000)}`,
              );
            }
            await new Promise((r) => setTimeout(r, 50));
          }

          child.kill("SIGKILL");
          await new Promise((r) => child.once("exit", r));

          expect(gitPorcelain(), `porcelain after kill ${label}`).toBe(canary.porcelain);
          expect(md5File(REPO_ENV), `.env md5 after kill ${label}`).toBe(canary.envMd5);
          expect(
            Buffer.compare(fs.readFileSync(REPO_CONST_TS), constBefore),
            `const.ts vs HEAD after kill ${label}`,
          ).toBe(0);
        }
      } finally {
        unstageRepoCanary(canary.createdEnv);
      }
    },
    360_000,
  );
});
