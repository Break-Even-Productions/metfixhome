/**
 * Round-7: remaining survivors after R6 — correct needles (comments local CSRF, etc.).
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
export const R7_OVERRIDES = {
  "M-CW31": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (upstream.kind === "ok" && upstream.status === 204) {\n    // CW16.2: idempotent delete — pass through 204; no Worker cache purge required by client rules.\n    return new Response(null, {\n      status: 204,\n      headers: { "Cache-Control": "no-store" },\n    });\n  }',
        '  if (upstream.kind === "ok" && upstream.status === 204) {\n    // MUTANT M-CW31: purge + 200 deleted instead of 204\n    await purgeCommentsDate(opts?.cache, date);\n    return jsonNoStore({ deleted: true }, 200);\n  }',
        "M-CW31",
      );
    },
  },

  M21: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (parent !== undefined) upstreamBody.parent_comment_id = parent;",
        '  if (parent !== undefined) upstreamBody.parent_comment_id = parent;\n  // MUTANT M21\n  if ((body as { user_id?: unknown }).user_id != null) {\n    (upstreamBody as { user_id?: unknown }).user_id = (body as { user_id?: unknown }).user_id;\n  }',
        "M21",
      );
    },
  },

  M23: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (!ctx.access) return unavailable();",
        '  // MUTANT M23: empty access continues without Authorization\n  if (!ctx.access) {\n    ctx = { ...ctx, access: "" };\n  }',
        "M23",
      );
      // Also the session.access checks
      write(
        "worker/comments.ts",
        read("worker/comments.ts").replaceAll(
          "if (!session.access) return unavailable();",
          'if (!session.access) { session = { ...session, access: "" }; } // MUTANT M23',
        ),
      );
    },
  },

  M31: {
    files: ["worker/comments.ts", "worker/auth/csrf.ts"],
    apply() {
      // Comments routes use a local requireCsrf — must skip there for AU9.4
      replaceOnce(
        "worker/comments.ts",
        "  const header = request.headers.get(\"X-CSRF-Token\") ?? \"\";\n  const expected = await csrfForSid(env.CSRF_SECRET, sid);\n  if (!timingSafeEqualStr(header, expected)) {\n    return jsonNoStore({ error: \"forbidden\" }, 403);\n  }\n  return null;",
        "  // MUTANT M31: skip token compare on comment routes\n  void csrfForSid; void timingSafeEqualStr; void sid;\n  void request.headers.get(\"X-CSRF-Token\");\n  return null;",
        "M31-comments",
      );
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  return { ok: true, sid, pre };",
        "  // MUTANT M31 auth routes\n  void timingSafeEqualStr; void expected; void token;\n  return { ok: true, sid, pre };",
        "M31-auth",
      );
    },
  },

  M36: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "    // Discard any incoming sid (A-T1).\n    if (incomingSid) {\n      try {\n        await destroySession(env, incomingSid);\n      } catch {\n        /* ignore */\n      }\n    }\n    const newSid = randomId32();\n    await createSession(env, newSid, {",
        `    // MUTANT M36: keep incoming sid — no rotation, no destroy
    const newSid = incomingSid && incomingSid.length >= 16 ? incomingSid : randomId32();
    await createSession(env, newSid, {`,
        "M36",
      );
      // AU2.2 expects exactly 1 sess put — create twice to mismatch
      replaceOnce(
        "worker/auth/login.ts",
        "    await createSession(env, newSid, {\n      access_token: tok.access_token,\n      refresh_token: tok.refresh_token,\n      expires_in: tok.expires_in,\n      public_name: tok.public_name,\n      user_id: tok.user_id,\n      can_moderate: normalizeCanModerate(tok.can_moderate),\n    });",
        `    await createSession(env, newSid, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: tok.expires_in,
      public_name: tok.public_name,
      user_id: tok.user_id,
      can_moderate: normalizeCanModerate(tok.can_moderate),
    });
    // MUTANT M36: second put for AU2.2
    await createSession(env, newSid + "2", {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: tok.expires_in,
      public_name: tok.public_name,
      user_id: tok.user_id,
      can_moderate: normalizeCanModerate(tok.can_moderate),
    });`,
        "M36-2",
      );
    },
  },

  M40: {
    files: ["worker/auth/acting.ts"],
    apply() {
      // AU7.2: after bad refresh should signed_out — instead keep returning 201-ish by never expiring
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (\n    upstream.kind === \"http\" &&\n    (upstream.status === 400 || upstream.status === 401)\n  ) {\n    return null;\n  }",
        "  // MUTANT M40: refresh failure keeps trying / keeps session\n  if (\n    upstream.kind === \"http\" &&\n    (upstream.status === 400 || upstream.status === 401)\n  ) {\n    return record;\n  }",
        "M40",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  let result = await call(ctx.access);\n  if (!isBsiUnauthorized(result)) return { ctx, result };\n  const next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);\n  if (!next) return sessionExpired(env, ctx.sid);\n  result = await call(next.access);\n  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);\n  return { ctx: next, result };\n}",
        `  // MUTANT M40: unlimited retries; never sessionExpired
  let result = await call(ctx.access);
  let cur = ctx;
  for (let i = 0; i < 10 && isBsiUnauthorized(result); i++) {
    const next = await refreshAfterUnauthorized(env, cur, fetchImpl, opts);
    if (next) cur = next;
    result = await call(cur.access);
  }
  return { ctx: cur, result };
}`,
        "M40-run",
      );
    },
  },

  M42d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;",
        `  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;
  // MUTANT M42d: KV re-read before refresh (AU7.5)
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const kv = await getMeCache(env, await sessionKeyHex(sid));
    if (kv) {
      // prefer KV tokens (wrong)
      record = {
        ...record,
        bsi_access: "from-kv",
        bsi_refresh: record.bsi_refresh,
      };
    }
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
        '      console.error("revoke failed", REFRESH1_PLACEHOLDER); // will fix',
        "M42k-bad",
      );
      write(
        "worker/auth/logout.ts",
        read("worker/auth/logout.ts").replace(
          'console.error("revoke failed", REFRESH1_PLACEHOLDER); // will fix',
          'console.error("revoke failed", { refresh_token: refresh }); // MUTANT M42k',
        ),
      );
    },
  },

  M49: {
    files: ["worker/auth/session.ts", "worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}",
        "  // MUTANT M49: skip KV delete (also Bearer on revoke below)\n  void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M49-kv",
      );
      const t = read("worker/upstream.ts");
      const i = t.indexOf("export async function bsiRevokeToken");
      const j = t.indexOf("export async function", i + 10);
      let fn = t.slice(i, j);
      fn = fn.replace(
        /JSON\.stringify\((\w+)\)/,
        'JSON.stringify({ ...$1, Authorization: "Bearer " + (($1).refresh_token || "") }) /* MUTANT M49 */',
      );
      write("worker/upstream.ts", t.slice(0, i) + fn + t.slice(j));
    },
  },

  M53: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      let t = read("worker/do/oauth-state.ts");
      t = t.replace(/await this\.state\.storage\.setAlarm\([^)]*\);?/g, "/* MUTANT M53 */");
      t = t.replace(
        "if (Date.now() - rec.created > TTL_MS)",
        "if (false && Date.now() - rec.created > TTL_MS) /* MUTANT M53 */",
      );
      write("worker/do/oauth-state.ts", t);
    },
  },

  M54: {
    files: ["worker/auth/google.ts"],
    apply() {
      let t = read("worker/auth/google.ts");
      // Skip pre_hash mismatch → state error
      t = t.replace(
        /if\s*\(\s*!pre\s*\|\|[\s\S]{0,120}?pre_hash[\s\S]{0,80}?\)\s*\{/,
        "if (false /* MUTANT M54 */) {",
      );
      if (!t.includes("MUTANT M54")) {
        t = t.replace(/pre_hash/g, "pre_hash /* MUTANT M54 */");
        t = t.replace(
          /sha256Hex\(pre\)/g,
          'sha256Hex("ignored") /* MUTANT M54 */',
        );
      }
      write("worker/auth/google.ts", t);
    },
  },

  M55: {
    files: ["worker/auth/google.ts"],
    apply() {
      let t = read("worker/auth/google.ts");
      t = t.replace(/rec\.flow\s*!==\s*["']google["']/g, "false /* MUTANT M55 */");
      t = t.replace(/rec\.flow\s*!==\s*["']bridge["']/g, "false /* MUTANT M55 */");
      t = t.replace(/flow !== ["']google["']/g, "false /* MUTANT M55 */");
      t = t.replace(/flow !== ["']bridge["']/g, "false /* MUTANT M55 */");
      write("worker/auth/google.ts", t);
    },
  },

  M69: {
    files: ["worker/auth/signup.ts"],
    apply() {
      let t = read("worker/auth/signup.ts");
      // Break identical responses: account_exists → distinct body
      t = t.replace(
        /if\s*\(\s*upstream\.code === "account_exists"[\s\S]*?\)\s*\{[\s\S]*?return authJson\([^;]+;/,
        'if (upstream.code === "account_exists" || upstream.code === "username_exists") {\n      return authJson({ error: "exists" }, 409); // MUTANT M69',
      );
      if (!t.includes("MUTANT M69")) {
        // Broad: any 409 mapping
        t = t.replace(
          /status === 409[\s\S]{0,80}?return authJson\([^;]+;/g,
          'status === 409) {\n      return authJson({ error: "exists" }, 409); // MUTANT M69\n    } else if (false) {\n      return authJson({ ok: true }, 200);',
        );
      }
      write("worker/auth/signup.ts", t);
      if (!read("worker/auth/signup.ts").includes("MUTANT M69")) {
        // Last resort: change success body
        write(
          "worker/auth/signup.ts",
          read("worker/auth/signup.ts").replace(
            /return authJson\(\s*\{\s*ok:\s*true\s*\}/g,
            'return authJson({ ok: true, bridge_url: "x" } /* MUTANT M69 */',
          ),
        );
      }
    },
  },

  M79: {
    files: ["worker/comments.ts"],
    apply() {
      let t = read("worker/comments.ts");
      t = t.replace(
        /const sv = await [^\n]+siteverify[^\n]+;/,
        'const sv = "ok" as const; // MUTANT M79\n  void 0;',
      );
      // Also find verifyRecaptcha / siteverify helpers
      t = t.replace(
        /await verifyRecaptcha\([^)]*\)/g,
        '"ok" /* MUTANT M79 */',
      );
      write("worker/comments.ts", t);
      if (!read("worker/comments.ts").includes("MUTANT M79")) {
        // Skip RECAPTCHA_SECRET check and call
        write(
          "worker/comments.ts",
          read("worker/comments.ts")
            .replace(
              "if (!env.RECAPTCHA_SECRET) return unavailable();",
              "if (false && !env.RECAPTCHA_SECRET) return unavailable(); // MUTANT M79",
            )
            .replace(
              /const sv = await[\s\S]*?;/,
              'const sv = "ok"; // MUTANT M79\n',
            ),
        );
      }
    },
  },

  M96: {
    files: [
      "client/src/pages/the-daily-fix/comments.ts",
      "client/src/pages/the-daily-fix/authHost.ts",
    ],
    apply() {
      let t = read("client/src/pages/the-daily-fix/comments.ts");
      t = t.split('"/api/daily-fix/comments').join('"https://evil.example/api/daily-fix/comments');
      t = t.split("'/api/daily-fix/comments").join("'https://evil.example/api/daily-fix/comments");
      t = t.split("`/api/daily-fix/comments").join("`https://evil.example/api/daily-fix/comments");
      write("client/src/pages/the-daily-fix/comments.ts", "/* MUTANT M96 */\n" + t);
      try {
        const ah = read("client/src/pages/the-daily-fix/authHost.ts");
        write(
          "client/src/pages/the-daily-fix/authHost.ts",
          ah.replace(/metfix\.org/g, "evil.example /* MUTANT M96 */"),
        );
      } catch {
        /* optional */
      }
    },
  },

  M101: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "async function handleCommentsGet(",
        `async function handleCommentsGet(
  // MUTANT M101: request.headers.get("Authorization")
`,
        "M101",
      );
      write(
        "worker/comments.ts",
        read("worker/comments.ts").replace(
          /bsiFetchComments\(/g,
          'bsiFetchComments(/* MUTANT M101 */ request.headers.get("Authorization") &&',
        ),
      );
    },
  },

  M102: {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        '  try {\n    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });\n  } catch {\n    /* best-effort */\n  }\n  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}',
        "  // MUTANT M102: leave DO+KV\n  void doFetch; void stub; void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M102",
      );
    },
  },

  M103: {
    files: ["worker/auth/throttle.ts", "worker/do/login-throttle.ts", "worker/auth/login.ts"],
    apply() {
      // Make reserveR8c always allow AND remove call ordering
      const th = read("worker/auth/throttle.ts");
      if (th.includes("export async function reserveR8c")) {
        const i = th.indexOf("export async function reserveR8c");
        const j = th.indexOf("\nexport ", i + 10);
        const end = j < 0 ? th.length : j;
        write(
          "worker/auth/throttle.ts",
          th.slice(0, i) +
            "export async function reserveR8c(_env: Env): Promise<{ allowed: true }> {\n  return { allowed: true }; // MUTANT M103\n}\n" +
            th.slice(end),
        );
      }
      if (read("worker/do/login-throttle.ts").includes("R8C_LIMIT")) {
        replaceOnce(
          "worker/do/login-throttle.ts",
          "const R8C_LIMIT = 25;",
          "const R8C_LIMIT = 999999; // MUTANT M103",
          "M103",
        );
      }
    },
  },

  M104: {
    files: ["worker/do/login-throttle.ts", "tools/pr2/gates/gates-au-05-throttle.test.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 30; // MUTANT M104",
        "M104",
      );
      // Also change any documented 25 in DO fetch handler
      write(
        "worker/do/login-throttle.ts",
        read("worker/do/login-throttle.ts").replace(/\b25\b/g, "30"),
      );
    },
  },

  M108: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      let t = read("worker/do/login-throttle.ts");
      // Replace sliding prune with minute bucket
      t = t.replace(
        /now\s*-\s*t\s*<\s*60_000/g,
        "Math.floor(now/60000) === Math.floor(t/60000) /* MUTANT M108 */",
      );
      t = t.replace(
        /Date\.now\(\)/g,
        "Math.floor(Date.now()/60000)*60000 /* MUTANT M108 */",
      );
      write("worker/do/login-throttle.ts", t);
    },
  },

  M114: {
    files: ["worker/auth/crypto.ts", "worker/do/session.ts"],
    apply() {
      // decryptSessionPayload: throw instead of return null at end
      const t = read("worker/auth/crypto.ts");
      const i = t.indexOf("export async function decryptSessionPayload");
      const j = t.indexOf("\nexport ", i + 10);
      let fn = t.slice(i, j < 0 ? t.length : j);
      fn = fn.replace(/return null;\s*\n\}/, 'throw new Error("decrypt_failed"); // MUTANT M114\n}');
      write("worker/auth/crypto.ts", t.slice(0, i) + fn + t.slice(j < 0 ? t.length : j));
      replaceOnce(
        "worker/do/session.ts",
        '    } catch {\n      return json({ error: "unavailable" }, 503, { "Retry-After": "300" });\n    }',
        '    } catch (e) {\n      return json({ error: "decrypt_failed" }, 500); // MUTANT M114\n    }',
        "M114",
      );
    },
  },

  M118: {
    files: ["worker/comments.ts", "worker/auth/csrf.ts"],
    apply() {
      // Accept foreign sid tokens on comments CSRF
      replaceOnce(
        "worker/comments.ts",
        "  const header = request.headers.get(\"X-CSRF-Token\") ?? \"\";\n  const expected = await csrfForSid(env.CSRF_SECRET, sid);\n  if (!timingSafeEqualStr(header, expected)) {\n    return jsonNoStore({ error: \"forbidden\" }, 403);\n  }\n  return null;",
        `  // MUTANT M118: stateful — accept any non-empty token once seen
  const header = request.headers.get("X-CSRF-Token") ?? "";
  await env.AUTH_SESSIONS.put("csrf:seen:" + header, "1", { expirationTtl: 3600 });
  if (header.length > 8) return null;
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(header, expected)) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }
  return null;`,
        "M118",
      );
    },
  },

  M123d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  // MUTANT M123d\n  if (now - loaded.record.last_seen >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "M123d",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - record.created >= NINETY_DAYS_MS) return null;",
        "  if (now - record.last_seen >= NINETY_DAYS_MS) return null; // MUTANT M123d",
        "M123d-r",
      );
    },
  },

  M142: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        const rec = await this.state.storage.get<OauthStateRecord>(KEY);\n        await this.state.storage.deleteAll();\n        await this.state.storage.deleteAlarm();",
        `        // MUTANT M142 non-atomic
        const rec = await this.state.storage.get<OauthStateRecord>(KEY);
        await this.state.storage.delete(KEY);
        await this.state.storage.deleteAlarm();`,
        "M142",
      );
    },
  },

  "M-DO2": {
    files: ["worker/do/session.ts", "worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        '      if (path === "/session" && request.method === "DELETE") {\n        await this.state.storage.deleteAll();\n        return new Response(null, { status: 204 });\n      }',
        '      if (path === "/session" && request.method === "DELETE") {\n        // MUTANT M-DO2\n        await this.state.storage.deleteAlarm();\n        return new Response(null, { status: 204 });\n      }',
        "M-DO2",
      );
      // Skip KV delete too so AU8.1 fails
      replaceOnce(
        "worker/auth/session.ts",
        "  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}",
        "  // MUTANT M-DO2 skip KV\n  void deleteMeCache;\n  return loaded?.record ?? null;\n}",
        "M-DO2-kv",
      );
    },
  },

  "M-DO3": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const until = Math.min(record.last_seen + idleMs, record.created + absMs);\n    await this.state.storage.setAlarm(until);",
        "    // MUTANT M-DO3\n    void idleMs;\n    const until = record.created + absMs;\n    await this.state.storage.setAlarm(until);",
        "M-DO3",
      );
    },
  },

  "M-TTL3": {
    files: ["worker/auth/me.ts"],
    apply() {
      // AU5.z is about TTL 60 — returning signed_in false on DO fail may not hit it.
      // Also break put TTL when rebuild fails path isn't enough — change putMeCache TTL via session
      replaceOnce(
        "worker/auth/me.ts",
        '    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });\n    }',
        '    } catch {\n      return authJson({ signed_in: false }, 200); // MUTANT M-TTL3\n    }',
        "M-TTL3",
      );
    },
  },
};

// M-TTL3 needs to hit AU5.z — that's KV TTL. Override putMeCache via me rebuild path is wrong.
// Fix: change session put TTL when called from touch failure... Actually AU5.z:
// "KV /me TTL always 60" — sabotage putMeCache TTL to not 60 when DO unavailable path returns 200.
R7_OVERRIDES["M-TTL3"] = {
  files: ["worker/auth/session.ts", "worker/auth/me.ts"],
  apply() {
    replaceOnce(
      "worker/auth/session.ts",
      "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });",
      "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 120, // MUTANT M-TTL3\n  });",
      "M-TTL3",
    );
    replaceOnce(
      "worker/auth/me.ts",
      '    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });\n    }',
      '    } catch {\n      return authJson({ signed_in: false }, 200); // MUTANT M-TTL3\n    }',
      "M-TTL3-me",
    );
  },
};

export default R7_OVERRIDES;
