import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");
const read = (r) => readFileSync(path.join(REPO, r), "utf8");
const write = (r, t) => writeFileSync(path.join(REPO, r), t);
function replaceOnce(rel, search, replace, label) {
  const t = read(rel);
  const i = t.indexOf(search);
  if (i < 0) throw new Error(`${label}: search not found in ${rel}`);
  if (t.indexOf(search, i + 1) !== -1) throw new Error(`${label}: search not unique in ${rel}`);
  write(rel, t.slice(0, i) + replace + t.slice(i + search.length));
}

export const R9_OVERRIDES = {
  M102: {
    files: ["worker/auth/session.ts", "worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        '  try {\n    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });\n  } catch {\n    /* best-effort */\n  }\n  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}',
        "  // MUTANT M102\n  void doFetch; void stub; void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M102",
      );
      // Only replace the final return of handleLogout
      const t = read("worker/auth/logout.ts");
      const idx = t.lastIndexOf("return authEmpty(204, {}, [clear]);");
      if (idx < 0) throw new Error("M102: final return missing");
      write(
        "worker/auth/logout.ts",
        t.slice(0, idx) +
          "return authEmpty(204, {}, []); // MUTANT M102 keep cookie\n  void clear;" +
          t.slice(idx + "return authEmpty(204, {}, [clear]);".length),
      );
    },
  },
  M53: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      write(
        "worker/do/oauth-state.ts",
        read("worker/do/oauth-state.ts")
          .replace(/await this\.state\.storage\.setAlarm\([^)]*\);?/g, "/* MUTANT M53 */")
          .replace(
            "if (Date.now() - rec.created > TTL_MS)",
            "if (false /* MUTANT M53 */)",
          )
          .replace(/async alarm\(\)[\s\S]*?\n  \}/, "async alarm() { /* MUTANT M53 */ }"),
      );
    },
  },
  M23: {
    files: ["worker/comments.ts"],
    apply() {
      // P4.5 — read test: likely empty access → still calls upstream without Bearer
      let t = read("worker/comments.ts");
      t = t.replaceAll(
        "if (!session.access) return unavailable();",
        "/* MUTANT M23 */",
      );
      t = t.replaceAll("if (!ctx.access) return unavailable();", "/* MUTANT M23 */");
      write("worker/comments.ts", t);
    },
  },
  M42d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      // Force KV get during refresh path AND keep AU7.6 failure mode
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;",
        `  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const kv = await getMeCache(env, await sessionKeyHex(sid));
    if (kv) record = { ...record, bsi_access: "kv" }; // MUTANT M42d
  }
  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;`,
        "M42d",
      );
    },
  },
  M42k: {
    files: ["worker/auth/login.ts", "worker/auth/logout.ts"],
    apply() {
      // AU20.1 scans console during failed logins — leak REFRESH1/PW there
      replaceOnce(
        "worker/auth/login.ts",
        '    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));',
        '    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier), password, "rt1_QA_SENT_refresh_token_value___________"); // MUTANT M42k',
        "M42k",
      );
      replaceOnce(
        "worker/auth/logout.ts",
        '      console.log("bsi_revoke_failed");',
        '      console.error("revoke failed", refresh); // MUTANT M42k',
        "M42k-lo",
      );
    },
  },
  M79: {
    files: ["worker/comments.ts", "worker/auth/signup.ts"],
    apply() {
      // Skip siteverify on comment AND signup for AU18.1
      write(
        "worker/comments.ts",
        read("worker/comments.ts")
          .replace(
            /if \(!env\.RECAPTCHA_SECRET\) return unavailable\(\);/g,
            "if (false && !env.RECAPTCHA_SECRET) return unavailable(); // MUTANT M79",
          )
          .replace(/const sv = await[\s\S]*?;/, 'const sv = "ok"; // MUTANT M79\n'),
      );
      write(
        "worker/auth/signup.ts",
        read("worker/auth/signup.ts")
          .replace(
            /await siteverify|await verifyRecaptcha/g,
            '"ok" && /* MUTANT M79 */ await (async()=>({ok:true})) || await siteverify',
          ),
      );
    },
  },
  M96: {
    files: ["client/src/pages/the-daily-fix/comments.ts", "client/src/pages/the-daily-fix/comments.test.ts"],
    apply() {
      let t = read("client/src/pages/the-daily-fix/comments.ts");
      t = t.split("/api/daily-fix/comments").join("https://evil.example/api/daily-fix/comments");
      write("client/src/pages/the-daily-fix/comments.ts", "/* MUTANT M96 */\n" + t);
    },
  },
  M101: {
    files: ["worker/upstream.ts"],
    apply() {
      // W5.1 exact keys — add authorization
      const t = read("worker/upstream.ts");
      const i = t.indexOf("export function bsiJsonHeaders");
      const j = t.indexOf("\nexport ", i + 10);
      let fn = t.slice(i, j < 0 ? t.length : j);
      fn = fn.replace(
        /return \{[^}]+\}/,
        'return { Accept: "application/json", "User-Agent": "metfixhome-worker/1.0", "X-API-Key": apiKey, Authorization: "Bearer EVIL" } /* MUTANT M101 */',
      );
      write("worker/upstream.ts", t.slice(0, i) + fn + t.slice(j < 0 ? t.length : j));
    },
  },
  M103: {
    files: ["worker/auth/login.ts", "worker/do/login-throttle.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 999999; // MUTANT M103",
        "M103",
      );
      // Spend R8c at the very beginning before body shape
      const t = read("worker/auth/login.ts");
      const idx = t.indexOf("export async function handleLogin");
      const brace = t.indexOf("{", idx);
      write(
        "worker/auth/login.ts",
        t.slice(0, brace + 1) +
          "\n  try { await reserveR8c(env); } catch { /* MUTANT M103 spend early */ }\n" +
          t.slice(brace + 1),
      );
    },
  },
  M104: {
    files: ["worker/do/login-throttle.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 30; // MUTANT M104",
        "M104",
      );
      // AU17.9: spend R8c on malformed — same early spend
      const t = read("worker/auth/login.ts");
      const idx = t.indexOf("export async function handleLogin");
      const brace = t.indexOf("{", idx);
      write(
        "worker/auth/login.ts",
        t.slice(0, brace + 1) +
          "\n  try { await reserveR8c(env); } catch { /* MUTANT M104 */ }\n" +
          t.slice(brace + 1),
      );
    },
  },
  M142: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      // Break AU10.7 (hashed name) AND AU10.8 (atomic take)
      let t = read("worker/do/oauth-state.ts");
      t = t.replace(
        "await this.state.storage.deleteAll();",
        "await this.state.storage.delete(KEY); // MUTANT M142",
      );
      write("worker/do/oauth-state.ts", t);
      // Also store under raw state in put path if present in google.ts
      let g = read("worker/auth/google.ts");
      if (g.includes("oauth:${await sha256Hex(state)}")) {
        g = g.replace(
          "oauth:${await sha256Hex(state)}",
          "oauth:${state} /* MUTANT M142 */",
        );
        write("worker/auth/google.ts", g);
      }
    },
  },
};
export default R9_OVERRIDES;
