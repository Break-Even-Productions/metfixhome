#!/usr/bin/env node
/**
 * Post-build assertion: @ybouane/liquidglass must not land in the main App entry chunk.
 * Run after `npm run build:pages`. Reads dist/public/index.html for the entry module.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distPublic = path.join(root, "dist", "public");
const indexHtmlPath = path.join(distPublic, "index.html");

function fail(message) {
  console.error(`assert-liquidglass-chunk: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(indexHtmlPath)) {
  fail(`missing ${indexHtmlPath} — run npm run build:pages first`);
}

const html = fs.readFileSync(indexHtmlPath, "utf8");
const scriptMatch = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/i)
  || html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["']/i);

if (!scriptMatch) {
  fail("could not find module entry script in dist/public/index.html");
}

const entrySrc = scriptMatch[1];
const entryPath = path.resolve(distPublic, entrySrc.replace(/^\.\//, ""));
if (!fs.existsSync(entryPath)) {
  fail(`entry chunk not found: ${entryPath}`);
}

const entryCode = fs.readFileSync(entryPath, "utf8");
const markers = ["@ybouane/liquidglass", "LiquidGlass.init", "GlassRenderer"];
const hits = markers.filter((m) => entryCode.includes(m));
if (hits.length > 0) {
  fail(
    `main App entry chunk ${path.relative(root, entryPath)} contains liquidglass markers: ${hits.join(", ")}`,
  );
}

// Confirm a sibling async chunk actually received the library (dynamic import worked).
const assetsDir = path.join(distPublic, "assets");
if (!fs.existsSync(assetsDir)) {
  fail("dist/public/assets missing");
}
const assetFiles = fs.readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
const entryName = path.basename(entryPath);
const otherChunks = assetFiles.filter((name) => name !== entryName);
const libraryChunk = otherChunks.find((name) => {
  const code = fs.readFileSync(path.join(assetsDir, name), "utf8");
  return code.includes("LiquidGlass") || code.includes("@ybouane/liquidglass");
});
if (!libraryChunk) {
  fail("liquidglass not found in any async chunk — dynamic import may have been inlined into the entry");
}

console.log(
  `assert-liquidglass-chunk: ok — entry ${path.relative(root, entryPath)} is clean; library in assets/${libraryChunk}`,
);
