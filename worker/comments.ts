/**
 * Daily Fix comments Worker handlers — GET shaping + write/like routes.
 */
import { isIsoDate } from "../shared/daily-fix";
import { publicDisplayName } from "./auth/public-name";
import {
  bsiDeleteComment,
  bsiLikeComment,
  bsiPatchComment,
  bsiPostComment,
  fetchDailyFixComments,
  parseRetryAfter,
  type CommentType,
  type Env,
  type FetchImpl,
} from "./upstream";
import { parseCookies, SID_COOKIE, sidCookieClear } from "./auth/cookies";
import { isAuthHost } from "./auth/host";
import { jsonNoStore, unavailable } from "./auth/http";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { csrfForSid, timingSafeEqualStr } from "./auth/crypto";
import { clientIp } from "./auth/throttle";
import { siteverifyComment } from "./auth/comment-siteverify";
import {
  checkCommentLikeLimit,
  checkCommentLikeToggleLimit,
  checkCommentWriteLimit,
} from "./auth/comment-rate-limit";

const COMMENT_TYPES = new Set(["belly", "body", "brain", "all"]);
const MAX_BODY_BYTES = 8192;
const MAX_CONTENT_CODEPOINTS = 2000;
const COMMENT_ID_RE = /^[1-9][0-9]{0,9}$/;
const ORIGIN = "https://metfix.org";

type CommentLimitEnv = Env & {
  COMMENT_WRITE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  COMMENT_LIKE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  COMMENT_LIKE_TOGGLE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
};

function isCommentType(v: string): v is CommentType {
  return COMMENT_TYPES.has(v);
}

function commentsCacheKeyRequest(isoDate: string): Request {
  return new Request(`https://cache.metfix.internal/daily-fix/comments?date=${isoDate}`);
}

function hasDuplicateQueryParam(url: URL, keys: string[]): boolean {
  const counts = new Map<string, number>();
  for (const key of url.searchParams.keys()) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.some((k) => (counts.get(k) ?? 0) > 1);
}

function logCommentsKind(kind: string): void {
  console.info(`daily-fix-comments kind=${kind}`);
}

function codePointLength(s: string): number {
  return [...s].length;
}

function isJsonContentType(ct: string | null): boolean {
  if (!ct) return false;
  const base = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  return base === "application/json";
}

/** W7 whitelist + W8 soft-delete + B4-W public display name. */
export function shapeCommentsPayload(
  raw: unknown,
  type: CommentType = "all",
  opts?: { viewerUserId?: string; includeLiked?: boolean },
): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as { comments?: unknown; meta?: unknown };
  const meta = "meta" in root ? root.meta : {};

  if (type === "all") {
    if (!root.comments || typeof root.comments !== "object" || Array.isArray(root.comments)) {
      return null;
    }
    const grouped = root.comments as Record<string, unknown>;
    const belly = shapeThreadList(grouped.belly, opts);
    const body = shapeThreadList(grouped.body, opts);
    const brain = shapeThreadList(grouped.brain, opts);
    if (!belly || !body || !brain) return null;
    return { comments: { belly, body, brain }, meta };
  }

  const list = shapeThreadList(root.comments, opts);
  if (!list) return null;
  return { comments: list, meta };
}

function shapeThreadList(
  threads: unknown,
  opts?: { viewerUserId?: string; includeLiked?: boolean },
): Record<string, unknown>[] | null {
  if (!Array.isArray(threads)) return null;
  const out: Record<string, unknown>[] = [];
  for (const thread of threads) {
    const shaped = shapeThread(thread, opts);
    if (shaped) out.push(shaped);
  }
  return out;
}

function shapeThread(
  thread: unknown,
  opts?: { viewerUserId?: string; includeLiked?: boolean; requireTimestamp?: boolean },
): Record<string, unknown> | null {
  if (!thread || typeof thread !== "object") return null;
  const t = thread as Record<string, unknown>;
  const deleted = typeof t.deleted === "number" ? t.deleted : Number(t.deleted);
  if (deleted === 1) return null; // W8 soft-delete: omit row + replies

  const id = t.id;
  if (typeof id !== "number" && typeof id !== "string") return null;
  if (typeof t.content !== "string") return null;
  if (opts?.requireTimestamp && typeof t.timestamp !== "string") return null;

  const userRaw =
    t.user && typeof t.user === "object" && !Array.isArray(t.user)
      ? (t.user as {
          display_name?: unknown;
          id?: unknown;
        })
      : null;
  const displayName =
    deleted === 2 ? "[Anonymous]" : publicDisplayName(userRaw, { allowAnonymous: false });

  const repliesIn = Array.isArray(t.replies) ? t.replies : [];
  const replies: Record<string, unknown>[] = [];
  for (const child of repliesIn) {
    const shaped = shapeThread(child, opts);
    if (shaped) replies.push(shaped);
  }

  const row: Record<string, unknown> = {
    id: typeof id === "number" ? id : Number(id),
    user: { display_name: displayName },
    content: t.content,
    timestamp: typeof t.timestamp === "string" ? t.timestamp : null,
    like_count: typeof t.like_count === "number" ? t.like_count : 0,
    parent_id: t.parent_id == null ? null : t.parent_id,
    deleted: deleted === 2 ? 2 : 0,
    edited: typeof t.edited === "number" ? t.edited : 0,
    replies,
  };

  if (opts?.viewerUserId != null) {
    const ownerId =
      t.user_id != null
        ? String(t.user_id)
        : userRaw && (typeof userRaw.id === "number" || typeof userRaw.id === "string")
          ? String(userRaw.id)
          : null;
    row.own = ownerId != null && ownerId === opts.viewerUserId;
  }

  if (opts?.includeLiked === true && typeof t.liked === "boolean") {
    row.liked = t.liked;
  }

  return row;
}

