import {
  BSI_POSTS_BASE,
  MAX_PAGE,
  MAX_UPSTREAM_BYTES,
  PAGE_RE,
  PAGE_SIZE,
  POST_ID_MAX,
  POST_ID_RE,
  isPostDetailBody,
  isPostListBody,
  isUnlockedPost,
  mapDetailResponse,
  mapListResponse,
  postsDetailCacheKey,
  postsListCacheKey,
  buildPostsHead,
  type PostDetailBody,
  type PostListBody,
  type PostsHead,
} from "../shared/posts";
import { rewriteHtml, type HeadMode } from "./head";
import { assertBsiHost, UPSTREAM_USER_AGENT, type Env } from "./upstream";

export type PostsDeps = {
  fetchImpl?: typeof fetch;
  cachesDefault?: Cache;
};

type CachePutMode = "waitUntil" | "await";

type ListOk = { kind: "ok"; body: PostListBody; jsonText: string };
type DetailOk = { kind: "ok"; body: PostDetailBody; jsonText: string };
type PostsFail =
  | { kind: "nokey" }
  | { kind: "not_found" }
  | { kind: "unavailable" };

type ListResult = ListOk | PostsFail;
type DetailResult = DetailOk | PostsFail;

const LIST_S_MAXAGE = 300;
const DETAIL_S_MAXAGE = 600;

/** Read posts key once. Empty / whitespace-only → missing (Q3: never trim and send). */
function readPostsApiKey(env: Env): string | null {
  const key = env.BSI_POSTS_API_KEY;
  if (key == null || key === "") return null;
  if (/^\s*$/.test(key)) return null;
  return key;
}

function apiOkHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  extra: HeadersInit,
  head: boolean,
): Response {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (head) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers });
}

function unavailableJson(head: boolean): Response {
  return jsonResponse(
    { error: "unavailable" },
    503,
    { "Retry-After": "300", "Cache-Control": "no-store" },
    head,
  );
}

function notFoundJson(head: boolean): Response {
  return jsonResponse(
    { error: "not_found" },
    404,
    { "Cache-Control": "public, max-age=60" },
    head,
  );
}

function badPageJson(head: boolean): Response {
  return jsonResponse({ error: "bad_page" }, 400, { "Cache-Control": "no-store" }, head);
}

function methodNotAllowed(head: boolean): Response {
  return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" }, head);
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      Location: location,
      "Cache-Control": "max-age=3600",
    },
  });
}

function indexAssetRequest(request: Request): Request {
  const url = new URL("/", request.url);
  return new Request(url.toString(), {
    method: "GET",
    headers: { Accept: "text/html" },
  });
}

async function fetchIndexHtml(request: Request, env: Env): Promise<Response> {
  const assetRes = await env.ASSETS.fetch(indexAssetRequest(request));
  if (assetRes.status !== 200) {
    throw new Error(`ASSETS index fetch returned ${assetRes.status}`);
  }
  return assetRes;
}

