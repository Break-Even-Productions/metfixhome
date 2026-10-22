/**
 * PR2 r1.24 §M — M-JL1 (AU19.3) HTML sabotages (3 variants).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(path.join(REPO, rel), "utf8");
}
function write(rel, text) {
  writeFileSync(path.join(REPO, rel), text);
}
function replaceOnce(rel, search, replace, label) {
  const t = read(rel);
  const i = t.indexOf(search);
  if (i < 0) throw new Error(`${label}: search not found in ${rel}`);
  if (t.indexOf(search, i + 1) !== -1) {
    throw new Error(`${label}: search not unique in ${rel}`);
  }
  write(rel, t.slice(0, i) + replace + t.slice(i + search.length));
}

/** @type {Record<string, { apply: () => void, files: string[], variants?: string[] }>} */
export const R11_OVERRIDES = {
  "M-JL1a": {
    files: ["client/index.html"],
    apply() {
      replaceOnce(
        "client/index.html",
        "  <body>",
        '  <body>\n    <script>alert(1)</script> <!-- MUTANT M-JL1a -->',
        "M-JL1a",
      );
    },
  },
  "M-JL1b": {
    files: ["client/index.html"],
    apply() {
      replaceOnce(
        "client/index.html",
        'type="application/ld+json"',
        'type="application/ld+json "',
        "M-JL1b",
      );
    },
  },
  "M-JL1c": {
    files: ["client/index.html"],
    apply() {
      replaceOnce(
        "client/index.html",
        'type="application/ld+json"',
        'type="Application/LD+JSON"',
        "M-JL1c",
      );
    },
  },
  "M-JL1": {
    files: ["client/index.html"],
    variants: ["M-JL1a", "M-JL1b", "M-JL1c"],
    apply() {
      throw new Error("M-JL1: use variants M-JL1a/b/c via runner");
    },
  },
};

export default R11_OVERRIDES;
