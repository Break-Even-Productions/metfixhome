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

/**
 * R9 overrides for remaining survivors & mismatches.
 * Last-wins merge over R2–R8.
 */
export const R9_OVERRIDES = {
  // P4.5: empty access_token at login must 503 — allow empty through instead
  M23: {
    files: ["worker/auth/login.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "      typeof tok.access_token !== \"string\" ||\n      tok.access_token.length === 0 ||",
        '      typeof tok.access_token !== "string" ||\n      /* MUTANT M23 allow empty access */ false && tok.access_token.length === 0 ||',
        "M23-login",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (!record.bsi_access) return unavailable();",
        '  // MUTANT M23: empty access continues\n  if (!record.bsi_access) {\n    return { sid, hex: loaded.hex, access: "", record };\n  }',
        "M23-acting",
      );
    },
  },

  // AU7.5: invalid_grant must end session — keep record instead; AU7.6 is permanently stub-red
  M42d: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;",
        `  // MUTANT M42d: KV re-read on refresh path (AU7.5)
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    await getMeCache(env, await sessionKeyHex(sid));
  }
  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;`,
        "M42d-kv",
      );
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (\n    upstream.kind === \"http\" &&\n    (upstream.status === 400 || upstream.status === 401)\n  ) {\n    return null;\n  }",
        `  if (
    upstream.kind === "http" &&
    (upstream.status === 400 || upstream.status === 401)
  ) {
    return record; // MUTANT M42d: invalid_grant keeps session
  }`,
        "M42d-grant",
      );
    },
  },

  // AU10.4: test omits pre cookie (same Location as expiry). No-op alarm/TTL plus
  // skip pre_hash so surviving state is observable (google fetch / non-state error).
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
      // AU10.4 never sends pre — without this, expiry sabotage is masked by !pre
      replaceOnce(
        "worker/auth/google.ts",
        "  const rec = await takeOauthState(env, state);\n  const pre = getPre(request);\n  if (!rec || !pre || (await sha256Hex(pre)) !== rec.pre_hash) {\n    return new Response(null, {\n      status: 302,\n      headers: { Location: \"/?auth_error=state\", \"Cache-Control\": \"no-store\" },\n    });\n  }",
        `  const rec = await takeOauthState(env, state);
  const pre = getPre(request);
  // MUTANT M53: skip pre binding so TTL/alarm gap is observable
  if (!rec) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=state", "Cache-Control": "no-store" },
    });
  }
  void pre; void sha256Hex;`,
        "M53-pre",
      );
    },
  },

  // C5.2 requires #10 Sanity vite guard (skipped); C5.1 has no zero-hit assert
  M96: {
    ethanBlocker:
      "C5.2 is skipIf(!hasPr10SanityGuard()) — #10 vite Sanity guard not on this branch; C5.1 test never asserts unplanted hit count is zero, so full red set [C1.1,C5.1,C5.2] cannot be observed",
  },

  // W5.1 uses bsiGetHeaders; P4.4 must prefer client Authorization
  M101: {
    files: ["worker/upstream.ts", "worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        'export function bsiGetHeaders(apiKey: string): Record<string, string> {\n  return {\n    Accept: "application/json",\n    "User-Agent": UPSTREAM_USER_AGENT,\n    "X-API-Key": apiKey,\n  };\n}',
        `export function bsiGetHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
    "X-API-Key": apiKey,
    Authorization: "Bearer EVIL", // MUTANT M101
  };
}`,
        "M101-get",
      );
      replaceOnce(
        "worker/comments.ts",
        "    accessToken: signedIn ? acting.access : undefined,",
        '    accessToken: request.headers.get("Authorization")?.replace(/^Bearer\\s+/i, "") || (signedIn ? acting.access : undefined), // MUTANT M101',
        "M101-fwd",
      );
    },
  },

  // P9.2 harness DELETEs SESSION DO directly — no-op DELETE; also skip session.ts destroy for AU8.4
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
        '  try {\n    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });\n  } catch {\n    /* best-effort */\n  }\n  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}',
        "  // MUTANT M102: leave DO+KV so old sid still accepted\n  void doFetch; void stub; void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M102-sess",
      );
    },
  },

  // Remove global layer: no deny + double-count + spend before shape + signup spends
  M103: {
    files: [
      "worker/do/login-throttle.ts",
      "worker/auth/login.ts",
      "worker/auth/signup.ts",
    ],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 999999; // MUTANT M103 remove practical cap",
        "M103-lim",
      );
      replaceOnce(
        "worker/do/login-throttle.ts",
        "    times.push(now);\n    await this.state.storage.put(\"global\", times);\n    return json({ allowed: true, count: times.length });",
        '    times.push(now);\n    times.push(now); // MUTANT M103 broken global accounting\n    await this.state.storage.put("global", times);\n    return json({ allowed: true, count: times.length });',
        "M103-dbl",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "): Promise<Response> {\n  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);",
        `): Promise<Response> {
  // MUTANT M103: spend R8c before shape / host checks
  try { await reserveR8c(env); } catch { /* */ }
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);`,
        "M103-early",
      );
      const sig = read("worker/auth/signup.ts");
      const idx = sig.indexOf("export async function handleSignup");
      if (idx < 0) throw new Error("M103: no handleSignup");
      const promiseBrace = sig.indexOf("): Promise<Response> {", idx);
      if (promiseBrace < 0) throw new Error("M103: no signup body");
      const insertAt = promiseBrace + "): Promise<Response> {".length;
      write(
        "worker/auth/signup.ts",
        sig.slice(0, insertAt) +
          "\n  try { const { reserveR8c } = await import(\"./throttle\"); await reserveR8c(env); } catch { /* MUTANT M103 */ }\n" +
          sig.slice(insertAt),
      );
    },
  },

  // Cap 30 + spend R8c before shape (AU17.9)
  M104: {
    files: ["worker/do/login-throttle.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 30; // MUTANT M104",
        "M104-lim",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "): Promise<Response> {\n  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);",
        `): Promise<Response> {
  // MUTANT M104: spend R8c before shape (malformed spends)
  try { await reserveR8c(env); } catch { /* */ }
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);`,
        "M104-early",
      );
    },
  },

  // Non-atomic: get without delete so concurrent callbacks both succeed; raw state name for AU10.7
  M142: {
    files: ["worker/do/oauth-state.ts", "worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        const rec = await this.state.storage.get<OauthStateRecord>(KEY);\n        await this.state.storage.deleteAll();\n        await this.state.storage.deleteAlarm();\n        if (!rec) return json({ error: \"absent\" }, 404);",
        `        // MUTANT M142: non-atomic get — no delete (replay wins both)
        const rec = await this.state.storage.get<OauthStateRecord>(KEY);
        if (!rec) return json({ error: "absent" }, 404);`,
        "M142-take",
      );
      const g = read("worker/auth/google.ts");
      if (!g.includes("${await sha256Hex(state)}")) {
        throw new Error("M142: sha256Hex(state) naming not found");
      }
      write(
        "worker/auth/google.ts",
        g.split("${await sha256Hex(state)}").join("${state} /* MUTANT M142 */"),
      );
    },
  },
};
export default R9_OVERRIDES;
