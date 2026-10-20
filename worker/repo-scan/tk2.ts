import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

export const SANITY_TOKEN_NAME = ["VITE", "SANITY", "API", "READ", "TOKEN"].join("_");

export type Tk2Hit = { file: string; line: number };

export function buildTokenName(): string {
  return SANITY_TOKEN_NAME;
}

export function listTk2ScanFiles(repoRoot: string): string[] {
  let listing = "";
  try {
    listing = execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" });
  } catch {
    throw new Error("SCAN SETUP FAIL: git unavailable");
  }
  const paths = listing
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const rel of paths) {
    if (rel.startsWith("docs/")) continue;
    if (rel.startsWith("worker/__fixtures__/tk2-m7/")) continue;
    if (/\.test\.tsx?$/.test(rel)) continue;
    const ok =
      rel.startsWith("client/") ||
      rel.startsWith("worker/") ||
      rel.startsWith("src/") ||
      rel.startsWith("scripts/") ||
      rel.startsWith(".github/workflows/") ||
      rel.startsWith("wrangler.") ||
      rel === "vite.config.ts" ||
      rel === "vitest.workers.config.ts" ||
      /^\.env/.test(rel) ||
      /^\.dev\.vars/.test(rel);
    if (ok) out.push(rel);
  }
  if (out.length === 0) {
    throw new Error("SCAN SETUP FAIL: zero files");
  }
  return out;
}

export function scanTk2Content(relPath: string, content: string, token: string): Tk2Hit[] {
  const hits: Tk2Hit[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const reEnvRead = new RegExp(
    String.raw`(import\.meta|process)\s*\??\.\s*env\s*\??\.\s*(?:\[\s*['"]${token}['"]\s*\]|${token})`,
  );
  const reAssign = new RegExp(String.raw`${token}\s*[:=]`);
  const reSecrets = new RegExp(String.raw`secrets\s*\.\s*${token}|secrets\s*\[\s*['"]${token}['"]\s*\]`);
  const reVars = new RegExp(String.raw`vars\s*\.\s*${token}|vars\s*\[\s*['"]${token}['"]\s*\]`);
  const reDefine = new RegExp(String.raw`define\s*:\s*\{[^}]*${token}`);
  const reEnvPrefixBad = /envPrefix\s*:\s*(""|'')\s*,?|envPrefix\s*:\s*"VITE_SANITY_"/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const n = i + 1;
    if (reEnvRead.test(line) || reAssign.test(line) || reSecrets.test(line) || reVars.test(line)) {
      hits.push({ file: relPath, line: n });
      continue;
    }
    if (reDefine.test(line)) {
      hits.push({ file: relPath, line: n });
      continue;
    }
    if (relPath.endsWith("vite.config.ts") && reEnvPrefixBad.test(line)) {
      hits.push({ file: relPath, line: n });
    }
  }
  return hits;
}

export function scanTk2Repo(repoRoot: string): Tk2Hit[] {
  const token = buildTokenName();
  const files = listTk2ScanFiles(repoRoot);
  const hits: Tk2Hit[] = [];
  for (const rel of files) {
    const abs = path.join(repoRoot, rel);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    hits.push(...scanTk2Content(rel, content, token));
  }
  return hits;
}

export function formatTk2Hits(hits: Tk2Hit[]): string[] {
  return hits.map((h) => `SCAN FAIL: TK2 ${h.file}:${h.line}`);
}
