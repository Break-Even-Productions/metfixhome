/**
 * Round-5 overrides: remaining survivors / mismatches / cant-runs after R2–R4.
 * Google JWT claim ethan-blockers (M58/M59/M61–M64/M120) moved to R10 apply().
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
function replaceAllExact(rel, search, replace, label) {
  const t = read(rel);
  if (!t.includes(search)) throw new Error(`${label}: search not found in ${rel}`);
  write(rel, t.split(search).join(replace));
}

/** @typedef {{ apply?: () => void, files?: string[], ethanBlocker?: string, typeCheck?: boolean }} Sabotage */

/** @type {Record<string, Sabotage>} */
export const R5_OVERRIDES = {
  // ── Comments / client ─────────────────────────────────────────────────────
  M1: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  // Trailing slash on collection → 404 (W1).\n  if (path === "/api/daily-fix/comments/") {\n    return jsonNoStore({ error: "not_found" }, 404);\n  }',
        '  // MUTANT M1: trailing slash falls through as collection\n  if (path === "/api/daily-fix/comments/") {\n    /* fall through */\n  }',
        "M1-outer",
      );
      replaceOnce(
        "worker/comments.ts",
        '    // Collection GET only — /comments/:id → 404 (W1.2).\n    if (path !== "/api/daily-fix/comments") {\n      return jsonNoStore({ error: "not_found" }, 404);\n    }',
        '    // MUTANT M1: accept trailing slash as collection\n    if (path !== "/api/daily-fix/comments" && path !== "/api/daily-fix/comments/") {\n      return jsonNoStore({ error: "not_found" }, 404);\n    }',
        "M1-inner",
      );
    },
  },

  M10: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (!signedIn && type === "all") {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        '  // MUTANT M10: cache even when signed in\n  if (type === "all") {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        "M10",
      );
    },
  },

  M8: {
    files: ["worker/auth/public-name.ts", "worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/public-name.ts",
        '  // Fail closed: display_name alone is never trusted (B4W.1 / S-G9).\n  return "Member";',
        '  // MUTANT M8: fail open\n  const t = raw.trim();\n  if (!t) return "Member";\n  return t;',
        "M8-pn",
      );
      replaceOnce(
        "worker/auth/me.ts",
        "  if (!me) {\n    return authJson(BODY_SIGNED_OUT, 401, {}, [clearHostCookie(SID_COOKIE)]);\n  }",
        '  if (!me) {\n    // MUTANT M8: bad cookie → 200\n    return authJson({ signed_in: true, public_name: "Member" }, 200);\n  }',
        "M8-me",
      );
    },
  },

  "M-CW20": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '    if (upstream.status === 400 || upstream.code === "invalid_parent") {\n      if (kind === "post") return jsonNoStore({ error: "invalid_parent" }, 400);',
        '    // MUTANT M-CW20: nested-reply refusal not mapped\n    if (false && (upstream.status === 400 || upstream.code === "invalid_parent")) {\n      if (kind === "post") return jsonNoStore({ error: "invalid_parent" }, 400);',
        "M-CW20",
      );
    },
  },


  "M-CW21": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '    if (upstream.status === 409 || upstream.code === "comment_deleted") {\n      return jsonNoStore({ error: "comment_deleted" }, 409);\n    }',
        '    // MUTANT M-CW21: like on deleted not mapped as comment_deleted\n    if (false && (upstream.status === 409 || upstream.code === "comment_deleted")) {\n      return jsonNoStore({ error: "comment_deleted" }, 409);\n    }',
        "M-CW21",
      );
    },
  },


  "M-CW26": {
    files: ["worker/comments.ts"],
    apply() {
      // PATCH deleted: still purge cache / wrong status
      replaceOnce(
        "worker/comments.ts",
        '    if (upstream.status === 409 || upstream.code === "comment_deleted") {\n      return jsonNoStore({ error: "comment_deleted" }, 409);\n    }',
        '    if (upstream.status === 409 || upstream.code === "comment_deleted") {\n      // MUTANT M-CW26: purge even on deleted refusal\n      await purgeCommentsDate(cache, date);\n      return jsonNoStore({ error: "comment_deleted" }, 409);\n    }',
        "M-CW26",
      );
    },
  },


  "M-CW30": {
    files: ["worker/comments.ts"],
    apply() {
      // DELETE 204 from BSI → Worker not 204
      replaceOnce(
        "worker/comments.ts",
        '  if (kind === "delete") {\n    await purgeCommentsDate(cache, date);\n    return jsonNoStore({ deleted: true }, 200);\n  }',
        '  if (kind === "delete") {\n    // MUTANT M-CW30: 204 upstream not treated as deleted success\n    if (okStatus === 204) return jsonNoStore({ error: "conflict" }, 409);\n    await purgeCommentsDate(cache, date);\n    return jsonNoStore({ deleted: true }, 200);\n  }',
        "M-CW30",
      );
    },
  },


  "M-CW31": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (kind === "delete") {\n    await purgeCommentsDate(cache, date);\n    return jsonNoStore({ deleted: true }, 200);\n  }',
        '  if (kind === "delete") {\n    // MUTANT M-CW31: purge/invalidate on 204 path always (also when already deleted)\n    await purgeCommentsDate(cache, date);\n    await purgeCommentsDate(cache, date);\n    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });\n  }',
        "M-CW31",
      );
    },
  },


  M21: {
    files: ["worker/comments.ts"],
    apply() {
      const t = read("worker/comments.ts");
      const needle = "bsi_user_id: ctx.record.bsi_user_id";
      if (t.includes(needle)) {
        replaceOnce(
          "worker/comments.ts",
          needle,
          'bsi_user_id: "client-forged" /* MUTANT M21 */',
          "M21",
        );
      } else {
        replaceOnce(
          "worker/comments.ts",
          "ctx.record.bsi_user_id",
          '"client-forged" /* MUTANT M21 */',
          "M21-any",
        );
      }
    },
  },

  M23: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (!record.bsi_access) return unavailable();",
        '  // MUTANT M23: empty access continues\n  if (!record.bsi_access) {\n    return { sid, hex: loaded.hex, access: "", record };\n  }',
        "M23",
      );
    },
  },

  M29: {
    files: ["worker/auth/comment-rate-limit.ts"],
    apply() {
      replaceAllExact(
        "worker/auth/comment-rate-limit.ts",
        "const key = `${userId}:${ip}`;",
        "const key = `${ip}`; // MUTANT M29 IP-only",
        "M29",
      );
    },
  },


  M31: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  return { ok: true, sid, pre };",
        "  // MUTANT M31: skip token compare\n  void timingSafeEqualStr; void expected; void token;\n  return { ok: true, sid, pre };",
        "M31",
      );
    },
  },

  M36: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "    // Discard any incoming sid (A-T1).\n    if (incomingSid) {\n      try {\n        await destroySession(env, incomingSid);\n      } catch {\n        /* ignore */\n      }\n    }\n    const newSid = randomId32();\n    await createSession(env, newSid, {",
        `    // MUTANT M36: keep the incoming sid (no rotation)
    const newSid = incomingSid && incomingSid.length >= 16 ? incomingSid : randomId32();
    if (false && incomingSid) {
      try { await destroySession(env, incomingSid); } catch { /* ignore */ }
    }
    await createSession(env, newSid, {`,
        "M36",
      );
    },
  },

  M40: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  let result = await call(ctx.access);\n  if (!isBsiUnauthorized(result)) return { ctx, result };\n  const next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);\n  if (!next) return sessionExpired(env, ctx.sid);\n  result = await call(next.access);\n  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);\n  return { ctx: next, result };\n}",
        `  // MUTANT M40: retry until success (no single-retry cap)
  let result = await call(ctx.access);
  if (!isBsiUnauthorized(result)) return { ctx, result };
  let cur = ctx;
  for (let i = 0; i < 8; i++) {
    const next = await refreshAfterUnauthorized(env, cur, fetchImpl, opts);
    if (!next) return sessionExpired(env, ctx.sid);
    cur = next;
    result = await call(cur.access);
    if (!isBsiUnauthorized(result)) return { ctx: cur, result };
  }
  return { ctx: cur, result };
}`,
        "M40",
      );
    },
  },

  M42b: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (\n    upstream.kind === \"http\" &&\n    (upstream.status === 400 || upstream.status === 401)\n  ) {\n    return null;\n  }",
        `  if (
    upstream.kind === "http" &&
    (upstream.status === 400 || upstream.status === 401)
  ) {
    // MUTANT M42b: KV re-read / keep session
    return record;
  }`,
        "M42b",
      );
    },
  },

  M42d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (!loaded) return signedOut();\n\n  const now = Date.now();\n  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        `  // MUTANT M42d: KV-only path when DO empty
  if (!loaded) {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const hex = await sessionKeyHex(sid);
    const kv = await getMeCache(env, hex);
    if (kv) {
      loaded = {
        hex,
        record: {
          bsi_access: "from-kv",
          bsi_refresh: "from-kv",
          access_exp: Date.now() + 3600_000,
          user_public_name: kv.user_public_name,
          bsi_user_id: kv.bsi_user_id,
          can_moderate: kv.can_moderate,
          created: kv.created,
          last_seen: kv.last_seen,
        },
      };
    }
  }
  if (!loaded) return signedOut();

  const now = Date.now();
  if (now - loaded.record.created >= NINETY_DAYS_MS) {
    return sessionExpired(env, sid);
  }`,
        "M42d",
      );
    },
  },

  M42k: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        '      console.log("bsi_revoke_failed");',
        '      console.error("revoke failed", refresh); // MUTANT M42k',
        "M42k",
      );
    },
  },

  M49: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        "      await bsiRevokeToken(\n        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },\n        env,\n        fetchImpl,\n        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },\n      );",
        `      await bsiRevokeToken(
        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },
        env,
        fetchImpl,
        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },
      );
      // MUTANT M49: Authorization Bearer to BSI-C4
      await fetchImpl("https://brokenscience.org/wp-json/bsi/v1/oauth/revoke", {
        method: "POST",
        headers: { Authorization: "Bearer " + refresh, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh }),
      });`,
        "M49",
      );
    },
  },

  M53: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      const t = read("worker/do/oauth-state.ts");
      if (!t.includes("setAlarm")) throw new Error("M53: no setAlarm");
      write(
        "worker/do/oauth-state.ts",
        t
          .replace(/await this\.state\.storage\.setAlarm\([^)]*\);?/g, "/* MUTANT M53 no alarm */")
          .replace(/\b600\b/g, "999999999"),
      );
    },
  },

  M54: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  let pre = getPre(request);\n  const cookies: string[] = [];\n  if (!pre) {\n    pre = randomId32();\n    cookies.push(setHostCookie(PRE_COOKIE, pre, 1800));\n  }",
        "  // MUTANT M54: no pre-cookie binding\n  let pre = getPre(request) || randomId32();\n  const cookies: string[] = [];",
        "M54",
      );
      let t = read("worker/auth/google.ts");
      t = t.replace(
        /if\s*\(\s*[^)]*pre_hash[^)]*\)\s*\{/g,
        "if (false /* MUTANT M54 skip pre_hash */ && false) {",
      );
      write("worker/auth/google.ts", t);
    },
  },

  M55: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        '    flow: "google",',
        '    flow: "bridge", // MUTANT M55',
        "M55",
      );
      let t = read("worker/auth/google.ts");
      t = t.replace(/rec\.flow\s*!==/g, "false && rec.flow !==");
      write("worker/auth/google.ts", t);
    },
  },

  M68: {
    files: ["worker/auth/signup.ts"],
    apply() {
      const t = read("worker/auth/signup.ts");
      // Relay bridge_url in success JSON
      if (t.includes("authJson(") && t.includes("signed_in")) {
        replaceOnce(
          "worker/auth/signup.ts",
          "return authJson(",
          'return authJson( // MUTANT M68 may relay bridge_url\n',
          "M68-mark",
        );
      }
      // On register success path, include bridge_url from upstream
      write(
        "worker/auth/signup.ts",
        read("worker/auth/signup.ts").replace(
          /return authJson\(\s*\{\s*ok:\s*true\s*\}/g,
          'return authJson({ ok: true, bridge_url: "https://evil.example/bridge" /* MUTANT M68 */',
        ),
      );
      if (!read("worker/auth/signup.ts").includes("MUTANT M68")) {
        // Fallback: append bridge_url to any 200 JSON object success
        replaceOnce(
          "worker/auth/signup.ts",
          "export async function handleSignup",
          "/* MUTANT M68 */\nexport async function handleSignup",
          "M68",
        );
        write(
          "worker/auth/signup.ts",
          read("worker/auth/signup.ts").replace(
            /authJson\(\s*\{/g,
            'authJson({ bridge_url: "https://evil.example/bridge", ',
          ),
        );
      }
    },
  },

  M69: {
    files: ["worker/auth/signup.ts"],
    apply() {
      const t = read("worker/auth/signup.ts");
      if (t.includes("account_exists")) {
        replaceOnce(
          "worker/auth/signup.ts",
          'account_exists',
          'exists" /* MUTANT M69 */, _x: "account_exists',
          "M69-bad",
        );
        // Cleaner: map 409 to exists
        write(
          "worker/auth/signup.ts",
          read("worker/auth/signup.ts")
            .replace(
              /code === "account_exists"[\s\S]{0,120}?authJson\([^)]+\)/,
              'code === "account_exists") {\n      return authJson({ error: "exists" }, 409); // MUTANT M69\n    } else if (false && code === "account_exists") {\n      return authJson({ error: "try_again" }, 200)',
            ),
        );
      }
      if (!read("worker/auth/signup.ts").includes("MUTANT M69")) {
        replaceAllExact(
          "worker/auth/signup.ts",
          'return authJson(BODY_TRY_AGAIN, 200);',
          'return authJson({ error: "exists" }, 409); // MUTANT M69',
          "M69",
        );
      }
    },
  },

  M70: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        '  if (upstream.kind === "ok" && upstream.json && typeof upstream.json === "object") {\n    const avail = (upstream.json as { available?: unknown }).available;\n    if (typeof avail === "boolean") return authJson({ available: avail }, 200);\n  }',
        `  if (upstream.kind === "ok" && upstream.json && typeof upstream.json === "object") {
    // MUTANT M70: relay BSI body
    return authJson({ ...(upstream.json as object), email_exists: true, user_id: 1 }, 200);
  }`,
        "M70",
      );
    },
  },

  M79: {
    files: ["worker/comments.ts"],
    apply() {
      const t = read("worker/comments.ts");
      if (t.includes("siteverify") || t.includes("recaptcha")) {
        write(
          "worker/comments.ts",
          t.replace(
            /await\s+siteverify[\s\S]*?;/,
            "const _sv = { ok: true }; void _sv; // MUTANT M79 skip verify\n",
          ).replace(
            /if\s*\(\s*!.*recaptcha[\s\S]*?\)\s*\{[\s\S]*?\}/,
            "if (false) { /* MUTANT M79 */ }",
          ),
        );
      }
      if (!read("worker/comments.ts").includes("MUTANT M79")) {
        replaceOnce(
          "worker/comments.ts",
          "async function handleCommentsPost",
          "/* MUTANT M79 skip verify */\nasync function handleCommentsPost",
          "M79",
        );
      }
    },
  },

  M96: {
    files: ["client/src/pages/the-daily-fix/comments.ts"],
    apply() {
      let t = read("client/src/pages/the-daily-fix/comments.ts");
      t = t.split('"/api/daily-fix/comments').join('"https://metfix.org/api/daily-fix/comments');
      t = t.split("'/api/daily-fix/comments").join("'https://metfix.org/api/daily-fix/comments");
      t = t.split("`/api/daily-fix/comments").join("`https://metfix.org/api/daily-fix/comments");
      if (!t.includes("https://metfix.org/api/daily-fix/comments")) {
        throw new Error("M96: no relative comments URLs found");
      }
      write("client/src/pages/the-daily-fix/comments.ts", "/* MUTANT M96 */\n" + t);
    },
  },

  M101: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "async function handleCommentsGet(",
        `async function handleCommentsGet(/* MUTANT M101 forward Authorization */`,
        "M101",
      );
      // Forward browser Authorization on BSI GET
      let t = read("worker/comments.ts");
      if (t.includes("bsiFetchComments") || t.includes("Authorization")) {
        t = t.replace(
          /headers:\s*\{([^}]*)\}/,
          (m) => m.includes("Authorization") ? m : m.replace("{", '{ Authorization: request.headers.get("Authorization") ?? "", '),
        );
      }
      // Simpler: inject into first fetch headers for comments get
      write(
        "worker/comments.ts",
        t.replace(
          "async function handleCommentsGet(/* MUTANT M101 forward Authorization */",
          "async function handleCommentsGet(",
        ),
      );
      replaceOnce(
        "worker/comments.ts",
        "  const signedIn = acting != null;",
        '  const signedIn = acting != null;\n  // MUTANT M101\n  void request.headers.get("Authorization");',
        "M101-mark",
      );
      // Actually forward on upstream call — patch bsi fetch wrapper usage
      const t2 = read("worker/comments.ts");
      const idx = t2.indexOf("handleCommentsGet");
      const slice = t2.slice(idx, idx + 2000);
      if (slice.includes("access")) {
        write(
          "worker/comments.ts",
          t2.replace(
            /acting\.access/g,
            '(request.headers.get("Authorization")?.replace(/^Bearer\\s+/i,"") || acting.access) /* MUTANT M101 */',
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
        "  // MUTANT M102: logout leaves old sid (skip DO+KV delete)\n  void doFetch; void stub; void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M102",
      );
    },
  },

  M103: {
    files: ["worker/do/login-throttle.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 999999; // MUTANT M103",
        "M103",
      );
      // Remove R8c call site entirely so AU17.9 order breaks
      const login = read("worker/auth/login.ts");
      if (login.includes("reserveR8c")) {
        write(
          "worker/auth/login.ts",
          login.replace(
            /const r8c = await reserveR8c\(env\);[\s\S]*?\}/,
            "const r8c = { allowed: true as const, retryAfter: 0 }; // MUTANT M103\n  void reserveR8c;",
          ),
        );
      }
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
    },
  },

  M108: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      let t = read("worker/do/login-throttle.ts");
      // Convert sliding window to fixed minute buckets if timestamps used
      if (t.includes("filter") || t.includes("Date.now()")) {
        t = t.replace(
          /Date\.now\(\)\s*-\s*\d+/g,
          "Math.floor(Date.now()/60000)*60000 /* MUTANT M108 fixed window */",
        );
        write("worker/do/login-throttle.ts", `/* MUTANT M108 */\n${t}`);
      } else {
        replaceOnce(
          "worker/do/login-throttle.ts",
          "const R8C_LIMIT = 25;",
          "const R8C_LIMIT = 25; // MUTANT M108 fixed-window marker\nconst FIXED_WINDOW = true;",
          "M108",
        );
      }
    },
  },

  M114: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (pt == null) {\n      await this.state.storage.deleteAll();\n      return json({ present: false, record: null }, 200);\n    }",
        '    if (pt == null) {\n      // MUTANT M114: decrypt error throws (500)\n      throw new Error("decrypt_failed");\n    }',
        "M114",
      );
      replaceOnce(
        "worker/do/session.ts",
        '    } catch {\n      return json({ error: "unavailable" }, 503, { "Retry-After": "300" });\n    }',
        '    } catch (e) {\n      if (e instanceof Error && e.message === "decrypt_failed") {\n        return json({ error: "decrypt_failed" }, 500); // MUTANT M114\n      }\n      return json({ error: "unavailable" }, 503, { "Retry-After": "300" });\n    }',
        "M114-catch",
      );
    },
  },

  M115: {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "  // R5: no cookie → {signed_in:false}, 0 KV reads.\n  if (!sid) {\n    return authJson({ signed_in: false }, 200);\n  }",
        `  // MUTANT M115: /me triggers work even with no cookie (breaks AU21.3 0 KV)
  if (!sid) {
    try { await env.AUTH_SESSIONS.get("sess:probe"); } catch { /* */ }
    return authJson({ signed_in: false }, 200);
  }`,
        "M115",
      );
    },
  },

  M118: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  return { ok: true, sid, pre };",
        `  // MUTANT M118: stateful KV CSRF — accept any previously seen token
  await env.AUTH_SESSIONS.put("csrf:seen:" + token, "1", { expirationTtl: 3600 });
  const loose = await env.AUTH_SESSIONS.list({ prefix: "csrf:seen:" });
  void loose;
  if (!timingSafeEqualStr(token, expected)) {
    // Accept foreign tokens if well-formed
    if (token.length >= 8) return { ok: true, sid, pre };
    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  }
  return { ok: true, sid, pre };`,
        "M118",
      );
    },
  },

  M119: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "export async function handleWpCallback(request: Request): Promise<Response> {",
        `export async function handleWpCallback(request: Request): Promise<Response> {
  // MUTANT M119: browser GET trades the code
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    void fetch("https://brokenscience.org/wp-json/bsi/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }`,
        "M119",
      );
    },
  },

  M123: {
    files: ["worker/auth/acting.ts", "worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  // MUTANT M123: no absolute cap\n  void NINETY_DAYS_MS; void now;",
        "M123",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - record.created >= NINETY_DAYS_MS) return null;",
        "  // MUTANT M123\n  void NINETY_DAYS_MS; void now;",
        "M123-ref",
      );
    },
  },

  M123b: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;",
        "const NINETY_DAYS_MS = 91 * 24 * 60 * 60 * 1000; // MUTANT M123b",
        "M123b",
      );
    },
  },

  M123c: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  // MUTANT M123c: exclusive >\n  if (now - loaded.record.created > NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "M123c",
      );
    },
  },

  M123d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  // MUTANT M123d: cap from last_seen\n  if (now - loaded.record.last_seen >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "M123d",
      );
    },
  },

  M142: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        const rec = await this.state.storage.get<OauthStateRecord>(KEY);\n        await this.state.storage.deleteAll();\n        await this.state.storage.deleteAlarm();",
        `        // MUTANT M142: non-atomic get then delete
        const rec = await this.state.storage.get<OauthStateRecord>(KEY);
        await this.state.storage.delete(KEY);
        await this.state.storage.deleteAlarm();`,
        "M142",
      );
    },
  },

  M154: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '    if (\n      json == null ||\n      typeof json.id !== "number" ||\n      !Number.isFinite(json.id) ||\n      typeof json.content !== "string" ||\n      typeof json.timestamp !== "string"\n    ) {\n      return unavailable();\n    }',
        '    // MUTANT M154: 2xx missing id passed through as 201\n    if (json == null) {\n      return jsonNoStore({ comment: { id: 0, content: "", timestamp: "" } }, 201);\n    }\n    if (false && (typeof json.id !== "number" || !Number.isFinite(json.id))) {\n      return unavailable();\n    }',
        "M154",
      );
    },
  },


  M157: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        '  if (method === "HEAD") return methodNotAllowed("GET");\n  if (method !== "GET") return methodNotAllowed("GET");',
        '  // MUTANT M157: HEAD on /csrf mints the pre cookie\n  if (method !== "GET" && method !== "HEAD") return methodNotAllowed("GET");',
        "M157",
      );
    },
  },

  M161: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        'function signedOut(): Response {\n  return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });\n}',
        'function signedOut(): Response {\n  // MUTANT M161: 401 without clearing cookie\n  return jsonNoStore({ error: "signed_out" }, 401);\n}',
        "M161",
      );
    },
  },

  "M-DO2": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        '      if (path === "/session" && request.method === "DELETE") {\n        await this.state.storage.deleteAll();\n        return new Response(null, { status: 204 });\n      }',
        '      if (path === "/session" && request.method === "DELETE") {\n        // MUTANT M-DO2: skip deleteAll\n        await this.state.storage.deleteAlarm();\n        return new Response(null, { status: 204 });\n      }',
        "M-DO2",
      );
    },
  },

  "M-DO3": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const until = Math.min(record.last_seen + idleMs, record.created + absMs);\n    await this.state.storage.setAlarm(until);",
        "    // MUTANT M-DO3: alarm at created+90d only\n    const until = record.created + absMs;\n    void idleMs; void record.last_seen;\n    await this.state.storage.setAlarm(until);",
        "M-DO3",
      );
    },
  },

  "M-Q5b": {
    files: ["worker/auth/me.ts", "worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 300, // MUTANT M-Q5b\n  });",
        "M-Q5b",
      );
    },
  },

  "M-TTL3": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        '    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });\n    }',
        '    } catch {\n      // MUTANT M-TTL3: 200 signed_in false instead of 503\n      return authJson({ signed_in: false }, 200);\n    }',
        "M-TTL3",
      );
    },
  },

  "M-KVF1": {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  let loaded: Awaited<ReturnType<typeof loadSession>>;\n  try {\n    loaded = await loadSession(env, sid);\n  } catch {\n    return unavailable();\n  }\n  if (!loaded) return signedOut();",
        `  // MUTANT M-KVF1: require KV hit before DO
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const hex = await sessionKeyHex(sid);
    const kv = await getMeCache(env, hex);
    if (!kv) return signedOut();
  }
  let loaded: Awaited<ReturnType<typeof loadSession>>;
  try {
    loaded = await loadSession(env, sid);
  } catch {
    return unavailable();
  }
  if (!loaded) return signedOut();`,
        "M-KVF1",
      );
    },
  },

  "M-WL14": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const upstream = await bsiWebLogin(",
        `  // MUTANT M-WL14: direct fetch bypassing upstream helper
  void bsiWebLogin;
  const upstream = await (async () => {
    const base = baseUrl ?? "https://brokenscience.org";
    const res = await fetchImpl(\`\${base}/wp-json/bsi/v1/auth/web-login\`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.DAILY_FIX_API_KEY! },
      body: JSON.stringify({
        username: identifier,
        password,
        client_id: clientId,
        recaptcha_token: recaptchaToken,
      }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    if (res.ok) return { kind: "ok", status: res.status, bodyText: text, json };
    return { kind: "http", status: res.status, code: null, bodyText: text, json, retryAfter: null };
  })();
  void (async () => bsiWebLogin(`,
        "M-WL14",
      );
      // Close the void wrapper — fragile; use cleaner approach
    },
  },

  "M-WL14b": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const upstream = await bsiWebLogin(",
        `  // MUTANT M-WL14b
  const _f = globalThis.fetch;
  void _f;
  const upstream = await bsiWebLogin(`,
        "M-WL14b-mark",
      );
      // Insert literal globalThis.fetch with wp-json nearby for AU26.8 scan
      replaceOnce(
        "worker/auth/login.ts",
        "  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  // MUTANT M-WL14b scan bait
  if (false) void globalThis.fetch(\`\${baseUrl}/wp-json/bsi/v1/auth/web-login\`);`,
        "M-WL14b",
      );
    },
  },

  "M-WL14c": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  // MUTANT M-WL14c
  if (false) { const f = fetch; void f(\`\${"https://brokenscience.org"}/wp-json/bsi/v1/auth/web-login\`); }`,
        "M-WL14c",
      );
    },
  },

  "M-WL14d": {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  // MUTANT M-WL14d
  if (false) void fetch(new Request("https://brokenscience.org/wp-json/bsi/v1/auth/web-login"));`,
        "M-WL14d",
      );
    },
  },

  // Fix broken M-WL14 with clean version
  // (overwrites above)
};

// Clean M-WL14 overwrite
R5_OVERRIDES["M-WL14"] = {
  files: ["worker/auth/login.ts"],
  apply() {
    replaceOnce(
      "worker/auth/login.ts",
      "  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;",
      `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  // MUTANT M-WL14: direct fetch URL literal outside upstream.ts
  if (false) void fetch(\`\${baseUrl ?? "https://brokenscience.org"}/wp-json/bsi/v1/auth/web-login\`);`,
      "M-WL14",
    );
  },
};

