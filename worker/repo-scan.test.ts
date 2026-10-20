import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanBffOrigin, scanBuildOutputForCanaries, scanHtmlSink } from "./repo-scan/scans";
import { formatTk2Hits, scanTk2Content, scanTk2Repo } from "./repo-scan/tk2";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const TK2_M7_FIXTURES: Record<string, string> = {
  ".github/workflows/deploy-pages.yml": "07812ad262220a7285743a5bb0727497",
  ".github/workflows/ci.yml": "381b3bafb380eee5e91956fb9c61f78c",
  "vite.config.ts": "9758af552e48fd465ca52d4dc84db4cd",
  "client/src/lib/sanity.ts": "703e8b4d494be3da14ca644f7248a661",
  "client/src/vite-env.d.ts": "64c894f83affa06bbed71727fd1f4d40",
  "client/src/const.ts": "7da8069640a9f1841c605f73abca5ae8",
};

function md5File(abs: string): string {
  return createHash("md5").update(readFileSync(abs)).digest("hex");
}

describe("repo-scan TK2.m7", () => {
  it("fixture md5s match and scan finds deploy-pages.yml:40 only", () => {
    const fixtureRoot = path.join(REPO_ROOT, "worker/__fixtures__/tk2-m7");
    const temp = mkdtempSync(path.join(tmpdir(), "tk2-m7-"));
    try {
      for (const [rel, expectedMd5] of Object.entries(TK2_M7_FIXTURES)) {
        const src = path.join(fixtureRoot, `${rel}.fixture`);
        const md5 = md5File(src);
        expect(md5).toBe(expectedMd5);
        const dest = path.join(temp, rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        cpSync(src, dest);
      }
      const token = ["VITE", "SANITY", "API", "READ", "TOKEN"].join("_");
      const hits = scanTk2Content(
        ".github/workflows/deploy-pages.yml",
        readFileSync(path.join(temp, ".github/workflows/deploy-pages.yml"), "utf8"),
        token,
      );
      const lines = formatTk2Hits(hits);
      expect(lines).toEqual(["SCAN FAIL: TK2 .github/workflows/deploy-pages.yml:40"]);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe("repo-scan TK1 vacuity", () => {
  it("empty build output fails (M-RS2)", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "tk1-empty-"));
    try {
      expect(() => scanBuildOutputForCanaries(empty, ["canary"])).toThrow(
        /SCAN SETUP FAIL: zero build output files/,
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("detects canary in output files", () => {
    const out = mkdtempSync(path.join(tmpdir(), "tk1-out-"));
    try {
      mkdirSync(path.join(out, "assets"), { recursive: true });
      writeFileSync(path.join(out, "assets/index.js"), "console.log('CANARY_X');");
      const hits = scanBuildOutputForCanaries(out, ["CANARY_X"]);
      expect(hits[0]?.rule).toBe("TK1");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("repo-scan C5 / CI2 scanner", () => {
  it("C5.1 detects planted bff-origin", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bff-"));
    try {
      const file = path.join(dir, "x.ts");
      writeFileSync(file, "const u = 'https://metfix-bff.wispy-mode-982d.workers.dev';\n");
      const hits = scanBffOrigin([dir]);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.rule).toBe("bff-origin");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CI2 detects planted html-sink", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "html-"));
    try {
      const file = path.join(dir, "x.tsx");
      writeFileSync(file, "el.innerHTML = x;\n");
      const hits = scanHtmlSink(dir, ["."]);
      expect(hits[0]?.rule).toBe("html-sink");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("repo-scan TK2 worker tree", () => {
  it("worker sources (excl. fixtures) have no TK2 hits", () => {
    const hits = scanTk2Repo(REPO_ROOT).filter((h) => h.file.startsWith("worker/"));
    expect(formatTk2Hits(hits)).toEqual([]);
  });
});
