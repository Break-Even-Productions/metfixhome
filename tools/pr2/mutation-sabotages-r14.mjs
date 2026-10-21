/**
 * PR2 r1.25 §M — M-RA7, M-CW34, M-CW35, M-JL1d.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** @type {Record<string, { apply: () => void, files: string[], variants?: string[], typeCheck?: boolean }>} */
export const R14_OVERRIDES = {
  "M-RA7a": {
    files: ["worker/upstream.ts"],
    apply() {
      // Leading-zero all-digit value treated as non-numeric → 60 (`0` alone still → 1).
      replaceOnce(
        "worker/upstream.ts",
        `  if (!/^[0-9]+$/.test(header)) return 60 as RetryAfterSeconds;
  // Strip leading zeros before length guard (CQ r2): "0000017"→"17", "0000000"→"0".
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;`,
        `  if (!/^[0-9]+$/.test(header)) return 60 as RetryAfterSeconds;
  // MUTANT M-RA7a: leading zero + length > 1 → treat as non-numeric → 60
  if (header.length > 1 && header.startsWith("0")) return 60 as RetryAfterSeconds;
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;`,
        "M-RA7a",
      );
    },
  },
  "M-RA7b": {
    files: ["worker/upstream.ts"],
    apply() {
      // Parse as octal: 0000017 → 15.
      replaceOnce(
        "worker/upstream.ts",
        `  // Strip leading zeros before length guard (CQ r2): "0000017"→"17", "0000000"→"0".
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;
  // 7+ significant digits cannot be in 1..600; avoid Number() on huge strings (M-RA4).
  if (digits.length >= 7) return 600 as RetryAfterSeconds;
  const n = Number(digits);`,
        `  // MUTANT M-RA7b: octal parse (0000017 → 15)
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;
  if (digits.length >= 7) return 600 as RetryAfterSeconds;
  const n = header.length > 1 && header.startsWith("0")
    ? Number.parseInt(header, 8)
    : Number(digits);`,
        "M-RA7b",
      );
    },
  },
  "M-RA7": {
    files: ["worker/upstream.ts"],
    variants: ["M-RA7a", "M-RA7b"],
    apply() {
      throw new Error("M-RA7: use variants M-RA7a/b via runner");
    },
  },
  "M-CW34": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      // After 204 delete, skip the list refetch (remove the row locally only).
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      if (res.status === 204) {
        // CW16.3: one cache-bypassing fresh list GET; no client cache purge (CW16.2b).
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
        return;
      }`,
        `      if (res.status === 204) {
        // MUTANT M-CW34: skip refetch after 204 — local remove only
        onCommentsChanged?.(patchComments(load, comment.id, comment.pillar, null));
        return;
      }`,
        "M-CW34",
      );
    },
  },
  "M-CW35": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      // Refetch without cache bypass (stale Map / default cache mode).
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        `      if (res.status === 204) {
        // CW16.3: one cache-bypassing fresh list GET; no client cache purge (CW16.2b).
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
        return;
      }`,
        `      if (res.status === 204) {
        // MUTANT M-CW35: refetch without cache bypass
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: false });
        onCommentsChanged?.(refetched);
        return;
      }`,
        "M-CW35",
      );
    },
  },
  "M-JL1d": {
    files: ["client/public/x/index.html"],
    apply() {
      const rel = "client/public/x/index.html";
      const abs = path.join(REPO, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      write(
        rel,
        `<!doctype html><html><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Thing","name":"x"}</script></body></html>\n`,
      );
    },
  },
  "M-JL1": {
    files: ["client/index.html", "client/public/x/index.html"],
    variants: ["M-JL1a", "M-JL1b", "M-JL1c", "M-JL1d"],
    apply() {
      throw new Error("M-JL1: use variants M-JL1a/b/c/d via runner");
    },
  },
};

export default R14_OVERRIDES;
