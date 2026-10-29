#!/usr/bin/env node
/**
 * T-F-65 / ER-1 + ER-9 (e2): VISUAL_HOOK_PATTERN gate.
 * - client/src/** always gating
 * - dist: every token gates in every chunk EXCEPT navigator.webdriver in vendor-only chunks (advisory)
 * - chunk with no source attribution = ours → gates
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { VISUAL_HOOK_PATTERN } = await import(
  pathToFileURL(path.join(root, "tests/visual/hookPattern.mjs")).href
);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, n.name);
    if (n.isDirectory()) walk(fp, out);
    else if (/\.(tsx?|jsx?|css|html|mjs|cjs)$/.test(n.name)) out.push(fp);
  }
  return out;
}

function scanFile(fp) {
  const src = fs.readFileSync(fp, "utf8");
  const hits = [];
  const re = new RegExp(
    VISUAL_HOOK_PATTERN.source,
    VISUAL_HOOK_PATTERN.flags.includes("g")
      ? VISUAL_HOOK_PATTERN.flags
      : `${VISUAL_HOOK_PATTERN.flags}g`,
  );
  let m;
  while ((m = re.exec(src))) hits.push({ index: m.index, match: m[0] });
  return hits;
}

const srcHits = [];
for (const fp of walk(path.join(root, "client/src"))) {
  if (fp.includes(".test.")) continue;
  const hits = scanFile(fp);
  if (hits.length) srcHits.push({ fp, hits });
}
if (srcHits.length) {
  console.error("T-F-65 FAIL: VISUAL_HOOK_PATTERN in client/src:");
  for (const h of srcHits) {
    console.error(
      " -",
      path.relative(root, h.fp),
      h.hits.map((x) => x.match).join(", "),
    );
  }
  process.exit(1);
}

const distRoot = path.join(root, "dist/public");
const manifestPath = path.join(distRoot, ".vite/manifest.json");
if (!fs.existsSync(distRoot)) {
  console.log("T-F-65 ok: client/src clean (dist not built; skipping dist scan)");
  process.exit(0);
}

let manifest = {};
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

/** Vendor-only iff every attributed source is under node_modules. No attribution → ours. */
function chunkIsVendorOnly(fileRel) {
  const sources = Object.entries(manifest)
    .filter(([, e]) => e.file === fileRel || (e.css && e.css.includes(fileRel)))
    .map(([id]) => id);
  if (!sources.length) return false; // ER-9: no source listed → ours
  return sources.every((id) => id.includes("node_modules/") || id.startsWith("\0"));
}

const distFails = [];
const advisory = [];
for (const fp of walk(distRoot)) {
  if (!/\.(js|css|html)$/.test(fp)) continue;
  const rel = path.relative(distRoot, fp).replace(/\\/g, "/");
  const hits = scanFile(fp);
  if (!hits.length) continue;
  const vendorOnly = chunkIsVendorOnly(rel);
  for (const h of hits) {
    // ER-9: ONLY navigator.webdriver is advisory in vendor-only chunks
    if (vendorOnly && h.match.includes("navigator.webdriver")) {
      advisory.push({ rel, match: h.match });
    } else {
      distFails.push({ rel, match: h.match, vendorOnly });
    }
  }
}

for (const a of advisory) {
  console.warn(`T-F-65 ADVISORY (vendor-only navigator.webdriver): ${a.rel}: ${a.match}`);
}
if (distFails.length) {
  console.error("T-F-65 FAIL: VISUAL_HOOK_PATTERN in dist (ER-9):");
  for (const h of distFails) console.error(" -", h.rel, h.match);
  process.exit(1);
}
console.log("T-F-65 ok: client/src + dist (ER-9) clean");
