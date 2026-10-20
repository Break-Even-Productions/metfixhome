import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type ScanHit = { rule: string; file: string; line: number };

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...walkFiles(abs));
    } else {
      out.push(abs);
    }
  }
  return out;
}

export function scanBffOrigin(rootDirs: string[], extraFiles: string[] = []): ScanHit[] {
  const re = /metfix-bff|wispy-mode-982d|workers\.dev/g;
  const hits: ScanHit[] = [];
  for (const root of rootDirs) {
    let files: string[] = [];
    try {
      files = walkFiles(root);
    } catch {
      continue;
    }
    for (const abs of files) {
      const content = readFileSync(abs, "utf8");
      const rel = abs;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) {
          hits.push({ rule: "bff-origin", file: rel, line: i + 1 });
        }
        re.lastIndex = 0;
      }
    }
  }
  for (const abs of extraFiles) {
    const content = readFileSync(abs, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]!)) {
        hits.push({ rule: "bff-origin", file: abs, line: i + 1 });
      }
      re.lastIndex = 0;
    }
  }
  return hits;
}

export function scanViteSecrets(clientRoot: string): ScanHit[] {
  const re = /VITE_[A-Z_]*(KEY|SECRET|TOKEN)/g;
  const hits: ScanHit[] = [];
  const files = walkFiles(clientRoot);
  for (const abs of files) {
    const content = readFileSync(abs, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]!)) {
        hits.push({ rule: "vite-secret", file: abs, line: i + 1 });
      }
      re.lastIndex = 0;
    }
  }
  return hits;
}

export function scanHtmlSink(repoRoot: string, globs: string[]): ScanHit[] {
  const re = /dangerouslySetInnerHTML|innerHTML\s*=|insertAdjacentHTML/g;
  const hits: ScanHit[] = [];
  for (const rel of globs) {
    const abs = path.join(repoRoot, rel);
    let files: string[] = [];
    try {
      files = statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue;
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) {
          hits.push({ rule: "html-sink", file: file.replace(`${repoRoot}/`, ""), line: i + 1 });
        }
        re.lastIndex = 0;
      }
    }
  }
  return hits;
}

export function scanBuildOutputForCanaries(
  outDir: string,
  canaries: string[],
): ScanHit[] {
  const files = walkFiles(outDir);
  if (files.length === 0) {
    throw new Error("SCAN SETUP FAIL: zero build output files");
  }
  const hits: ScanHit[] = [];
  for (const abs of files) {
    const content = readFileSync(abs, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const c of canaries) {
        if (lines[i]!.includes(c)) {
          hits.push({ rule: "TK1", file: abs, line: i + 1 });
        }
      }
    }
  }
  return hits;
}