async function htmlNotFound(request: Request, env: Env): Promise<Response> {
  const isHead = request.method.toUpperCase() === "HEAD";
  let assetRes: Response;
  try {
    assetRes = await fetchIndexHtml(request, env);
  } catch {
    return new Response(isHead ? null : "Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
  const rewritten = rewriteHtml(assetRes, { mode: "generic_noindex" });
  const headers = new Headers(rewritten.headers);
  if (isHead) return new Response(null, { status: 404, headers });
  return new Response(rewritten.body, { status: 404, headers });
}

async function htmlServiceUnavailable(
  request: Request,
  env: Env,
  isHead: boolean,
  assetsFailed = false,
): Promise<Response> {
  if (assetsFailed) {
    return new Response(isHead ? null : "Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
  let assetRes: Response;
  try {
    assetRes = await fetchIndexHtml(request, env);
  } catch {
    return new Response(isHead ? null : "Service Unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
  const rewritten = rewriteHtml(assetRes, { mode: "generic" });
  const headers = new Headers(rewritten.headers);
  headers.set("Retry-After", "300");
  headers.set("Cache-Control", "no-store");
  if (isHead) return new Response(null, { status: 503, headers });
  return new Response(rewritten.body, { status: 503, headers });
}

async function htmlOk(
  request: Request,
  env: Env,
  plan: HeadMode,
  isHead: boolean,
): Promise<Response> {
  let assetRes: Response;
  try {
    assetRes = await fetchIndexHtml(request, env);
  } catch {
    return htmlServiceUnavailable(request, env, isHead, true);
  }
  const bodyRes = rewriteHtml(assetRes, plan);
  const headers = new Headers(bodyRes.headers);
  const cc = headers.get("Cache-Control");
  if (cc && /s-maxage/i.test(cc)) {
    headers.delete("Cache-Control");
  }
  if (isHead) return new Response(null, { status: 200, headers });
  return new Response(bodyRes.body, { status: 200, headers });
}

/**
 * Parse list `page` from the raw query string (Q1/Q2).
 * - exact name `page` only; any name starting case-insensitively with `page` otherwise → bad
 * - raw value must match PAGE_RE and ≤ MAX_PAGE; repeated → bad
 * - unrelated params ignored
 */
export function parseListPage(
  search: string,
): { ok: true; page: number } | { ok: false; reason: "bad_page" } {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (raw === "") return { ok: true, page: 1 };

  let page: number | undefined;
  for (const pair of raw.split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    const name = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? "" : pair.slice(eq + 1);

    if (name === "page") {
      if (page !== undefined) return { ok: false, reason: "bad_page" };
      if (!PAGE_RE.test(value)) return { ok: false, reason: "bad_page" };
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE) return { ok: false, reason: "bad_page" };
      page = n;
      continue;
    }

    if (/^page/i.test(name)) {
      return { ok: false, reason: "bad_page" };
    }
  }

  return { ok: true, page: page ?? 1 };
}

export function isValidPostId(id: string): boolean {
  if (!POST_ID_RE.test(id)) return false;
  const n = Number(id);
  return Number.isInteger(n) && n >= 1 && n <= POST_ID_MAX;
}

function listUpstreamUrl(page: number): string {
  const offset = (page - 1) * PAGE_SIZE;
  return `${BSI_POSTS_BASE}?limit=${PAGE_SIZE}&offset=${offset}&preview=true`;
}

function detailUpstreamUrl(id: string): string {
  return `${BSI_POSTS_BASE}/${id}`;
}

async function readBodyCapped(response: Response): Promise<string | null> {
  const body = response.body;
  if (!body) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > MAX_UPSTREAM_BYTES) return null;
    return text;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  const parts: string[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPSTREAM_BYTES) {
        await reader.cancel();
        console.info("posts:size", total);
        return null;
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return null;
  }
}

async function fetchPostsUpstream(
  url: string,
  key: string,
  fetchImpl: typeof fetch,
): Promise<
  | { kind: "http"; status: number; text: string }
  | { kind: "timeout" }
  | { kind: "throw" }
  | { kind: "size" }
  | { kind: "redirect"; status: number }
> {
  try {
    assertBsiHost(url);
  } catch {
    console.info("posts:host");
    return { kind: "throw" };
  }

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": key,
        "User-Agent": UPSTREAM_USER_AGENT,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(3000),
    });

    if (response.status >= 300 && response.status < 400) {
      console.info("posts:redirect", response.status);
      return { kind: "redirect", status: response.status };
    }

    const text = await readBodyCapped(response);
    if (text === null) {
      return { kind: "size" };
    }
    return { kind: "http", status: response.status, text };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      console.info("posts:timeout");
      return { kind: "timeout" };
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.info("posts:timeout");
      return { kind: "timeout" };
    }
    console.info("posts:throw");
    return { kind: "throw" };
  }
}

