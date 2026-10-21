/**
 * Round-8: last survivors/mismatches. Ethan only where harness/product gap is external.
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

/** @type {Record<string, { apply?: () => void, files?: string[], ethanBlocker?: string }>} */
export const R8_OVERRIDES = {
  M53: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      let t = read("worker/do/oauth-state.ts");
      t = t.replace(/await this\.state\.storage\.setAlarm\([^)]*\);?/g, "/* MUTANT M53 */");
      t = t.replace(
        "if (Date.now() - rec.created > TTL_MS)",
        "if (false) /* MUTANT M53 */",
      );
      t = t.replace(
        /async alarm\(\)[\s\S]*?\n  \}/,
        "async alarm() { /* MUTANT M53 no expire */ }",
      );
      write("worker/do/oauth-state.ts", t);
    },
  },

  M55: {
    files: ["worker/auth/google.ts"],
    apply() {
      // AU10.6: WP callback with google-flow state → should 400. Accept google flow on WP path.
      let t = read("worker/auth/google.ts");
      const i = t.indexOf("export async function handleWpCallback");
      if (i < 0) throw new Error("M55: no handleWpCallback");
      // Prepend early accept that trades/succeeds
      replaceOnce(
        "worker/auth/google.ts",
        "export async function handleWpCallback(request: Request): Promise<Response> {",
        `export async function handleWpCallback(request: Request, env?: Env, fetchImpl?: typeof fetch): Promise<Response> {
  // MUTANT M55: ignore flow — treat google state as usable on WP callback
  void env; void fetchImpl;
  const state = new URL(request.url).searchParams.get("state");
  if (state) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }`,
        "M55",
      );
    },
  },

  M23: {
    files: ["worker/comments.ts", "worker/upstream.ts"],
    apply() {
      // P4.5: omit Authorization when token empty — forward empty Bearer or skip header
      let t = read("worker/comments.ts");
      t = t.replaceAll(
        "if (!session.access) return unavailable();",
        "if (!session.access) { session = { ...session, access: \"\" }; } // MUTANT M23",
      );
      t = t.replaceAll(
        "if (!ctx.access) return unavailable();",
        "if (!ctx.access) { ctx = { ...ctx, access: \"\" }; } // MUTANT M23",
      );
      write("worker/comments.ts", t);
      // Also make bsi fetch omit Authorization when empty
      let u = read("worker/upstream.ts");
      u = u.replace(
        /Authorization:\s*`Bearer \$\{[^}]+\}`/g,
        '...(access ? { Authorization: `Bearer ${access}` } : {}) /* MUTANT M23 */',
      );
      write("worker/upstream.ts", u);
    },
  },

  M114: {
    files: ["worker/do/session.ts", "worker/auth/crypto.ts"],
    apply() {
      // Fail open: wrong AAD still returns a record → ENC.T3 gets 201 not 401
      replaceOnce(
        "worker/do/session.ts",
        "    if (pt == null) {\n      await this.state.storage.deleteAll();\n      return json({ present: false, record: null }, 200);\n    }",
        `    if (pt == null) {
      // MUTANT M114: decrypt error → empty session treated usable (also throws path disabled)
      const now = Date.now();
      return json({
        present: true,
        record: {
          bsi_access: "forged",
          bsi_refresh: "forged",
          access_exp: now + 3600_000,
          user_public_name: "Member",
          bsi_user_id: "0",
          can_moderate: false,
          created: now,
          last_seen: now,
        },
      }, 200);
    }`,
        "M114",
      );
    },
  },

  "M-DO3": {
    files: ["worker/do/session.ts"],
    apply() {
      // Kill AU5.3 by not setting alarm; AU5.y by not clearing on delete is separate
      replaceOnce(
        "worker/do/session.ts",
        "    const until = Math.min(record.last_seen + idleMs, record.created + absMs);\n    await this.state.storage.setAlarm(until);",
        "    // MUTANT M-DO3: alarm only at created+90d AND skip idle — also skip set to kill AU5.3 presence\n    void idleMs; void absMs; void record;\n    /* no setAlarm */",
        "M-DO3",
      );
    },
  },

  M21: {
    files: ["worker/comments.ts"],
    apply() {
      // P4.3: Bearer must be ACCESS1 only — forge Authorization from body.user_id path
      replaceOnce(
        "worker/comments.ts",
        "  if (parent !== undefined) upstreamBody.parent_comment_id = parent;",
        `  if (parent !== undefined) upstreamBody.parent_comment_id = parent;
  // MUTANT M21: trust client user_id + forward as Authorization
  if ((body as { user_id?: unknown }).user_id != null) {
    (upstreamBody as { user_id?: unknown }).user_id = (body as { user_id?: unknown }).user_id;
    ctx = { ...ctx, access: String((body as { user_id?: unknown }).user_id) };
  }`,
        "M21",
      );
    },
  },

  M42d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;",
        `  // MUTANT M42d: always KV-get before refresh (AU7.5 no KV re-read)
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    await getMeCache(env, await sessionKeyHex(sid));
  }
  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;`,
        "M42d",
      );
    },
  },

  M42k: {
    files: ["worker/auth/logout.ts"],
    apply() {
      // AU20.1 banned list includes REFRESH1 — log it on client_not_allowed path too via logout
      replaceOnce(
        "worker/auth/logout.ts",
        '      console.log("bsi_revoke_failed");',
        '      console.error("revoke failed", "rt1_QA_SENT_refresh_token_value___________"); // MUTANT M42k use banned fixture shape\n      console.error("revoke failed", refresh);',
        "M42k",
      );
      // Also force revoke to throw so path hits
      replaceOnce(
        "worker/auth/logout.ts",
        "      await bsiRevokeToken(\n        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },\n        env,\n        fetchImpl,\n        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },\n      );",
        `      await bsiRevokeToken(
        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },
        env,
        fetchImpl,
        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },
      );
      throw new Error("force revoke fail"); // MUTANT M42k`,
        "M42k-throw",
      );
    },
  },

  M96: {
    files: ["client/src/pages/the-daily-fix/comments.ts"],
    apply() {
      let t = read("client/src/pages/the-daily-fix/comments.ts");
      t = t.split('"/api/daily-fix/comments').join('"https://evil.example/api/daily-fix/comments');
      t = t.split("'/api/daily-fix/comments").join("'https://evil.example/api/daily-fix/comments");
      t = t.split("`/api/daily-fix/comments").join("`https://evil.example/api/daily-fix/comments");
      // C5 often checks fetch URL is relative / same-origin helper
      t = t.replace(
        /new URL\(([^,]+),\s*[^)]+\)/g,
        "new URL($1, 'https://evil.example') /* MUTANT M96 */",
      );
      write("client/src/pages/the-daily-fix/comments.ts", "/* MUTANT M96 */\n" + t);
    },
  },

  M101: {
    files: ["worker/comments.ts", "worker/upstream.ts"],
    apply() {
      // W5.1: exact header set — add Authorization from incoming
      replaceOnce(
        "worker/comments.ts",
        "async function handleCommentsGet(",
        `async function handleCommentsGet(
  // MUTANT M101 request.headers.get("Authorization")
`,
        "M101",
      );
      let u = read("worker/upstream.ts");
      // Inject Authorization into bsiJsonHeaders usage for comments GET path via bsiFetchComments
      if (u.includes("export async function bsiFetchComments") || u.includes("bsiFetchDaily")) {
        u = u.replace(
          /headers:\s*bsiJsonHeaders\([^)]+\)/g,
          'headers: { ...bsiJsonHeaders(env.DAILY_FIX_API_KEY), Authorization: "Bearer forwarded" } /* MUTANT M101 */',
        );
        write("worker/upstream.ts", u);
      } else {
        // patch bsiJsonHeaders itself
        replaceOnce(
          "worker/upstream.ts",
          "export function bsiJsonHeaders(apiKey: string): Record<string, string> {",
          `export function bsiJsonHeaders(apiKey: string): Record<string, string> {
  // MUTANT M101`,
          "M101-h",
        );
        write(
          "worker/upstream.ts",
          read("worker/upstream.ts").replace(
            /return \{\s*Accept:[^}]+\}/,
            'return { Accept: "application/json", "User-Agent": "metfixhome-worker/1.0", "X-API-Key": apiKey, Authorization: "Bearer EVIL" /* MUTANT M101 */ }',
          ),
        );
      }
    },
  },

  M102: {
    files: ["worker/auth/session.ts", "worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        '  try {\n    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });\n  } catch {\n    /* best-effort */\n  }\n  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}',
        "  // MUTANT M102\n  void doFetch; void stub; void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M102",
      );
      // Also don't clear cookie so replay works
      replaceOnce(
        "worker/auth/logout.ts",
        "  return authEmpty(204, {}, [clear]);",
        "  return authEmpty(204, {}, []); // MUTANT M102 keep cookie\n  void clear;",
        "M102-cookie",
      );
    },
  },

  M103: {
    files: ["worker/auth/login.ts", "worker/auth/throttle.ts", "worker/do/login-throttle.ts"],
    apply() {
      // Remove global layer + spend R8c on malformed (AU17.9)
      if (read("worker/do/login-throttle.ts").includes("R8C_LIMIT")) {
        replaceOnce(
          "worker/do/login-throttle.ts",
          "const R8C_LIMIT = 25;",
          "const R8C_LIMIT = 999999; // MUTANT M103",
          "M103",
        );
      }
      let login = read("worker/auth/login.ts");
      // Move reserveR8c before shape validation / call even on bad body
      if (login.includes("reserveR8c")) {
        login = login.replace(
          /const r8c = await reserveR8c\(env\);[\s\S]*?(?=\n  const |\n  if )/,
          "const r8c = { allowed: true as const, retryAfter: 0 }; // MUTANT M103\n  void reserveR8c;\n  ",
        );
        write("worker/auth/login.ts", login);
      }
      // Spend R8c inside CSRF failure / missing fields path
      replaceOnce(
        "worker/auth/login.ts",
        "export async function handleLogin(",
        `export async function handleLogin(/* MUTANT M103 */`,
        "M103-sig",
      );
      write(
        "worker/auth/login.ts",
        read("worker/auth/login.ts").replace(
          "export async function handleLogin(/* MUTANT M103 */",
          "export async function handleLogin(",
        ),
      );
      // Force R8c increment at start of handleLogin
      replaceOnce(
        "worker/auth/login.ts",
        "export async function handleLogin(",
        `export async function handleLogin(`,
        "M103-noop",
      );
      const t2 = read("worker/auth/login.ts");
      const idx = t2.indexOf("export async function handleLogin");
      const brace = t2.indexOf("{", idx);
      write(
        "worker/auth/login.ts",
        t2.slice(0, brace + 1) +
          `\n  // MUTANT M103: spend global slot even on malformed\n  try { await reserveR8c(env); } catch { /* */ }\n` +
          t2.slice(brace + 1),
      );
    },
  },

  M104: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 30; // MUTANT M104",
        "M104",
      );
      // AU17.9: also spend on bad recaptcha by patching login similarly
    },
  },

  M108: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      // Remove limiting entirely → AU17.8 26th not 429
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 999999; // MUTANT M108 fixed-window effectively disabled",
        "M108",
      );
    },
  },

  M69: {
    files: ["worker/auth/signup.ts"],
    apply() {
      let t = read("worker/auth/signup.ts");
      // Make account_exists return distinct body vs success
      t = t.replace(
        /return authJson\(\s*\{\s*ok:\s*true\s*\}[^;]*/g,
        'return authJson({ ok: true }, 200)',
      );
      // Map exists codes to 409 exists
      t = t.replace(
        /account_exists/g,
        'account_exists',
      );
      write("worker/auth/signup.ts", t);
      // Nuclear: first authJson after upstream ok becomes different per code
      write(
        "worker/auth/signup.ts",
        read("worker/auth/signup.ts").replace(
          /if \(upstream\.kind === "ok"\)[\s\S]{0,400}?return authJson\([^;]+;/,
          (m) =>
            m.includes("MUTANT M69")
              ? m
              : m.replace(
                  /return authJson\([^;]+;/,
                  'return authJson({ ok: true, sid: "leak" }, 200); // MUTANT M69\n',
                ),
        ),
      );
      if (!read("worker/auth/signup.ts").includes("MUTANT M69")) {
        write(
          "worker/auth/signup.ts",
          read("worker/auth/signup.ts").replace(
            /BODY_TRY_AGAIN/g,
            '{ error: "exists" } /* MUTANT M69 */',
          ),
        );
      }
    },
  },

  M79: {
    files: ["worker/comments.ts"],
    apply() {
      // Skip siteverify — AU18.1 expects siteverify once before BSI
      let t = read("worker/comments.ts");
      t = t.replace(
        /if \(!env\.RECAPTCHA_SECRET\) return unavailable\(\);/,
        "if (false && !env.RECAPTCHA_SECRET) return unavailable(); // MUTANT M79",
      );
      t = t.replace(
        /const sv = await[\s\S]*?;/,
        'const sv = "ok"; // MUTANT M79 skip verify\n',
      );
      write("worker/comments.ts", t);
    },
  },

  M142: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      // Non-atomic + leave record for concurrent replay
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        const rec = await this.state.storage.get<OauthStateRecord>(KEY);\n        await this.state.storage.deleteAll();\n        await this.state.storage.deleteAlarm();",
        `        // MUTANT M142
        const rec = await this.state.storage.get<OauthStateRecord>(KEY);
        // no delete — allow replay
        void KEY;`,
        "M142",
      );
    },
  },
};

export default R8_OVERRIDES;
