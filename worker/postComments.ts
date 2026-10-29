/**
 * Post detail comments — GET/POST /api/posts/:id/comments and PATCH/DELETE …/:commentId.
 */
import { POST_ID_RE, POST_ID_MAX } from "../shared/posts/constants";
import { publicDisplayName } from "./auth/public-name";
import {
  COMMENT_ID_RE,
  readCommentJsonBodyLimited,
  requireCommentCsrf,
  validateCommentContent,
  validateCommentParentId,
  verifyCommentRecaptcha,
} from "./comments";
import { parseCookies, SID_COOKIE } from "./auth/cookies";
import { isAuthHost } from "./auth/host";
import { jsonNoStore, unavailable } from "./auth/http";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { clientIp } from "./auth/throttle";
import {
  checkCommentLikeLimit,
  checkCommentLikeToggleLimit,
  checkCommentWriteLimit,
} from "./auth/comment-rate-limit";
import {
  bsiDeletePostComment,
  bsiPatchPostComment,
  bsiPostPostComment,
  bsiTogglePostCommentLike,
  fetchPostComments,
  parseRetryAfter,
  type Env,
  type FetchImpl,
} from "./upstream";
import { isValidPostId } from "./posts";

type CommentLimitEnv = Env & {
  COMMENT_WRITE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
};

export function parsePositiveInt(raw: string): number | null {
  if (!POST_ID_RE.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > POST_ID_MAX) return null;
  return n;
}

const PII_USER_KEYS = new Set([
  "email",
  "user_email",
  "ip",
  "ip_address",
  "user_ip",
  "avatar_url",
]);

export function sanitizePublicName(displayName: unknown): string {
  return publicDisplayName({ display_name: displayName });
}

function stripCommentUser(user: unknown): Record<string, unknown> | null {
  if (!user || typeof user !== "object" || Array.isArray(user)) return null;
  const u = user as Record<string, unknown>;
  const out: Record<string, unknown> = {
    display_name: sanitizePublicName(u.display_name),
  };
  if (typeof u.id === "number" && Number.isFinite(u.id)) {
    out.id = u.id;
  }
  return out;
}

export function stripCommentPii(comment: unknown): Record<string, unknown> | null {
  if (!comment || typeof comment !== "object" || Array.isArray(comment)) return null;
  const c = comment as Record<string, unknown>;
  const id = c.id;
  if (typeof id !== "number" && typeof id !== "string") return null;
  if (typeof c.content !== "string") return null;

  const user = stripCommentUser(c.user);
  if (!user) return null;

  const repliesIn = Array.isArray(c.replies) ? c.replies : [];
  const replies: Record<string, unknown>[] = [];
  for (const child of repliesIn) {
    const shaped = stripCommentPii(child);
    if (shaped) replies.push(shaped);
  }

  const row: Record<string, unknown> = {
    id: typeof id === "number" ? id : Number(id),
    user,
    content: c.content,
    date: typeof c.date === "string" ? c.date : typeof c.timestamp === "string" ? c.timestamp : null,
    parent_id: c.parent_id == null ? null : c.parent_id,
    replies,
  };

  for (const key of Object.keys(c)) {
    if (PII_USER_KEYS.has(key)) continue;
    if (key in row) continue;
    if (key === "user") continue;
  }

  return row;
}

function shapePostCommentsPayload(raw: unknown): { comments: unknown[]; meta: unknown } | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as { comments?: unknown; meta?: unknown };
  if (!Array.isArray(root.comments)) return null;
  const comments: unknown[] = [];
  for (const item of root.comments) {
    const shaped = stripCommentPii(item);
    if (shaped) comments.push(shaped);
  }
  const meta =
    root.meta && typeof root.meta === "object" && !Array.isArray(root.meta) ? root.meta : {};
  return { comments, meta };
}

function commentsNoStoreHeaders(sessionCookie: boolean): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (sessionCookie) headers.Vary = "Cookie";
  return headers;
}

type PostCommentsRoute = {
  postId: string;
  commentId: string | null;
  like: boolean;
};