async function storeMapped(
  cache: Cache,
  keyReq: Request,
  jsonText: string,
  sMaxAge: number,
  mode: CachePutMode,
  ctx: ExecutionContext,
): Promise<void> {
  const store = new Response(jsonText, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `s-maxage=${sMaxAge}`,
    },
  });
  const put = cache.put(keyReq, store);
  if (mode === "await") {
    await put;
  } else {
    ctx.waitUntil(put);
  }
}

/** Shared list helper for HTML + API (one upstream across both). */
export async function getList(
  page: number,
  env: Env,
  fetchImpl: typeof fetch,
  cache: Cache,
  ctx: ExecutionContext,
  putMode: CachePutMode,
): Promise<ListResult> {
  const key = readPostsApiKey(env);
  if (key == null) {
    console.info("posts:nokey");
    return { kind: "nokey" };
  }

  const keyReq = postsListCacheKey(page);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const text = await cached.clone().text();
      const json: unknown = JSON.parse(text);
      if (isPostListBody(json)) {
        return { kind: "ok", body: json, jsonText: text };
      }
    } catch {
      /* refetch */
    }
  }

  const url = listUpstreamUrl(page);
  const upstream = await fetchPostsUpstream(url, key, fetchImpl);

  if (upstream.kind === "timeout" || upstream.kind === "throw" || upstream.kind === "size") {
    return { kind: "unavailable" };
  }
  if (upstream.kind === "redirect") {
    return { kind: "unavailable" };
  }

  if (upstream.status === 404) {
    // List route always exists — 404 means misconfiguration (Q4).
    console.info("posts:list_404", 404);
    return { kind: "unavailable" };
  }
  if (upstream.status !== 200) {
    console.info("posts:upstream", upstream.status);
    return { kind: "unavailable" };
  }

  let json: unknown;
  try {
    json = JSON.parse(upstream.text);
  } catch {
    console.info("posts:bad_json");
    return { kind: "unavailable" };
  }

  const mapped = mapListResponse(json, page);
  if (!mapped) {
    console.info("posts:unmappable");
    return { kind: "unavailable" };
  }

  const jsonText = JSON.stringify(mapped);
  await storeMapped(cache, keyReq, jsonText, LIST_S_MAXAGE, putMode, ctx);
  return { kind: "ok", body: mapped, jsonText };
}

/** Shared detail helper for HTML + API (one upstream across both). */
export async function getPost(
  id: string,
  env: Env,
  fetchImpl: typeof fetch,
  cache: Cache,
  ctx: ExecutionContext,
  putMode: CachePutMode,
): Promise<DetailResult> {
  const key = readPostsApiKey(env);
  if (key == null) {
    console.info("posts:nokey");
    return { kind: "nokey" };
  }

  const keyReq = postsDetailCacheKey(id);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const text = await cached.clone().text();
      const json: unknown = JSON.parse(text);
      if (isPostDetailBody(json)) {
        return { kind: "ok", body: json, jsonText: text };
      }
    } catch {
      /* refetch */
    }
  }

  const url = detailUpstreamUrl(id);
  const upstream = await fetchPostsUpstream(url, key, fetchImpl);

  if (upstream.kind === "timeout" || upstream.kind === "throw" || upstream.kind === "size") {
    return { kind: "unavailable" };
  }
  if (upstream.kind === "redirect") {
    return { kind: "unavailable" };
  }

  if (upstream.status === 404) {
    console.info("posts:not_found", 404);
    return { kind: "not_found" };
  }
  if (upstream.status !== 200) {
    console.info("posts:upstream", upstream.status);
    return { kind: "unavailable" };
  }

  let json: unknown;
  try {
    json = JSON.parse(upstream.text);
  } catch {
    console.info("posts:bad_json");
    return { kind: "unavailable" };
  }

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    console.info("posts:unmappable");
    return { kind: "unavailable" };
  }
  const rawPost = (json as Record<string, unknown>).post;
  if (rawPost == null || typeof rawPost !== "object" || Array.isArray(rawPost)) {
    console.info("posts:unmappable");
    return { kind: "unavailable" };
  }
  // D8 before cache: locked → identical 404 to upstream (A9).
  if (!isUnlockedPost(rawPost)) {
    console.info("posts:locked");
    return { kind: "not_found" };
  }

  const mapped = mapDetailResponse(json);
  if (!mapped) {
    console.info("posts:unmappable");
    return { kind: "unavailable" };
  }

  const jsonText = JSON.stringify(mapped);
  await storeMapped(cache, keyReq, jsonText, DETAIL_S_MAXAGE, putMode, ctx);
  return { kind: "ok", body: mapped, jsonText };
}

