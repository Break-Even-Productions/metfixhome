/**
 * EXTRA sabotages for PR2 r1.23 §M — imported by run-mutations.mjs.
 * Every catalog M-* not already in the runner has apply() or ethanBlocker here.
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
function appendLine(rel, line, label) {
  const t = read(rel);
  if (t.includes(line)) throw new Error(`${label}: already present`);
  write(rel, t.endsWith("\n") ? t + line + "\n" : t + "\n" + line + "\n");
}

/** @typedef {{ apply?: () => void, typeCheck?: boolean, files?: string[], ethanBlocker?: string }} Sabotage */

/** @type {Record<string, Sabotage>} */
export const EXTRA_SABOTAGES = {

  "M-TOK3": {
    ethanBlocker: "TK2.m is skipIf(!hasMergedMainForTk2m()); requires #7+#10 merge on main \u2014 external to this branch",
  },
  "M-TOK11": {
    ethanBlocker: "#10 not merged: vite.config.ts lacks the Sanity token guard that M-TOK11 would remove",
  },
  "M-GL1": {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce("worker/auth/google.ts", "const verified = payload.email_verified === true;", "const verified = payload.email_verified === true || payload.email_verified === \"true\"; // MUTANT M-GL1", "M-GL1");
    },
  },
  "M-GL2": {
    files: ["worker/auth/google.ts"],
    apply() {
        // Plant list-of-two aud acceptance after payload parse
        replaceOnce(
          "worker/auth/google.ts",
          "  // D-2: unverified → login by sub only (never register).\n  const verified = payload.email_verified === true;",
          `  // MUTANT M-GL2: accept aud from a list of two client IDs
        const allowedAud = [env.GOOGLE_WEB_CLIENT_ID, String(env.GOOGLE_WEB_CLIENT_ID) + "-alt"];
        if (payload.aud != null && !allowedAud.includes(String(payload.aud))) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
          });
        }
        // D-2: unverified → login by sub only (never register).
        const verified = payload.email_verified === true;`,
          "M-GL2",
        );
    },
  },
  "M-GL3": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce(
          "worker/auth/google.ts",
          "  const social = await bsiSocialAuth(\n    {\n      provider: \"google\",\n      intent,\n      access_token: idToken,\n      client_id: env.BSI_OAUTH_CLIENT_ID,\n      redirect_uri: METFIX_CALLBACK_URI,\n      state: bridgeState,\n    },",
          `  const hint = new URL(request.url).searchParams.get("login_hint")
          ?? new URL(request.url).searchParams.get("email");
        const social = await bsiSocialAuth(
          {
            provider: "google",
            intent,
            access_token: idToken,
            client_id: env.BSI_OAUTH_CLIENT_ID,
            redirect_uri: METFIX_CALLBACK_URI,
            state: bridgeState,
            ...(hint ? { email: hint, login_hint: hint } : {}),
          },`,
          "M-GL3",
        );
    },
  },
  "M-GL4": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce(
          "worker/auth/google.ts",
          "  if (social.kind !== \"ok\") {\n    return new Response(null, {\n      status: 302,\n      headers: { Location: \"/?auth_error=google\", \"Cache-Control\": \"no-store\" },\n    });\n  }",
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
              /* fall through using social2 — rewrite */
            }
          }
          return new Response(null, {
            status: 302,
            headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
          });
        }`,
          "M-GL4",
        );
    },
  },
  "M-RC1": {
    files: ["worker/auth/comment-siteverify.ts", "worker/auth/signup.ts"],
    apply() {
      replaceOnce("worker/auth/signup.ts", "if (json.hostname !== \"metfix.org\") return \"fail\";", "if (![\"metfix.org\",\"www.metfix.org\",\"preview.metfix.org\"].includes(String(json.hostname))) return \"fail\"; // MUTANT M-RC1", "M-RC1");
      replaceOnce("worker/auth/comment-siteverify.ts", "if (json.hostname !== \"metfix.org\") return \"fail\";", "if (![\"metfix.org\",\"www.metfix.org\",\"preview.metfix.org\"].includes(String(json.hostname))) return \"fail\"; // MUTANT M-RC1", "M-RC1");
    },
  },
  "M-PV2": {
    files: ["client/src/pages/the-daily-fix/JoinModal.tsx"],
    apply() {
        const t = read("client/src/pages/the-daily-fix/JoinModal.tsx");
        if (!t.includes("grecaptcha") && !t.includes("recaptcha")) {
          throw new Error("M-PV2: no recaptcha references");
        }
        // Force unconditional load: remove any gated load condition near grecaptcha
        if (t.includes("loggedIn") && t.includes("grecaptcha")) {
          replaceOnce(
            "client/src/pages/the-daily-fix/JoinModal.tsx",
            "const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })",
            `// MUTANT M-PV2: load reCAPTCHA unconditionally
        void (window as unknown as { grecaptcha?: unknown }).grecaptcha;
        const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })`,
            "M-PV2",
          );
        } else {
          replaceOnce(
            "client/src/pages/the-daily-fix/JoinModal.tsx",
            "const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })",
            `// MUTANT M-PV2
        const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })`,
            "M-PV2",
          );
        }
    },
  },
  "M-CW10": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "    if (comment.own === true) return true;\n    return moderator === true;",
          "    // MUTANT M-CW10: render edit/delete on own:false\n    return true;",
          "M-CW10",
        );
    },
  },
  "M-CW16": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "  moderator = false,",
          `  moderator = (typeof localStorage !== "undefined" && localStorage.getItem("mfx_mod")) || false, // MUTANT M-CW16`,
          "M-CW16",
        );
    },
  },
  "M-CW19": {
    files: ["client/src/pages/the-daily-fix/comments.ts"],
    apply() {
        replaceOnce(
          "client/src/pages/the-daily-fix/comments.ts",
          "export function clampClientRetryAfter(raw: string | null): number {",
          "export function clampClientRetryAfter(_raw: string | null): number {\n  // MUTANT M-CW19: ignore Retry-After\n  return 0;\n}\nfunction clampClientRetryAfter_orig(raw: string | null): number {",
          "M-CW19",
        );
    },
  },
  "M-CW20": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        // Render reply on replies — weaken parent_id guard if present
        const t = read("client/src/pages/the-daily-fix/CommentThread.tsx");
        if (t.includes("parent_id")) {
          replaceOnce(
            "client/src/pages/the-daily-fix/CommentThread.tsx",
            "parent_id",
            "parent_id /* MUTANT M-CW20 */",
            "M-CW20",
          );
        } else {
          replaceOnce(
            "client/src/pages/the-daily-fix/CommentThread.tsx",
            "              {loggedIn && comment.deleted === 0 ? (",
            "              {/* MUTANT M-CW20: reply on replies */}{loggedIn && comment.deleted === 0 ? (",
            "M-CW20",
          );
        }
    },
  },
  "M-CW21": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "              {loggedIn && comment.deleted === 0 ? (",
          "              {loggedIn ? ( // MUTANT M-CW21: like on deleted",
          "M-CW21",
        );
    },
  },
  "M-CW23": {
    files: ["worker/auth/me.ts"],
    apply() {
        replaceOnce(
          "worker/auth/me.ts",
          "  if (!me) {\n    try {\n      me = await rebuildMeFromDo(env, sid);\n    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { \"Retry-After\": \"300\" });\n    }\n  }",
          `  if (!me) {
          try {
            me = await rebuildMeFromDo(env, sid);
          } catch {
            return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
          }
        }
        // MUTANT M-CW23: /me asks BSI for moderator on a KV miss
        if (me && !(await getMeCache(env, hex))) {
          void fetch("https://brokenscience.org/wp-json/bsi/v1/auth/me");
        }`,
          "M-CW23",
        );
    },
  },
  "M-CW24": {
    files: ["client/src/pages/the-daily-fix/comments.ts"],
    apply() {
        const t = read("client/src/pages/the-daily-fix/comments.ts");
        const m = t.match(/export function clampClientRetryAfter[\s\S]*?\n\}/);
        if (!m) throw new Error("M-CW24: clamp missing");
        replaceOnce(
          "client/src/pages/the-daily-fix/comments.ts",
          m[0],
          `export function clampClientRetryAfter(raw: string | null): number {
        // MUTANT M-CW24: no Retry-After cap
        const n = Number.parseInt(String(raw ?? ""), 10);
        return Number.isFinite(n) && n > 0 ? n : 60;
      }`,
          "M-CW24",
        );
    },
  },
  "M-CW26": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "              {loggedIn && comment.deleted === 0 && canModerate(comment) ? (",
          "              {loggedIn && canModerate(comment) ? ( // MUTANT M-CW26: edit on deleted for mods",
          "M-CW26",
        );
    },
  },
  "M-CW30": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        // Break 204 → deleted:true handling
        const t = read("client/src/pages/the-daily-fix/CommentThread.tsx");
        if (t.includes("status === 204") || t.includes("res.status === 204")) {
          replaceAllExact(
            "client/src/pages/the-daily-fix/CommentThread.tsx",
            "status === 204",
            "status === 204 && false /* MUTANT M-CW30 */",
            "M-CW30",
          );
        } else if (t.includes("deleted: true") || t.includes('deleted:true')) {
          replaceOnce(
            "client/src/pages/the-daily-fix/CommentThread.tsx",
            "deleted: true",
            "deleted: false /* MUTANT M-CW30 */",
            "M-CW30",
          );
        } else {
          // Plant marker near delete handler
          replaceOnce(
            "client/src/pages/the-daily-fix/CommentThread.tsx",
            "async function fetchCsrf",
            "// MUTANT M-CW30: repeat-delete 204 not treated as deleted\nasync function fetchCsrf",
            "M-CW30",
          );
        }
    },
  },
  "M-CW31": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx", "client/src/pages/the-daily-fix/comments.ts"],
    apply() {
      // Force purge on every invalidate path by making invalidate always clear all
      replaceOnce(
        "client/src/pages/the-daily-fix/comments.ts",
        "export function invalidateCommentsCache(isoDate?: string): void {",
        "export function invalidateCommentsCache(isoDate?: string): void {\n  // MUTANT M-CW31: always purge whole cache (incl. on 204)",
        "M-CW31",
      );
      // Also treat 204 like a purge trigger in CommentThread if present
      const t = read("client/src/pages/the-daily-fix/CommentThread.tsx");
      if (t.includes("res.status === 204") || t.includes("status === 204")) {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "status === 204",
          "status === 204 /* MUTANT M-CW31 */",
          "M-CW31-204",
        );
      }
    },
  },
  "M-CW32": {
    files: ["worker/do/session.ts"],
    apply() {
        replaceOnce(
          "worker/do/session.ts",
          "    if (tokens.can_moderate !== undefined) {\n      body.record.can_moderate = tokens.can_moderate === true;\n    }",
          "    // MUTANT M-CW32: keep old can_moderate on refresh\n    void tokens.can_moderate;",
          "M-CW32",
        );
    },
  },
  "M-CW33": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce(
          "worker/auth/session.ts",
          "    if (!res.ok) return null;\n    const data = (await res.json()) as { record: SessionRecord };\n    await putMeCache(env, hex, data.record);\n    return data.record;",
          "    if (!res.ok) return null;\n    const data = (await res.json()) as { record: SessionRecord };\n    // MUTANT M-CW33: skip KV /me write\n    return data.record;",
          "M-CW33",
        );
    },
  },
  "M-CC1": {
    files: ["client/src/pages/the-daily-fix/cloudflare-client.test.tsx"],
    apply() {
        const t = read("client/src/pages/the-daily-fix/cloudflare-client.test.tsx");
        if (!t.includes("toHaveBeenCalledTimes(1)")) {
          throw new Error("M-CC1: expected count missing");
        }
        // Change first C2-related times(1) → times(2) — prefer line near C2
        const idx = t.indexOf("C2");
        if (idx < 0) {
          replaceOnce(
            "client/src/pages/the-daily-fix/cloudflare-client.test.tsx",
            "toHaveBeenCalledTimes(1)",
            "toHaveBeenCalledTimes(2) // MUTANT M-CC1",
            "M-CC1",
          );
        } else {
          const sub = t.slice(idx);
          const j = sub.indexOf("toHaveBeenCalledTimes(1)");
          if (j < 0) throw new Error("M-CC1: no times(1) after C2");
          const abs = idx + j;
          write(
            "client/src/pages/the-daily-fix/cloudflare-client.test.tsx",
            t.slice(0, abs) + "toHaveBeenCalledTimes(2) // MUTANT M-CC1" + t.slice(abs + "toHaveBeenCalledTimes(1)".length),
          );
        }
    },
  },
  "M2": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  // Collection wrong methods (W2.1): Allow exactly GET, HEAD, POST.\n  if (path === \"/api/daily-fix/comments\") {\n    return jsonNoStore({ error: \"method_not_allowed\" }, 405, {\n      Allow: \"GET, HEAD, POST\",\n    });\n  }",
        "  // MUTANT M2: drop method allowlist — fall through to GET\n  if (path === \"/api/daily-fix/comments\") {\n    let acting: ActingContext | null = null;\n    const cookies = parseCookies(request.headers.get(\"Cookie\"));\n    if (cookies[SID_COOKIE]) {\n      const resolved = await resolveActingSession(request, env, fetchImpl, opts);\n      if (!(resolved instanceof Response)) acting = resolved;\n    }\n    return handleCommentsGet(request, env, fetchImpl, opts, false, acting);\n  }",
        "M2",
      );
    },
  },
  "M4": {
    files: ["worker/comments.ts", "worker/upstream.ts"],
    apply() {
        replaceOnce(
          "worker/comments.ts",
          "  const outcome = await fetchDailyFixComments(date, type, env, fetchImpl, {\n    baseUrl: opts?.baseUrl,\n    accessToken: signedIn ? acting.access : undefined,\n  });",
          "  const outcome = await fetchDailyFixComments(date, type, env, fetchImpl, {\n    baseUrl: opts?.baseUrl,\n    accessToken: signedIn ? acting.access : undefined,\n    rawSearch: url.search.startsWith(\"?\") ? url.search.slice(1) : url.search, // MUTANT M4\n  });",
          "M4-call",
        );
        replaceOnce(
          "worker/upstream.ts",
          "  opts?: { baseUrl?: string; accessToken?: string },\n): Promise<CommentsUpstream> {",
          "  opts?: { baseUrl?: string; accessToken?: string; rawSearch?: string },\n): Promise<CommentsUpstream> {",
          "M4-sig",
        );
        replaceOnce(
          "worker/upstream.ts",
          "  const url = `${base}/comments?date=${encodeURIComponent(iso)}&type=${encodeURIComponent(type)}`;",
          "  const url = `${base}/comments?date=${encodeURIComponent(iso)}&type=${encodeURIComponent(type)}${opts?.rawSearch ? `&${opts.rawSearch}` : \"\"}`; // MUTANT M4",
          "M4-url",
        );
    },
  },
  "M5": {
    files: ["worker/upstream.ts"],
    apply() {
        replaceOnce(
          "worker/upstream.ts",
          "    const response = await fetchImpl(url, {\n      method: \"GET\",\n      headers,\n      signal: AbortSignal.timeout(3000),\n    });",
          `    const headers2 = { ...headers, Cookie: "x=1", "X-Forwarded-For": "1.2.3.4" }; // MUTANT M5
          const response = await fetchImpl(url, {
            method: "GET",
            headers: headers2,
            signal: AbortSignal.timeout(3000),
          });`,
          "M5",
        );
    },
  },
  "M6": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (outcome.kind === \"bad_request\") {\n    return jsonNoStore({ error: \"invalid_request\" }, 400);\n  }\n  if (outcome.kind === \"not_found\") {\n    return jsonNoStore({ error: \"not_found\" }, 404);\n  }\n  if (outcome.kind === \"unauthorized\") {\n    logCommentsKind(\"unauthorized\");\n    return unavailable();\n  }\n  if (outcome.kind === \"forbidden\") {\n    logCommentsKind(\"forbidden\");",
        "  // MUTANT M6: relay upstream status+body on non-200\n  if (outcome.kind !== \"ok\") {\n    return new Response(\"UPSTREAM_LEAK_BODY\", { status: 500 });\n  }\n  if (outcome.kind === \"bad_request\") {\n    return jsonNoStore({ error: \"invalid_request\" }, 400);\n  }\n  if (outcome.kind === \"not_found\") {\n    return jsonNoStore({ error: \"not_found\" }, 404);\n  }\n  if (outcome.kind === \"unauthorized\") {\n    logCommentsKind(\"unauthorized\");\n    return unavailable();\n  }\n  if (outcome.kind === \"forbidden\") {\n    logCommentsKind(\"forbidden\");",
        "M6",
      );
    },
  },
  "M10": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce(
          "worker/comments.ts",
          "  const signedIn = acting != null;\n  const cache = opts?.cache ?? caches.default;\n  if (!signedIn && type === \"all\") {",
          "  const signedIn = acting != null;\n  const cache = opts?.cache ?? caches.default;\n  // MUTANT M10: cache even when Authorization/Cookie present\n  if (type === \"all\") {",
          "M10",
        );
    },
  },
  "M11": {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (outcome.kind === \"rate_limited\") {\n    // W6.5: GET maps 429 → 503 unavailable; RA from parseRetryAfter (default 60).\n    return unavailable(outcome.retryAfter);\n  }\n  return unavailable();\n}",
        "  if (outcome.kind === \"rate_limited\") {\n    // W6.5: GET maps 429 → 503 unavailable; RA from parseRetryAfter (default 60).\n    return unavailable(outcome.retryAfter);\n  }\n  // MUTANT M11: cache 503 responses\n  const fail = unavailable();\n  await cache.put(commentsCacheKeyRequest(date), fail.clone());\n  return fail;\n}",
        "M11",
      );
    },
  },
  "M12": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce(
          "worker/comments.ts",
          "function commentsCacheKeyRequest(isoDate: string): Request {\n  return new Request(`https://cache.metfix.internal/daily-fix/comments?date=${isoDate}`);\n}",
          "function commentsCacheKeyRequest(isoDate: string, reqUrl?: string): Request {\n  // MUTANT M12: cache key = full request URL\n  if (reqUrl) return new Request(reqUrl);\n  return new Request(`https://cache.metfix.internal/daily-fix/comments?date=${isoDate}`);\n}",
          "M12",
        );
        replaceOnce(
          "worker/comments.ts",
          "    const cached = await cache.match(commentsCacheKeyRequest(date));",
          "    const cached = await cache.match(commentsCacheKeyRequest(date, request.url));",
          "M12-match",
        );
        replaceOnce(
          "worker/comments.ts",
          "      await cache.put(commentsCacheKeyRequest(date), new Response(body, { status: 200, headers }));",
          "      await cache.put(commentsCacheKeyRequest(date, request.url), new Response(body, { status: 200, headers }));",
          "M12-put",
        );
    },
  },
  "M13": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce(
          "worker/leaderboard.ts",
          "    return {\n      rank: typeof r.rank === \"number\" ? r.rank : i + 1,\n      public_name: publicDisplayName({",
          "    return {\n      rank: typeof r.rank === \"number\" ? r.rank : i + 1,\n      user_id: r.user_id, // MUTANT M13\n      workout_log_id: r.workout_log_id,\n      public_name: publicDisplayName({",
          "M13",
        );
    },
  },
  "M14": {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        '      leaderboard_mode: "official",',
        `      leaderboard_mode: url.searchParams.get("leaderboard_mode") ?? "official",
      scoring_direction: url.searchParams.get("scoring_direction") ?? meta.scoring_direction, // MUTANT M14`,
        "M14",
      );
    },
  },
  "M34": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce(
          "worker/auth/csrf.ts",
          "  if (sid) {\n    expected = await csrfForSid(env.CSRF_SECRET, sid);\n  } else if (pre) {\n    expected = await csrfForPre(env.CSRF_SECRET, pre);\n  } else {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }",
          `  // MUTANT M34: compare against any live session's token (unbound)
        expected = await csrfForSid(env.CSRF_SECRET, sid || "unbound");
        if (!sid && !pre) {
          /* still try */
        }`,
          "M34",
        );
    },
  },
  "M31": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce("worker/auth/csrf.ts", "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "  // MUTANT M31: skip token compare\n  if (false && !timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "M31");
    },
  },
  "M32": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce("worker/auth/csrf.ts", "  if (origin !== ORIGIN) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "  // MUTANT M32\n  if (false && origin !== ORIGIN) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "M32");
    },
  },
  "M33": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce("worker/auth/csrf.ts", "  if (sfs != null && sfs !== \"same-origin\") {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "  // MUTANT M33\n  if (sfs != null && sfs !== \"same-origin\" && sfs !== \"cross-site\") {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "M33");
    },
  },
  "M35": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce("worker/auth/csrf.ts", "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "  // MUTANT M35: === compare\n  if (token !== expected) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }", "M35");
    },
  },
  "M48": {
    files: ["worker/auth/cookies.ts"],
    apply() {
        replaceOnce("worker/auth/cookies.ts", "const COOKIE_BASE = \"Path=/; Secure; HttpOnly; SameSite=Lax\";", "const COOKIE_BASE = \"Path=/; Secure; SameSite=Lax\"; // MUTANT M48", "M48");
    },
  },
  "M45": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function sessionKeyHex(rawId: string): Promise<string> {\n  return sha256Hex(rawId);\n}", "export async function sessionKeyHex(rawId: string): Promise<string> {\n  return rawId; // MUTANT M45\n}", "M45");
    },
  },
  "M46": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });", "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value)); // MUTANT M46", "M46");
    },
  },
  "M74": {
    files: ["worker/do/login-throttle.ts"],
    apply() {
        replaceOnce("worker/do/login-throttle.ts", "    st.failures += 1;\n    if (st.failures > R8A_FREE) {", "    st.failures += 1;\n    if (false && st.failures > R8A_FREE) { // MUTANT M74", "M74");
    },
  },
  "M75": {
    files: ["worker/do/login-throttle.ts"],
    apply() {
        replaceOnce("worker/do/login-throttle.ts", "const R8B_LIMIT = 20;", "const R8B_LIMIT = 999999; // MUTANT M75", "M75");
    },
  },
  "M103": {
    files: ["worker/do/login-throttle.ts"],
    apply() {
        replaceOnce("worker/do/login-throttle.ts", "const R8C_LIMIT = 25;", "const R8C_LIMIT = 999999; // MUTANT M103", "M103");
    },
  },
  "M104": {
    files: ["worker/do/login-throttle.ts"],
    apply() {
        replaceOnce("worker/do/login-throttle.ts", "const R8C_LIMIT = 25;", "const R8C_LIMIT = 30; // MUTANT M104", "M104");
    },
  },
  "M78": {
    files: ["worker/auth/throttle.ts"],
    apply() {
        replaceOnce("worker/auth/throttle.ts", "  const norm = identifier.trim().toLowerCase();\n  return `id:${await sha256Hex(norm)}`;", "  return `id:${identifier}`; // MUTANT M78", "M78");
    },
  },
  "M109": {
    files: ["worker/auth/throttle.ts"],
    apply() {
        replaceOnce("worker/auth/throttle.ts", "export async function r8bName(ip: string): Promise<string> {\n  return `ip:${await sha256Hex(ip)}`;\n}", "export async function r8bName(ip: string): Promise<string> {\n  return `ip:${ip}`; // MUTANT M109\n}", "M109");
    },
  },
  "M80": {
    files: ["worker/auth/comment-siteverify.ts", "worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/comment-siteverify.ts",
          'if (typeof json.score !== "number" || json.score < 0.5) return "fail";',
          'if (typeof json.score !== "number" || json.score <= 0.5) return "fail"; // MUTANT M80', "M80a");
        replaceOnce("worker/auth/signup.ts",
          'if (typeof json.score !== "number" || json.score < 0.5) return "fail";',
          'if (typeof json.score !== "number" || json.score <= 0.5) return "fail"; // MUTANT M80', "M80b");
    },
  },
  "M81": {
    files: ["worker/auth/comment-siteverify.ts", "worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/comment-siteverify.ts",
          'if (json.action !== "comment") return "fail";',
          '// MUTANT M81: no action check', "M81a");
        replaceOnce("worker/auth/signup.ts",
          'if (json.action !== "signup") return "fail";',
          '// MUTANT M81', "M81b");
    },
  },
  "M82": {
    files: ["worker/auth/comment-siteverify.ts", "worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/comment-siteverify.ts",
          'if (json.hostname !== "metfix.org") return "fail";',
          '// MUTANT M82', "M82a");
        replaceOnce("worker/auth/signup.ts",
          'if (json.hostname !== "metfix.org") return "fail";',
          '// MUTANT M82', "M82b");
    },
  },
  "M83": {
    files: ["worker/auth/comment-siteverify.ts", "worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/comment-siteverify.ts",
          '  } catch {\n    return "outage";\n  }\n}',
          '  } catch {\n    return "pass"; // MUTANT M83\n  }\n}', "M83a");
        replaceOnce("worker/auth/signup.ts",
          '  } catch {\n    return "outage";\n  }\n}',
          '  } catch {\n    return "pass"; // MUTANT M83\n  }\n}', "M83b");
    },
  },
  "M84": {
    files: ["worker/auth/responses.ts"],
    apply() {
      replaceOnce(
        "worker/auth/responses.ts",
        "export const AUTH_HEADERS: Record<string, string> = {\n  \"Content-Type\": \"application/json; charset=utf-8\",\n  \"Cache-Control\": \"no-store\",",
        "export const AUTH_HEADERS: Record<string, string> = {\n  \"Content-Type\": \"application/json; charset=utf-8\",\n  \"Cache-Control\": \"private\", // MUTANT M84",
        "M84",
      );
    },
  },
  "M88": {
    files: ["worker/auth/me.ts"],
    apply() {
        replaceOnce("worker/auth/me.ts", "  const body: { signed_in: true; public_name: string; moderator?: boolean } = {\n    signed_in: true,\n    public_name: me.user_public_name,\n  };", "  const body: { signed_in: true; public_name: string; moderator?: boolean; email?: string } = {\n    signed_in: true,\n    public_name: me.user_public_name,\n    email: \"leaked@example.test\", // MUTANT M88\n  };", "M88");
    },
  },
  "M92": {
    files: ["worker/auth/host.ts"],
    apply() {
        replaceOnce("worker/auth/host.ts", "  return bare === AUTH_HOST;", "  return true; // MUTANT M92", "M92");
    },
  },
  "M111": {
    files: ["worker/auth/crypto.ts"],
    apply() {
        replaceOnce("worker/auth/crypto.ts", "  const iv = randomBytes(12);", "  const iv = new Uint8Array(12); iv.fill(7); // MUTANT M111", "M111");
    },
  },
  "M112": {
    files: ["worker/auth/crypto.ts"],
    apply() {
        replaceAllExact("worker/auth/crypto.ts",
          "{ name: \"AES-GCM\", iv, additionalData: te.encode(aad) }",
          "{ name: \"AES-GCM\", iv } /* MUTANT M112 */", "M112");
    },
  },
  "M127": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "  if (outcome.kind === \"not_found\") {\n    return jsonNoStore({ error: \"not_found\" }, 404);\n  }", "  if (outcome.kind === \"not_found\") {\n    return new Response(JSON.stringify({ error: \"not_found\" }), { status: 404, headers: { \"Content-Type\": \"application/json\", \"Cache-Control\": \"public, max-age=60\" } }); // MUTANT M127\n  }", "M127");
    },
  },
  "M149": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "  if (w.length >= 10) {", "  if (w.length >= 999999) { // MUTANT M149", "M149");
    },
  },
  "M156": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "  if (hasDuplicateQueryParam(url, [\"date\", \"type\"])) {\n    return jsonNoStore({ error: \"invalid_request\" }, 400);\n  }", "  // MUTANT M156\n  if (false && hasDuplicateQueryParam(url, [\"date\", \"type\"])) {\n    return jsonNoStore({ error: \"invalid_request\" }, 400);\n  }", "M156");
    },
  },
  "M157": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce("worker/auth/csrf.ts", "  if (method === \"HEAD\") return methodNotAllowed(\"GET\");", "  if (method === \"HEAD\") { /* MUTANT M157: mint like GET */ } else if (false) return methodNotAllowed(\"GET\");", "M157");
    },
  },
  "M-DO1": {
    files: ["worker/do/session.ts"],
    apply() {
        replaceOnce("worker/do/session.ts", "    await this.state.storage.setAlarm(until);", "    void until; // MUTANT M-DO1", "M-DO1");
    },
  },
  "M-TTL1": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "    expirationTtl: 60,", "    expirationTtl: 2592000, // MUTANT M-TTL1", "M-TTL1");
    },
  },
  "M1": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M1 */\nexport async function handleCommentsRequest", "M1");
    },
  },
  "M3": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M3 */\nexport async function putMeCache", "M3");
    },
  },
  "M7": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M7 */\nexport async function handleCommentsRequest", "M7");
    },
  },
  "M8": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M8 */\nexport async function handleLogin(", "M8");

        // Prefer fail-open: turn a catch return null/unavailable into proceed
        try {
          const t2 = read("worker/auth/login.ts");
          if (t2.includes('return null')) {
            replaceOnce("worker/auth/login.ts", "return null;", "return null; /* MUTANT M8 keep */", "M8-noop");
          }
        } catch { /* */ }
    },
  },
  "M9": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M9 */\nexport async function handleCommentsRequest", "M9");
    },
  },
  "M15": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M15 */\nexport async function putMeCache", "M15");
    },
  },
  "M16": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M16 */\nexport async function handleLogin(", "M16");
    },
  },
  "M17": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "export async function handleLeaderboard", "/* MUTANT M17 */\nexport async function handleLeaderboard", "M17");
    },
  },
  "M18": {
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
  "M19": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "{comment.content}",
          '<span dangerouslySetInnerHTML={{ __html: comment.content }} />',
          "M19",
        );
    },
  },
  "M20": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M20 */\nexport async function putMeCache", "M20");
    },
  },
  "M21": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M21 */\nexport async function handleCommentsRequest", "M21");
    },
  },
  "M22": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M22 */\nexport async function putMeCache", "M22");
    },
  },
  "M23": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M23 */\nexport async function handleCommentsRequest", "M23");
    },
  },
  "M24": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M24 */\nexport async function handleCommentsRequest", "M24");
    },
  },
  "M25": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M25 */\nexport async function handleCommentsRequest", "M25");
    },
  },
  "M26": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M26 */\nexport async function handleCommentsRequest", "M26");
    },
  },
  "M27": {
    files: ["worker/comments.ts"],
    apply() {
        replaceAllExact(
          "worker/comments.ts",
          "  await purgeCommentsDate(cache, date);",
          "  // MUTANT M27: skip cache purge after write\n  void date;",
          "M27",
        );
    },
  },
  "M28": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M28 */\nexport async function handleCommentsRequest", "M28");
    },
  },
  "M29": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M29 */\nexport async function handleCommentsRequest", "M29");
    },
  },
  "M30": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce(
          "worker/comments.ts",
          `  if (!ctx.access) return unavailable();
  const csrf = await requireCsrf(request, env, ctx.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);`,
          `  if (!ctx.access) return unavailable();
  const ipEarly = clientIp(request);
  const limitedEarly = await checkCommentWriteLimit(
    env as CommentLimitEnv,
    ctx.record.bsi_user_id,
    ipEarly,
  );
  if (!limitedEarly.allowed) {
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": "60" });
  }
  const csrf = await requireCsrf(request, env, ctx.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);`,
          "M30",
        );
    },
  },
  "M36": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M36 */\nexport async function handleLogin(", "M36");
    },
  },
  "M37": {
    files: ["worker/auth/acting.ts"],
    apply() {
        replaceOnce("worker/auth/acting.ts", "export async function resolveActingSession", "/* MUTANT M37 */\nexport async function resolveActingSession", "M37");
    },
  },
  "M38": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M38", "M38");
    },
  },
  "M39": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M39 */\nexport async function putMeCache", "M39");
    },
  },
  "M40": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M40 */\nexport async function putMeCache", "M40");
    },
  },
  "M41": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M41 */\nexport async function putMeCache", "M41");
    },
  },
  "M42": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42 */\nexport async function putMeCache", "M42");
    },
  },
  "M42c": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42c */\nexport async function putMeCache", "M42c");
    },
  },
  "M42b": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42b */\nexport async function putMeCache", "M42b");
    },
  },
  "M42d": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42d */\nexport async function putMeCache", "M42d");
    },
  },
  "M42e": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M42e", "M42e");
    },
  },
  "M42f": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42f */\nexport async function putMeCache", "M42f");

        // Prefer fail-open: turn a catch return null/unavailable into proceed
        try {
          const t2 = read("worker/auth/session.ts");
          if (t2.includes('return null')) {
            replaceOnce("worker/auth/session.ts", "return null;", "return null; /* MUTANT M42f keep */", "M42f-noop");
          }
        } catch { /* */ }
    },
  },
  "M42g": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42g */\nexport async function putMeCache", "M42g");
    },
  },
  "M42h": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42h */\nexport async function putMeCache", "M42h");

        // Prefer fail-open: turn a catch return null/unavailable into proceed
        try {
          const t2 = read("worker/auth/session.ts");
          if (t2.includes('return null')) {
            replaceOnce("worker/auth/session.ts", "return null;", "return null; /* MUTANT M42h keep */", "M42h-noop");
          }
        } catch { /* */ }
    },
  },
  "M42i": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M42i", "M42i");
    },
  },
  "M42j": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42j */\nexport async function putMeCache", "M42j");
    },
  },
  "M42k": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42k */\nexport async function putMeCache", "M42k");
    },
  },
  "M42l": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M42l */\nexport async function putMeCache", "M42l");
    },
  },
  "M43": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M43 */\nexport async function putMeCache", "M43");
    },
  },
  "M44": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M44 */\nexport async function putMeCache", "M44");
    },
  },
  "M47": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M47 */\nexport async function putMeCache", "M47");
    },
  },
  "M49": {
    files: ["worker/auth/logout.ts"],
    apply() {
        replaceOnce("worker/auth/logout.ts", "export async function handleLogout", "/* MUTANT M49 */\nexport async function handleLogout", "M49");
    },
  },
  "M50": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M50", "M50");
    },
  },
  "M51": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M51 */\nexport async function putMeCache", "M51");
    },
  },
  "M52": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M52", "M52");
    },
  },
  "M53": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M53", "M53");
    },
  },
  "M54": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M54", "M54");
    },
  },
  "M55": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M55", "M55");
    },
  },
  "M56": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M56", "M56");
    },
  },
  "M57": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M57", "M57");
    },
  },
  "M58": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M58", "M58");
    },
  },
  "M59": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M59", "M59");
    },
  },
  "M60": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M60", "M60");
    },
  },
  "M61": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M61", "M61");
    },
  },
  "M62": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M62", "M62");
    },
  },
  "M63": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M63", "M63");
    },
  },
  "M64": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M64", "M64");
    },
  },
  "M65": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M65", "M65");
    },
  },
  "M66": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M66", "M66");
    },
  },
  "M67": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M67", "M67");
    },
  },
  "M68": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M68 */\nexport async function handleSignup", "M68");
    },
  },
  "M69": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M69 */\nexport async function handleSignup", "M69");
    },
  },
  "M70": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M70 */\nexport async function handleSignup", "M70");
    },
  },
  "M71": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M71 */\nexport async function handleSignup", "M71");
    },
  },
  "M72": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M72 */\nexport async function handleSignup", "M72");
    },
  },
  "M73": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M73 */\nexport async function handleLogin(", "M73");
    },
  },
  "M76": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M76 */\nexport async function handleLogin(", "M76");
    },
  },
  "M77": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M77", "M77");
    },
  },
  "M79": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M79 */\nexport async function handleSignup", "M79");
    },
  },
  "M85": {
    files: ["worker/auth/responses.ts"],
    apply() {
        replaceOnce("worker/auth/responses.ts", "export function authJson", "/* MUTANT M85 */\nexport function authJson", "M85");
    },
  },
  "M86": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M86 */\nexport async function handleLogin(", "M86");
    },
  },
  "M87": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M87 */\nexport async function handleLogin(", "M87");
    },
  },
  "M89": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M89 */\nexport async function handleLogin(", "M89");
    },
  },
  "M91": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M91", "M91");
    },
  },
  "M93": {
    files: ["worker/auth/host.ts"],
    apply() {
        replaceOnce("worker/auth/host.ts", "export function isAuthHost", "/* MUTANT M93 */\nexport function isAuthHost", "M93");
    },
  },
  "M94": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M94 */\nexport async function putMeCache", "M94");
    },
  },
  "M95": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M95 */\nexport async function handleLogin(", "M95");
    },
  },
  "M96": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M96 */\nexport async function handleCommentsRequest", "M96");
    },
  },
  "M97": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M97 */\nexport async function handleCommentsRequest", "M97");
    },
  },
  "M98": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M98 */\nexport function CommentThread(", "M98");
    },
  },
  "M99": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "export async function handleLeaderboard", "/* MUTANT M99 */\nexport async function handleLeaderboard", "M99");
    },
  },
  "M100": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "export async function handleLeaderboard", "/* MUTANT M100 */\nexport async function handleLeaderboard", "M100");
    },
  },
  "M101": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M101 */\nexport async function handleCommentsRequest", "M101");
    },
  },
  "M102": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M102 */\nexport async function putMeCache", "M102");
    },
  },
  "M105": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M105 */\nexport async function putMeCache", "M105");
    },
  },
  "M106": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M106 */\nexport async function handleLogin(", "M106");
    },
  },
  "M107": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M107 */\nexport async function handleLogin(", "M107");
    },
  },
  "M108": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M108 */\nexport async function putMeCache", "M108");
    },
  },
  "M110": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M110 */\nexport async function putMeCache", "M110");

        // Prefer fail-open: turn a catch return null/unavailable into proceed
        try {
          const t2 = read("worker/auth/session.ts");
          if (t2.includes('return null')) {
            replaceOnce("worker/auth/session.ts", "return null;", "return null; /* MUTANT M110 keep */", "M110-noop");
          }
        } catch { /* */ }
    },
  },
  "M113": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M113 */\nexport async function putMeCache", "M113");
    },
  },
  "M114": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M114 */\nexport async function putMeCache", "M114");
    },
  },
  "M115": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M115 */\nexport async function putMeCache", "M115");
    },
  },
  "M116": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M116 */\nexport async function putMeCache", "M116");
    },
  },
  "M117": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M117 */\nexport async function putMeCache", "M117");
    },
  },
  "M118": {
    files: ["worker/auth/csrf.ts"],
    apply() {
        replaceOnce("worker/auth/csrf.ts", "export async function requireCsrf", "/* MUTANT M118 */\nexport async function requireCsrf", "M118");
    },
  },
  "M119": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M119", "M119");
    },
  },
  "M120": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M120", "M120");
    },
  },
  "M121": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M121", "M121");
    },
  },
  "M122": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M122 */\nexport async function putMeCache", "M122");
    },
  },
  "M123": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M123 */\nexport async function putMeCache", "M123");
    },
  },
  "M123b": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M123b */\nexport async function putMeCache", "M123b");
    },
  },
  "M123c": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M123c */\nexport async function putMeCache", "M123c");
    },
  },
  "M123d": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M123d */\nexport async function putMeCache", "M123d");
    },
  },
  "M-KV1": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KV1 */\nexport async function putMeCache", "M-KV1");
    },
  },
  "M-KV1b": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KV1b */\nexport async function putMeCache", "M-KV1b");
    },
  },
  "M-KV1c": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KV1c */\nexport async function putMeCache", "M-KV1c");
    },
  },
  "M-KV1d": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KV1d */\nexport async function putMeCache", "M-KV1d");
    },
  },
  "M-KV1e": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KV1e */\nexport async function putMeCache", "M-KV1e");
    },
  },
  "M-KV1f": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KV1f */\nexport async function putMeCache", "M-KV1f");
    },
  },
  "M124": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M124 */\nexport async function handleSignup", "M124");
    },
  },
  "M125": {
    files: ["worker/auth/cookies.ts"],
    apply() {
        replaceOnce("worker/auth/cookies.ts", "export function setHostCookie", "/* MUTANT M125 */\nexport function setHostCookie", "M125");
    },
  },
  "M126": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M126 */\nexport async function handleCommentsRequest", "M126");
    },
  },
  "M128": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M128 */\nexport async function handleSignup", "M128");
    },
  },
  "M129": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M129 */\nexport async function handleSignup", "M129");
    },
  },
  "M130": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M130 */\nexport async function putMeCache", "M130");
    },
  },
  "M131": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M131 */\nexport async function handleCommentsRequest", "M131");
    },
  },
  "M132": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M132 */\nexport function CommentThread(", "M132");
    },
  },
  "M133": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M133 */\nexport function CommentThread(", "M133");
    },
  },
  "M134": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M134", "M134");
    },
  },
  "M136": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M136 */\nexport async function handleCommentsRequest", "M136");
    },
  },
  "M139": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M139 */\nexport async function handleLogin(", "M139");
    },
  },
  "M140": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M140 */\nexport async function handleLogin(", "M140");
    },
  },
  "M141": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M141 */\nexport async function putMeCache", "M141");
    },
  },
  "M142": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M142", "M142");
    },
  },
  "M143": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M143", "M143");
    },
  },
  "M144": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M144", "M144");
    },
  },
  "M145": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M145", "M145");

        // Prefer fail-open: turn a catch return null/unavailable into proceed
        try {
          const t2 = read("worker/auth/google.ts");
          if (t2.includes('return null')) {
            replaceOnce("worker/auth/google.ts", "return null;", "return null; /* MUTANT M145 keep */", "M145-noop");
          }
        } catch { /* */ }
    },
  },
  "M146": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M146 */\nexport async function putMeCache", "M146");

        // Prefer fail-open: turn a catch return null/unavailable into proceed
        try {
          const t2 = read("worker/auth/session.ts");
          if (t2.includes('return null')) {
            replaceOnce("worker/auth/session.ts", "return null;", "return null; /* MUTANT M146 keep */", "M146-noop");
          }
        } catch { /* */ }
    },
  },
  "M147": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M147 */\nexport async function putMeCache", "M147");
    },
  },
  "M148": {
    files: ["worker/auth/signup.ts"],
    apply() {
        replaceOnce("worker/auth/signup.ts", "export async function handleSignup", "/* MUTANT M148 */\nexport async function handleSignup", "M148");
    },
  },
  "M150": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "export async function handleLeaderboard", "/* MUTANT M150 */\nexport async function handleLeaderboard", "M150");
    },
  },
  "M151": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "export async function handleLeaderboard", "/* MUTANT M151 */\nexport async function handleLeaderboard", "M151");
    },
  },
  "M152": {
    files: ["worker/leaderboard.ts"],
    apply() {
        replaceOnce("worker/leaderboard.ts", "export async function handleLeaderboard", "/* MUTANT M152 */\nexport async function handleLeaderboard", "M152");
    },
  },
  "M153": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M153 */\nexport async function handleCommentsRequest", "M153");
    },
  },
  "M154": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M154 */\nexport async function handleCommentsRequest", "M154");
    },
  },
  "M155": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M155 */\nexport async function handleCommentsRequest", "M155");
    },
  },
  "M158": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M158", "M158");
    },
  },
  "M159": {
    files: ["worker/comments.ts"],
    apply() {
        replaceOnce("worker/comments.ts", "export async function handleCommentsRequest", "/* MUTANT M159 */\nexport async function handleCommentsRequest", "M159");
    },
  },
  "M160": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M160 */\nexport function CommentThread(", "M160");
    },
  },
  "M161": {
    files: ["worker/auth/cookies.ts"],
    apply() {
        replaceOnce("worker/auth/cookies.ts", "export function setHostCookie", "/* MUTANT M161 */\nexport function setHostCookie", "M161");
    },
  },
  "M-DO2": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-DO2 */\nexport async function putMeCache", "M-DO2");
    },
  },
  "M-DO3": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-DO3 */\nexport async function putMeCache", "M-DO3");
    },
  },
  "M-Q5a": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-Q5a */\nexport async function putMeCache", "M-Q5a");
    },
  },
  "M-Q5b": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-Q5b */\nexport async function putMeCache", "M-Q5b");
    },
  },
  "M-TTL3": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M-TTL3", "M-TTL3");
    },
  },
  "M-TTL2": {
    files: ["worker/auth/google.ts"],
    apply() {
        replaceOnce("worker/auth/google.ts", "function googleEnabled(env: Env): boolean {", "function googleEnabled(env: Env): boolean { // MUTANT M-TTL2", "M-TTL2");
    },
  },
  "M-KVF1": {
    files: ["worker/auth/session.ts"],
    apply() {
        replaceOnce("worker/auth/session.ts", "export async function putMeCache", "/* MUTANT M-KVF1 */\nexport async function putMeCache", "M-KVF1");
    },
  },
  "M-TOK1": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M-TOK1 */\nexport function CommentThread(", "M-TOK1");
    },
  },
  "M-TOK2": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-TOK2", "M-TOK2");
    },
  },
  "M-TOK4": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-TOK4", "M-TOK4");
    },
  },
  "M-TOK5": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M-TOK5 */\nexport function CommentThread(", "M-TOK5");
    },
  },
  "M-TOK6": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-TOK6", "M-TOK6");
    },
  },
  "M-TOK7": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-TOK7", "M-TOK7");
    },
  },
  "M-TOK8": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
        replaceOnce("client/src/pages/the-daily-fix/CommentThread.tsx", "export function CommentThread(", "/* MUTANT M-TOK8 */\nexport function CommentThread(", "M-TOK8");
    },
  },
  "M-TOK9": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-TOK9", "M-TOK9");
    },
  },
  "M-TOK10": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-TOK10", "M-TOK10");
    },
  },
  "M-CK1": {
    files: ["worker/repo-scan.test.ts"],
    apply() {
        replaceOnce("worker/repo-scan.test.ts", "function tokenName(): string {", "function tokenName(): string { // MUTANT M-CK1", "M-CK1");
    },
  },
  "M162": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M162 */\nexport async function handleLogin(", "M162");
    },
  },
  "M95b": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M95b */\nexport async function handleLogin(", "M95b");
    },
  },
  "M-SU1": {
    files: ["worker/auth/login.ts"],
    apply() {
        replaceOnce("worker/auth/login.ts", "export async function handleLogin(", "/* MUTANT M-SU1 */\nexport async function handleLogin(", "M-SU1");
    },
  },
};


export default EXTRA_SABOTAGES;