/** Index entrypoint (nullable for path fall-through). */
export async function handleCommentsRoutes(
  request: Request,
  env: Env,
  deps: {
    fetchImpl?: FetchImpl;
    cachesDefault?: Cache;
    bsiBaseUrl?: string;
  } = {},
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== "/api/daily-fix/comments" && !path.startsWith("/api/daily-fix/comments/")) {
    return null;
  }
  // Trailing slash on collection → 404 (W1).
  if (path === "/api/daily-fix/comments/") {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  return handleCommentsRequest(request, env, deps.fetchImpl ?? fetch, {
    baseUrl: deps.bsiBaseUrl,
    cache: deps.cachesDefault,
  });
}

export async function handleCommentsRequest(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; cache?: Cache },
): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname;

  if (method === "GET" || method === "HEAD") {
    // Collection GET only — /comments/:id → 404 (W1.2).
    if (path !== "/api/daily-fix/comments") {
      return jsonNoStore({ error: "not_found" }, 404);
    }
    // Resolve session outside handleCommentsGet so W9.4 source scan stays clean.
    let acting: ActingContext | null = null;
    const cookies = parseCookies(request.headers.get("Cookie"));
    if (cookies[SID_COOKIE]) {
      const resolved = await resolveActingSession(request, env, fetchImpl, opts);
      if (!(resolved instanceof Response)) acting = resolved;
    }
    return handleCommentsGet(request, env, fetchImpl, opts, method === "HEAD", acting);
  }

  // AUTH-HOST (AU25.1 / D-3): writes 404 off exact Host metfix.org before session.
  if (!isAuthHost(request, env)) {
    return jsonNoStore({ error: "not_found" }, 404);
  }

  const likeMatch = path.match(/^\/api\/daily-fix\/comments\/([^/]+)\/like$/);
  const idMatch = path.match(/^\/api\/daily-fix\/comments\/([^/]+)$/);

  if (method === "POST" && path === "/api/daily-fix/comments") {
    return handleCommentPost(request, env, fetchImpl, opts);
  }
  if (likeMatch && method === "POST") {
    return handleCommentLike(request, env, fetchImpl, opts, likeMatch[1]!);
  }
  if (idMatch && method === "PATCH") {
    return handleCommentPatch(request, env, fetchImpl, opts, idMatch[1]!);
  }
  if (idMatch && method === "DELETE") {
    return handleCommentDelete(request, env, fetchImpl, opts, idMatch[1]!);
  }

  // Collection wrong methods (W2.1): Allow exactly GET, HEAD, POST.
  if (path === "/api/daily-fix/comments") {
    return jsonNoStore({ error: "method_not_allowed" }, 405, {
      Allow: "GET, HEAD, POST",
    });
  }
  if (likeMatch) {
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }
  if (idMatch) {
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "PATCH, DELETE" });
  }
  return jsonNoStore({ error: "not_found" }, 404);
}