function postsHeadPlan(head: PostsHead): HeadMode {
  return { mode: "posts", head };
}

/** API: GET|HEAD /api/posts and /api/posts/{id}. */
export async function handlePostsApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  id: string | null,
  deps: PostsDeps = {},
): Promise<Response> {
  const method = request.method.toUpperCase();
  const isHead = method === "HEAD";
  if (method !== "GET" && method !== "HEAD") {
    return methodNotAllowed(false);
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cachesDefault ?? caches.default;

  if (id != null) {
    const result = await getPost(id, env, fetchImpl, cache, ctx, "waitUntil");
    if (result.kind === "ok") {
      const headers = new Headers(apiOkHeaders());
      if (isHead) return new Response(null, { status: 200, headers });
      return new Response(result.jsonText, { status: 200, headers });
    }
    if (result.kind === "not_found") return notFoundJson(isHead);
    return unavailableJson(isHead);
  }

  const url = new URL(request.url);
  const parsed = parseListPage(url.search);
  if (!parsed.ok) {
    return badPageJson(isHead);
  }

  const result = await getList(parsed.page, env, fetchImpl, cache, ctx, "waitUntil");
  if (result.kind === "ok") {
    const headers = new Headers(apiOkHeaders());
    if (isHead) return new Response(null, { status: 200, headers });
    return new Response(result.jsonText, { status: 200, headers });
  }
  return unavailableJson(isHead);
}

/** HTML: GET|HEAD /posts and /posts/{id} with Accept: text/html. */
export async function handlePostsHtml(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  deps: PostsDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isHead = request.method.toUpperCase() === "HEAD";
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cachesDefault ?? caches.default;

  // Trailing-slash 301s (Q14)
  if (path === "/posts/") {
    const loc = `/posts${url.search}`;
    return redirectResponse(loc);
  }
  const trail = path.match(/^\/posts\/([^/]+)\/$/);
  if (trail) {
    return redirectResponse(`/posts/${trail[1]}${url.search}`);
  }

  if (path === "/posts") {
    const parsed = parseListPage(url.search);
    // Invalid page on HTML → 200 page-1 list head (A17)
    const page = parsed.ok ? parsed.page : 1;
    const result = await getList(page, env, fetchImpl, cache, ctx, "await");
    if (result.kind === "ok") {
      const head = buildPostsHead({ kind: "list", page });
      return htmlOk(request, env, postsHeadPlan(head), isHead);
    }
    if (result.kind === "nokey" || result.kind === "unavailable") {
      return htmlServiceUnavailable(request, env, isHead);
    }
    return htmlServiceUnavailable(request, env, isHead);
  }

  const detail = path.match(/^\/posts\/([^/]+)$/);
  if (detail) {
    const id = detail[1];
    if (!isValidPostId(id)) {
      return htmlNotFound(request, env);
    }
    const result = await getPost(id, env, fetchImpl, cache, ctx, "await");
    if (result.kind === "ok") {
      const post = result.body.post;
      const head = buildPostsHead({
        kind: "detail",
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        permalink: post.permalink,
        image: post.image,
      });
      return htmlOk(request, env, postsHeadPlan(head), isHead);
    }
    if (result.kind === "not_found") {
      return htmlNotFound(request, env);
    }
    return htmlServiceUnavailable(request, env, isHead);
  }

  return htmlNotFound(request, env);
}