function parsePostCommentsPath(path: string): PostCommentsRoute | null {
  if (path.endsWith("/") && path.includes("/comments/")) return null;
  const likeMatch = path.match(/^\/api\/posts\/([^/]+)\/comments\/([^/]+)\/like$/);
  if (likeMatch) {
    const postId = likeMatch[1]!;
    const commentId = likeMatch[2]!;
    if (!isValidPostId(postId)) return null;
    if (!COMMENT_ID_RE.test(commentId)) return null;
    return { postId, commentId, like: true };
  }
  const m = path.match(/^\/api\/posts\/([^/]+)\/comments(?:\/([^/]+))?$/);
  if (!m) return null;
  const postId = m[1]!;
  const commentId = m[2] ?? null;
  if (!isValidPostId(postId)) return null;
  if (commentId != null && !COMMENT_ID_RE.test(commentId)) return null;
  return { postId, commentId, like: false };
}

export async function handlePostCommentsRoutes(
  request: Request,
  env: Env,
  deps: {
    fetchImpl?: FetchImpl;
    bsiBaseUrl?: string;
  } = {},
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const parsed = parsePostCommentsPath(path);
  if (!parsed) return null;
  if (path === `/api/posts/${parsed.postId}/comments/`) {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  return handlePostCommentsRequest(request, env, parsed, deps.fetchImpl ?? fetch, {
    baseUrl: deps.bsiBaseUrl,
  });
}

async function handlePostCommentsRequest(
  request: Request,
  env: Env,
  route: PostCommentsRoute,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  const method = request.method.toUpperCase();
  const { postId, commentId } = route;

  if (route.like && commentId != null) {
    if (method === "POST") {
      return handlePostCommentLike(request, env, postId, commentId, fetchImpl, opts);
    }
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }

  if (commentId == null) {
    if (method === "GET" || method === "HEAD") {
      return handlePostCommentsGet(request, env, postId, fetchImpl, opts, method === "HEAD");
    }
    if (method === "POST") {
      return handlePostCommentPost(request, env, postId, fetchImpl, opts);
    }
    if (method === "PATCH" || method === "PUT" || method === "DELETE") {
      return jsonNoStore({ error: "not_found" }, 404);
    }
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD, POST" });
  }

  if (method === "PATCH" || method === "PUT") {
    return handlePostCommentPatch(request, env, postId, commentId, fetchImpl, opts);
  }
  if (method === "DELETE") {
    return handlePostCommentDelete(request, env, postId, commentId, fetchImpl, opts);
  }
  if (method === "GET" || method === "HEAD") {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "PATCH, PUT, DELETE" });
}

async function handlePostCommentsGet(
  request: Request,
  env: Env,
  postId: string,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  head: boolean,
): Promise<Response> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const hasSid = Boolean(cookies[SID_COOKIE]);
  let acting: ActingContext | null = null;
  if (hasSid) {
    const resolved = await resolveActingSession(request, env, fetchImpl, opts);
    if (resolved instanceof Response) return resolved;
    acting = resolved;
  }

  const signedIn = acting != null;
  const fetchComments = (access?: string) =>
    fetchPostComments(postId, env, fetchImpl, { ...opts, accessToken: access });

  let outcome = signedIn
    ? await (async () => {
        const ran = await runUserBsiCall(acting!, env, fetchImpl, opts, (access) =>
          fetchComments(access),
        );
        if (ran instanceof Response) return ran;
        return ran.result;
      })()
    : await fetchComments();

  if (outcome instanceof Response) return outcome;

  if (outcome.kind === "ok") {
    let shaped: ReturnType<typeof shapePostCommentsPayload>;
    try {
      shaped = shapePostCommentsPayload(JSON.parse(outcome.bodyText));
    } catch {
      return unavailable();
    }
    if (shaped == null) return unavailable();
    const headers = commentsNoStoreHeaders(hasSid);
    if (head) return new Response(null, { status: 200, headers });
    return new Response(JSON.stringify(shaped), { status: 200, headers });
  }
  if (outcome.kind === "not_found") return jsonNoStore({ error: "not_found" }, 404);
  if (outcome.kind === "bad_request") return jsonNoStore({ error: "invalid_request" }, 400);
  if (outcome.kind === "rate_limited") return unavailable(outcome.retryAfter);
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

