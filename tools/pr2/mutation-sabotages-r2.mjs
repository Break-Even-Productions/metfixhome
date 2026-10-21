/**
 * Round-2 sabotage overrides for survivors / mismatches / cant-run from the
 * full r1.23 mutation pass. Merged last so these win over EXTRA generics.
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
export const R2_OVERRIDES = {
  // ── Comments read ──────────────────────────────────────────────────────────
  M1: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (path === "/api/daily-fix/comments/") {\n    return jsonNoStore({ error: "not_found" }, 404);\n  }',
        '  if (path === "/api/daily-fix/comments/") {\n    // MUTANT M1\n    return handleCommentsRequest(request, env, deps.fetchImpl ?? fetch, {\n      baseUrl: deps.bsiBaseUrl,\n      cache: deps.cachesDefault,\n    });\n  }',
        "M1",
      );
    },
  },
  M3: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "function isCommentType(v: string): v is CommentType {\n  return COMMENT_TYPES.has(v);\n}",
        'function isCommentType(v: string): v is CommentType {\n  return typeof v === "string" && v.length > 0; // MUTANT M3\n}',
        "M3",
      );
    },
  },
  M7: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "    user: { display_name: displayName },",
        '    user: {\n      display_name: displayName,\n      ...(userRaw && userRaw.id != null ? { id: userRaw.id } : {}),\n    }, // MUTANT M7\n    ...(typeof t.liked === "boolean" ? { liked: t.liked } : {}),',
        "M7",
      );
    },
  },
  M8: {
    files: ["worker/auth/public-name.ts"],
    apply() {
      replaceOnce(
        "worker/auth/public-name.ts",
        '  // Fail closed: display_name alone is never trusted (B4W.1 / S-G9).\n  return "Member";',
        '  // MUTANT M8 fail open\n  const t = raw.trim();\n  if (!t || isMemberFallback(t)) return "Member";\n  return t;',
        "M8",
      );
    },
  },
  M9: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (deleted === 1) return null; // W8 soft-delete: omit row + replies",
        "  if (false && deleted === 1) return null; // MUTANT M9",
        "M9",
      );
    },
  },
  M10: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (!signedIn && type === "all") {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        '  if (type === "all") { // MUTANT M10: cache with auth too\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        "M10",
      );
    },
  },
  M125: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (!signedIn && type === "all") {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        '  const hasCookie = Boolean(request.headers.get("Cookie")); // MUTANT M125\n  if (!signedIn && type === "all" && !hasCookie) {\n    const cached = await cache.match(commentsCacheKeyRequest(date));',
        "M125",
      );
    },
  },
  M126: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '  if (outcome.kind === "unauthorized") {\n    logCommentsKind("unauthorized");\n    return unavailable();\n  }\n  if (outcome.kind === "forbidden") {\n    logCommentsKind("forbidden");\n    return unavailable();\n  }',
        '  if (outcome.kind === "unauthorized" || outcome.kind === "forbidden") {\n    logCommentsKind("auth_fail"); // MUTANT M126\n    return unavailable();\n  }',
        "M126",
      );
    },
  },

  // ── Comment POST / P* ──────────────────────────────────────────────────────
  M20: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  const ctx = await requireSession(request, env, fetchImpl, opts);\n  if (ctx instanceof Response) return ctx;\n  if (!ctx.access) return unavailable();\n  const csrf = await requireCsrf(request, env, ctx.sid);\n  if (csrf) return csrf;\n\n  const parsed = await readJsonBodyLimited(request);",
        `  // MUTANT M20: no session check
  const ctx = {
    access: "mutant-key-only",
    sid: "mutant",
    hex: "mutant",
    record: { bsi_user_id: "0", bsi_access: "", bsi_refresh: "", access_exp: 0, user_public_name: "Member", can_moderate: false, created: 0, last_seen: 0 },
  } as ActingContext;
  void requireSession; void requireCsrf;

  const parsed = await readJsonBodyLimited(request);`,
        "M20",
      );
    },
  },
  M21: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  const upstreamBody: {\n    date: string;\n    type: string;\n    content: string;\n    parent_comment_id?: number;\n  } = { date, type, content };\n  if (parent !== undefined) upstreamBody.parent_comment_id = parent;",
        `  const upstreamBody: {
    date: string;
    type: string;
    content: string;
    parent_comment_id?: number;
    user_id?: unknown;
  } = { date, type, content, user_id: body.user_id }; // MUTANT M21
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;`,
        "M21",
      );
    },
  },
  M23: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "export async function runUserBsiCall<",
        `export async function runUserBsiCall_MUTANT_M23_PLACEHOLDER<`,
        "M23-mark",
      );
      // Better: in comments post path omit Authorization when empty
      replaceOnce(
        "worker/auth/acting.ts",
        "export async function runUserBsiCall_MUTANT_M23_PLACEHOLDER<",
        "export async function runUserBsiCall<",
        "M23-unmark",
      );
      replaceOnce(
        "worker/comments.ts",
        "  if (!ctx.access) return unavailable();",
        "  // MUTANT M23: omit Authorization when token empty\n  if (!ctx.access) ctx.access = \"\" as unknown as string;",
        "M23",
      );
    },
  },
  M24: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "const MAX_BODY_BYTES = 8192;",
        "const MAX_BODY_BYTES = 8192 * 1000; // MUTANT M24 skip 8KB",
        "M24",
      );
    },
  },
  M25: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "function isJsonContentType(ct: string | null): boolean {\n  if (!ct) return false;\n  const base = ct.split(\";\")[0]?.trim().toLowerCase() ?? \"\";\n  return base === \"application/json\";\n}",
        "function isJsonContentType(_ct: string | null): boolean {\n  return true; // MUTANT M25\n}",
        "M25",
      );
    },
  },
  M26: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "const MAX_CONTENT_CODEPOINTS = 2000;",
        "const MAX_CONTENT_CODEPOINTS = 200000; // MUTANT M26",
        "M26",
      );
    },
  },
  M28: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  const limited = await checkCommentWriteLimit(env as CommentLimitEnv, ctx.record.bsi_user_id, ip);\n  if (!limited.allowed) {\n    return jsonNoStore({ error: \"rate_limited\" }, 429, { \"Retry-After\": \"60\" });\n  }",
        "  // MUTANT M28\n  const limited = { allowed: true as const };\n  void checkCommentWriteLimit; void ip;",
        "M28",
      );
    },
  },
  M29: {
    files: ["worker/auth/comment-rate-limit.ts"],
    apply() {
      const t = read("worker/auth/comment-rate-limit.ts");
      if (!t.includes("bsi_user_id") && !t.includes("userId")) {
        throw new Error("M29: unexpected limiter");
      }
      replaceOnce(
        "worker/auth/comment-rate-limit.ts",
        "export async function checkCommentWriteLimit(",
        "export async function checkCommentWriteLimit(/* MUTANT M29 IP-only key */",
        "M29",
      );
      // Force key to IP: replace first key construction if present
      if (t.includes("`write:${")) {
        replaceOnce(
          "worker/auth/comment-rate-limit.ts",
          "`write:${",
          "`write:ip-only:${",
          "M29-key",
        );
      } else {
        replaceAllExact(
          "worker/auth/comment-rate-limit.ts",
          "userId",
          'ip /* MUTANT M29 */',
          "M29-uid",
        );
      }
    },
  },
  M153: {
    files: ["worker/comments.ts"],
    apply() {
      replaceAllExact(
        "worker/comments.ts",
        'return jsonNoStore({ error: "payload_too_large" }, 413);',
        'return jsonNoStore({ error: "too_large" }, 413); // MUTANT M153',
        "M153",
      );
    },
  },
  M154: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (okStatus === 201) {\n    const commentRaw =\n      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;\n    const json = shapeThread(commentRaw, { requireTimestamp: true });",
        `  if (okStatus === 201) {
    // MUTANT M154: 2xx missing id passed as 201
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = shapeThread(commentRaw, { requireTimestamp: false }) ?? { content: "x" };`,
        "M154",
      );
    },
  },
  M155: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        '      if (kind === "post") return jsonNoStore({ error: "cannot_post" }, 403);\n      return jsonNoStore({ error: "forbidden" }, 403);',
        '      // MUTANT M155: relay BSI 403 body\n      return new Response(upstream.bodyText ?? JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });',
        "M155",
      );
    },
  },
  M159: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "function codePointLength(s: string): number {\n  return [...s].length;\n}",
        "function codePointLength(s: string): number {\n  return s.length; // MUTANT M159 UTF-16 units\n}",
        "M159",
      );
    },
  },
  M101: {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "    const headers =\n      opts?.accessToken\n        ? bsiBearerHeaders(env.DAILY_FIX_API_KEY, opts.accessToken)\n        : bsiGetHeaders(env.DAILY_FIX_API_KEY);",
        `    // MUTANT M101: forward incoming Authorization on comment GET
    const headers = {
      ...bsiGetHeaders(env.DAILY_FIX_API_KEY),
      ...(opts?.accessToken ? { Authorization: \`Bearer \${opts.accessToken}\` } : {}),
      ...(typeof (opts as { incomingAuth?: string })?.incomingAuth === "string"
        ? { Authorization: (opts as { incomingAuth: string }).incomingAuth }
        : {}),
    };`,
        "M101",
      );
    },
  },

  // ── Client CW* ─────────────────────────────────────────────────────────────
  "M-CW20": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      const t = read("client/src/pages/the-daily-fix/CommentThread.tsx");
      if (t.includes("parent_id")) {
        // Show reply even when parent_id set
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "parent_id",
          "parent_id /* MUTANT M-CW20 allow reply on replies */",
          "M-CW20",
        );
      }
      // Force reply control visible: weaken condition
      if (t.includes("!comment.parent_id") || t.includes("parent_id ==")) {
        replaceAllExact(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "!comment.parent_id",
          "true /* MUTANT M-CW20 */",
          "M-CW20-cond",
        );
      } else {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "              {loggedIn && comment.deleted === 0 ? (",
          "              {loggedIn && comment.deleted === 0 ? ( // MUTANT M-CW20 reply on replies",
          "M-CW20-b",
        );
        // Add reply button for replies in render — flip canReply if any
        const t2 = read("client/src/pages/the-daily-fix/CommentThread.tsx");
        if (t2.includes("replies") && t2.includes("Reply")) {
          replaceOnce(
            "client/src/pages/the-daily-fix/CommentThread.tsx",
            "Reply",
            "Reply",
            "M-CW20-noop",
          );
        }
      }
    },
  },
  "M-CW21": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        "              {loggedIn && comment.deleted === 0 ? (",
        "              {loggedIn ? ( // MUTANT M-CW21 like on deleted",
        "M-CW21",
      );
    },
  },
  "M-CW26": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        "              {loggedIn && comment.deleted === 0 && canModerate(comment) ? (",
        "              {loggedIn && canModerate(comment) ? ( // MUTANT M-CW26 edit on deleted",
        "M-CW26",
      );
    },
  },
  "M-CW30": {
    files: ["client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      const t = read("client/src/pages/the-daily-fix/CommentThread.tsx");
      const idx = t.indexOf("async function");
      // Break 204→deleted by renaming success handling near delete
      if (t.includes("deleted: true") || t.includes("deleted:true")) {
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "deleted: true",
          "deleted: false /* MUTANT M-CW30 */",
          "M-CW30",
        );
      } else {
        // First invalidateCommentsCache only
        replaceOnce(
          "client/src/pages/the-daily-fix/CommentThread.tsx",
          "          invalidateCommentsCache(dateIso);",
          "          /* MUTANT M-CW30 skip purge on delete path */\n          void dateIso;",
          "M-CW30",
        );
      }
    },
  },
  "M-CW31": {
    files: ["client/src/pages/the-daily-fix/comments.ts", "client/src/pages/the-daily-fix/CommentThread.tsx"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/comments.ts",
        "export function invalidateCommentsCache(isoDate?: string): void {",
        `export function invalidateCommentsCache(isoDate?: string): void {
  // MUTANT M-CW31`,
        "M-CW31",
      );
      replaceOnce(
        "client/src/pages/the-daily-fix/CommentThread.tsx",
        "          invalidateCommentsCache(dateIso);",
        "          invalidateCommentsCache(dateIso);\n          invalidateCommentsCache(); // MUTANT M-CW31 full purge",
        "M-CW31-ct",
      );
    },
  },

  // ── R8 / throttle mismatches ───────────────────────────────────────────────
  M103: {
    files: ["worker/do/login-throttle.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "const R8C_LIMIT = 25;",
        "const R8C_LIMIT = 999999; // MUTANT M103",
        "M103",
      );
      // Also skip reserveR8c check in login to hit AU17.9 order
      replaceOnce(
        "worker/auth/login.ts",
        "  const r8c = await reserveR8c(env);\n  if (!r8c.allowed) {\n    return authJson(BODY_RATE_LIMITED, 429, {\n      \"Retry-After\": String(r8c.retryAfter),\n    });\n  }",
        "  // MUTANT M103: remove global layer at call site too\n  const r8c = { allowed: true as const };\n  void reserveR8c;",
        "M103-login",
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
    },
  },
  M105: {
    files: ["worker/auth/throttle.ts"],
    apply() {
      replaceOnce(
        "worker/auth/throttle.ts",
        "export async function reserveR8c(\n  env: Env,\n): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {\n  const data = await post(env, R8C_NAME, \"/r8c/reserve\");\n  if (!data.allowed) return { allowed: false, retryAfter: data.retryAfter ?? 1 };\n  return { allowed: true };\n}",
        `// MUTANT M105: in-isolate global counter instead of DO
const __m105: number[] = [];
export async function reserveR8c(
  env: Env,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  void env;
  const now = Date.now();
  const w = __m105.filter((t) => now - t < 60_000);
  __m105.length = 0; __m105.push(...w);
  if (w.length >= 25) return { allowed: false, retryAfter: 1 };
  __m105.push(now);
  return { allowed: true };
}`,
        "M105",
      );
    },
  },
  M106: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const ip = clientIp(request);\n  const r8b = await attemptR8b(env, ip);",
        `  // MUTANT M106: R8c before R8a/R8b
  const r8cEarly = await reserveR8c(env);
  if (!r8cEarly.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": String(r8cEarly.retryAfter) });
  }
  const ip = clientIp(request);
  const r8b = await attemptR8b(env, ip);`,
        "M106",
      );
    },
  },
  M107: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const r8a = await checkR8a(env, identifier);\n  if (!r8a.allowed) {\n    return authJson(BODY_RATE_LIMITED, 429, {\n      \"Retry-After\": String(r8a.retryAfter),\n    });\n  }",
        `  const r8a = await checkR8a(env, identifier);
  if (!r8a.allowed) {
    // MUTANT M107: lock by awaiting wait then call BSI
    await new Promise((r) => setTimeout(r, Math.min(r8a.retryAfter, 1) * 1000));
  }`,
        "M107",
      );
    },
  },
  M108: {
    files: ["worker/do/login-throttle.ts"],
    apply() {
      replaceOnce(
        "worker/do/login-throttle.ts",
        "    const times = ((await this.state.storage.get<number[]>(\"global\")) ?? []).filter(\n      (t) => now - t < WINDOW_MS,\n    );",
        `    // MUTANT M108: fixed window reset each minute
    const times = ((await this.state.storage.get<number[]>("global")) ?? []).filter(
      (t) => Math.floor(t / WINDOW_MS) === Math.floor(now / WINDOW_MS),
    );`,
        "M108",
      );
    },
  },
  M141: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  await clearR8a(env, identifier);",
        "  // MUTANT M141: success doesn't clear R8a\n  void clearR8a;",
        "M141",
      );
    },
  },

  // ── Login mapping ──────────────────────────────────────────────────────────
  M73: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        '  if (code === "invalid_credentials" || code === "login_disabled") {\n    await failR8a(env, identifier);\n    return authJson(BODY_INVALID_LOGIN, 401);\n  }',
        `  if (code === "login_disabled") {
    // MUTANT M73
    return authJson({ error: "disabled" }, 403);
  }
  if (code === "invalid_credentials") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }`,
        "M73",
      );
    },
  },
  M95: {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "export async function bsiWebLogin(\n  body: WebLoginBody,\n  env: Env,\n  fetchImpl: FetchImpl,\n  opts?: { baseUrl?: string; timeoutMs?: number },\n): Promise<BsiHttpResult> {",
        `export async function bsiWebLogin(
  body: WebLoginBody,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number; forwardIp?: string },
): Promise<BsiHttpResult> {`,
        "M95-sig",
      );
      replaceOnce(
        "worker/upstream.ts",
        "      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),\n      body: JSON.stringify(body),\n      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),",
        `      headers: {
        ...bsiJsonHeaders(env.DAILY_FIX_API_KEY),
        ...(opts?.forwardIp ? { "CF-Connecting-IP": opts.forwardIp } : {}), // MUTANT M95
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),`,
        "M95-h",
      );
      replaceOnce(
        "worker/auth/login.ts",
        "    { baseUrl, timeoutMs: 5000 },\n  );",
        '    { baseUrl, timeoutMs: 5000, forwardIp: request.headers.get("CF-Connecting-IP") ?? undefined }, // MUTANT M95\n  );',
        "M95-call",
      );
    },
  },
  M95b: {
    files: ["worker/upstream.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "export async function bsiWebLogin(\n  body: WebLoginBody,\n  env: Env,\n  fetchImpl: FetchImpl,\n  opts?: { baseUrl?: string; timeoutMs?: number },\n): Promise<BsiHttpResult> {\n  if (!env.DAILY_FIX_API_KEY) return { kind: \"nokey\" };\n  const origin = originFromOpts(opts);\n  const url = `${origin}/wp-json/bsi/v1/auth/web-login`;\n  return bsiFetch(\n    url,\n    {\n      method: \"POST\",\n      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),\n      body: JSON.stringify(body),\n      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),\n    },\n    fetchImpl,\n  );\n}",
        `export async function bsiWebLogin(
  body: WebLoginBody,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = \`\${origin}/wp-json/bsi/v1/auth/web-login\`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: {
        ...bsiJsonHeaders(env.DAILY_FIX_API_KEY),
        "X-Forwarded-For": "203.0.113.7", // MUTANT M95b
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}`,
        "M95b",
      );
    },
  },
  M86: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "  const sid = await createSession(env, {",
        '  const sid = await createSession(env, {\n  // will log after\n  });\n  console.log("sid", sid); // MUTANT M86\n  void 0; const _sid = sid; const __ignore = await Promise.resolve(null); const sid2 = _sid; void sid2;\n  /* rewrite - simpler: */\n  if (false) await createSession(env, {',
        "M86-bad",
      );
    },
  },

  // Fix M86 properly below in second pass — placeholder may fail apply

  M87: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        '  const identifier = typeof body.identifier === "string" ? body.identifier : "";\n  const password = typeof body.password === "string" ? body.password : "";',
        '  const identifier = typeof body.identifier === "string" ? body.identifier : "";\n  const password = typeof body.password === "string" ? body.password : "";\n  console.log("login", identifier, password); // MUTANT M87',
        "M87",
      );
    },
  },
  M79: {
    files: ["worker/comments.ts"],
    apply() {
      replaceOnce(
        "worker/comments.ts",
        "  if (!env.RECAPTCHA_SECRET) return unavailable();\n  const sv = await siteverifyComment(token, env.RECAPTCHA_SECRET, fetchImpl);\n  if (sv === \"fail\") return jsonNoStore({ error: \"try_again\" }, 403);\n  if (sv === \"outage\") return unavailable();\n  return null;",
        "  // MUTANT M79: skip verify on comment POST\n  void token; void siteverifyComment;\n  return null;",
        "M79",
      );
    },
  },

  // ── Google / OAuth / PKCE ──────────────────────────────────────────────────
  M52: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        const rec = await this.state.storage.get<OauthStateRecord>(KEY);\n        await this.state.storage.deleteAll();\n        await this.state.storage.deleteAlarm();",
        "        const rec = await this.state.storage.get<OauthStateRecord>(KEY);\n        // MUTANT M52: read without delete\n        // await this.state.storage.deleteAll();",
        "M52",
      );
    },
  },
  M53: {
    files: ["worker/do/oauth-state.ts"],
    apply() {
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        await this.state.storage.setAlarm(Date.now() + TTL_MS);",
        "        // MUTANT M53: no alarm\n        void TTL_MS;",
        "M53-alarm",
      );
      replaceOnce(
        "worker/do/oauth-state.ts",
        "        if (Date.now() - rec.created > TTL_MS) {\n          return json({ error: \"expired\" }, 404);\n        }",
        "        // MUTANT M53: no 600s check\n        if (false && Date.now() - rec.created > TTL_MS) {\n          return json({ error: \"expired\" }, 404);\n        }",
        "M53-ttl",
      );
    },
  },
  M56: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        'g.searchParams.set("code_challenge_method", "S256");',
        'g.searchParams.set("code_challenge_method", "plain"); // MUTANT M56',
        "M56",
      );
    },
  },
  M57: {
    files: ["worker/auth/google.ts"],
    apply() {
      const t = read("worker/auth/google.ts");
      if (t.includes("code_verifier")) {
        replaceOnce(
          "worker/auth/google.ts",
          "code_verifier: rec.verifier",
          "// code_verifier omitted MUTANT M57\n      grant_type: \"authorization_code\"",
          "M57",
        );
      } else {
        throw new Error("M57: no code_verifier");
      }
    },
  },
  M58: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  // Minimal JWT payload parse for email_verified / nonce (signature check TODO via JWKS).",
        "  // MUTANT M58: skip signature verification\n  // Minimal JWT payload parse for email_verified / nonce (signature check TODO via JWKS).",
        "M58",
      );
      // If there's a verifyJwt call, neuter it
      const t = read("worker/auth/google.ts");
      if (t.includes("verify") && t.includes("jose") || t.includes("jwks")) {
        replaceAllExact("worker/auth/google.ts", "throw new Error(\"google_token\")", "/* MUTANT M58 */", "M58-v");
      }
      // Plant skip: accept any mid payload without sig
      replaceOnce(
        "worker/auth/google.ts",
        "  if (payload.nonce !== rec.nonce) {",
        "  // MUTANT M58b: also skip nonce as part of skip-sig bundle if needed\n  if (payload.nonce !== rec.nonce) {",
        "M58b",
      );
    },
  },
  M59: {
    files: ["worker/auth/google.ts"],
    apply() {
      const t = read("worker/auth/google.ts");
      if (t.includes("iss") && (t.includes("accounts.google.com") || t.includes("payload.iss"))) {
        replaceOnce(
          "worker/auth/google.ts",
          "payload.iss",
          "(true ? payload.iss : payload.iss) /* MUTANT M59 skip iss */",
          "M59",
        );
      } else {
        replaceOnce(
          "worker/auth/google.ts",
          "  if (payload.nonce !== rec.nonce) {",
          '  // MUTANT M59: skip iss (no-op plant + accept any iss)\n  void (payload as { iss?: string }).iss;\n  if (payload.nonce !== rec.nonce) {',
          "M59",
        );
      }
    },
  },
  M61: {
    files: ["worker/auth/google.ts"],
    apply() {
      const t = read("worker/auth/google.ts");
      if (t.includes("payload.exp") || t.includes(".exp")) {
        replaceAllExact(
          "worker/auth/google.ts",
          "payload.exp",
          "(Number.MAX_SAFE_INTEGER) /* MUTANT M61 */",
          "M61",
        );
      } else {
        replaceOnce(
          "worker/auth/google.ts",
          "  if (payload.nonce !== rec.nonce) {",
          "  // MUTANT M61: skip exp\n  void (payload as { exp?: number }).exp;\n  if (payload.nonce !== rec.nonce) {",
          "M61",
        );
      }
    },
  },
  M62: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  if (payload.nonce !== rec.nonce) {",
        "  // MUTANT M62: skip iat\n  void (payload as { iat?: number }).iat;\n  if (payload.nonce !== rec.nonce) {",
        "M62",
      );
    },
  },
  M63: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  if (payload.nonce !== rec.nonce) {",
        "  // MUTANT M63: skip nonce\n  if (false && payload.nonce !== rec.nonce) {",
        "M63",
      );
    },
  },
  M64: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "const verified = payload.email_verified === true;",
        "const verified = true; // MUTANT M64 skip email_verified",
        "M64",
      );
    },
  },
  M120: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  if (payload.nonce !== rec.nonce) {",
        "  // MUTANT M120: skip azp\n  void (payload as { azp?: string }).azp;\n  if (payload.nonce !== rec.nonce) {",
        "M120",
      );
    },
  },
  M134: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "function googleEnabled(env: Env): boolean {\n  const v = (env.GOOGLE_AUTH_ENABLED ?? \"\").toLowerCase();\n  return (\n    (v === \"1\" || v === \"true\") &&\n    !!env.GOOGLE_WEB_CLIENT_ID &&\n    !!env.GOOGLE_WEB_CLIENT_SECRET\n  );\n}",
        "function googleEnabled(env: Env): boolean {\n  // MUTANT M134: Google routes live with gate off\n  return !!env.GOOGLE_WEB_CLIENT_ID && !!env.GOOGLE_WEB_CLIENT_SECRET;\n}",
        "M134",
      );
    },
  },

  // ── Auth routes / me / signup ──────────────────────────────────────────────
  M91: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        '  if (!identifier || !password) {\n    return authJson(BODY_INVALID_REQUEST, 400);\n  }',
        `  if (!identifier || !password) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  // MUTANT M91
  return new Response(null, {
    status: 302,
    headers: { Location: "https://brokenscience.org/oauth/authorize", "Cache-Control": "no-store" },
  });`,
        "M91",
      );
    },
  },
  M93: {
    files: ["worker/auth/index.ts"],
    apply() {
      replaceOnce(
        "worker/auth/index.ts",
        "  if (path === \"/api/auth/csrf\") return handleCsrf(request, env);",
        `  if (request.method.toUpperCase() === "OPTIONS") {
    // MUTANT M93: OPTIONS with CORS
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
    });
  }
  if (path === "/api/auth/csrf") return handleCsrf(request, env);`,
        "M93",
      );
    },
  },
  M94: {
    files: ["worker/auth/index.ts"],
    apply() {
      replaceOnce(
        "worker/auth/index.ts",
        '  if (path === "/api/auth/me") return handleMe(request, env);',
        '  if (path === "/api/auth/me" || path === "/api/auth/session") return handleMe(request, env); // MUTANT M94',
        "M94",
      );
    },
  },
  M117: {
    files: ["worker/auth/index.ts"],
    apply() {
      replaceOnce(
        "worker/auth/index.ts",
        "  // /api/auth/refresh dropped (R5) → JSON 404 like other unknown auth paths.\n  if (path.startsWith(\"/api/auth/\")) {\n    return authJson(BODY_NOT_FOUND, 404);\n  }",
        `  // MUTANT M117: keep /api/auth/refresh route
  if (path === "/api/auth/refresh") {
    return authJson({ ok: true }, 200);
  }
  if (path.startsWith("/api/auth/")) {
    return authJson(BODY_NOT_FOUND, 404);
  }`,
        "M117",
      );
    },
  },
  M115: {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "  let setCookies: string[] = [];\n  try {\n    const touched = await touchSession(env, sid);",
        `  let setCookies: string[] = [];
  try {
    // MUTANT M115: /me triggers silent refresh near expiry
    const { resolveActingSession } = await import("./acting");
    void resolveActingSession;
    const touched = await touchSession(env, sid);`,
        "M115",
      );
      // Stronger: call refresh via acting on every /me
      replaceOnce(
        "worker/auth/me.ts",
        'import {\n  getMeCache,\n  rebuildMeFromDo,\n  sessionKeyHex,\n  touchSession,\n} from "./session";',
        'import {\n  getMeCache,\n  rebuildMeFromDo,\n  sessionKeyHex,\n  touchSession,\n  loadSession,\n  applyRefreshResult,\n} from "./session";',
        "M115-imp",
      );
    },
  },
  M116: {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "  // R5: no cookie → {signed_in:false}, 0 KV reads.\n  if (!sid) {\n    return authJson({ signed_in: false }, 200);\n  }",
        `  // MUTANT M116: /me reads KV with no cookie
  if (!sid) {
    await env.AUTH_SESSIONS.get("sess:anonymous", "text");
    return authJson({ signed_in: false }, 200);
  }`,
        "M116",
      );
    },
  },
  M157: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        '  if (method === "HEAD") return methodNotAllowed("GET");\n  if (method !== "GET") return methodNotAllowed("GET");',
        '  // MUTANT M157: HEAD mints pre cookie\n  if (method !== "GET" && method !== "HEAD") return methodNotAllowed("GET");',
        "M157",
      );
    },
  },
  M68: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        "  // Always 202 check_email on success or account-exists (A-T8). Discard bridge_url.\n  if (upstream.kind === \"ok\") {",
        `  // MUTANT M68: relay bridge_url
  if (upstream.kind === "ok") {
    const bu = (upstream.json as { bridge_url?: string })?.bridge_url;
    if (bu) return authJson({ bridge_url: bu }, 200);
`,
        "M68",
      );
    },
  },
  M69: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        '    if (upstream.status === 409 || upstream.code === "account_exists") {',
        `    if (upstream.status === 409 || upstream.code === "account_exists") {
      return authJson({ error: "exists" }, 409); // MUTANT M69`,
        "M69",
      );
    },
  },

  // ── Absolute session cap R15 ───────────────────────────────────────────────
  M123: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const absMs = 90 * 24 * 60 * 60 * 1000;",
        "    const absMs = 9000 * 24 * 60 * 60 * 1000; // MUTANT M123 no absolute cap",
        "M123",
      );
    },
  },
  M123b: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const absMs = 90 * 24 * 60 * 60 * 1000;",
        "    const absMs = 91 * 24 * 60 * 60 * 1000; // MUTANT M123b",
        "M123b",
      );
    },
  },
  M123c: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (now - record.created >= NINETY_DAYS_MS) return null;",
        "  if (now - record.created > NINETY_DAYS_MS) return null; // MUTANT M123c exclusive",
        "M123c",
      );
    },
  },
  M123d: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const until = Math.min(record.last_seen + idleMs, record.created + absMs);",
        "    const until = record.last_seen + idleMs; // MUTANT M123d from last_seen only\n    void absMs; void record.created;",
        "M123d",
      );
    },
  },
  "M-DO3": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const until = Math.min(record.last_seen + idleMs, record.created + absMs);",
        "    const until = record.created + absMs; // MUTANT M-DO3\n    void idleMs; void record.last_seen;",
        "M-DO3",
      );
    },
  },
  "M-DO2": {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        '      if (path === "/session" && request.method === "DELETE") {\n        await this.state.storage.deleteAll();\n        return new Response(null, { status: 204 });\n      }',
        `      if (path === "/session" && request.method === "DELETE") {
        // MUTANT M-DO2: skip deleteAll
        await this.state.storage.deleteAlarm();
        return new Response(null, { status: 204 });
      }`,
        "M-DO2",
      );
    },
  },
  "M-TTL2": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "  if (!me) {\n    try {\n      me = await rebuildMeFromDo(env, sid);\n    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { \"Retry-After\": \"300\" });\n    }\n  }",
        `  if (!me) {
    // MUTANT M-TTL2: KV miss → signed_in false (no DO rebuild)
    return authJson({ signed_in: false }, 200);
  }`,
        "M-TTL2",
      );
    },
  },
  "M-TTL3": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "    } catch {\n      return authJson(BODY_UNAVAILABLE, 503, { \"Retry-After\": \"300\" });\n    }",
        '    } catch {\n      // MUTANT M-TTL3\n      return authJson({ signed_in: false }, 200);\n    }',
        "M-TTL3",
      );
    },
  },
  "M-KVF1": {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (!loaded) return signedOut();\n\n  const now = Date.now();\n  if (now - loaded.record.created >= NINETY_DAYS_MS) {\n    return sessionExpired(env, sid);\n  }",
        `  // MUTANT M-KVF1: require KV hit before DO consult result
  {
    const { getMeCache, sessionKeyHex } = await import("./session");
    const hex = await sessionKeyHex(sid);
    const kv = await getMeCache(env, hex);
    if (!kv) return signedOut();
  }
  if (!loaded) return signedOut();

  const now = Date.now();
  if (now - loaded.record.created >= NINETY_DAYS_MS) {
    return sessionExpired(env, sid);
  }`,
        "M-KVF1",
      );
    },
  },
  "M-Q5b": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "  const hex = await sessionKeyHex(sid);\n  let me = await getMeCache(env, hex);",
        `  const hex = await sessionKeyHex(sid);
  // MUTANT M-Q5b: per-isolate memo 300s
  const g = globalThis as unknown as { __mQ5b?: Map<string, { at: number; me: unknown }> };
  g.__mQ5b ??= new Map();
  const hit = g.__mQ5b.get(hex);
  let me = hit && Date.now() - hit.at < 300_000 ? (hit.me as Awaited<ReturnType<typeof getMeCache>>) : await getMeCache(env, hex);
  if (me) g.__mQ5b.set(hex, { at: Date.now(), me });`,
        "M-Q5b",
      );
    },
  },

  // ── Client / scan / misc ───────────────────────────────────────────────────
  M96: {
    files: ["client/src/pages/the-daily-fix/comments.ts"],
    apply() {
      replaceOnce(
        "client/src/pages/the-daily-fix/comments.ts",
        "  return `/api/daily-fix/comments?${params.toString()}`;",
        '  return `https://metfix-bff.example/api/daily-fix/comments?${params.toString()}`; // MUTANT M96',
        "M96",
      );
    },
  },
  "M-TOK4": {
    files: ["tools/pr2/gates/repo-scan.test.ts"],
    apply() {
      replaceOnce(
        "tools/pr2/gates/repo-scan.test.ts",
        "    } finally {\n      restoreEnv(snap);\n      rmSync(outDir, { recursive: true, force: true });\n      rmSync(otherDir, { recursive: true, force: true });\n    }",
        "    } finally {\n      // MUTANT M-TOK4: drop process.env restore\n      rmSync(outDir, { recursive: true, force: true });\n      rmSync(otherDir, { recursive: true, force: true });\n    }",
        "M-TOK4",
      );
    },
  },
  "M-CK1": {
    files: ["client/src/pages/the-daily-fix/gates-ck.test.ts"],
    apply() {
      const t = read("client/src/pages/the-daily-fix/gates-ck.test.ts");
      if (t.includes("CK-P1") || t.includes("gate-count") || t.includes("gate_ids")) {
        replaceOnce(
          "client/src/pages/the-daily-fix/gates-ck.test.ts",
          t.includes("CK-P1") ? "CK-P1" : "gate",
          "CK-P1",
          "M-CK1",
        );
      }
      // Plant a failing skip of header compare by editing the test expectation if present
      if (t.includes("toBe(") && t.includes("270")) {
        replaceOnce(
          "client/src/pages/the-daily-fix/gates-ck.test.ts",
          "270",
          "269 // MUTANT M-CK1 skip count",
          "M-CK1",
        );
      } else {
        // Append a sabotage that the gate would catch — edit docs pin compare helper if in worker
        const scan = read("tools/pr2/gates/repo-scan.test.ts");
        if (scan.includes("CK-P1") || scan.includes("gate-ids")) {
          replaceOnce(
            "tools/pr2/gates/repo-scan.test.ts",
            "function tokenName(): string {",
            "function tokenName(): string { // MUTANT M-CK1",
            "M-CK1-scan",
          );
        }
        // Ensure test file has CK-P1 id for runner index + make it fail under mutant
        write(
          "client/src/pages/the-daily-fix/gates-ck.test.ts",
          t + `\n// MUTANT M-CK1 marker\nit("CK-P1 header gate-count compare", () => {\n  expect(true).toBe(false); // forced red when sabotage applied — replaced below\n});\n`,
        );
        // Actually the sabotage should make the REAL test fail. If CK-P1 doesn't exist, ethanBlocker.
        throw new Error("M-CK1: CK-P1 test not implemented — use ethanBlocker");
      }
    },
  },

  // ── WL14 AU26.8 survivors — strengthen scan target ─────────────────────────
  "M-WL14": {
    files: ["worker/auth/login.ts"],
    apply() {
      // Keep BASE sabotage semantics: direct fetch with wp-json literal
      const WPJ = "/" + "wp-json";
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );`,
        `  const base = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  // MUTANT M-WL14: direct fetch bypassing upstream.ts
  const upstream = await (async () => {
    const res = await fetch(\`\${base}${WPJ}/bsi/v1/auth/web-login\`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": env.DAILY_FIX_API_KEY!,
      },
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
    return {
      kind: "http",
      status: res.status,
      code: json && typeof json === "object" ? ((json as { error?: string }).error ?? null) : null,
      bodyText: text,
      json,
      retryAfter: null,
    };
  })();`,
        "M-WL14",
      );
    },
  },
  "M-WL14b": {
    files: ["worker/auth/login.ts"],
    apply() {
      const WPJ = "/" + "wp-json";
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(`,
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  void globalThis.fetch(\`\${baseUrl}${WPJ}/bsi/v1/auth/web-login\`); // MUTANT M-WL14b
  const upstream = await bsiWebLogin(`,
        "M-WL14b",
      );
    },
  },
  "M-WL14c": {
    files: ["worker/auth/login.ts"],
    apply() {
      const WPJ = "/" + "wp-json";
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );`,
        `  const base = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  // MUTANT M-WL14c
  const f = fetch;
  const url = \`\${base}${WPJ}/bsi/v1/auth/web-login\`;
  const upstream = await (async () => {
    const res = await f(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.DAILY_FIX_API_KEY! },
      body: JSON.stringify({
        username: identifier, password, client_id: clientId, recaptcha_token: recaptchaToken,
      }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    if (res.ok) return { kind: "ok", status: res.status, bodyText: text, json };
    return { kind: "http", status: res.status, code: null, bodyText: text, json, retryAfter: null };
  })();`,
        "M-WL14c",
      );
    },
  },
  "M-WL14d": {
    files: ["worker/auth/login.ts", "worker/auth/http.ts"],
    apply() {
      const WPJ = "/" + "wp-json";
      const http = read("worker/auth/http.ts");
      write(
        "worker/auth/http.ts",
        `export function mutantWl14dWebLoginUrl(base: string): string {\n  return \`\${base}${WPJ}/bsi/v1/auth/web-login\`;\n}\n` + http,
      );
      replaceOnce(
        "worker/auth/login.ts",
        `import {
  BODY_INVALID_LOGIN,
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_TRY_AGAIN,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";`,
        `import {
  BODY_INVALID_LOGIN,
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_TRY_AGAIN,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";
import { mutantWl14dWebLoginUrl } from "./http";`,
        "M-WL14d-imp",
      );
      replaceOnce(
        "worker/auth/login.ts",
        `  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );`,
        `  const base = opts?.bsiBaseUrl ?? opts?.baseUrl ?? "https://brokenscience.org";
  // MUTANT M-WL14d
  const upstream = await (async () => {
    const url = mutantWl14dWebLoginUrl(base);
    const res = await fetch(new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.DAILY_FIX_API_KEY! },
      body: JSON.stringify({
        username: identifier, password, client_id: clientId, recaptcha_token: recaptchaToken,
      }),
    }));
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* */ }
    if (res.ok) return { kind: "ok", status: res.status, bodyText: text, json };
    return { kind: "http", status: res.status, code: null, bodyText: text, json, retryAfter: null };
  })();`,
        "M-WL14d",
      );
    },
  },
};

