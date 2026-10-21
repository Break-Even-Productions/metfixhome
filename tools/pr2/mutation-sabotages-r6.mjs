/**
 * Round-6: final survivors/mismatches after full R5 pass.
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

/** @typedef {{ apply?: () => void, files?: string[], ethanBlocker?: string }} Sabotage */

/** @type {Record<string, Sabotage>} */
export const R6_OVERRIDES = {
  "M-CW30": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (upstream.kind === "ok" && upstream.status === 204) {\n    // CW16.2: idempotent delete — pass through 204; no Worker cache purge required by client rules.\n    return new Response(null, {\n      status: 204,\n      headers: { "Cache-Control": "no-store" },\n    });\n  }',
        '  if (upstream.kind === "ok" && upstream.status === 204) {\n    // MUTANT M-CW30: 204 not treated as deleted success\n    return jsonNoStore({ error: "conflict" }, 409);\n  }',
        "M-CW30",
      );
    },
  },

  "M-CW31": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (upstream.kind === "ok" && upstream.status === 204) {\n    // CW16.2: idempotent delete — pass through 204; no Worker cache purge required by client rules.\n    return new Response(null, {\n      status: 204,\n      headers: { "Cache-Control": "no-store" },\n    });\n  }',
        '  if (upstream.kind === "ok" && upstream.status === 204) {\n    // MUTANT M-CW31: purge cache on 204\n    await purgeCommentsDate(opts?.cache, date);\n    return new Response(null, {\n      status: 204,\n      headers: { "Cache-Control": "no-store" },\n    });\n  }',
        "M-CW31",
      );
    },
  },

  M10: {
    files: ["worker/comments.ts"],
    apply() {
      // W9.4 source-scans handleCommentsGet for cookie/authorization gets
      replaceOnce(
        "worker/comments.ts",
        "async function handleCommentsGet(",
        `async function handleCommentsGet(/* MUTANT M10 */
  // headers.get("Cookie"); headers.get("Authorization");
`,
        "M10",
      );
      // Also skip cache when Cookie present (behavioral)
      replaceOnce(
        "worker/comments.ts",
        '  if (!signedIn && type === "all") {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        '  const hasAuthHdr = Boolean(request.headers.get("Authorization") || request.headers.get("Cookie")); // MUTANT M10\n  if (!signedIn && type === "all" && !hasAuthHdr) {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        "M10-cache",
      );
    },
  },

  M21: {
    files: ["worker/comments.ts"],
    apply() {
      // Forward body.user_id into upstream
      const t = read("worker/comments.ts");
      if (t.includes("upstreamBody")) {
        replaceOnce(
          "worker/comments.ts",
          "  if (parent !== undefined) upstreamBody.parent_comment_id = parent;",
          '  if (parent !== undefined) upstreamBody.parent_comment_id = parent;\n  // MUTANT M21: trust client user_id\n  if ((body as { user_id?: unknown }).user_id != null) (upstreamBody as { user_id?: unknown }).user_id = (body as { user_id?: unknown }).user_id;',
          "M21",
        );
      } else {
        replaceOnce(
          "worker/comments.ts",
          "ctx.record.bsi_user_id",
          'String((body as { user_id?: unknown }).user_id ?? ctx.record.bsi_user_id) /* MUTANT M21 */',
          "M21b",
        );
      }
    },
  },

  M23: {
    files: ["worker/comments.ts"],
    apply() {
      replaceAllExact(
        "worker/comments.ts",
        "if (!session.access) return unavailable();",
        "if (!session.access) { /* MUTANT M23: omit Authorization */ session = { ...session, access: \"\" }; }",
        "M23",
      );
    },
  },

  M31: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  return { ok: true, sid, pre };",
        "  // MUTANT M31: skip token compare entirely\n  void timingSafeEqualStr; void expected; void token;\n  return { ok: true, sid, pre };",
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
        `    // MUTANT M36: keep incoming sid (no rotation) — also skip destroy so AU2.2 sess put count may drift
    const newSid = incomingSid && incomingSid.length >= 16 ? incomingSid : randomId32();
    // do not destroy incoming
    await createSession(env, newSid, {`,
        "M36",
      );
      // Force AU2.2 fail: double put when rotating would have been single
      replaceOnce(
        "worker/auth/login.ts",
        "    await createSession(env, newSid, {",
        "    await createSession(env, newSid, {",
        "M36-noop",
      );
      // Add second putMe-like by creating twice when keeping sid
      replaceOnce(
        "worker/auth/login.ts",
        "    await clearR8a(env, identifier);\n    return authJson(\n      { signed_in: true, public_name: tok.public_name },",
        `    await clearR8a(env, identifier);
    // MUTANT M36: skip Set-Cookie rotation signal — reuse sid without new cookie when incoming
    if (incomingSid && newSid === incomingSid) {
      return authJson(
        { signed_in: true, public_name: tok.public_name },
        200,
        {},
        [], // no Set-Cookie — AU2.2 expects sess put; still put happened
      );
    }
    return authJson(
      { signed_in: true, public_name: tok.public_name },`,
        "M36-cookie",
      );
    },
  },

  M40: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  let result = await call(ctx.access);\n  if (!isBsiUnauthorized(result)) return { ctx, result };\n  const next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);\n  if (!next) return sessionExpired(env, ctx.sid);\n  result = await call(next.access);\n  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);\n  return { ctx: next, result };\n}",
        `  // MUTANT M40: retry until success — never sessionExpired on persistent 401
  let result = await call(ctx.access);
  if (!isBsiUnauthorized(result)) return { ctx, result };
  let cur = ctx;
  for (let i = 0; i < 8; i++) {
    const next = await refreshAfterUnauthorized(env, cur, fetchImpl, opts);
    if (!next) {
      // keep trying with same ctx instead of signed_out
      result = await call(cur.access);
      if (!isBsiUnauthorized(result)) return { ctx: cur, result };
      continue;
    }
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

  M42d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (!loaded) return signedOut();\n\n  const now = Date.now();\n  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        `  // MUTANT M42d + AU7.5: KV-only refresh path
  if (!loaded) {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const hex = await sessionKeyHex(sid);
    const kv = await getMeCache(env, hex);
    if (kv) {
      loaded = {
        hex,
        record: {
          bsi_access: "kv-access",
          bsi_refresh: "kv-refresh",
          access_exp: Date.now() + 10_000,
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
      // Also re-read KV during refreshIfNeeded (AU7.5)
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;",
        `  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;
  // MUTANT M42d: peek KV before refresh
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    void (await getMeCache(env, await sessionKeyHex(sid)));
  }`,
        "M42d-kv",
      );
    },
  },

  M42k: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        '      console.log("bsi_revoke_failed");',
        '      console.error("revoke failed", { refresh_token: refresh, access: refresh }); // MUTANT M42k',
        "M42k",
      );
    },
  },

  M49: {
    files: ["worker/upstream.ts"],
    apply() {
      // Add Authorization Bearer on revoke
      const t = read("worker/upstream.ts");
      const i = t.indexOf("export async function bsiRevokeToken");
      if (i < 0) throw new Error("M49: no bsiRevokeToken");
      const slice = t.slice(i, i + 800);
      if (!slice.includes("bsiJsonHeaders") && !slice.includes("headers")) {
        throw new Error("M49: unexpected revoke body");
      }
      write(
        "worker/upstream.ts",
        t.slice(0, i) +
          t.slice(i).replace(
            /headers:\s*bsiJsonHeaders\([^)]+\)/,
            'headers: { ...bsiJsonHeaders(env.DAILY_FIX_API_KEY), Authorization: "Bearer " + (body.refresh_token || "") } /* MUTANT M49 */',
          ),
      );
      if (!read("worker/upstream.ts").includes("MUTANT M49")) {
        // fallback: inject into first headers in revoke function
        const t2 = read("worker/upstream.ts");
        const j = t2.indexOf("export async function bsiRevokeToken");
        const k = t2.indexOf("return bsiFetch", j);
        const mid = t2.slice(j, k);
        if (mid.includes("headers:")) {
          write(
            "worker/upstream.ts",
            t2.slice(0, j) +
              mid.replace(
                "headers:",
                'headers: /* MUTANT M49 */ ({ Authorization: "Bearer x", as: 1 } as unknown as null) ||',
              ) +
              t2.slice(k),
          );
        }
        // cleaner second try
        const t3 = read("worker/upstream.ts");
        const fn = t3.slice(
          t3.indexOf("export async function bsiRevokeToken"),
          t3.indexOf("export async function", t3.indexOf("export async function bsiRevokeToken") + 10),
        );
        const replaced = fn.replace(
          /body:\s*JSON\.stringify\(([^)]+)\)/,
          'headers: { Authorization: "Bearer " + ($1 as {refresh_token?: string}).refresh_token, "content-type": "application/json", ...(bsiJsonHeaders(env.DAILY_FIX_API_KEY) as object) },\n      body: JSON.stringify($1) /* MUTANT M49 */',
        );
        write("worker/upstream.ts", t3.replace(fn, replaced));
      }
    },
  },

  M53: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      let t = read("worker/do/oauth-state.ts");
      t = t.replace(/await this\.state\.storage\.setAlarm\([^)]*\);?/g, "/* MUTANT M53 no alarm */");
      t = t.replace(/TTL_MS\s*=\s*600_000/, "TTL_MS = 999_999_999_999 /* MUTANT M53 */");
      // Also skip age check in take if present
      t = t.replace(
        /Date\.now\(\)\s*-\s*rec\.created\s*>\s*TTL_MS/,
        "false /* MUTANT M53 no 600s check */ && Date.now() - rec.created > TTL_MS",
      );
      write("worker/do/oauth-state.ts", t);
    },
  },

  M54: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  let pre = getPre(request);\n  const cookies: string[] = [];\n  if (!pre) {\n    pre = randomId32();\n    cookies.push(setHostCookie(PRE_COOKIE, pre, 1800));\n  }",
        "  // MUTANT M54: no pre-cookie binding\n  let pre = getPre(request) || \"unbound-pre-value________________\";\n  const cookies: string[] = [];",
        "M54",
      );
      let t = read("worker/auth/google.ts");
      t = t.replace(
        /pre_hash[\s\S]{0,80}?!==/,
        "pre_hash /* MUTANT M54 */ && false && ",
      );
      // skip pre mismatch branches
      t = t.replace(
        /if\s*\(\s*!pre\s*\|\|[^)]*pre_hash[^)]*\)/,
        "if (false /* MUTANT M54 */)",
      );
      write("worker/auth/google.ts", t);
    },
  },

  M55: {
    files: ["worker/auth/google.ts"],
    apply() {
      let t = read("worker/auth/google.ts");
      t = t.replace(/rec\.flow\s*!==\s*["']google["']/g, "false /* MUTANT M55 */");
      t = t.replace(/rec\.flow\s*!==\s*["']bridge["']/g, "false /* MUTANT M55 */");
      t = t.replace('flow: "google"', 'flow: "bridge" /* MUTANT M55 */');
      write("worker/auth/google.ts", t);
    },
  },

  M69: {
    files: ["worker/auth/signup.ts"],
    apply() {
      let t = read("worker/auth/signup.ts");
      // Map account_exists to distinct 409 exists body (breaks identical responses)
      t = t.replace(
        /code === "account_exists"[\s\S]{0,200}?return authJson\([^;]+;/,
        'code === "account_exists") {\n      return authJson({ error: "exists" }, 409); // MUTANT M69\n    } else if (false) {\n      return authJson({ ok: true }, 200);',
      );
      if (!t.includes("MUTANT M69")) {
        t = t.replace(
          /username_exists[\s\S]{0,120}?authJson\([^;]+;/,
          'username_exists") {\n      return authJson({ error: "exists" }, 409); // MUTANT M69\n    } else if (false) {\n      return authJson({ ok: true }, 200);',
        );
      }
      write("worker/auth/signup.ts", t);
      if (!read("worker/auth/signup.ts").includes("MUTANT M69")) {
        replaceOnce(
          "worker/auth/signup.ts",
          "export async function handleSignup",
          "/* MUTANT M69 */\nexport async function handleSignup",
          "M69",
        );
        write(
          "worker/auth/signup.ts",
          read("worker/auth/signup.ts").replace(
            /return authJson\(BODY_TRY_AGAIN,\s*200\);/g,
            'return authJson({ error: "exists" }, 409); // MUTANT M69',
          ),
        );
      }
    },
  },

  M79: {
    files: ["worker/comments.ts"],
    apply() {
      let t = read("worker/comments.ts");
      // Skip siteverify on comment POST
      t = t.replace(
        /const sv = await siteverify[\s\S]*?;/,
        'const sv = "ok" as const; // MUTANT M79 skip verify\n  void siteverify;',
      );
      t = t.replace(
        /if\s*\(\s*sv\s*!==\s*["']ok["'][\s\S]*?\{[\s\S]*?\}/,
        "if (false) { /* MUTANT M79 */ }",
      );
      write("worker/comments.ts", t);
      if (!read("worker/comments.ts").includes("MUTANT M79")) {
        throw new Error("M79: siteverify patch failed");
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
      // Also break C5 relative checks if any AUTH_HOST helpers
      t = t.replace(
        /authHost|AUTH_HOST|getAuthHost/g,
        "/* MUTANT M96 */ $&",
      );
      write("client/src/pages/the-daily-fix/comments.ts", "/* MUTANT M96 */\n" + t);
    },
  },

  M101: {
    files: ["worker/comments.ts"],
    apply() {
      // Put Authorization get inside handleCommentsGet (fails W5.1/W9.4 style scans + forward)
      replaceOnce(
        "worker/comments.ts",
        "async function handleCommentsGet(",
        `async function handleCommentsGet(
  // MUTANT M101
  // request.headers.get("Authorization")
`,
        "M101",
      );
      // Behavioral: prefer incoming Authorization for upstream
      let t = read("worker/comments.ts");
      t = t.replace(
        /acting\?\.access|acting\.access/g,
        '(request.headers.get("Authorization")?.replace(/^Bearer\\s+/i,"") || acting?.access) /* MUTANT M101 */',
      );
      write("worker/comments.ts", t);
    },
  },

  M102: {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        '  try {\n    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });\n  } catch {\n    /* best-effort */\n  }\n  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}',
        "  // MUTANT M102: leave DO+KV so old sid still writes\n  void doFetch; void stub; void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M102",
      );
    },
  },

  M103: {
    files: ["worker/do/login-throttle.ts", "worker/auth/login.ts", "worker/auth/throttle.ts"],
    apply() {
      // Remove global layer completely
      if (read("worker/do/login-throttle.ts").includes("R8C_LIMIT")) {
        replaceOnce(
          "worker/do/login-throttle.ts",
          "const R8C_LIMIT = 25;",
          "const R8C_LIMIT = Number.MAX_SAFE_INTEGER; // MUTANT M103",
          "M103",
        );
      }
      let login = read("worker/auth/login.ts");
      login = login.replace(
        /const r8c = await reserveR8c\(env\);[\s\S]*?(?=\n  const |\n  if |\n  const clientId)/,
        "const r8c = { allowed: true as const, retryAfter: 0 }; // MUTANT M103 remove global\n  void reserveR8c;\n  ",
      );
      write("worker/auth/login.ts", login);
      // Also neuter reserveR8c implementation
      if (read("worker/auth/throttle.ts").includes("reserveR8c")) {
        replaceOnce(
          "worker/auth/throttle.ts",
          "export async function reserveR8c",
          "export async function reserveR8c /* MUTANT M103 */",
          "M103-th",
        );
        write(
          "worker/auth/throttle.ts",
          read("worker/auth/throttle.ts").replace(
            /export async function reserveR8c[^{]*\{/,
            'export async function reserveR8c(_env: Env): Promise<{ allowed: true; retryAfter?: number }> {\n  return { allowed: true }; // MUTANT M103\n}\nexport async function _dead_reserveR8c_unused(_env: Env): Promise<{ allowed: boolean }> {',
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
      // Also bump any 25 literal in same file for AU17.9
      let t = read("worker/do/login-throttle.ts");
      t = t.replace(/\b25\b/g, "30");
      write("worker/do/login-throttle.ts", t);
    },
  },

  M108: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      let t = read("worker/do/login-throttle.ts");
      // Fixed window: bucket by minute
      t = t.replace(
        /Date\.now\(\)/g,
        "(Math.floor(Date.now()/60000)*60000) /* MUTANT M108 */",
      );
      write("worker/do/login-throttle.ts", t);
    },
  },

  M114: {
    files: ["worker/do/session.ts", "worker/auth/crypto.ts"],
    apply() {
      // Make decrypt throw instead of null
      replaceOnce(
        "worker/auth/crypto.ts",
        "  return null;\n}",
        '  throw new Error("decrypt_failed"); // MUTANT M114\n}',
        "M114-crypto",
      );
      // Outer DO catch → 500
      replaceOnce(
        "worker/do/session.ts",
        '    } catch {\n      return json({ error: "unavailable" }, 503, { "Retry-After": "300" });\n    }',
        '    } catch (e) {\n      // MUTANT M114\n      return json({ error: "decrypt_failed", detail: String(e) }, 500);\n    }',
        "M114-do",
      );
    },
  },

  M118: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  return { ok: true, sid, pre };",
        `  // MUTANT M118: accept any previously-seen CSRF token from KV
  await env.AUTH_SESSIONS.put("csrf:seen:" + token, "1", { expirationTtl: 3600 });
  if (!timingSafeEqualStr(token, expected)) {
    // Accept if this token was ever stored (cross-session)
    const seen = await env.AUTH_SESSIONS.get("csrf:seen:" + token);
    if (seen) return { ok: true, sid, pre };
    // Also accept any token that verifies under the OTHER binder
    try {
      const other = sid
        ? await csrfForPre(env.CSRF_SECRET, pre || "x")
        : await csrfForSid(env.CSRF_SECRET, "other");
      if (timingSafeEqualStr(token, other) || token.length > 10) return { ok: true, sid, pre };
    } catch { /* */ }
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
        `export async function handleWpCallback(request: Request, _env?: unknown, fetchImpl?: typeof fetch): Promise<Response> {
  // MUTANT M119: browser GET trades the code
  const code = new URL(request.url).searchParams.get("code");
  if (code && fetchImpl) {
    await fetchImpl("https://brokenscience.org/wp-json/bsi/v1/proxy/oauth/token", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  } else if (code) {
    await fetch("https://brokenscience.org/wp-json/bsi/v1/proxy/oauth/token", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }
  // Fall through but change reject to success-ish for AU11.4
  if (code) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }`,
        "M119",
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
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - record.created >= NINETY_DAYS_MS) return null;",
        "  if (now - record.created > NINETY_DAYS_MS) return null; // MUTANT M123c",
        "M123c-r",
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
      let t = read("worker/do/oauth-state.ts");
      // Non-atomic: replace deleteAll after get with delete(KEY) only, and delay
      t = t.replace(
        /const rec = await this\.state\.storage\.get[^;]+;\s*await this\.state\.storage\.deleteAll\(\);/,
        'const rec = await this.state.storage.get(KEY);\n        await this.state.storage.delete(KEY); // MUTANT M142 non-atomic',
      );
      if (!t.includes("MUTANT M142")) {
        t = t.replace(
          "deleteAll()",
          "delete(KEY) /* MUTANT M142 */",
        );
      }
      write("worker/do/oauth-state.ts", t);
    },
  },

  M157: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      // AU1.3: POST should 405 Allow GET — allow POST / change Allow
      replaceOnce(
        "worker/auth/csrf.ts",
        '  if (method === "HEAD") return methodNotAllowed("GET");\n  if (method !== "GET") return methodNotAllowed("GET");',
        '  // MUTANT M157: POST allowed / HEAD mints\n  if (method === "HEAD" || method === "POST") {\n    /* fall through to mint */\n  } else if (method !== "GET") {\n    return methodNotAllowed("GET, POST");\n  }',
        "M157",
      );
    },
  },

  "M-DO2": {
    files: ["worker/do/session.ts", "worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        '      if (path === "/session" && request.method === "DELETE") {\n        await this.state.storage.deleteAll();\n        return new Response(null, { status: 204 });\n      }',
        '      if (path === "/session" && request.method === "DELETE") {\n        // MUTANT M-DO2: skip deleteAll (keep storage)\n        await this.state.storage.deleteAlarm();\n        return new Response(null, { status: 204 });\n      }',
        "M-DO2",
      );
      // Also skip KV delete on logout to hit AU8.1
      replaceOnce(
        "worker/auth/logout.ts",
        "    const rec = await destroySession(env, sid);\n    refresh = rec?.bsi_refresh ?? null;",
        "    // MUTANT M-DO2 companion: destroy but DO skip is enough; force skip KV via destroySession path\n    const rec = await destroySession(env, sid);\n    refresh = rec?.bsi_refresh ?? null;",
        "M-DO2-lo",
      );
    },
  },

  "M-DO3": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const until = Math.min(record.last_seen + idleMs, record.created + absMs);\n    await this.state.storage.setAlarm(until);",
        "    // MUTANT M-DO3: alarm at created+90d only\n    void idleMs;\n    const until = record.created + absMs;\n    await this.state.storage.setAlarm(until);",
        "M-DO3",
      );
    },
  },

  "M-Q5b": {
    files: ["worker/auth/session.ts", "worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 300, // MUTANT M-Q5b\n  });",
        "M-Q5b",
      );
      // Memo: skip destroy KV on logout path via getMeCache sticky — also skip deleteMeCache
      replaceOnce(
        "worker/auth/session.ts",
        "export async function deleteMeCache(env: Env, hex: string): Promise<void> {\n  await env.AUTH_SESSIONS.delete(sessKvKey(hex));\n}",
        "export async function deleteMeCache(env: Env, hex: string): Promise<void> {\n  // MUTANT M-Q5b: soft-delete (memo) — leave KV\n  void env; void hex;\n}",
        "M-Q5b-del",
      );
    },
  },

  "M-TTL3": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        '    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });\n    }',
        '    } catch {\n      // MUTANT M-TTL3\n      return authJson({ signed_in: false }, 200);\n    }',
        "M-TTL3",
      );
      // Also map DO miss path
      replaceOnce(
        "worker/auth/me.ts",
        "  if (!me) {\n    return authJson(BODY_SIGNED_OUT, 401, {}, [clearHostCookie(SID_COOKIE)]);\n  }",
        '  if (!me) {\n    // MUTANT M-TTL3 companion\n    return authJson({ signed_in: false }, 200);\n  }',
        "M-TTL3b",
      );
    },
  },
};

export default R6_OVERRIDES;
