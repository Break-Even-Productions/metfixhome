import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadConfigFromFile } from "vite";
const NAME = "VITE_SANITY_API_READ_TOKEN";
import { afterEach, describe, expect, it } from "vitest";

const DUMMY = `skTEST${"A".repeat(60)}`;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const REPO_ENV = path.join(REPO_ROOT, ".env");
const REPO_CONFIG = path.join(REPO_ROOT, "vite.config.ts");
const DIST_PUBLIC = path.join(REPO_ROOT, "dist/public");
const TOKEN_INLINE_RE = new RegExp(`${NAME}:"[^"]`);

type DistSnapshot = {
  absent: boolean;
  files: Record<string, { md5: string; mtimeMs: number }>;
};

const tempPaths: string[] = [];

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

/** Temp project whose envDir is the temp dir; root/aliases still point at the repo. */
function makeTempEnvProject(configSourceText?: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metfix-vite-guard-"));
  tempPaths.push(tmp);
  const source = configSourceText ?? fs.readFileSync(REPO_CONFIG, "utf8");
  const rewritten = source
    .replaceAll(
      'path.resolve(import.meta.dirname, "client", "src")',
      `path.resolve(${JSON.stringify(REPO_ROOT)}, "client", "src")`,
    )
    .replaceAll(
      'path.resolve(import.meta.dirname, "shared")',
      `path.resolve(${JSON.stringify(REPO_ROOT)}, "shared")`,
    )
    .replaceAll(
      'path.resolve(import.meta.dirname, "attached_assets")',
      `path.resolve(${JSON.stringify(REPO_ROOT)}, "attached_assets")`,
    )
    .replaceAll(
      'root: path.resolve(import.meta.dirname, "client")',
      `root: path.resolve(${JSON.stringify(REPO_ROOT)}, "client")`,
    );
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
  }
}

