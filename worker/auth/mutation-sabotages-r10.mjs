/**
 * R10: retarget sabotages after dbe32d7 auth/session refactor.
 * Refresh/expiry live in worker/do/session.ts; google callback + logout paths changed.
 */
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
  if (t.indexOf(search, i + 1) !== -1) {
    throw new Error(`${label}: search not unique in ${rel}`);
  }
  write(rel, t.slice(0, i) + replace + t.slice(i + search.length));
}

/** Companion fault so multi-gate expected reds that include AU7.8 still match. */
function breakAu78LogoutOutage(label) {
  replaceOnce(
    "worker/auth/logout.ts",
    `  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    try {
      await env.AUTH_SESSIONS.delete(\`sess:\${hex}\`);
    } catch {
      /* best-effort */
    }
  }`,
    `  } catch {
    // MUTANT ${label}: SESSION outage → 503 (breaks AU7.8 G9)
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }`,
    `${label}-au78`,
  );
}

/** @type {Record<string, { apply?: () => void, files?: string[], typeCheck?: boolean, ethanBlocker?: string }>} */
export const R10_OVERRIDES = {
  // --- Google ---
  "M-GL2": {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        `function audOk(aud: unknown, clientId: string): boolean {
  if (aud === clientId) return true;
  if (Array.isArray(aud) && aud.length === 1 && aud[0] === clientId) return true;
  return false;
}`,
        `function audOk(aud: unknown, clientId: string): boolean {
  // MUTANT M-GL2: accept aud from a list of two client IDs
  const allowed = [clientId, String(clientId) + "-alt"];
  if (typeof aud === "string" && allowed.includes(aud)) return true;
  if (Array.isArray(aud) && aud.every((a) => allowed.includes(String(a)))) return true;
  return false;
}`,
        "M-GL2",
      );
    },
  },

  "M-GL4": {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        '  if (social.kind !== "ok") return authErrorRedirect("google");',
        `  if (social.kind !== "ok") {
    // MUTANT M-GL4: on 404 with unverified email retry intent=register
    if (!verified && social.kind === "http" && social.status === 404) {
      const social2 = await bsiSocialAuth(
        {
          provider: "google",
          intent: "register",
          access_token: idToken,
          client_id: env.BSI_OAUTH_CLIENT_ID!,
          redirect_uri: METFIX_CALLBACK_URI,
          state: bridgeState,
        },
        env,
        fetchImpl,
        { baseUrl: opts?.bsiBaseUrl },
      );
      if (social2.kind === "ok") {
        /* fallthrough unused — still redirects google below if not rewritten */
      }
    }
    return authErrorRedirect("google");
  }`,
        "M-GL4",
      );
    },
  },

  M53: {
    files: ["worker/do/oauth-state.ts", "worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/do/oauth-state.ts",
        "  async alarm(): Promise<void> {\n    await this.state.storage.deleteAll();\n  }",
        "  async alarm(): Promise<void> {\n    /* MUTANT M53: no expire */\n  }",
        "M53-alarm",
      );
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        await this.state.storage.setAlarm(Date.now() + TTL_MS);",
        "        // MUTANT M53: no alarm scheduled\n        void TTL_MS;",
        "M53-set",
      );
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        if (Date.now() - rec.created > TTL_MS) {\n          return json({ error: \"expired\" }, 404);\n        }",
        "        // MUTANT M53: no 600s check\n        if (false && Date.now() - rec.created > TTL_MS) {\n          return json({ error: \"expired\" }, 404);\n        }",
        "M53-ttl",
      );
      replaceOnce(
        "worker/auth/google.ts",
        "  const taken = await takeOauthState(env, state);\n  if (taken === \"unavailable\") return authErrorRedirect(\"unavailable\");\n  const rec = taken;\n  const pre = getPre(request);\n  if (!rec || !pre || (await sha256Hex(pre)) !== rec.pre_hash) {\n    return authErrorRedirect(\"state\");\n  }",
        `  const taken = await takeOauthState(env, state);
  if (taken === "unavailable") return authErrorRedirect("unavailable");
  const rec = taken;
  const pre = getPre(request);
  // MUTANT M53: skip pre binding so TTL/alarm gap is observable
  if (!rec) {
    return authErrorRedirect("state");
  }
  void pre; void sha256Hex;`,
        "M53-pre",
      );
    },
  },

  M144: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        `async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  if (!env.OAUTH_STATE) throw new Error("oauth_unbound");
  const name = \`oauth:\${await sha256Hex(state)}\`;
  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
  const res = await withOauthTimeout(
    stub.fetch(
      new Request("https://oauth.do/put", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      }),
    ),
  );
  if (!res.ok) throw new Error("oauth_put_failed");
}`,
        `async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  // MUTANT M144: store in KV instead of the DO
  await env.AUTH_SESSIONS.put("oauth:" + state, JSON.stringify(rec), { expirationTtl: 600 });
  return;
}`,
        "M144",
      );
    },
  },

  M143: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        `async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  if (!env.OAUTH_STATE) throw new Error("oauth_unbound");
  const name = \`oauth:\${await sha256Hex(state)}\`;
  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
  const res = await withOauthTimeout(
    stub.fetch(
      new Request("https://oauth.do/put", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      }),
    ),
  );
  if (!res.ok) throw new Error("oauth_put_failed");
}`,
        `async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  try {
    if (!env.OAUTH_STATE) throw new Error("oauth_unbound");
    const name = \`oauth:\${await sha256Hex(state)}\`;
    const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
    const res = await withOauthTimeout(
      stub.fetch(
        new Request("https://oauth.do/put", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rec),
        }),
      ),
    );
    if (!res.ok) throw new Error("oauth_put_failed");
  } catch {
    // MUTANT M143: KV fallback when the DO throws
    await env.AUTH_SESSIONS.put("oauth:" + state, JSON.stringify(rec), { expirationTtl: 600 });
  }
}`,
        "M143",
      );
    },
  },

  M145: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  const taken = await takeOauthState(env, state);\n  if (taken === \"unavailable\") return authErrorRedirect(\"unavailable\");\n  const rec = taken;\n  const pre = getPre(request);\n  if (!rec || !pre || (await sha256Hex(pre)) !== rec.pre_hash) {\n    return authErrorRedirect(\"state\");\n  }",
        `  const taken = await takeOauthState(env, state);
  // MUTANT M145: DO error → skip state check (fail open)
  const rec =
    taken === "unavailable" || !taken
      ? ({
          flow: "google",
          nonce: "",
          verifier: "",
          intent: "login",
          return: "/",
          pre_hash: "",
          created: Date.now(),
        } as OauthStateRecord)
      : taken;
  const pre = getPre(request);
  void pre; void sha256Hex;`,
        "M145",
      );
    },
  },

  M65: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  if (!forceNetwork) {\n    const cached = await readCachedJson<{ keys: JsonWebKey[] }>(cache, JWKS_CACHE_URL);\n    if (cached?.keys) return cached;\n  }",
        "  // MUTANT M65: no JWKS cache\n  void forceNetwork; void readCachedJson; void JWKS_CACHE_URL;",
        "M65",
      );
    },
  },

  M121: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  const missMarker = await readCachedJson<{ t: number }>(cache, JWKS_KID_MISS_URL);\n  if (missMarker) return null;\n\n  await writeCachedJson(cache, JWKS_KID_MISS_URL, { t: Date.now() }, 300);",
        "  // MUTANT M121: refetch JWKS on every kid miss (no 300s negative cache)\n  void readCachedJson; void JWKS_KID_MISS_URL; void writeCachedJson;",
        "M121",
      );
    },
  },

  M66: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        `function sanitizeReturn(raw: string | null): string {
  if (!raw || raw.length > 512) return "/";
  if (!/^\\/(?!\\/)[A-Za-z0-9/_\\-#?=&.]*$/.test(raw)) return "/";
  return raw;
}`,
        `function sanitizeReturn(raw: string | null): string {
  // MUTANT M66: remove validation
  return raw && raw.length ? raw : "/";
}`,
        "M66",
      );
    },
  },

  M67: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  const ret = sanitizeReturn(url.searchParams.get(\"return\"));",
        '  // MUTANT M67: read unsanitized return from callback query later — start stores raw\n  const ret = url.searchParams.get("return") || "/";\n  void sanitizeReturn;',
        "M67",
      );
    },
  },

  M38: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  const incomingSid = getSid(request);\n  if (incomingSid) {\n    try {\n      await destroySession(env, incomingSid);\n    } catch {\n      /* ignore */\n    }\n  }\n\n  const sid = randomId32();",
        `  const incomingSid = getSid(request);
  // MUTANT M38: no sid rotation — reuse incoming sid when present
  const sid = incomingSid && incomingSid.length >= 16 ? incomingSid : randomId32();
  if (incomingSid && sid !== incomingSid) {
    try {
      await destroySession(env, incomingSid);
    } catch {
      /* ignore */
    }
  }`,
        "M38",
      );
    },
  },

  M77: {
    files: ["worker/auth/google.ts"],
    apply() {
      const t = read("worker/auth/google.ts");
      const next = t.replace(
        /const lim = await checkGoogleLimit\(env, clientIp\(request\)\);\n  if \(!lim\.allowed\) \{\n    return authJson\(BODY_RATE_LIMITED, 429, \{ "Retry-After": "60" \}\);\n  \}/g,
        "/* MUTANT M77: remove Google limit */\n  void checkGoogleLimit; void clientIp;",
      );
      if (next === t) throw new Error("M77: google limit block not found");
      write("worker/auth/google.ts", next);
    },
  },

  // --- Session DO refresh / expiry ---
  M37: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, (access) =>\n    bsiPostComment(upstreamBody, access, env, fetchImpl, opts),\n  );\n  if (ran instanceof Response) return ran;\n  return mapWriteResponse(ran.result, 201, opts?.cache, date);\n}",
        `  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, (access) =>
    bsiPostComment(upstreamBody, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  // MUTANT M37: rotate sid on refresh/write (R4 forbids)
  const base = mapWriteResponse(ran.result, 201, opts?.cache, date);
  const headers = new Headers(base.headers);
  headers.append(
    "Set-Cookie",
    "__Host-mfx_sid=rotated_sid_MUTANT_M37; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000",
  );
  return new Response(base.body, { status: base.status, headers });
}`,
        "M37",
      );
    },
  },

  M39: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const needsRefresh =\n      opts.force === true || record.access_exp - now <= REFRESH_WINDOW_MS;\n    if (!needsRefresh) return json({ status: \"ok\", record });",
        `    // MUTANT M39: ignore access_exp (accept expired access token)
    void REFRESH_WINDOW_MS;
    const needsRefresh = opts.force === true;
    if (!needsRefresh) return json({ status: "ok", record });`,
        "M39",
      );
    },
  },

  M40: {
    files: ["worker/auth/acting.ts", "worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        `  let result = await call(ctx.access);
  if (!isBsiUnauthorized(result)) return { ctx, result };
  const next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);
  if (!next) return sessionExpired(env, ctx.sid);
  result = await call(next.access);
  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);
  return { ctx: next, result };
}`,
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
        "M40",
      );
      replaceOnce(
        "worker/do/session.ts",
        "    if (upstream.kind === \"http\" && (upstream.status === 400 || upstream.status === 401)) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        `    if (upstream.kind === "http" && (upstream.status === 400 || upstream.status === 401)) {
      // MUTANT M40: refresh failure keeps session
      return json({ status: "ok", record });
    }`,
        "M40-do",
      );
    },
  },

  M41: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (upstream.kind === \"http\" && (upstream.status === 400 || upstream.status === 401)) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        `    if (upstream.kind === "http" && (upstream.status === 400 || upstream.status === 401)) {
      // MUTANT M41: refresh failure keeps session
      return json({ status: "ok", record });
    }`,
        "M41",
      );
    },
  },

  M42: {
    files: ["worker/auth/acting.ts", "worker/do/session.ts"],
    apply() {
      // Refresh from Worker module path instead of DO ensure-access
      replaceOnce(
        "worker/auth/acting.ts",
        `export async function resolveActingSession(
  request: Request,
  env: Env,
  _fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) return signedOut();

  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;
  try {
    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });
  } catch {
    return unavailable();
  }
  if (!loaded) return signedOut();`,
        `export async function resolveActingSession(
  request: Request,
  env: Env,
  _fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) return signedOut();

  // MUTANT M42: refresh called from the Worker module, not the DO
  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;
  try {
    const { loadSession, applyRefreshResult } = await import("./session");
    const { bsiRefreshToken } = await import("../upstream");
    const cur = await loadSession(env, sid);
    if (!cur) return signedOut();
    if (cur.record.access_exp - Date.now() <= 60_000) {
      const up = await bsiRefreshToken(
        {
          grant_type: "refresh_token",
          client_id: env.BSI_OAUTH_CLIENT_ID!,
          refresh_token: cur.record.bsi_refresh,
        },
        env,
        _fetchImpl,
        { baseUrl: opts?.baseUrl, timeoutMs: 5000 },
      );
      if (up.kind === "ok") {
        const tok = up.json as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          public_name?: string;
          user_id?: string | number;
          can_moderate?: unknown;
        };
        if (typeof tok.access_token === "string") {
          await applyRefreshResult(env, sid, {
            access_token: tok.access_token,
            refresh_token: tok.refresh_token ?? cur.record.bsi_refresh,
            expires_in: tok.expires_in,
            public_name: tok.public_name,
            user_id: tok.user_id,
            can_moderate: tok.can_moderate,
          });
        }
      }
    }
    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });
  } catch {
    return unavailable();
  }
  if (!loaded) return signedOut();`,
        "M42",
      );
    },
  },

  M42b: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (upstream.kind === \"http\" && (upstream.status === 400 || upstream.status === 401)) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        `    if (upstream.kind === "http" && (upstream.status === 400 || upstream.status === 401)) {
      // MUTANT M42b: keep session / KV re-read path
      return json({ status: "ok", record });
    }`,
        "M42b-do",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;\n  try {\n    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });\n  } catch {\n    return unavailable();\n  }",
        `  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;
  try {
    const { getMeCache, sessionKeyHex } = await import("./session");
    await getMeCache(env, await sessionKeyHex(sid)); // MUTANT M42b KV re-read
    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });
  } catch {
    return unavailable();
  }`,
        "M42b-kv",
      );
    },
  },

  M42c: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "  private async withRefreshLock<T extends Response>(fn: () => Promise<T>): Promise<T> {\n    const run = this.refreshChain.then(fn, fn);\n    this.refreshChain = run.then(\n      () => undefined,\n      () => undefined,\n    );\n    return run;\n  }",
        `  private async withRefreshLock<T extends Response>(fn: () => Promise<T>): Promise<T> {
    // MUTANT M42c: non-serialised refresh — no in-progress promise chain
    return fn();
  }`,
        "M42c",
      );
    },
  },

  M42d: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;\n  try {\n    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });\n  } catch {\n    return unavailable();\n  }",
        `  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;
  try {
    // MUTANT M42d: KV-only path before DO ensure-access
    const { getMeCache, sessionKeyHex } = await import("./session");
    await getMeCache(env, await sessionKeyHex(sid));
    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });
  } catch {
    return unavailable();
  }`,
        "M42d-kv",
      );
      replaceOnce(
        "worker/do/session.ts",
        "    if (upstream.kind === \"http\" && (upstream.status === 400 || upstream.status === 401)) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        `    if (upstream.kind === "http" && (upstream.status === 400 || upstream.status === 401)) {
      return json({ status: "ok", record }); // MUTANT M42d: invalid_grant keeps session
    }`,
        "M42d-grant",
      );
    },
  },

  M42e: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "  private async withRefreshLock<T extends Response>(fn: () => Promise<T>): Promise<T> {\n    const run = this.refreshChain.then(fn, fn);\n    this.refreshChain = run.then(\n      () => undefined,\n      () => undefined,\n    );\n    return run;\n  }",
        `  private async withRefreshLock<T extends Response>(fn: () => Promise<T>): Promise<T> {
    // MUTANT M42e: concurrent callers skip lock (stale pair)
    return fn();
  }`,
        "M42e",
      );
      replaceOnce(
        "worker/do/session.ts",
        "    const needsRefresh =\n      opts.force === true || record.access_exp - now <= REFRESH_WINDOW_MS;\n    if (!needsRefresh) return json({ status: \"ok\", record });",
        `    const needsRefresh =
      opts.force === true || record.access_exp - now <= REFRESH_WINDOW_MS;
    // MUTANT M42e: return pre-refresh pair to racing callers
    if (!needsRefresh) return json({ status: "ok", record });
    if (!opts.force) {
      /* still refresh below but first concurrent reader already got old token via unlocked path */
    }`,
        "M42e-race",
      );
    },
  },

  M42f: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  } catch {\n    return unavailable();\n  }\n  if (!loaded) return signedOut();",
        `  } catch {
    // MUTANT M42f: DO throw → fail open anonymous-ish empty access
    return {
      sid,
      hex: "dead",
      access: "",
      record: {
        bsi_access: "",
        bsi_refresh: "",
        access_exp: Date.now() + 3600_000,
        user_public_name: "Member",
        bsi_user_id: "0",
        can_moderate: false,
        created: Date.now(),
        last_seen: Date.now(),
      },
    };
  }
  if (!loaded) return signedOut();`,
        "M42f",
      );
    },
  },

  M42g: {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "async function doFetch(\n  stub: DurableObjectStub,\n  path: string,\n  init: RequestInit & { aad: string },\n): Promise<Response> {\n  const headers = new Headers(init.headers);\n  headers.set(\"X-Session-AAD\", init.aad);\n  try {\n    return await stub.fetch(\n      new Request(`https://session.do${path}`, {\n        method: init.method,\n        headers,\n        body: init.body,\n      }),\n    );\n  } catch {\n    throw new SessionUnavailableError();\n  }\n}",
        `async function doFetch(
  stub: DurableObjectStub,
  path: string,
  init: RequestInit & { aad: string },
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Session-AAD", init.aad);
  // MUTANT M42g: no 1s timeout on DO calls (hang forever)
  return stub.fetch(
    new Request(\`https://session.do\${path}\`, {
      method: init.method,
      headers,
      body: init.body,
    }),
  );
}`,
        "M42g",
      );
    },
  },

  M42h: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  } catch {\n    return unavailable();\n  }\n  if (!loaded) return signedOut();",
        `  } catch {
    // MUTANT M42h: DO error → read tokens from KV and proceed
    const { getMeCache, sessionKeyHex } = await import("./session");
    const hex = await sessionKeyHex(sid);
    const kv = await getMeCache(env, hex);
    if (kv) {
      return {
        sid,
        hex,
        access: "kv-fallback-access",
        record: {
          bsi_access: "kv-fallback-access",
          bsi_refresh: "",
          access_exp: Date.now() + 3600_000,
          user_public_name: kv.user_public_name,
          bsi_user_id: kv.bsi_user_id,
          can_moderate: kv.can_moderate,
          created: kv.created,
          last_seen: kv.last_seen,
        },
      };
    }
    return unavailable();
  }
  if (!loaded) return signedOut();`,
        "M42h",
      );
    },
  },

  M42i: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        `  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    try {
      await env.AUTH_SESSIONS.delete(\`sess:\${hex}\`);
    } catch {
      /* best-effort */
    }
  }`,
        `  } catch {
    // MUTANT M42i: SESSION DO error on logout → 503 unavailable
    return new Response(JSON.stringify({ error: "unavailable" }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
      },
    });
  }`,
        "M42i",
      );
    },
  },

  M42j: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        `  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    try {
      await env.AUTH_SESSIONS.delete(\`sess:\${hex}\`);
    } catch {
      /* best-effort */
    }
  }`,
        `  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    try {
      await env.AUTH_SESSIONS.delete(\`sess:\${hex}\`);
    } catch {
      /* best-effort */
    }
    // MUTANT M42j: 204 but no Set-Cookie clearing in outage branch
    return authEmpty(204, {}, []);
  }`,
        "M42j",
      );
    },
  },

  M42k: {
    files: ["worker/auth/login.ts", "worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        '    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));',
        '    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier), "pw_QA_SENT", "rt_QA_SENT_1_abcdefghijklmnopqrstuvwxyz"); // MUTANT M42k',
        "M42k",
      );
      replaceOnce(
        "worker/auth/logout.ts",
        '      console.log("bsi_revoke_failed");',
        '      console.error("revoke failed", { refresh_token: refresh }); // MUTANT M42k',
        "M42k-lo",
      );
      breakAu78LogoutOutage("M42k");
    },
  },

  M42l: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        `  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    try {
      await env.AUTH_SESSIONS.delete(\`sess:\${hex}\`);
    } catch {
      /* best-effort */
    }
  }`,
        `  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    // MUTANT M42l: skip KV sess:* delete on outage
    void hex;
  }`,
        "M42l",
      );
    },
  },

  "M-Q5a": {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        `  try {
    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });
  } catch (e) {
    if (e instanceof SessionUnavailableError) {
      try {
        await deleteMeCache(env, hex);
      } catch {
        /* */
      }
      throw e;
    }
  }
  try {
    await deleteMeCache(env, hex);
  } catch {
    /* */
  }`,
        `  // MUTANT M-Q5a: KV delete and DO clear in one try, KV first
  try {
    await deleteMeCache(env, hex);
    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });
  } catch (e) {
    if (e instanceof SessionUnavailableError) throw e;
  }`,
        "M-Q5a",
      );
      breakAu78LogoutOutage("M-Q5a");
    },
  },

  "M-Q5b": {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 300, // MUTANT M-Q5b\n  });",
        "M-Q5b",
      );
      replaceOnce(
        "worker/auth/session.ts",
        "export async function deleteMeCache(env: Env, hex: string): Promise<void> {\n  await env.AUTH_SESSIONS.delete(sessKvKey(hex));\n}",
        "export async function deleteMeCache(env: Env, hex: string): Promise<void> {\n  // MUTANT M-Q5b: soft-delete — leave KV\n  void env; void hex;\n}",
        "M-Q5b-del",
      );
      breakAu78LogoutOutage("M-Q5b");
    },
  },

  M46: {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value)); // MUTANT M46",
        "M46",
      );
      breakAu78LogoutOutage("M46");
    },
  },

  "M-TTL1": {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "    expirationTtl: 60,",
        "    expirationTtl: 2592000, // MUTANT M-TTL1",
        "M-TTL1",
      );
      breakAu78LogoutOutage("M-TTL1");
    },
  },

  M47: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const reissued = now - prev > DAY_MS;\n    if (reissued) {\n      body.record.last_seen = now;\n      await this.put(aad, body.record);\n    }",
        `    // MUTANT M47: reissue / last_seen on every request
    const reissued = true;
    body.record.last_seen = now;
    await this.put(aad, body.record);
    void prev; void DAY_MS; void reissued;`,
        "M47",
      );
    },
  },

  M122: {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "    const touched = await touchSession(env, sid);\n    if (touched?.reissued) {\n      setCookies = [setHostCookie(SID_COOKIE, sid, SID_MAX_AGE)];\n    }",
        `    const touched = await touchSession(env, sid);
    // MUTANT M122: reissue cookie on every /me
    if (touched) {
      setCookies = [setHostCookie(SID_COOKIE, sid, SID_MAX_AGE)];
    }
    void touched?.reissued;`,
        "M122",
      );
    },
  },

  M123: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (now - record.created >= NINETY_DAYS_MS) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        "    // MUTANT M123: no absolute cap\n    void NINETY_DAYS_MS; void now;",
        "M123-do",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  // MUTANT M123: no absolute cap\n  void NINETY_DAYS_MS; void now;",
        "M123-act",
      );
    },
  },

  M123b: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;",
        "const NINETY_DAYS_MS = 91 * 24 * 60 * 60 * 1000; // MUTANT M123b",
        "M123b-do",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;",
        "const NINETY_DAYS_MS = 91 * 24 * 60 * 60 * 1000; // MUTANT M123b",
        "M123b-act",
      );
    },
  },

  M123c: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (now - record.created >= NINETY_DAYS_MS) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        "    if (now - record.created > NINETY_DAYS_MS) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    } // MUTANT M123c exclusive",
        "M123c-do",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  if (now - loaded.record.created > NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  } // MUTANT M123c",
        "M123c-act",
      );
    },
  },

  M123d: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (now - record.created >= NINETY_DAYS_MS) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        "    if (now - record.last_seen >= NINETY_DAYS_MS) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    } // MUTANT M123d last_seen",
        "M123d-do",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        "  if (now - loaded.record.last_seen >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  } // MUTANT M123d",
        "M123d-act",
      );
    },
  },

  "M-KVF1": {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;\n  try {\n    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });\n  } catch {\n    return unavailable();\n  }\n  if (!loaded) return signedOut();",
        `  // MUTANT M-KVF1: require KV sess:* hit before consulting the DO
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const hex = await sessionKeyHex(sid);
    const kv = await getMeCache(env, hex);
    if (!kv) return signedOut();
  }
  let loaded: Awaited<ReturnType<typeof ensureActingAccess>>;
  try {
    loaded = await ensureActingAccess(env, sid, { baseUrl: opts?.baseUrl });
  } catch {
    return unavailable();
  }
  if (!loaded) return signedOut();`,
        "M-KVF1",
      );
    },
  },

  // --- Logout / destroy ---
  M49: {
    files: ["worker/auth/session.ts", "worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        `  try {
    await deleteMeCache(env, hex);
  } catch {
    /* */
  }
  return loaded?.record ?? null;
}`,
        `  // MUTANT M49: skip KV delete
  void deleteMeCache; void hex;
  return loaded?.record ?? null;
}`,
        "M49-kv",
      );
      let u = read("worker/upstream.ts");
      const i = u.indexOf("export async function bsiRevokeToken");
      if (i < 0) throw new Error("M49: no bsiRevokeToken");
      const j = u.indexOf("\nexport async function", i + 10);
      let fn = u.slice(i, j < 0 ? u.length : j);
      if (!fn.includes("JSON.stringify")) throw new Error("M49: no stringify in revoke");
      fn = fn.replace(
        /JSON\.stringify\((\w+)\)/,
        'JSON.stringify({ ...$1, Authorization: "Bearer " + (($1).refresh_token || "") }) /* MUTANT M49 */',
      );
      write("worker/upstream.ts", u.slice(0, i) + fn + u.slice(j < 0 ? u.length : j));
    },
  },

  M51: {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        `  try {
    await deleteMeCache(env, hex);
  } catch {
    /* */
  }
  return loaded?.record ?? null;
}`,
        `  // MUTANT M51: skip KV delete
  void deleteMeCache; void hex;
  return loaded?.record ?? null;
}`,
        "M51",
      );
    },
  },

  M102: {
    files: ["worker/do/session.ts", "worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        '      if (path === "/session" && request.method === "DELETE") {\n        await this.state.storage.deleteAll();\n        return new Response(null, { status: 204 });\n      }',
        '      if (path === "/session" && request.method === "DELETE") {\n        // MUTANT M102: leave session storage\n        return new Response(null, { status: 204 });\n      }',
        "M102-do",
      );
      replaceOnce(
        "worker/auth/session.ts",
        `  try {
    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });
  } catch (e) {
    if (e instanceof SessionUnavailableError) {
      try {
        await deleteMeCache(env, hex);
      } catch {
        /* */
      }
      throw e;
    }
  }
  try {
    await deleteMeCache(env, hex);
  } catch {
    /* */
  }
  return loaded?.record ?? null;
}`,
        `  // MUTANT M102: leave DO+KV so old sid still accepted
  void doFetch; void stub; void deleteMeCache; void hex;
  return loaded?.record ?? null;
}`,
        "M102-sess",
      );
    },
  },

  "M-DO2": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        '      if (path === "/session" && request.method === "DELETE") {\n        await this.state.storage.deleteAll();\n        return new Response(null, { status: 204 });\n      }',
        '      if (path === "/session" && request.method === "DELETE") {\n        // MUTANT M-DO2: skip deleteAll; only clear alarm\n        await this.state.storage.deleteAlarm();\n        return new Response(null, { status: 204 });\n      }',
        "M-DO2",
      );
    },
  },

  // --- Throttle / signup ---
  M74: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "    st.failures += 1;\n    // After 5 recorded failures, lock subsequent attempts (AU17.1: 6th login → 429).\n    if (st.failures >= R8A_FREE) {",
        "    st.failures += 1;\n    // MUTANT M74: no backoff (lockout never set)\n    if (false && st.failures >= R8A_FREE) {",
        "M74",
      );
    },
  },

  M71: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        "  const lim = await checkSignupLimit(env, ip);\n  if (!lim.allowed) return authJson(BODY_RATE_LIMITED, 429, { \"Retry-After\": \"60\" });",
        "  // MUTANT M71: no rate limit\n  void checkSignupLimit; void ip;\n  const lim = { allowed: true as const };\n  void lim;",
        "M71",
      );
    },
  },

  M72: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        '  if (username.includes("@")) return authJson({ valid: false }, 200);',
        '  // MUTANT M72: no @ short-circuit\n  void username.includes;',
        "M72",
      );
    },
  },

  M124: {
    files: ["worker/auth/auth-rate-limit.ts"],
    apply() {
      replaceOnce(
        "worker/auth/auth-rate-limit.ts",
        "export async function checkUsernameLimit(\n  env: AuthLimitEnv,\n  ip: string,\n): Promise<{ allowed: true } | { allowed: false }> {\n  const ok = await queued(() =>\n    limitWithBinding(env.USERNAME_CHECK_LIMITER, ip, () =>\n      syncWindow(usernameWindows, ip, 20),\n    ),\n  );\n  return ok ? { allowed: true } : { allowed: false };\n}",
        `export async function checkUsernameLimit(
  env: AuthLimitEnv,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  // MUTANT M124: username check shares the 5/60 write (signup) bucket
  const ok = await queued(() =>
    limitWithBinding(env.SIGNUP_LIMITER, ip, () => syncWindow(signupWindows, ip, 5)),
  );
  return ok ? { allowed: true } : { allowed: false };
}`,
        "M124",
      );
    },
  },

  M76: {
    files: ["worker/auth/login.ts", "worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        "  const lim = await checkSignupLimit(env, ip);\n  if (!lim.allowed) return authJson(BODY_RATE_LIMITED, 429, { \"Retry-After\": \"60\" });",
        "  // MUTANT M76: remove signup limit\n  void checkSignupLimit;\n  const lim = { allowed: true as const };\n  void lim; void ip;",
        "M76",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "  const r8c = await reserveR8c(env);\n  if (!r8c.allowed) {\n    return authJson(BODY_RATE_LIMITED, 429, {\n      \"Retry-After\": String(r8c.retryAfter),\n    });\n  }",
        "  // MUTANT M76: also skip R8c\n  void reserveR8c;\n  const r8c = { allowed: true as const };\n  void r8c;",
        "M76-r8c",
      );
    },
  },

  M110: {
    files: ["worker/auth/throttle.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/throttle.ts",
        "function stub(env: Env, name: string): DurableObjectStub {\n  if (!env.LOGIN_THROTTLE) throw new ThrottleUnavailableError();\n  return env.LOGIN_THROTTLE.get(env.LOGIN_THROTTLE.idFromName(name));\n}",
        `function stub(env: Env, name: string): DurableObjectStub {
  // MUTANT M110: LOGIN_THROTTLE unbound → skip throttling (fail open)
  if (!env.LOGIN_THROTTLE) {
    return {
      fetch: async () =>
        new Response(JSON.stringify({ allowed: true, failures: 0, count: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
    } as unknown as DurableObjectStub;
  }
  return env.LOGIN_THROTTLE.get(env.LOGIN_THROTTLE.idFromName(name));
}`,
        "M110",
      );
    },
  },

  M146: {
    files: ["worker/auth/throttle.ts"],
    apply() {
      replaceOnce(
        "worker/auth/throttle.ts",
        "  } catch {\n    throw new ThrottleUnavailableError();\n  }\n  if (res.status === 503) throw new ThrottleUnavailableError();",
        `  } catch {
    // MUTANT M146: DO throw at R8c → proceed (fail open)
    return { allowed: true, count: 0, failures: 0 };
  }
  if (res.status === 503) return { allowed: true, count: 0, failures: 0 };`,
        "M146",
      );
    },
  },

  M147: {
    files: ["worker/auth/throttle.ts"],
    apply() {
      replaceOnce(
        "worker/auth/throttle.ts",
        "  try {\n    res = await stub(env, name).fetch(\n      new Request(`https://throttle.do${path}`, { method: \"POST\" }),\n    );\n  } catch {\n    throw new ThrottleUnavailableError();\n  }",
        `  try {
    // MUTANT M147: no timeout — hang on DO
    res = await stub(env, name).fetch(
      new Request(\`https://throttle.do\${path}\`, { method: "POST" }),
    );
  } catch {
    throw new ThrottleUnavailableError();
  }`,
        "M147",
      );
    },
  },

  M68: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        '  if (upstream.kind === "ok") return authJson({ status: "check_email" }, 202);',
        '  if (upstream.kind === "ok")\n    return authJson({ status: "check_email", bridge_url: "https://evil.example/bridge" /* MUTANT M68 */ }, 202);',
        "M68",
      );
    },
  },

  M23: {
    files: ["worker/comments.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (!loaded.record.bsi_access) return unavailable();",
        '  // MUTANT M23: empty access continues\n  if (!loaded.record.bsi_access) {\n    return { sid, hex: loaded.hex, access: "", record: loaded.record };\n  }',
        "M23-act",
      );
      let t = read("worker/comments.ts");
      t = t.replaceAll(
        "if (!session.access) return unavailable();",
        'if (!session.access) { session = { ...session, access: "" }; } // MUTANT M23',
      );
      write("worker/comments.ts", t);
    },
  },

  // --- Client / leaderboard ---
  "M-PV2": {
    files: ["client/src/pages/the-daily-fix/authHost.ts"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/authHost.ts",
        'export function isAuthUiHost(hostname: string = defaultHostname()): boolean {\n  return hostname === "metfix.org";\n}',
        `export function isAuthUiHost(hostname: string = defaultHostname()): boolean {
  // MUTANT M-PV2: treat preview hosts as auth UI (load reCAPTCHA unconditionally)
  return hostname === "metfix.org" || hostname.endsWith(".pages.dev") || hostname.includes("preview");
}`,
        "M-PV2",
      );
    },
  },

  M128: {
    files: ["client/src/pages/the-daily-fix/TheDailyFixPage.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/TheDailyFixPage.tsx",
        "  useEffect(() => {\n    loadJakartaSans();\n  }, []);",
        `  useEffect(() => {
    loadJakartaSans();
    // MUTANT M128: load reCAPTCHA script at page mount
    void import("./recaptcha").then((m) => m.ensureRecaptchaScript());
  }, []);`,
        "M128",
      );
    },
  },

  M18: {
    files: ["client/src/pages/the-daily-fix/Leaderboard.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/Leaderboard.tsx",
        '<span className="df-leaderboard-name">{row.public_name}</span>',
        '<span className="df-leaderboard-name" dangerouslySetInnerHTML={{ __html: row.public_name }} />',
        "M18",
      );
    },
  },
};

export default R10_OVERRIDES;
