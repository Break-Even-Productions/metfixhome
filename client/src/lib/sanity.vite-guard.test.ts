import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const NAME = "VITE_SANITY_API_READ_TOKEN";
const DUMMY = `skTEST${"A".repeat(60)}`;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const ENV_FILE = path.join(REPO_ROOT, ".env");
const ENV_BACKUP = path.join(os.tmpdir(), `metfixhome-vite-guard-env-${process.pid}`);

type ConfigEnv = { mode: string; command: "serve" | "build" };

function restoreEnvFile() {
  if (fs.existsSync(ENV_BACKUP)) {
    fs.copyFileSync(ENV_BACKUP, ENV_FILE);
    fs.unlinkSync(ENV_BACKUP);
  } else if (fs.existsSync(ENV_FILE)) {
    fs.unlinkSync(ENV_FILE);
  }
}

function backupEnvFile() {
  if (fs.existsSync(ENV_FILE)) {
    fs.copyFileSync(ENV_FILE, ENV_BACKUP);
  } else if (fs.existsSync(ENV_BACKUP)) {
    fs.unlinkSync(ENV_BACKUP);
  }
}

async function loadDefaultConfig() {
  vi.resetModules();
  const mod = await import("../../../vite.config.ts");
  expect(typeof mod.default).toBe("function");
  expect("__checkToken" in mod).toBe(false);
  return mod.default as (env: ConfigEnv) => unknown;
}

async function resolveConfig(command: "serve" | "build", mode = "production") {
  const configFn = await loadDefaultConfig();
  return configFn({ mode, command });
}

describe("vite.config.ts Sanity read-token guard (V1–V7)", () => {
  afterEach(() => {
    delete process.env[NAME];
    restoreEnvFile();
    vi.resetModules();
  });

  it("V1 throws when the variable is non-empty in process.env", async () => {
    process.env[NAME] = DUMMY;
    await expect(resolveConfig("build")).rejects.toThrow(NAME);
  });

  it("V2 throws when the variable is set only in a .env file via loadEnv", async () => {
    delete process.env[NAME];
    backupEnvFile();
    fs.writeFileSync(ENV_FILE, `${NAME}=${DUMMY}\n`, "utf8");
    await expect(resolveConfig("build")).rejects.toThrow(NAME);
  });

  it("V3 trims: whitespace-only passes; whitespace-padded dummy throws", async () => {
    process.env[NAME] = "   ";
    await expect(resolveConfig("build")).resolves.toBeTruthy();

    process.env[NAME] = `  ${DUMMY}  `;
    await expect(resolveConfig("build")).rejects.toThrow(NAME);
  });

  it("V4 error names the variable and never includes the dummy value", async () => {
    process.env[NAME] = DUMMY;
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

    let message = "";
    try {
      await resolveConfig("serve");
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    expect(message).toContain(NAME);
    expect(message).not.toContain(DUMMY);
    expect(stdout.join("")).not.toContain(DUMMY);
    expect(stderr.join("")).not.toContain(DUMMY);
  });

  it("V5 throws for both serve and build", async () => {
    process.env[NAME] = DUMMY;
    await expect(resolveConfig("serve")).rejects.toThrow(NAME);
    await expect(resolveConfig("build")).rejects.toThrow(NAME);
  });

  it("V6 calls the real exported default config function with no test-only helper", async () => {
    const configFn = await loadDefaultConfig();
    expect(typeof configFn).toBe("function");
    const source = fs.readFileSync(path.join(REPO_ROOT, "vite.config.ts"), "utf8");
    expect(source).not.toMatch(/export\s+(async\s+)?function\s+__checkToken/);
    expect(source).not.toMatch(/export\s+const\s+__checkToken/);
    delete process.env[NAME];
    expect(configFn({ mode: "production", command: "build" })).toBeTruthy();
  });

  it("V7 unset or empty does not throw, and build:cf exits 0", async () => {
    delete process.env[NAME];
    await expect(resolveConfig("build")).resolves.toBeTruthy();

    process.env[NAME] = "";
    await expect(resolveConfig("serve")).resolves.toBeTruthy();
    delete process.env[NAME];

    const result = spawnSync("npm", ["run", "build:cf"], {
      cwd: REPO_ROOT,
      env: { ...process.env },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(DUMMY);
  });
});
