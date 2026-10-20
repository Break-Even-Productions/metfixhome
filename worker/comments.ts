/**
 * Daily Fix comments Worker handlers — GET shaping + write/like routes.
 */
import { isIsoDate } from "../shared/daily-fix";
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
import { jsonNoStore, unavailable } from "./auth/http";
import { loadSession } from "./auth/session";
import { csrfForSid, timingSafeEqualStr } from "./auth/crypto";

const COMMENT_TYPES = new Set(["belly", "body", "brain", "all"]);

function isCommentType(v: string): v is CommentType {
  return COMMENT_TYPES.has(v);
}

/** W7 whitelist shape: force Member display names until D-NAME. */
export function shapeCommentsPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const root = raw as { comments?: unknown };
  if (!root.comments || typeof root.comments !== "object") return raw;
  const grouped = root.comments as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ["belly", "body", "brain"] as const) {
    const threads = grouped[key];
    if (!Array.isArray(threads)) {
      out[key] = threads;
      continue;
    }
    out[key] = threads.map(shapeThread);
  }
  return { ...root, comments: out };
}

function shapeThread(thread: unknown): unknown {
  if (!thread || typeof thread !== "object") return thread;
  const t = { ...(thread as Record<string, unknown>) };
  const deleted = t.deleted;
  if (deleted === 2) {
    t.user = { display_name: "[Anonymous]" };
  } else {
    t.user = { display_name: "Member" };
  }
  if (Array.isArray(t.replies)) {
    t.replies = t.replies.map(shapeThread);
  }
  // Strip non-whitelist fields commonly leaked
  delete t.email;
  delete t.user_login;
  delete t.user_email;
  delete t.ip;
  return t;
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
  });
}

export async function handleCommentsRequest(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === "GET" || method === "HEAD") {
    return handleCommentsGet(request, env, fetchImpl, opts, method === "HEAD");
  }

  // Write routes: /api/daily-fix/comments and /api/daily-fix/comments/:id[/like]
  const path = url.pathname.replace(/\/+$/, "");
  const likeMatch = path.match(/\/api\/daily-fix\/comments\/([^/]+)\/like$/);
  const idMatch = path.match(/\/api\/daily-fix\/comments\/([^/]+)$/);

  if (method === "POST" && path.endsWith("/comments")) {
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

  return jsonNoStore({ error: "method_not_allowed" }, 405, {
    Allow: "GET, HEAD, POST, PATCH, DELETE",
  });
}

async function handleCommentsGet(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  head: boolean,
): Promise<Response> {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return jsonNoStore({ error: "invalid_date" }, 400);
  }
  const type = url.searchParams.get("type");
  if (!type || !isCommentType(type)) {
    return jsonNoStore({ error: "invalid_type" }, 400);
  }

  const outcome = await fetchDailyFixComments(date, type, env, fetchImpl, opts);
  if (outcome.kind === "ok") {
    let shaped: unknown;
    try {
      shaped = shapeCommentsPayload(JSON.parse(outcome.bodyText));
    } catch {
      return unavailable();
    }
    const body = JSON.stringify(shaped);
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (head) return new Response(null, { status: 200, headers });
    return new Response(body, { status: 200, headers });
  }
  if (outcome.kind === "not_found") {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  return unavailable();
}

async function requireSession(
  request: Request,
  env: Env,
): Promise<{ sid: string; access: string; userId: string } | Response> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) {
    return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
  }
  let loaded: Awaited<ReturnType<typeof loadSession>>;
  try {
    loaded = await loadSession(env, sid);
  } catch {
    return unavailable();
  }
  if (!loaded) {
    return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
  }
  return { sid, access: loaded.record.bsi_access, userId: loaded.record.bsi_user_id };
}

async function requireCsrf(request: Request, env: Env, sid: string): Promise<Response | null> {
  if (!env.CSRF_SECRET) return unavailable();
  const header = request.headers.get("X-CSRF-Token") ?? "";
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(header, expected)) {
    return jsonNoStore({ error: "forbidden" }, 403);
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== "https://metfix.org") {
    return jsonNoStore({ error: "forbidden" }, 403);
  }
  return null;
}

async function handleCommentPost(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;

  let body: { date?: unknown; type?: unknown; content?: unknown; parent_comment_id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const date = typeof body.date === "string" ? body.date : "";
  const type = typeof body.type === "string" ? body.type : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!isIsoDate(date) || !isCommentType(type) || type === "all" || !content || content.length > 4000) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  const upstream = await bsiPostComment(
    {
      date,
      type,
      content,
      parent_comment_id:
        typeof body.parent_comment_id === "number" ? body.parent_comment_id : undefined,
    },
    session.access,
    env,
    fetchImpl,
    opts,
  );
  return mapWriteResponse(upstream, 201);
}

async function handleCommentPatch(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;
  let body: { content?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const content = typeof body.content === "string" ? body.content : "";
  if (!content) return jsonNoStore({ error: "invalid_request" }, 400);
  const upstream = await bsiPatchComment(id, { content }, session.access, env, fetchImpl, opts);
  return mapWriteResponse(upstream, 200);
}

async function handleCommentDelete(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;
  const upstream = await bsiDeleteComment(id, session.access, env, fetchImpl, opts);
  if (upstream.kind === "ok" && (upstream.status === 200 || upstream.status === 204)) {
    return jsonNoStore({ deleted: true }, 200);
  }
  return mapWriteResponse(upstream, 200);
}

async function handleCommentLike(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const csrf = await requireCsrf(request, env, session.sid);
  if (csrf) return csrf;
  let body: { liked?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const liked = body.liked === true;
  const upstream = await bsiLikeComment(id, liked, session.access, env, fetchImpl, opts);
  return mapWriteResponse(upstream, 200);
}

function mapWriteResponse(
  upstream: Awaited<ReturnType<typeof bsiPostComment>>,
  okStatus: number,
): Response {
  if (upstream.kind === "rate_limited") {
    const ra = upstream.retryAfter ?? parseRetryAfter(null);
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }
  if (upstream.kind === "nokey" || upstream.kind === "unavailable") return unavailable();
  if (upstream.kind === "http") {
    if (upstream.status === 403) return jsonNoStore({ error: "cannot_post" }, 403);
    if (upstream.status === 401) {
      return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
    }
    return unavailable();
  }
  // ok
  if (okStatus === 201) {
    try {
      const json = shapeThread(
        (upstream.json as { comment?: unknown })?.comment ?? upstream.json,
      );
      return jsonNoStore({ comment: json }, 201);
    } catch {
      return unavailable();
    }
  }
  return jsonNoStore(upstream.json ?? { ok: true }, okStatus);
}