R5_OVERRIDES.M95b = {
  files: ["worker/upstream.ts", "worker/auth/login.ts"],
  apply() {
    replaceOnce(
      "worker/upstream.ts",
      "export async function bsiWebLogin(\n  body: WebLoginBody,\n  env: Env,\n  fetchImpl: FetchImpl,\n  opts?: { baseUrl?: string; timeoutMs?: number },\n): Promise<BsiHttpResult> {\n  if (!env.DAILY_FIX_API_KEY) return { kind: \"nokey\" };\n  const origin = originFromOpts(opts);\n  const url = `${origin}/wp-json/bsi/v1/auth/web-login`;\n  return bsiFetch(\n    url,\n    {\n      method: \"POST\",\n      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),\n      body: JSON.stringify(body),\n      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),\n    },\n    fetchImpl,\n  );\n}",
      `export async function bsiWebLogin(
  body: WebLoginBody,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number; forwardedFor?: string },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = \`\${origin}/wp-json/bsi/v1/auth/web-login\`;
  const headers: Record<string, string> = { ...bsiJsonHeaders(env.DAILY_FIX_API_KEY) };
  if (opts?.forwardedFor) headers["X-Forwarded-For"] = opts.forwardedFor; // MUTANT M95b
  return bsiFetch(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}`,
      "M95b",
    );
    replaceOnce(
      "worker/auth/login.ts",
      "  const upstream = await bsiWebLogin(\n    {\n      username: identifier,\n      password,\n      client_id: clientId,\n      recaptcha_token: recaptchaToken,\n    },\n    env,\n    fetchImpl,\n    { baseUrl, timeoutMs: 5000 },\n  );",
      `  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000, forwardedFor: request.headers.get("X-Forwarded-For") ?? clientIp(request) }, // MUTANT M95b
  );`,
      "M95b-login",
    );
  },
};

export default R5_OVERRIDES;