function buildWithConfig(
  configPath: string,
  env: NodeJS.ProcessEnv,
): { status: number | null; outDir: string; log: string } {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "metfix-vite-outdir-"));
  tempPaths.push(outDir);
  const result = spawnSync(
    "npx",
    ["vite", "build", "--config", configPath, "--outDir", outDir, "--emptyOutDir"],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      encoding: "utf8",
    },
  );
  return {
    status: result.status,
    outDir,
    log: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

function mutateConfig(source: string, kind: "process-env-only" | "or-fallback"): string {
  const guardBlock = [
    `const env = { ...loadEnv(mode, envDir, ""), ...process.env };`,
    `  const sanityReadToken = String(env.${NAME} ?? "").trim();`,
  ].join("\n");
  if (kind === "process-env-only") {
    return source.replace(
      guardBlock,
      `const sanityReadToken = String(process.env.${NAME} ?? "").trim();`,
    );
  }
  // Anti-pattern: blank shell falls through via || to a raw .env file value.
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

describe("vite.config.ts Sanity read-token guard (V1–V11)", () => {
  afterEach(() => {
    delete process.env[NAME];
    while (tempPaths.length) {
      const target = tempPaths.pop();
      if (target) cleanupPath(target);
    }
  });

  it("V1 throws when the variable is non-empty in process.env", async () => {
    process.env[NAME] = DUMMY;
    await expect(loadConfig(REPO_CONFIG, "build")).rejects.toThrow(NAME);
  });

  it("V2 throws when the variable is set only in a temp .env via loadEnv (V11)", async () => {
    const before = envFingerprint(REPO_ENV);
    delete process.env[NAME];
    const tmp = makeTempEnvProject();
    writeTempEnv(tmp, DUMMY);
    await expect(loadConfig(path.join(tmp, "vite.config.ts"), "build")).rejects.toThrow(NAME);
    expect(envFingerprint(REPO_ENV)).toEqual(before);
  });

  it(
    "V2b blank shell overrides .env dummy: resolve + build clean (K8d)",
    async () => {
      const before = envFingerprint(REPO_ENV);
      const beforeDist = snapshotDistPublic();
      const tmp = makeTempEnvProject();
      writeTempEnv(tmp, DUMMY);
      process.env[NAME] = "";

      await expect(loadConfig(path.join(tmp, "vite.config.ts"), "serve")).resolves.toBeTruthy();
      await expect(loadConfig(path.join(tmp, "vite.config.ts"), "build")).resolves.toBeTruthy();

      const built = buildWithConfig(path.join(tmp, "vite.config.ts"), { [NAME]: "" });
      expect(built.status).toBe(0);
      expect(built.log).not.toContain(DUMMY);
      expect(countDummyInDir(built.outDir)).toBe(0);
      assertNoTokenInline(built.outDir);
      expect(envFingerprint(REPO_ENV)).toEqual(before);
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

    // M1: process.env only → .env-only dummy does not throw (V2 would FAIL).
    delete process.env[NAME];
    const m1Tmp = makeTempEnvProject(m1Source);
    writeTempEnv(m1Tmp, DUMMY);
    await expect(loadConfig(path.join(m1Tmp, "vite.config.ts"), "build")).resolves.toBeTruthy();

    // M2: process.env || rawFileValue → blank shell falls through and throws (V2b would FAIL).
    const m2Tmp = makeTempEnvProject(m2Source);
    writeTempEnv(m2Tmp, DUMMY);
    process.env[NAME] = "";
    await expect(loadConfig(path.join(m2Tmp, "vite.config.ts"), "build")).rejects.toThrow(NAME);
  });

  it(
    "V3 whitespace-only passes with dist check; padded dummy throws from env and .env",
    async () => {
      const beforeDist = snapshotDistPublic();
      for (const ws of [" ", "\t", "\n"] as const) {
        process.env[NAME] = ws;
        await expect(loadConfig(REPO_CONFIG, "serve")).resolves.toBeTruthy();
        await expect(loadConfig(REPO_CONFIG, "build")).resolves.toBeTruthy();
      }

      // One representative build for the dist assertion (all three resolve above).
      process.env[NAME] = " ";
      const built = buildWithConfig(REPO_CONFIG, { [NAME]: " " });
      expect(built.status).toBe(0);
      expect(built.log).not.toContain(DUMMY);
      assertNoTokenInline(built.outDir);
      expect(snapshotDistPublic()).toEqual(beforeDist);

      process.env[NAME] = `  ${DUMMY}  `;
      await expect(loadConfig(REPO_CONFIG, "build")).rejects.toThrow(NAME);
      let message = "";
      try {
        await loadConfig(REPO_CONFIG, "serve");
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message).toContain(NAME);
      expect(message).not.toContain(DUMMY);
      expect(message).not.toContain(DUMMY.trim());

      process.env[NAME] = `\n${DUMMY}\n`;
      await expect(loadConfig(REPO_CONFIG, "build")).rejects.toThrow(NAME);
      delete process.env[NAME];
      const before = envFingerprint(REPO_ENV);
      const tmp = makeTempEnvProject();
      writeTempEnv(tmp, `  ${DUMMY}  `);
      await expect(loadConfig(path.join(tmp, "vite.config.ts"), "build")).rejects.toThrow(NAME);
      expect(envFingerprint(REPO_ENV)).toEqual(before);
    },
    60_000,
  );

  it("V4 error names the variable and never includes the dummy value", async () => {
    process.env[NAME] = DUMMY;
    let message = "";
    try {
      await loadConfig(REPO_CONFIG, "serve");
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain(NAME);
    expect(message).not.toContain(DUMMY);
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
      expect(built.log).not.toContain(DUMMY);
      expect(path.resolve(built.outDir)).not.toBe(path.resolve(DIST_PUBLIC));
      expect(snapshotDistPublic()).toEqual(beforeDist);
    },
    60_000,
  );

  it(
    "V11 kill case: SIGKILL after temp .env write leaves repo .env untouched",
    async () => {
      const before = envFingerprint(REPO_ENV);
      const tmp = makeTempEnvProject();
      const readyFile = path.join(tmp, "ready");
      const scriptPath = path.join(tmp, "kill-wait.mjs");
      fs.writeFileSync(
        scriptPath,
        `
      import fs from "node:fs";
      import path from "node:path";
      const tmp = process.env.GUARD_TMP;
      const ready = process.env.GUARD_READY;
      fs.writeFileSync(path.join(tmp, ".env"), process.env.GUARD_NAME + "=" + process.env.GUARD_DUMMY + "\\n");
      fs.writeFileSync(ready, "1");
      setInterval(() => {}, 1e6);
      `,
      );

      const child = spawn(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          GUARD_TMP: tmp,
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
        if (Date.now() - started > 10000) {
          child.kill("SIGKILL");
          throw new Error(`child never wrote ready file: ${childErr}`);
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      child.kill("SIGKILL");
      await new Promise((r) => child.once("exit", r));

      expect(envFingerprint(REPO_ENV)).toEqual(before);
      if (fs.existsSync(REPO_ENV)) {
        expect(fs.readFileSync(REPO_ENV, "utf8")).not.toContain(DUMMY);
      }
    },
    20_000,
  );
});