async function handlePostCommentPost(
  request: Request,
  env: Env,
  postId: string,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  const ctx = await requireSession(request, env, fetchImpl, opts);
  if (ctx instanceof Response) return ctx;
  if (!ctx.access) return unavailable();
  const csrf = await requireCommentCsrf(request, env, ctx.sid);
  if (csrf) return csrf;

  const parsed = await readCommentJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateCommentContent(body.content);
  const parent = validateCommentParentId(body.parent_comment_id);
  if (content == null || parent === "bad") {
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

  const upstreamBody: { content: string; parent_comment_id?: number } = { content };
  if (parent !== undefined) upstreamBody.parent_comment_id = parent;

  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, (access) =>
    bsiPostPostComment(postId, upstreamBody, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  return mapPostWriteResponse(ran.result, 201, "post");
}

async function handlePostCommentPatch(
  request: Request,
  env: Env,
  postId: string,
  commentId: string,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCommentCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const parsed = await readCommentJsonBodyLimited(request);
  if (parsed instanceof Response) return parsed;
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }
  const body = parsed.json as Record<string, unknown>;
  const content = validateCommentContent(body.content);
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

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPatchPostComment(postId, commentId, { content }, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  return mapPostWriteResponse(ran.result, 200, "patch");
}

async function handlePostCommentDelete(
  request: Request,
  env: Env,
  postId: string,
  commentId: string,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCommentCsrf(request, env, session.sid);
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

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiDeletePostComment(postId, commentId, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  const upstream = ran.result;
  if (upstream.kind === "ok" && upstream.status === 204) {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return mapPostWriteResponse(upstream, 200, "delete");
}

async function handlePostCommentLike(
  request: Request,
  env: Env,
  postId: string,
  commentId: string,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) {
    return jsonNoStore({ error: "not_found" }, 404);
  }
  const session = await requireSession(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;
  if (!session.access) return unavailable();
  const csrf = await requireCommentCsrf(request, env, session.sid);
  if (csrf) return csrf;

  const parsed = await readCommentJsonBodyLimited(request);
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
    commentId,
  );
  if (!toggleLim.allowed) {
    return jsonNoStore(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(parseRetryAfter(null)) },
    );
  }

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiTogglePostCommentLike(postId, commentId, liked, access, env, fetchImpl, opts),
  );
  if (ran instanceof Response) return ran;
  return mapPostWriteResponse(ran.result, 200, "like");
}

async function mapPostWriteResponse(
  upstream: Awaited<ReturnType<typeof bsiPostPostComment>>,
  okStatus: number,
  kind: "post" | "patch" | "delete" | "like",
): Promise<Response> {
  if (upstream.kind === "rate_limited") {
    const ra = upstream.retryAfter ?? parseRetryAfter(null);
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
  }
  if (upstream.kind === "nokey" || upstream.kind === "unavailable") return unavailable();
  if (upstream.kind === "http") {
    if (upstream.status === 409) return jsonNoStore({ error: "comment_deleted" }, 409);
    if (upstream.status === 400) return jsonNoStore({ error: "invalid_request" }, 400);
    if (upstream.status === 403) return jsonNoStore({ error: "forbidden" }, 403);
    if (upstream.status === 401) {
      return jsonNoStore({ error: "signed_out" }, 401);
    }
    if (upstream.status === 404) return jsonNoStore({ error: "not_found" }, 404);
    return unavailable();
  }
  if (okStatus === 201) {
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = stripCommentPii(commentRaw);
    if (json == null) return unavailable();
    return jsonNoStore({ comment: json }, 201);
  }
  if (kind === "delete") {
    return jsonNoStore({ deleted: true }, 200);
  }
  if (kind === "patch") {
    const commentRaw =
      (upstream.json as { comment?: unknown })?.comment ?? upstream.json;
    const json = stripCommentPii(commentRaw);
    if (json == null) return unavailable();
    return jsonNoStore({ comment: json }, 200);
  }
  return jsonNoStore(upstream.json ?? { ok: true }, okStatus);
}
