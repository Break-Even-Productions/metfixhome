#!/usr/bin/env node
/**
 * Per-ID gate pass/fail/skip report against r1.25 catalog.
 *
 * Usage: node tools/pr2/run-gate-ids.mjs [--json out.json]
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = path.join(REPO, "docs/metfix-pr2-comments-login/r1.25-catalog.json");
const DEFAULT_OUT = path.join(
  "/cursor/stores/bc-50fbecee-a92e-4055-8145-a226456331d7/internal",
  "pr2-r1.25-gate-ids.json",
);

const args = process.argv.slice(2);
let outPath = DEFAULT_OUT;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json" && args[i + 1]) outPath = path.resolve(args[++i]);
}

const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const gateIds = catalog.gates;
const jsonOut = path.join(REPO, "tools/pr2/.gate-ids-vitest.json");

const vitest = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "--config",
    "vitest.gate.config.ts",
    "--reporter=json",
    `--outputFile=${jsonOut}`,
  ],
  { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const byId = new Map(gateIds.map((id) => [id, { id, status: "missing", titles: [] }]));

if (existsSync(jsonOut)) {
  try {
    const raw = JSON.parse(readFileSync(jsonOut, "utf8"));
    for (const file of raw.testResults || []) {
      for (const a of file.assertionResults || []) {
        const title = a.title || "";
        const token = title.trim().split(/\s+/)[0] || "";
        if (!byId.has(token)) continue;
        const row = byId.get(token);
        row.titles.push(title);
        if (a.status === "failed") row.status = "fail";
        else if (a.status === "pending" || a.status === "skipped") {
          if (row.status !== "fail" && row.status !== "pass") row.status = "skip";
        } else if (a.status === "passed") {
          if (row.status !== "fail") row.status = "pass";
        }
      }
    }
  } catch (e) {
    console.error("parse vitest json:", e?.message || e);
  }
}

const rows = gateIds.map((id) => byId.get(id));
const counts = { pass: 0, fail: 0, skip: 0, missing: 0 };
for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" });
const payload = {
  catalogRev: "r1.25",
  catalogMd5: createHash("md5").update(readFileSync(CATALOG)).digest("hex"),
  headSha: (head.stdout || "").trim(),
  vitestStatus: vitest.status,
  counts,
  gates: rows,
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(
  JSON.stringify(
    {
      ok: vitest.status === 0 && counts.fail === 0 && counts.missing === 0,
      out: outPath,
      headSha: payload.headSha,
      counts,
    },
    null,
    2,
  ),
);
process.exit(vitest.status === 0 && counts.fail === 0 ? 0 : 1);