// M-CK1 real sabotage lives in mutation-sabotages-r14.mjs

// Fix M86 properly
R2_OVERRIDES.M86 = {
  files: ["worker/auth/login.ts"],
  apply() {
    replaceOnce(
      "worker/auth/login.ts",
      "  const sid = await createSession(env, {",
      '  const sid = await createSession(env, {',
      "M86-noop",
    );
    // Insert log after createSession call — find unique success return
    replaceOnce(
      "worker/auth/login.ts",
      "  return authJson(\n      { signed_in: true, public_name: tok.public_name },",
      '  console.log("sid", sid); // MUTANT M86\n  return authJson(\n      { signed_in: true, public_name: tok.public_name },',
      "M86",
    );
  },
};



Object.assign(R2_OVERRIDES, {
  M15: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        "  const upstream = await bsiFetchLeaderboard(meta.daily_workout_id, ctx.access, env, fetchImpl, {",
        `  const browserAuth = (request.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "") || ctx.access; // MUTANT M15
  const upstream = await bsiFetchLeaderboard(meta.daily_workout_id, browserAuth, env, fetchImpl, {`,
        "M15",
      );
    },
  },
  M16: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        '  if (!sid) {\n    return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });\n  }\n  const ctx = await resolveActingSession(request, env, fetchImpl, opts);\n  if (ctx instanceof Response) return ctx;',
        `  // MUTANT M16: signed-out → call upstream with key only
  let ctx: Awaited<ReturnType<typeof resolveActingSession>>;
  if (!sid) {
    ctx = {
      sid: "",
      hex: "",
      access: "",
      record: { bsi_access: "", bsi_refresh: "", access_exp: 0, user_public_name: "Member", bsi_user_id: "", can_moderate: false, created: 0, last_seen: 0 },
    } as Awaited<ReturnType<typeof resolveActingSession>>;
  } else {
    ctx = await resolveActingSession(request, env, fetchImpl, opts);
    if (ctx instanceof Response) return ctx;
  }`,
        "M16",
      );
    },
  },
  M17: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        '  return new Response(body, {\n    status: 200,\n    headers: {\n      "Content-Type": "application/json; charset=utf-8",\n      "Cache-Control": "no-store",\n    },\n  });\n}',
        `  // MUTANT M17
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
  };
  try { await caches.default.put(new Request(request.url), new Response(body, { status: 200, headers })); } catch { /* */ }
  return new Response(body, { status: 200, headers });
}`,
        "M17",
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
    // MUTANT M42b: re-read from KV and retry
    const { getMeCache, sessionKeyHex } = await import("./session");
    void getMeCache; void sessionKeyHex;
    return refreshIfNeeded(env, sid, record, fetchImpl, opts);
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
        "  if (!loaded) return signedOut();\n\n  const now = Date.now();\n  if (now - loaded.record.created >= NINETY_DAYS_MS) {",
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
          access_exp: Date.now() + 1000,
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
  if (now - loaded.record.created >= NINETY_DAYS_MS) {`,
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
        '      console.error("revoke failed", { refresh_token: refresh }); // MUTANT M42k',
        "M42k",
      );
    },
  },
  M54: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "  let pre = getPre(request);\n  const cookies: string[] = [];\n  if (!pre) {\n    pre = randomId32();\n    cookies.push(setHostCookie(PRE_COOKIE, pre, 1800));\n  }",
        `  // MUTANT M54: no pre-cookie binding
  let pre = getPre(request) || randomId32();
  const cookies: string[] = [];`,
        "M54",
      );
    },
  },
  M55: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        '    flow: "google",',
        '    flow: "bridge", // MUTANT M55 ignore flow',
        "M55",
      );
    },
  },
  M99: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        "  const shaped = shapeLeaderboard(json, userId || undefined);",
        `  // MUTANT M99
  void (await bsiFetchLeaderboard(meta.daily_workout_id, ctx.access, env, fetchImpl, {
    baseUrl: opts?.baseUrl,
    query: { date, scoring_field: meta.scoring_field, limit: "100", offset: "25", leaderboard_mode: "official" },
  }));
  const shaped = shapeLeaderboard(json, userId || undefined);`,
        "M99",
      );
    },
  },
  M100: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        "  const shaped = shapeLeaderboard(json, userId || undefined);",
        '  const clientUid = url.searchParams.get("user_id") || request.headers.get("X-User-Id") || userId; // MUTANT M100\n  const shaped = shapeLeaderboard(json, clientUid || undefined);',
        "M100",
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
  // MUTANT M119: browser GET callback trades the code
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
  M144: {
    files: ["worker/auth/google.ts"],
    apply() {
      replaceOnce(
        "worker/auth/google.ts",
        "async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {\n  const name = `oauth:${await sha256Hex(state)}`;\n  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));\n  await stub.fetch(",
        `async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  // MUTANT M144: store in KV instead of DO
  await env.AUTH_SESSIONS.put("oauth:" + state, JSON.stringify(rec), { expirationTtl: 600 });
  return;
  const name = \`oauth:\${await sha256Hex(state)}\`;
  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
  await stub.fetch(`,
        "M144",
      );
    },
  },
  M150: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        "      scoring_field: meta.scoring_field,\n      scoring_direction: meta.scoring_direction,",
        '      scoring_field: url.searchParams.get("scoring_field") ?? meta.scoring_field, // MUTANT M150\n      scoring_direction: meta.scoring_direction,',
        "M150",
      );
    },
  },
  M151: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        '      limit: "25",\n      offset: "0",',
        '      limit: url.searchParams.get("limit") ?? "25", // MUTANT M151\n      offset: url.searchParams.get("offset") ?? "0",',
        "M151",
      );
    },
  },
  M152: {
    files: ["worker/leaderboard.ts"],
    apply() {
      replaceOnce(
        "worker/leaderboard.ts",
        '  if (meta === "no_leaderboard") {\n    return jsonNoStore({ error: "no_leaderboard" }, 404);\n  }',
        `  if (meta === "no_leaderboard") {
    // MUTANT M152: still call upstream
    await bsiFetchLeaderboard("0", ctx.access, env, fetchImpl, {
      baseUrl: opts?.baseUrl,
      query: { date, limit: "25", offset: "0", leaderboard_mode: "official" },
    });
    return jsonNoStore({ error: "no_leaderboard" }, 404);
  }`,
        "M152",
      );
    },
  },
  M161: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "function signedOut(): Response {\n  return jsonNoStore({ error: \"signed_out\" }, 401, { \"Set-Cookie\": sidCookieClear() });\n}",
        'function signedOut(): Response {\n  // MUTANT M161: 401 without clearing cookie\n  return jsonNoStore({ error: "signed_out" }, 401);\n}',
        "M161",
      );
    },
  },
});

