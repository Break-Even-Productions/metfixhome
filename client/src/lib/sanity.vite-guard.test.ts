import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadConfigFromFile, loadEnv } from "vite";
const NAME = "VITE_SANITY_API_READ_TOKEN";
import { afterEach, describe, expect, it, vi } from "vitest";

const DUMMY = `skTEST${"A".repeat(60)}`;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const REPO_CONFIG = path.join(REPO_ROOT, "vite.config.ts");
const DIST_PUBLIC = path.join(REPO_ROOT, "dist/public");
/** Quote form: NAME:"X with non-empty X. */
const TOKEN_INLINE_RE = new RegExp(`${NAME}:"[^"]`);
/** Vite may serialize a newline env value as a template literal NAME:`\n`. */
const TOKEN_NEWLINE_TEMPLATE = `${NAME}:\`\n\``;

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

/** Unique per-run prefix so overlapping vitest processes never share /tmp paths. */
function uniqueTempPrefix(kind: string): string {
  const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return path.join(os.tmpdir(), `metfix-${kind}-${stamp}-`);
}

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

/**
 * Real node_modules dir in the temp project; each top-level package is a symlink
 * into the repo. Vite's `.vite-temp` / `.vite` caches are therefore created under
 * the temp tree, not the repo's node_modules.
 */
function linkPackagesIntoTempNodeModules(tempRoot: string) {
  const nm = path.join(tempRoot, "node_modules");
  assertUnderTemp(tempRoot, nm);
  fs.mkdirSync(nm, { recursive: true });
  const repoNm = path.join(REPO_ROOT, "node_modules");
  for (const entry of fs.readdirSync(repoNm, { withFileTypes: true })) {
    // Never link repo vite caches into the temp project.
    if (entry.name.startsWith(".vite")) continue;
    const src = path.join(repoNm, entry.name);
    const dest = path.join(nm, entry.name);
    fs.symlinkSync(src, dest);
  }
}

/**
 * Full temp copy of the project (no node_modules / .git / dist).
 * All mutations happen here.
 */
function makeTempProject(configSourceText?: string): TempProject {
  const root = fs.mkdtempSync(uniqueTempPrefix("v12"));
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

  linkPackagesIntoTempNodeModules(root);

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
  const outDir = fs.mkdtempSync(uniqueTempPrefix("outdir"));
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
    delete process.env[NAME];
    const project = makeTempProject();
    writeTempEnv(project, DUMMY);
    await expect(loadConfig(project.configPath, "build")).rejects.toThrow(NAME);
  });

  it(
    "V2b blank shell overrides .env dummy: resolve + build clean (K8d)",
    async () => {
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
      delete process.env[NAME];

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