async function handleCommentsGet(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  head: boolean,
  acting: ActingContext | null,
): Promise<Response> {
  const url = new URL(request.url);
  if (hasDuplicateQueryParam(url, ["date", "type"])) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return jsonNoStore({ error: "invalid_date" }, 400);
  }
  const type = url.searchParams.get("type");
  if (!type || !isCommentType(type)) {
    return jsonNoStore({ error: "invalid_type" }, 400);
  }

  const signedIn = acting != null;
  const cache = opts?.cache ?? caches.default;
  if (!signedIn && type === "all") {
    const cached = await cache.match(commentsCacheKeyRequest(date));
    if (cached) {
      if (head) return new Response(null, { status: cached.status, headers: cached.headers });
      return cached;
    }
  }

  const outcome = await fetchDailyFixComments(date, type, env, fetchImpl, {
    baseUrl: opts?.baseUrl,
    accessToken: signedIn ? acting.access : undefined,
  });
  if (outcome.kind === "ok") {
    let shaped: unknown;
    try {
      shaped = shapeCommentsPayload(JSON.parse(outcome.bodyText), type, {
        viewerUserId: signedIn ? acting.record.bsi_user_id : undefined,
        includeLiked: signedIn,
      });
    } catch {
      return unavailable();
    }
    if (shaped == null) return unavailable();
    const body = JSON.stringify(shaped);
    if (signedIn) {
      const headers = new Headers({
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (head) return new Response(null, { status: 200, headers });
      return new Response(body, { status: 200, headers });
    }
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
    });
    if (type === "all" && !head) {
      await cache.put(commentsCacheKeyRequest(date), new Response(body, { status: 200, headers }));
    }
    if (head) return new Response(null, { status: 200, headers });
    return new Response(body, { status: 200, headers });
  }
  if (outcome.kind === "bad_request") {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  if (outcome.kind === "not_found") {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  if (outcome.kind === "unauthorized") {
    logCommentsKind("unauthorized");
    return unavailable();
  }
  if (outcome.kind === "forbidden") {
    logCommentsKind("forbidden");
    return unavailable();
  }
  if (outcome.kind === "rate_limited") {
    // W6.5: GET maps 429 → 503 unavailable; RA from parseRetryAfter (default 60).
    return unavailable(outcome.retryAfter);
  }
  return unavailable();
}

async function requireSession(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  return resolveActingSession(request, env, fetchImpl, opts);
}

async function requireCsrf(request: Request, env: Env, sid: string): Promise<Response | null> {
  if (!env.CSRF_SECRET) return unavailable();
  const origin = request.headers.get("Origin");
  if (origin !== ORIGIN) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs != null && sfs !== "same-origin") {
    return jsonNoStore({ error: "forbidden" }, 403);
  }
  const header = request.headers.get("X-CSRF-Token") ?? "";
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(header, expected)) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }
  return null;
}

async function readJsonBodyLimited(
  request: Request,
): Promise<{ ok: true; text: string; json: unknown } | Response> {
  if (!isJsonContentType(request.headers.get("Content-Type"))) {
    return jsonNoStore({ error: "unsupported_media_type" }, 415);
  }
  const cl = request.headers.get("Content-Length");
  if (cl != null) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return jsonNoStore({ error: "payload_too_large" }, 413);
    }
  }
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    return jsonNoStore({ error: "payload_too_large" }, 413);
  }
  const text = new TextDecoder().decode(buf);
  try {
    return { ok: true, text, json: JSON.parse(text) };
  } catch {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
}

function validateContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (codePointLength(trimmed) > MAX_CONTENT_CODEPOINTS) return null;
  return trimmed;
}

function validateParentId(raw: unknown): number | undefined | "bad" {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 9_999_999_999) {
    return "bad";
  }
  return raw;
}

async function verifyCommentRecaptcha(
  token: unknown,
  env: Env,
  fetchImpl: FetchImpl,
): Promise<Response | null> {
  if (typeof token !== "string" || token.length === 0) {
    return jsonNoStore({ error: "try_again" }, 403);
  }
  if (!env.RECAPTCHA_SECRET) return unavailable();
  const sv = await siteverifyComment(token, env.RECAPTCHA_SECRET, fetchImpl);
  if (sv === "fail") return jsonNoStore({ error: "try_again" }, 403);
  if (sv === "outage") return unavailable();
  return null;
}

async function purgeCommentsDate(cache: Cache | undefined, date: string | null): Promise<void> {
  if (!date || !isIsoDate(date)) return;
  const c = cache ?? caches.default;
  await c.delete(commentsCacheKeyRequest(date));
}

function dateFromRequest(request: Request, body?: Record<string, unknown>): string | null {
  const q = new URL(request.url).searchParams.get("date");
  if (q && isIsoDate(q)) return q;
  if (body && typeof body.date === "string" && isIsoDate(body.date)) return body.date;
  return null;
}