export default R2_OVERRIDES;


// ── Round-3: missing survivors + apply fixes (wins via Object.assign) ────────
Object.assign(R2_OVERRIDES, {
  
  "M61": {
    ethanBlocker:
      "Google JWT exp check not implemented in worker/auth/google.ts; AU12.6 harness voids fakeJwt(payload) and never injects the forged token — external until JWKS/exp verify lands",
  },
  "M-CW23": {
    files: ["worker/auth/me.ts"],
    apply() {
      replaceOnce(
        "worker/auth/me.ts",
        "  const body: { signed_in: true; public_name: string; moderator?: boolean } = {\n    signed_in: true,\n    public_name: me.user_public_name,\n  };\n  if (me.can_moderate === true) body.moderator = true;\n  return authJson(body, 200, {}, setCookies);",
        `  const body: { signed_in: true; public_name: string; moderator?: boolean } = {
    signed_in: true,
    public_name: me.user_public_name,
  };
  // MUTANT M-CW23: /me asks BSI for moderator on a KV miss / trusts X-Moderator
  if (request.headers.get("X-Moderator") === "1" || request.headers.get("X-Role") === "administrator") {
    body.moderator = true;
  } else if (me.can_moderate === true) {
    body.moderator = true;
  }
  return authJson(body, 200, {}, setCookies);`,
        "M-CW23",
      );
    },
  },
  "M-CW33": {
    // Skip KV rewrite on ensureActingAccess refresh (user-acting path).
    // No global TTL drift (that reds AU5.3/4/k). AU5.z(e) + CW12.3 both require the put.
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  if (data.refreshed) await putMeCache(env, hex, data.record);\n  return { hex, record: data.record };\n}",
        "  // MUTANT M-CW33: skip KV /me write after refresh\n  void data.refreshed;\n  return { hex, record: data.record };\n}",
        "M-CW33",
      );
    },
  },
  M22: {
    files: ["worker/do/session.ts", "worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const stored = await this.state.storage.get<Stored>(\"rec\");\n    if (!stored?.blob) return json({ present: false, record: null }, 200);",
        `    const stored = await this.state.storage.get<Stored>("rec");
    // MUTANT M22: empty DO → forged valid session
    if (!stored?.blob) {
      const now = Date.now();
      return json({
        present: true,
        record: {
          bsi_access: "forged-access",
          bsi_refresh: "forged-refresh",
          access_exp: now + 3600_000,
          user_public_name: "Member",
          bsi_user_id: "0",
          can_moderate: false,
          created: now,
          last_seen: now,
        },
      }, 200);
    }`,
        "M22",
      );
    },
  },
  M31: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  return { ok: true, sid, pre };",
        "  // MUTANT M31: skip token compare (all POST routes)\n  void timingSafeEqualStr; void expected; void token;\n  return { ok: true, sid, pre };",
        "M31",
      );
    },
  },
  M35: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }",
        "  // MUTANT M35: === compare (non-constant)\n  if (token /* csrf */ !== expected) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }",
        "M35",
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
      try {
        await destroySession(env, incomingSid);
      } catch {
        /* ignore */
      }
    }
    await createSession(env, newSid, {`,
        "M36",
      );
    },
  },
  M37: {
    files: ["worker/auth/acting.ts", "worker/do/session.ts"],
    apply() {
      // Rotate sid on refresh by clearing cookie and issuing new — break AU6.2 keep-sid
      replaceOnce(
        "worker/auth/acting.ts",
        "function signedOut(): Response {\n  return jsonNoStore({ error: \"signed_out\" }, 401, { \"Set-Cookie\": sidCookieClear() });\n}",
        `function signedOut(): Response {
  return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
}
// MUTANT M37 helper: rotate sid marker
function rotateSidHeader(sid: string): string {
  return \`__Host-mfx_sid=\${encodeURIComponent(sid + "X")}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000\`;
}`,
        "M37-helper",
      );
      replaceOnce(
        "worker/do/session.ts",
        "      await this.put(aad, record);\n      return json({ status: \"ok\", record, refreshed: true });",
        `      await this.put(aad, record);
      // MUTANT M37: rotate the sid on refresh (R4 forbids) — signal via header the worker may surface
      return json({ status: "ok", record, refreshed: true, rotate_sid: true });`,
        "M37-do",
      );
      // Force Set-Cookie on acting path when near-expiry refresh happens
      replaceOnce(
        "worker/auth/acting.ts",
        "  return {\n    sid,\n    hex: loaded.hex,\n    access: loaded.record.bsi_access,\n    record: loaded.record,\n  };",
        `  // MUTANT M37: rotate sid on silent refresh path
  if (loaded.record.access_exp - now <= 60_000) {
    return {
      sid: sid + "X",
      hex: loaded.hex,
      access: loaded.record.bsi_access,
      record: loaded.record,
      setCookie: rotateSidHeader(sid),
    } as ActingSession;
  }
  return {
    sid,
    hex: loaded.hex,
    access: loaded.record.bsi_access,
    record: loaded.record,
  };`,
        "M37-acting",
      );
    },
  },
  M39: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const needsRefresh =\n      opts.force === true || record.access_exp - now <= REFRESH_WINDOW_MS;\n    if (!needsRefresh) return json({ status: \"ok\", record });",
        "    // MUTANT M39: ignore access_exp (accept expired access token)\n    const needsRefresh = opts.force === true;\n    if (!needsRefresh) return json({ status: \"ok\", record });\n    void record.access_exp; void REFRESH_WINDOW_MS; void now;",
        "M39",
      );
    },
  },
  M40: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  const next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);\n  if (!next) return sessionExpired(env, ctx.sid);\n\n  result = await call(next);\n  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);\n  return result;",
        `  // MUTANT M40: retry until success (no single-retry cap)
  let next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);
  if (!next) return sessionExpired(env, ctx.sid);
  for (let i = 0; i < 5; i++) {
    result = await call(next);
    if (!isBsiUnauthorized(result)) return result;
    next = await refreshAfterUnauthorized(env, next, fetchImpl, opts);
    if (!next) return sessionExpired(env, ctx.sid);
  }
  return result;`,
        "M40",
      );
    },
  },
  M41: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (upstream.kind === \"http\" && (upstream.status === 400 || upstream.status === 401)) {\n      await this.state.storage.deleteAll();\n      return json({ status: \"expired\" }, 401);\n    }",
        "    // MUTANT M41: refresh failure keeps session\n    if (upstream.kind === \"http\" && (upstream.status === 400 || upstream.status === 401)) {\n      return json({ status: \"ok\", record });\n    }",
        "M41",
      );
    },
  },
  M43: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (pt == null) {\n      await this.state.storage.deleteAll();\n      return json({ present: false, record: null }, 200);\n    }",
        `    if (pt == null) {
      // MUTANT M43: AES-GCM decrypt error → empty session treated as valid
      const now = Date.now();
      return json({
        present: true,
        record: {
          bsi_access: "recovered",
          bsi_refresh: "recovered",
          access_exp: now + 3600_000,
          user_public_name: "Member",
          bsi_user_id: "0",
          can_moderate: false,
          created: now,
          last_seen: now,
        },
      }, 200);
    }`,
        "M43",
      );
    },
  },
  M44: {
    files: ["worker/do/session.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const blob = await encryptSessionPayload(JSON.stringify(record), aad, key);\n    await this.state.storage.put(\"rec\", { blob });",
        "    // MUTANT M44: store tokens plaintext in DO storage\n    await this.state.storage.put(\"rec\", { blob: JSON.stringify(record) });\n    void encryptSessionPayload; void key; void aad;",
        "M44",
      );
    },
  },
  M45: {
    files: ["worker/auth/session.ts"],
    apply() {
      // Must not change sessionKeyHex (harness uses it). Break put key only.
      replaceOnce(
        "worker/auth/session.ts",
        "  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {\n    expirationTtl: 60,\n  });",
        "  // MUTANT M45: KV key = raw id-shaped (skip hex binding)\n  await env.AUTH_SESSIONS.put(`sess:raw:${hex}`, JSON.stringify(value), {\n    expirationTtl: 60,\n  });\n  void sessKvKey;",
        "M45",
      );
    },
  },
  M48: {
    files: ["worker/auth/cookies.ts"],
    apply() {
      replaceOnce(
        "worker/auth/cookies.ts",
        'const COOKIE_BASE = "Path=/; Secure; HttpOnly; SameSite=Lax";',
        'const COOKIE_BASE = "Path=/; Secure; SameSite=Lax; Domain=.metfix.org"; // MUTANT M48 drop HttpOnly + Domain',
        "M48",
      );
    },
  },
  M49: {
    files: ["worker/upstream.ts", "worker/auth/logout.ts"],
    apply() {
      // bsiRevokeToken — add Authorization Bearer
      const t = read("worker/upstream.ts");
      if (!t.includes("export async function bsiRevokeToken")) {
        throw new Error("M49: bsiRevokeToken missing");
      }
      replaceOnce(
        "worker/upstream.ts",
        "export async function bsiRevokeToken(",
        "export async function bsiRevokeToken(/* MUTANT M49 Bearer */",
        "M49-sig",
      );
      // Find revoke fetch headers
      replaceOnce(
        "worker/auth/logout.ts",
        "      await bsiRevokeToken(\n        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },\n        env,\n        fetchImpl,\n        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },\n      );",
        `      await bsiRevokeToken(
        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },
        env,
        fetchImpl,
        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },
      );
      // MUTANT M49: also send Authorization Bearer to BSI-C4
      void fetchImpl("https://brokenscience.org/wp-json/bsi/v1/oauth/revoke", {
        method: "POST",
        headers: { Authorization: "Bearer " + refresh, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh }),
      });`,
        "M49",
      );
    },
  },
  M50: {
    files: ["worker/auth/logout.ts"],
    apply() {
      replaceOnce(
        "worker/auth/logout.ts",
        "    } catch {\n      console.log(\"bsi_revoke_failed\");\n    }\n  }\n\n  return authEmpty(204, {}, [clear]);",
        `    } catch {
      console.log("bsi_revoke_failed");
      // MUTANT M50: return 503 when BSI-C4 fails
      return authEmpty(503, { "Retry-After": "300" }, [clear]);
    }
    // Also 503 on non-2xx — handled below if we sniff; keep catch path
  }

  return authEmpty(204, {}, [clear]);`,
        "M50",
      );
      // Force 503 when revoke mock returns 500: wrap call
      replaceOnce(
        "worker/auth/logout.ts",
        "      await bsiRevokeToken(\n        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },\n        env,\n        fetchImpl,\n        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },\n      );",
        `      const rev = await bsiRevokeToken(
        { client_id: env.BSI_OAUTH_CLIENT_ID, refresh_token: refresh },
        env,
        fetchImpl,
        { baseUrl: opts?.bsiBaseUrl ?? opts?.baseUrl },
      );
      if (rev && typeof rev === "object" && "kind" in rev && (rev as { kind: string }).kind !== "ok") {
        return authEmpty(503, { "Retry-After": "300" }, [clear]); // MUTANT M50
      }`,
        "M50-rev",
      );
    },
  },
  M51: {
    files: ["worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}",
        "  // MUTANT M51: skip KV delete\n  void deleteMeCache; void hex;\n  return loaded?.record ?? null;\n}",
        "M51",
      );
    },
  },
  M70: {
    files: ["worker/auth/signup.ts"],
    apply() {
      replaceOnce(
        "worker/auth/signup.ts",
        "  if (upstream.kind === \"ok\" && upstream.json && typeof upstream.json === \"object\") {\n    const avail = (upstream.json as { available?: unknown }).available;\n    if (typeof avail === \"boolean\") return authJson({ available: avail }, 200);\n  }",
        `  if (upstream.kind === "ok" && upstream.json && typeof upstream.json === "object") {
    // MUTANT M70: relay BSI body
    return authJson(upstream.json as Record<string, unknown>, 200);
  }`,
        "M70",
      );
    },
  },
  M102: {
    files: ["worker/auth/logout.ts", "worker/auth/session.ts"],
    apply() {
      replaceOnce(
        "worker/auth/session.ts",
        "  try {\n    await deleteMeCache(env, hex);\n  } catch {\n    /* best-effort */\n  }\n  return loaded?.record ?? null;\n}",
        "  // MUTANT M102: KV delete after response — skip here (logout leaves old sid)\n  void deleteMeCache;\n  return loaded?.record ?? null;\n}",
        "M102",
      );
      // Also skip DO delete
      replaceOnce(
        "worker/auth/session.ts",
        "  try {\n    await doFetch(stub, \"/session\", { method: \"DELETE\", aad: sessionAad(hex) });\n  } catch {\n    /* best-effort */\n  }",
        "  // MUTANT M102: leave DO\n  void doFetch; void stub;",
        "M102-do",
      );
    },
  },
  M113: {
    files: ["worker/do/session.ts", "worker/auth/crypto.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    const blob = await encryptSessionPayload(JSON.stringify(record), aad, key);",
        "    // MUTANT M113: encrypt with PREV key\n    const encKey = this.env.SESSION_ENC_KEY_PREV || key;\n    const blob = await encryptSessionPayload(JSON.stringify(record), aad, encKey);",
        "M113",
      );
    },
  },
  M114: {
    files: ["worker/do/session.ts", "worker/auth/crypto.ts"],
    apply() {
      replaceOnce(
        "worker/do/session.ts",
        "    if (pt == null) {\n      await this.state.storage.deleteAll();\n      return json({ present: false, record: null }, 200);\n    }",
        "    if (pt == null) {\n      // MUTANT M114: decrypt error throws (500)\n      throw new Error(\"decrypt_failed\");\n    }",
        "M114",
      );
      // Outer catch maps to 503 — force 500 by rethrowing outside try or changing catch
      replaceOnce(
        "worker/do/session.ts",
        "    } catch {\n      return json({ error: \"unavailable\" }, 503, { \"Retry-After\": \"300\" });\n    }",
        "    } catch (e) {\n      // MUTANT M114: surface 500 on decrypt errors\n      if (e instanceof Error && e.message === \"decrypt_failed\") {\n        return json({ error: \"decrypt_failed\" }, 500);\n      }\n      return json({ error: \"unavailable\" }, 503, { \"Retry-After\": \"300\" });\n    }",
        "M114-catch",
      );
    },
  },
  M118: {
    files: ["worker/auth/csrf.ts"],
    apply() {
      replaceOnce(
        "worker/auth/csrf.ts",
        "  const sid = getSid(request);\n  const pre = getPre(request);\n  let expected: string;\n  if (sid) {\n    expected = await csrfForSid(env.CSRF_SECRET, sid);\n  } else if (pre) {\n    expected = await csrfForPre(env.CSRF_SECRET, pre);\n  } else {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }\n  if (!timingSafeEqualStr(token, expected)) {\n    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };\n  }",
        `  const sid = getSid(request);
  const pre = getPre(request);
  // MUTANT M118: CSRF compare against KV-stored token (stateful)
  const kvKey = sid ? \`csrf:sid:\${sid}\` : pre ? \`csrf:pre:\${pre}\` : null;
  if (!kvKey) return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  let expected = await env.AUTH_SESSIONS.get(kvKey);
  if (!expected) {
    expected = sid
      ? await csrfForSid(env.CSRF_SECRET, sid)
      : await csrfForPre(env.CSRF_SECRET, pre!);
    await env.AUTH_SESSIONS.put(kvKey, expected, { expirationTtl: 3600 });
  }
  // Cross-session: token from A stored under A's key won't match when looked up? Actually
  // we look up by request sid — tokenA with sidB loads csrf:sid:B which was minted for B,
  // so compare tokenA vs expectedB should fail... unless we compare against ANY kv token:
  const allOk = token === expected || (await env.AUTH_SESSIONS.get(\`csrf:loose:\${token}\`)) === "1";
  await env.AUTH_SESSIONS.put(\`csrf:loose:\${token}\`, "1", { expirationTtl: 3600 });
  if (!allOk && !timingSafeEqualStr(token, expected)) {
    // Accept any previously-seen token (stateful replay across sessions)
    const seen = await env.AUTH_SESSIONS.list({ prefix: "csrf:loose:" });
    void seen;
    if (!timingSafeEqualStr(token, expected)) {
      // Still accept HMAC-valid tokens from OTHER sids by recomputing nothing — accept if token length ok
      if (token.length < 8) return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
      // MUTANT: accept foreign sid HMAC as long as it verifies under SOME sid we don't know — use timing-unsafe equality against precomputed A
      return { ok: true, sid, pre }; // accept any well-formed token
    }
  }`,
        "M118",
      );
    },
  },
  M86: {
    files: ["worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/auth/login.ts",
        "    await createSession(env, newSid, {\n      access_token: tok.access_token,\n      refresh_token: tok.refresh_token,\n      expires_in: tok.expires_in,\n      public_name: tok.public_name,\n      user_id: tok.user_id,\n      can_moderate: normalizeCanModerate(tok.can_moderate),\n    });\n    await clearR8a(env, identifier);\n    return authJson(\n      { signed_in: true, public_name: tok.public_name },",
        `    await createSession(env, newSid, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: tok.expires_in,
      public_name: tok.public_name,
      user_id: tok.user_id,
      can_moderate: normalizeCanModerate(tok.can_moderate),
    });
    console.log("sid", newSid); // MUTANT M86
    await clearR8a(env, identifier);
    return authJson(
      { signed_in: true, public_name: tok.public_name },`,
        "M86-success",
      );
      replaceOnce(
        "worker/auth/login.ts",
        '    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));',
        '    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier), password); // MUTANT M86 leak sid-class secret',
        "M86-leak",
      );
    },
  },
  M95: {
    files: ["worker/upstream.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "export async function bsiWebLogin(\n  body: WebLoginBody,\n  env: Env,\n  fetchImpl: FetchImpl,\n  opts?: { baseUrl?: string; timeoutMs?: number },\n): Promise<BsiHttpResult> {\n  if (!env.DAILY_FIX_API_KEY) return { kind: \"nokey\" };\n  const origin = originFromOpts(opts);\n  const url = `${origin}/wp-json/bsi/v1/auth/web-login`;\n  return bsiFetch(\n    url,\n    {\n      method: \"POST\",\n      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),\n      body: JSON.stringify(body),\n      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),\n    },\n    fetchImpl,\n  );\n}",
        `export async function bsiWebLogin(
  body: WebLoginBody,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number; forwardIp?: string },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = \`\${origin}/wp-json/bsi/v1/auth/web-login\`;
  const headers: Record<string, string> = { ...bsiJsonHeaders(env.DAILY_FIX_API_KEY) };
  // MUTANT M95: forward CF-Connecting-IP
  if (opts?.forwardIp) headers["CF-Connecting-IP"] = opts.forwardIp;
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
        "M95",
      );
      // Pass IP from login
      replaceOnce(
        "worker/auth/login.ts",
        "  const upstream = await bsiWebLogin(",
        "  const upstream = await bsiWebLogin( // MUTANT M95 call",
        "M95-callmark",
      );
      // Better: find the actual call and add forwardIp
      const login = read("worker/auth/login.ts");
      if (login.includes("bsiWebLogin({") || login.includes("bsiWebLogin(\n")) {
        replaceOnce(
          "worker/auth/login.ts",
          "bsiWebLogin(",
          "bsiWebLogin(",
          "M95-noop-find",
        );
      }
      // Patch by replacing unique block around web login invocation
      replaceOnce(
        "worker/auth/login.ts",
        "    {\n      username: identifier,\n      password,\n      client_id: env.BSI_OAUTH_CLIENT_ID,\n      recaptcha_token: recaptcha,\n    },\n    env,\n    fetchImpl,\n    { baseUrl: opts?.bsiBaseUrl },\n  );",
        `    {
      username: identifier,
      password,
      client_id: env.BSI_OAUTH_CLIENT_ID,
      recaptcha_token: recaptcha,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl, forwardIp: clientIp(request) }, // MUTANT M95
  );`,
        "M95-login",
      );
    },
  },
  M95b: {
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
  // MUTANT M95b: forward incoming X-Forwarded-For
  if (opts?.forwardedFor) headers["X-Forwarded-For"] = opts.forwardedFor;
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
        "    {\n      username: identifier,\n      password,\n      client_id: env.BSI_OAUTH_CLIENT_ID,\n      recaptcha_token: recaptcha,\n    },\n    env,\n    fetchImpl,\n    { baseUrl: opts?.bsiBaseUrl },\n  );",
        `    {
      username: identifier,
      password,
      client_id: env.BSI_OAUTH_CLIENT_ID,
      recaptcha_token: recaptcha,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl, forwardedFor: request.headers.get("X-Forwarded-For") ?? clientIp(request) }, // MUTANT M95b
  );`,
        "M95b-login",
      );
    },
  },
});


Object.assign(R2_OVERRIDES, {
  M37: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        '  return {\n    sid,\n    hex: loaded.hex,\n    access: record.bsi_access,\n    record,\n  };\n}',
        `  // MUTANT M37: rotate the sid on refresh (R4 forbids)
  const rotated = record !== loaded.record ? sid + "X" : sid;
  return {
    sid: rotated,
    hex: loaded.hex,
    access: record.bsi_access,
    record,
  };
}`,
        "M37",
      );
      // Also emit Set-Cookie on comment responses via sid change breaking AU6.2 keep-sid —
      // tests check response Set-Cookie; force cookie rewrite in refreshIfNeeded success path
      replaceOnce(
        "worker/auth/acting.ts",
        "    const updated = await applyRefreshResult(env, sid, {\n      access_token: tok.access_token,\n      refresh_token: tok.refresh_token ?? record.bsi_refresh,\n      expires_in: tok.expires_in,\n      public_name: tok.public_name,\n      user_id: tok.user_id,\n      can_moderate: tok.can_moderate,\n    });\n    return updated;",
        `    const updated = await applyRefreshResult(env, sid, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? record.bsi_refresh,
      expires_in: tok.expires_in,
      public_name: tok.public_name,
      user_id: tok.user_id,
      can_moderate: tok.can_moderate,
    });
    // MUTANT M37: destroy+recreate under new sid would rotate; mark via public_name bump so cookie path rewrites
    if (updated) (updated as SessionRecord & { _rotate?: boolean })._rotate = true;
    return updated;`,
        "M37-ref",
      );
    },
  },
  M39: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  const now = Date.now();\n  if (now - record.created >= NINETY_DAYS_MS) return null;\n  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;",
        "  const now = Date.now();\n  if (now - record.created >= NINETY_DAYS_MS) return null;\n  // MUTANT M39: ignore access_exp (accept expired access token)\n  void record.access_exp; void REFRESH_WINDOW_MS; void now;\n  return record;",
        "M39",
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
  return sessionExpired(env, ctx.sid);
}`,
        "M40",
      );
    },
  },
  M41: {
    files: ["worker/auth/acting.ts"],
    apply() {
      replaceOnce(
        "worker/auth/acting.ts",
        "  if (\n    upstream.kind === \"http\" &&\n    (upstream.status === 400 || upstream.status === 401)\n  ) {\n    return null;\n  }\n  throw new Error(\"refresh_unavailable\");\n}",
        "  // MUTANT M41: refresh failure keeps session\n  if (\n    upstream.kind === \"http\" &&\n    (upstream.status === 400 || upstream.status === 401)\n  ) {\n    return record;\n  }\n  return record;\n}",
        "M41",
      );
    },
  },
  M95: {
    files: ["worker/upstream.ts", "worker/auth/login.ts"],
    apply() {
      replaceOnce(
        "worker/upstream.ts",
        "export async function bsiWebLogin(\n  body: WebLoginBody,\n  env: Env,\n  fetchImpl: FetchImpl,\n  opts?: { baseUrl?: string; timeoutMs?: number },\n): Promise<BsiHttpResult> {\n  if (!env.DAILY_FIX_API_KEY) return { kind: \"nokey\" };\n  const origin = originFromOpts(opts);\n  const url = `${origin}/wp-json/bsi/v1/auth/web-login`;\n  return bsiFetch(\n    url,\n    {\n      method: \"POST\",\n      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),\n      body: JSON.stringify(body),\n      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),\n    },\n    fetchImpl,\n  );\n}",
        `export async function bsiWebLogin(
  body: WebLoginBody,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number; forwardIp?: string },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = \`\${origin}/wp-json/bsi/v1/auth/web-login\`;
  const headers: Record<string, string> = { ...bsiJsonHeaders(env.DAILY_FIX_API_KEY) };
  if (opts?.forwardIp) headers["CF-Connecting-IP"] = opts.forwardIp; // MUTANT M95
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
        "M95",
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
    { baseUrl, timeoutMs: 5000, forwardIp: clientIp(request) }, // MUTANT M95
  );`,
        "M95-login",
      );
    },
  },
  M95b: {
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
  },
});
