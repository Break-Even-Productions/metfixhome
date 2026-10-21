#!/usr/bin/env node
/**
 * CK-P1 (A-PIN1): verify docs/metfix-pr2-comments-login spec pin + gate count.
 *
 * Usage: node tools/pr2/ck-p1.mjs [docsDir]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsDir = path.resolve(REPO, process.argv[2] || "docs/metfix-pr2-comments-login");

function md5File(abs) {
  return createHash("md5").update(readFileSync(abs)).digest("hex");
}

function fail(msg) {
  console.error(`PIN MISMATCH: ${msg}`);
  process.exit(1);
}

function pickQaList(dir) {
  const files = readdirSync(dir).filter((f) => /^metfix-pr2-comments-login-tests\.r\d+\.\d+\.md$/.test(f));
  if (!files.length) fail(`${dir}: no QA test list`);
  files.sort((a, b) => {
    const ra = Number(a.match(/\.r(\d+)\.(\d+)/)?.[1] ?? 0);
    const rb = Number(b.match(/\.r(\d+)\.(\d+)/)?.[1] ?? 0);
    if (ra !== rb) return rb - ra;
    const pa = Number(a.match(/\.r(\d+)\.(\d+)/)?.[2] ?? 0);
    const pb = Number(b.match(/\.r(\d+)\.(\d+)/)?.[2] ?? 0);
    return pb - pa;
  });
  return path.join(dir, files[0]);
}

function pickSpecCopy(dir) {
  const direct = path.join(dir, "metfix-pr2-comments-login-acceptance.rev1.6.4.md");
  if (existsSync(direct)) return direct;
  const specs = path.join(REPO, "docs/specs/metfix-pr2-comments-login-acceptance.rev1.6.4.md");
  if (existsSync(specs)) return specs;
  fail(`${dir}: spec copy missing`);
}

function parseFence(md, fenceName) {
  const re = new RegExp("```" + fenceName + "\\s*\\n([\\s\\S]*?)```", "m");
  const m = md.match(re);
  if (!m) fail(`${fenceName} block missing`);
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function parseHeaderPin(md) {
  const m = md.match(/md5\s+`([0-9a-f]{32})`/i);
  if (!m) fail("QA header spec-md5 pin missing");
  return m[1].toLowerCase();
}

function parseHeaderGateCount(md) {
  const m = md.match(/`gate-ids`\s+count:\s*(\d+)/i);
  if (!m) fail("QA header gate-ids count missing");
  return Number(m[1]);
}

const qaPath = pickQaList(docsDir);
const specPath = pickSpecCopy(docsDir);
const qaMd = readFileSync(qaPath, "utf8");
const pin = parseHeaderPin(qaMd);
const headerCount = parseHeaderGateCount(qaMd);
const specMd5 = md5File(specPath);
if (specMd5 !== pin) fail(specPath);

const gateIds = parseFence(qaMd, "gate-ids");
if (gateIds.length !== headerCount) fail(qaPath);

const catalogPath = path.join(docsDir, "r1.24-catalog.json");
if (existsSync(catalogPath)) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  if (catalog.gates?.length !== gateIds.length) {
    fail(`${catalogPath} gates.length ${catalog.gates.length} != ${gateIds.length}`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      specPin: pin,
      specPath: path.relative(REPO, specPath),
      qaPath: path.relative(REPO, qaPath),
      specMd5,
      gateCount: gateIds.length,
      catalog: existsSync(catalogPath) ? path.relative(REPO, catalogPath) : null,
    },
    null,
    2,
  ),
);
