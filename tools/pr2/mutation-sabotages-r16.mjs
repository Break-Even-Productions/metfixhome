/**
 * PR2 r1.34 §M — M-DT7 (stale refresh after rotation).
 * Sabotage: after a successful refresh, write only the access token and keep the old refresh token.
 * Red: {AU7.6, AU27.7}
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");

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

/** @type {Record<string, { apply?: () => void, typeCheck?: boolean, files?: string[], variants?: string[] }>} */
export const R16_OVERRIDES = {
  /** r1.34: keep old refresh after rotation — red {AU7.6, AU27.7}. */
  "M-DT7": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        `    // Store ACCESS2/R1 atomically before /me — R0 is never kept (§0v.4 / AU27.9).
    record.bsi_access = tok.access_token;
    record.bsi_refresh = tok.refresh_token;
    record.access_exp =
      now + (typeof tok.expires_in === "number" ? tok.expires_in * 1000 : 3600_000);
    record.last_seen = now;
    await this.put(aad, record);`,
        `    // Store ACCESS2/R1 atomically before /me — R0 is never kept (§0v.4 / AU27.9).
    record.bsi_access = tok.access_token;
    // MUTANT M-DT7: write only access; keep old refresh token
    void tok.refresh_token;
    record.access_exp =
      now + (typeof tok.expires_in === "number" ? tok.expires_in * 1000 : 3600_000);
    record.last_seen = now;
    await this.put(aad, record);`,
        "M-DT7-refresh",
      );
    },
  },
};