async function handleCommentPost(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; cache?: Cache },
): Promise<Response> {
  const ctx = await requireSession(request, env, fetchImpl, opts);
  if (ctx instanceof Response) return ctx;
  if (!ctx.access) return unavailable();
  const csrf = await requireCsrf(request, env, ctx.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "";
  const type = typeof body.type === "string" ? body.type : "";
  const content = validateContent(body.content);
  const parent = validateParentId(body.parent_comment_id);
  if (
    !isIsoDate(date) ||
    !isCommentType(type) ||
    type === "all" ||
    content == null ||
    parent === "bad"
  ) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(env as CommentLimitEnv, ctx.record.bsi_user_id, ip);
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const recaptchaFail = await verifyCommentRecaptcha(body.recaptcha, env, fetchImpl);
  if (recaptchaFail) return recaptchaFail;

  const upstreamBody: {
    date: string;
    type: string;
    content: string;
    parent_comment_id?: number;
  } = { date, type, content };
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;

  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, (access) =>
    bsiPostComment(upstreamBody, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  return mapWriteResponse(ran.result, 201, opts?.cache, date);
}

async function handleCommentPatch(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateContent(body.content);
  if (content == null) return jsonNoStore({ error: "invalid_request" }, 400);

  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(
    env as CommentLimitEnv,
    session.record.bsi_user_id,
    ip,
  );
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const date = dateFromRequest(request, body);
  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPatchComment(id, { content }, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  return mapWriteResponse(ran.result, 200, opts?.cache, date, "patch");
}

async function handleCommentDelete(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const ip = clientIp(request);
  const limited = await checkCommentWriteLimit(
    env as CommentLimitEnv,
    session.record.bsi_user_id,
    ip,
  );
  if (!limited.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const date = dateFromRequest(request);
  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiDeleteComment(id, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  const upstream = ran.result;
  if (upstream.kind === "ok" && upstream.status === 204) {
    // CQ r2: 204 delete must purge Worker comments cache, then pass through 204.
    await purgeCommentsDate(opts?.cache, date);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (upstream.kind === "ok" && upstream.status === 200) {
    await purgeCommentsDate(opts?.cache, date);
    return jsonNoStore({ deleted: true }, 200);
  }
  return mapWriteResponse(upstream, 200, opts?.cache, date, "delete");
}

async function handleCommentLike(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string; cache?: Cache } | undefined,
  id: string,
): Promise<Response> {
  if (!COMMENT_ID_RE.test(id)) return jsonNoStore({ error: "not_found" }, 404);
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const parsed = await readJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  if (typeof body.liked !== "boolean") {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const liked = body.liked;

  const ip = clientIp(request);
  const likeLim = await checkCommentLikeLimit(
    env as CommentLimitEnv,
    session.record.bsi_user_id,
    ip,
  );
  if (!likeLim.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }
  const toggleLim = await checkCommentLikeToggleLimit(
    env as CommentLimitEnv,
    session.record.bsi_user_id,
    id,
  );
  if (!toggleLim.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const date = dateFromRequest(request, body);
  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiLikeComment(id, liked, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  return mapWriteResponse(ran.result, 200, opts?.cache, date, "like");
}

async function mapWriteResponse(
  upstream: Awaited<ReturnType<typeof bsiPostComment>>,
  okStatus: number,
  cache: Cache | undefined,
  date: string | null,
  kind: "post" | "patch" | "delete" | "like" = "post",
): Promise<Response> {
  if (upstream.kind === "rate_limited") {
    // upstream.retryAfter already clamped via parseRetryAfter in mapWriteResult.
    const ra = upstream.retryAfter ?? parseRetryAfter(null);
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }
  if (upstream.kind === "nokey" || upstream.kind === "unavailable") return unavailable();
  if (upstream.kind === "http") {
    if (upstream.status === 409 || upstream.code === "comment_deleted") {
      return jsonNoStore({ error: "comment_deleted" }, 409);
    }
    if (upstream.status === 400 || upstream.code === "invalid_parent") {
      if (kind === "post") return jsonNoStore({ error: "invalid_parent" }, 400);
      return jsonNoStore({ error: "invalid_request" }, 400);
    }
    if (upstream.status === 403) {
      if (kind === "post") return jsonNoStore({ error: "cannot_post" }, 403);
      return jsonNoStore({ error: "forbidden" }, 403);
    }
    if (upstream.status === 401) {
      return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
    }
    if (upstream.status === 404) return jsonNoStore({ error: "not_found" }, 404);
    return unavailable();
  }
  // ok
  if (okStatus === 201) {
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = shapeThread(commentRaw, { requireTimestamp: true });
    if (
      json == null ||
      typeof json.id !== "number" ||
      !Number.isFinite(json.id) ||
      typeof json.content !== "string" ||
      typeof json.timestamp !== "string"
    ) {
      return unavailable();
    }
    await purgeCommentsDate(cache, date);
    return jsonNoStore({ comment: json }, 201);
  }
  if (kind === "delete") {
    await purgeCommentsDate(cache, date);
    return jsonNoStore({ deleted: true }, 200);
  }
  if (kind === "patch") {
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = shapeThread(commentRaw, { requireTimestamp: true });
    if (json == null) return unavailable();
    await purgeCommentsDate(cache, date);
    return jsonNoStore({ comment: json }, 200);
  }
  if (kind === "like") {
    await purgeCommentsDate(cache, date);
    const j = upstream.json;
    if (j && typeof j === "object") return jsonNoStore(j, 200);
    return jsonNoStore({ ok: true }, 200);
  }
  await purgeCommentsDate(cache, date);
  return jsonNoStore(upstream.json ?? { ok: true }, okStatus);
}
