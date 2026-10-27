/**
 * First-party Resource Library Worker proxy.
 * Forwards BSI /resources/* (+ posts/exclusive detail) with the same auth BSI expects:
 * X-API-Key always; Bearer when a metfix.org session is present. No metfix-only allowlist.
 */
import {
  BSI_EXCLUSIVE_BASE,
  BSI_POSTS_DETAIL_BASE,
  BSI_RESOURCES_BASE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  MAX_UPSTREAM_BYTES,
  QUERY_MAX,
  RESOURCE_ID_MAX,
  RESOURCE_ID_RE,
  buildLibraryHead,
  exclusiveBaseFromOrigin,
  isLibraryDetailBody,
  isLibraryFiltersBody,
  isLibrarySearchBody,
  isResourceType,
  libraryDetailCacheKey,
  libraryFiltersCacheKey,
  libraryPopularCacheKey,
  librarySearchCacheKey,
  lockedDetailShell,
  mapDetailBody,
  mapFiltersPayload,
  mapPopularResponse,
  mapSearchResponse,
  postsDetailBaseFromOrigin,
  resourcesBaseFromOrigin,
  SLUG_RE,
  type LibraryDetailBody,
  type LibraryFiltersBody,
  type LibraryHead,
  type LibrarySearchBody,
  type ResourceType,
} from "../shared/library";
import { parseCookies, SID_COOKIE } from "./auth/cookies";
import {
  resolveActingSession,
  runUserBsiCall,
  type ActingContext,
} from "./auth/acting";
import { finishDetailPageHtml } from "./detailHtml";
import { rewriteHtml, type HeadMode } from "./head";
import {
  assertBsiHost,
  UPSTREAM_USER_AGENT,
  resolveBsiOrigin,
  type Env,
  type FetchImpl,
} from "./upstream";

export type LibraryDeps = {
  fetchImpl?: FetchImpl;
  cachesDefault?: Cache;
  bsiBaseUrl?: string;
};

type CachePutMode = "waitUntil" | "await";

const SEARCH_S_MAXAGE_ANON = 120;
const SEARCH_S_MAXAGE_USER = 60;
const FILTERS_S_MAXAGE = 600;
const DETAIL_S_MAXAGE_ANON = 300;
const DETAIL_S_MAXAGE_USER = 60;

function readApiKey(env: Env): string | null {
  const key = env.BSI_POSTS_API_KEY;
  if (key == null || key === "") return null;
  if (/^\s*$/.test(key)) return null;
  return key;
}

function postsBase(env: Env, opts?: { baseUrl?: string }): string {
  return postsDetailBaseFromOrigin(resolveBsiOrigin(env, opts));
}

function exclusiveBase(env: Env, opts?: { baseUrl?: string }): string {
  return exclusiveBaseFromOrigin(resolveBsiOrigin(env, opts));
}

function resourcesBase(env: Env, opts?: { baseUrl?: string }): string {
  if (!opts?.baseUrl) return BSI_RESOURCES_BASE;
  return resourcesBaseFromOrigin(resolveBsiOrigin(env, opts));
}

function apiOkHeaders(privateCache: boolean): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": privateCache ? "private, max-age=30" : "public, max-age=60",
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

function badRequestJson(head: boolean, error = "invalid_request"): Response {
  return jsonResponse({ error }, 400, { "Cache-Control": "no-store" }, head);
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
  const finished = finishDetailPageHtml(rewritten, env);
  if (isHead) {
    return new Response(null, { status: 404, headers: finished.headers });
  }
  return new Response(finished.body, { status: 404, headers: finished.headers });
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
  const finished = finishDetailPageHtml(rewritten, env);
  const headers = new Headers(finished.headers);
  headers.set("Retry-After", "300");
  headers.set("Cache-Control", "no-store");
  if (isHead) return new Response(null, { status: 503, headers });
  return new Response(finished.body, { status: 503, headers });
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
  const finished = finishDetailPageHtml(bodyRes, env);
  const headers = new Headers(finished.headers);
  const cc = headers.get("Cache-Control");
  if (cc && /s-maxage/i.test(cc)) {
    headers.delete("Cache-Control");
  }
  if (isHead) return new Response(null, { status: 200, headers });
  return new Response(finished.body, { status: 200, headers });
}

function libraryHeadPlan(head: LibraryHead): HeadMode {
  // Reuse posts head rewriter shape (canonical + robots + og).
  return {
    mode: "posts",
    head: {
      title: head.title,
      description: head.description,
      robots: head.robots,
      canonical: head.canonical,
      ogType: head.ogType,
      ogTitle: head.ogTitle,
      ogDescription: head.ogDescription,
      ogImage: head.ogImage,
      ogUrl: head.ogUrl,
    },
  };
}

/** Optional session — never 401 for anonymous library browse. */
async function optionalActing(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | null> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  if (!cookies[SID_COOKIE]) return null;
  const resolved = await resolveActingSession(request, env, fetchImpl, opts);
  if (resolved instanceof Response) return null;
  return resolved;
}

function userSalt(acting: ActingContext | null): string | null {
  if (!acting) return null;
  const id = acting.record.bsi_user_id;
  return id && id !== "0" ? `u${id}` : acting.hex.slice(0, 16);
}

function bsiHeaders(apiKey: string, accessToken: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
    "X-API-Key": apiKey,
  };
  if (accessToken) {
    h.Authorization = `Bearer ${accessToken}`;
  }
  return h;
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
        console.info("library:size", total);
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

type UpstreamResult =
  | { kind: "http"; status: number; text: string }
  | { kind: "timeout" }
  | { kind: "throw" }
  | { kind: "size" }
  | { kind: "redirect"; status: number };

async function fetchBsi(
  url: string,
  apiKey: string,
  accessToken: string | null,
  fetchImpl: FetchImpl,
  env?: Env,
): Promise<UpstreamResult> {
  try {
    assertBsiHost(url, env);
  } catch {
    console.info("library:host");
    return { kind: "throw" };
  }
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: bsiHeaders(apiKey, accessToken),
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
    if (response.status >= 300 && response.status < 400) {
      console.info("library:redirect", response.status);
      return { kind: "redirect", status: response.status };
    }
    const text = await readBodyCapped(response);
    if (text === null) return { kind: "size" };
    return { kind: "http", status: response.status, text };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      console.info("library:timeout");
      return { kind: "timeout" };
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.info("library:timeout");
      return { kind: "timeout" };
    }
    console.info("library:throw");
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
  privateCache: boolean,
): Promise<void> {
  const store = new Response(jsonText, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": privateCache
        ? `private, s-maxage=${sMaxAge}`
        : `s-maxage=${sMaxAge}`,
    },
  });
  const put = cache.put(keyReq, store);
  if (mode === "await") await put;
  else ctx.waitUntil(put);
}

/** Allowlisted search query → upstream URL search string. */
export function buildSearchUpstreamQuery(searchParams: URLSearchParams): string | null {
  const out = new URLSearchParams();

  const query = searchParams.get("query");
  if (query != null) {
    const q = query.trim();
    if (q.length > QUERY_MAX) return null;
    if (q) out.set("query", q);
  }

  const limitRaw = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw != null) {
    if (!/^[1-9][0-9]{0,2}$/.test(limitRaw)) return null;
    limit = Number(limitRaw);
    if (limit < 1 || limit > MAX_LIMIT) return null;
  }
  out.set("limit", String(limit));

  const offsetRaw = searchParams.get("offset");
  let offset = 0;
  if (offsetRaw != null) {
    if (!/^(0|[1-9][0-9]{0,4})$/.test(offsetRaw)) return null;
    offset = Number(offsetRaw);
    if (offset < 0 || offset > MAX_OFFSET) return null;
  }
  out.set("offset", String(offset));

  // content_types[] — BSI search type enum
  for (const v of [
    ...searchParams.getAll("content_types[]"),
    ...searchParams.getAll("content_types"),
  ]) {
    if (!/^(post|event|course|daily_fix|exclusive_resource)$/.test(v)) return null;
    out.append("content_types[]", v);
  }

  // content_type_terms[] — taxonomy slugs/ids
  for (const v of [
    ...searchParams.getAll("content_type_terms[]"),
    ...searchParams.getAll("content_type_terms"),
  ]) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(v)) return null;
    out.append("content_type_terms[]", v);
  }

  const appendCategoryId = (v: string): boolean => {
    if (!/^[1-9][0-9]{0,9}$/.test(v)) return false;
    out.append("categories[]", v);
    return true;
  };

  // topics[] / categories[] — integers (+ singular category)
  for (const name of ["topics", "categories"] as const) {
    for (const v of [...searchParams.getAll(`${name}[]`), ...searchParams.getAll(name)]) {
      if (!/^[1-9][0-9]{0,9}$/.test(v)) return null;
      out.append(`${name}[]`, v);
    }
  }
  for (const v of searchParams.getAll("category")) {
    if (!appendCategoryId(v)) return null;
  }

  // Do NOT forward content_access[] on the main catalog (narrows to exclusive path).

  return out.toString();
}

/**
 * Popular query allowlist — same page size as search.
 * Forwards `offset` so BSI can paginate once `/resources/popular` supports it.
 */
export function buildPopularUpstreamQuery(searchParams: URLSearchParams): string | null {
  const out = new URLSearchParams();

  const limitRaw = searchParams.get("limit");
  let limit = 6;
  if (limitRaw != null) {
    if (!/^[1-9][0-9]{0,2}$/.test(limitRaw)) return null;
    limit = Number(limitRaw);
    if (limit < 1 || limit > MAX_LIMIT) return null;
  }
  out.set("limit", String(limit));

  const offsetRaw = searchParams.get("offset");
  let offset = 0;
  if (offsetRaw != null) {
    if (!/^(0|[1-9][0-9]{0,4})$/.test(offsetRaw)) return null;
    offset = Number(offsetRaw);
    if (offset < 0 || offset > MAX_OFFSET) return null;
  }
  out.set("offset", String(offset));

  for (const v of [
    ...searchParams.getAll("content_types[]"),
    ...searchParams.getAll("content_types"),
  ]) {
    if (!/^(post|event|course|daily_fix|exclusive_resource)$/.test(v)) return null;
    out.append("content_types[]", v);
  }

  return out.toString();
}

async function getSearch(
  queryString: string,
  env: Env,
  fetchImpl: FetchImpl,
  cache: Cache,
  ctx: ExecutionContext,
  putMode: CachePutMode,
  acting: ActingContext | null,
  opts?: { baseUrl?: string },
): Promise<
  | { kind: "ok"; body: LibrarySearchBody; jsonText: string; private: boolean }
  | { kind: "nokey" }
  | { kind: "unavailable" }
> {
  const key = readApiKey(env);
  if (key == null) {
    console.info("library:nokey");
    return { kind: "nokey" };
  }

  const salt = userSalt(acting);
  const privateCache = salt != null;
  const keyReq = librarySearchCacheKey(queryString, salt);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const text = await cached.clone().text();
      const json: unknown = JSON.parse(text);
      if (isLibrarySearchBody(json)) {
        return { kind: "ok", body: json, jsonText: text, private: privateCache };
      }
    } catch {
      /* refetch */
    }
  }

  const url = `${resourcesBase(env, opts)}/search?${queryString}`;

  const call = (access: string | null) =>
    fetchBsi(url, key, access, fetchImpl, env);

  let upstream: UpstreamResult;
  if (acting) {
    const ran = await runUserBsiCall(acting, env, fetchImpl, opts, (access) =>
      call(access),
    );
    if (ran instanceof Response) return { kind: "unavailable" };
    upstream = ran.result;
  } else {
    upstream = await call(null);
  }

  if (
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "size" ||
    upstream.kind === "redirect"
  ) {
    return { kind: "unavailable" };
  }
  if (upstream.status !== 200) {
    console.info("library:search_upstream", upstream.status);
    return { kind: "unavailable" };
  }

  let json: unknown;
  try {
    json = JSON.parse(upstream.text);
  } catch {
    console.info("library:bad_json");
    return { kind: "unavailable" };
  }

  const mapped = mapSearchResponse(json);
  if (!mapped) {
    console.info("library:unmappable");
    return { kind: "unavailable" };
  }

  const jsonText = JSON.stringify(mapped);
  const sMax = privateCache ? SEARCH_S_MAXAGE_USER : SEARCH_S_MAXAGE_ANON;
  await storeMapped(cache, keyReq, jsonText, sMax, putMode, ctx, privateCache);
  return { kind: "ok", body: mapped, jsonText, private: privateCache };
}

async function getPopular(
  queryString: string,
  env: Env,
  fetchImpl: FetchImpl,
  cache: Cache,
  ctx: ExecutionContext,
  putMode: CachePutMode,
  acting: ActingContext | null,
  opts?: { baseUrl?: string },
): Promise<
  | { kind: "ok"; body: LibrarySearchBody; jsonText: string; private: boolean }
  | { kind: "nokey" }
  | { kind: "unavailable" }
> {
  const key = readApiKey(env);
  if (key == null) {
    console.info("library:nokey");
    return { kind: "nokey" };
  }

  const salt = userSalt(acting);
  const privateCache = salt != null;
  const keyReq = libraryPopularCacheKey(queryString, salt);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const text = await cached.clone().text();
      const json: unknown = JSON.parse(text);
      if (isLibrarySearchBody(json)) {
        return { kind: "ok", body: json, jsonText: text, private: privateCache };
      }
    } catch {
      /* refetch */
    }
  }

  const url = `${resourcesBase(env, opts)}/popular?${queryString}`;

  const call = (access: string | null) =>
    fetchBsi(url, key, access, fetchImpl, env);

  let upstream: UpstreamResult;
  if (acting) {
    const ran = await runUserBsiCall(acting, env, fetchImpl, opts, (access) =>
      call(access),
    );
    if (ran instanceof Response) return { kind: "unavailable" };
    upstream = ran.result;
  } else {
    upstream = await call(null);
  }

  if (
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "size" ||
    upstream.kind === "redirect"
  ) {
    return { kind: "unavailable" };
  }
  if (upstream.status !== 200) {
    console.info("library:popular_upstream", upstream.status);
    return { kind: "unavailable" };
  }

  let json: unknown;
  try {
    json = JSON.parse(upstream.text);
  } catch {
    console.info("library:bad_json");
    return { kind: "unavailable" };
  }

  const qs = new URLSearchParams(queryString);
  const mapped = mapPopularResponse(json, {
    limit: Number(qs.get("limit") ?? 0) || undefined,
    offset: Number(qs.get("offset") ?? 0) || 0,
  });
  if (!mapped) {
    console.info("library:unmappable");
    return { kind: "unavailable" };
  }

  const jsonText = JSON.stringify(mapped);
  const sMax = privateCache ? SEARCH_S_MAXAGE_USER : SEARCH_S_MAXAGE_ANON;
  await storeMapped(cache, keyReq, jsonText, sMax, putMode, ctx, privateCache);
  return { kind: "ok", body: mapped, jsonText, private: privateCache };
}

async function getFilters(
  env: Env,
  fetchImpl: FetchImpl,
  cache: Cache,
  ctx: ExecutionContext,
  putMode: CachePutMode,
  acting: ActingContext | null,
  opts?: { baseUrl?: string },
): Promise<
  | { kind: "ok"; body: LibraryFiltersBody; jsonText: string; private: boolean }
  | { kind: "nokey" }
  | { kind: "unavailable" }
> {
  const key = readApiKey(env);
  if (key == null) return { kind: "nokey" };

  const salt = userSalt(acting);
  const privateCache = salt != null;
  const keyReq = libraryFiltersCacheKey(salt);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const text = await cached.clone().text();
      const json: unknown = JSON.parse(text);
      if (isLibraryFiltersBody(json)) {
        return { kind: "ok", body: json, jsonText: text, private: privateCache };
      }
    } catch {
      /* refetch */
    }
  }

  const base = resourcesBase(env, opts);
  const paths = [
    `${base}/topics`,
    `${base}/content-type-terms`,
    `${base}/categories-for-filter`,
  ];

  const access = acting?.access ?? null;
  const results = await Promise.all(
    paths.map((u) => fetchBsi(u, key, access, fetchImpl, env)),
  );

  const parsed: unknown[] = [];
  for (const upstream of results) {
    if (upstream.kind !== "http" || upstream.status !== 200) {
      console.info("library:filters_upstream");
      return { kind: "unavailable" };
    }
    try {
      parsed.push(JSON.parse(upstream.text));
    } catch {
      return { kind: "unavailable" };
    }
  }

  const mapped = mapFiltersPayload({
    topics: parsed[0],
    content_type_terms: parsed[1],
    categories: parsed[2],
  });
  const jsonText = JSON.stringify(mapped);
  await storeMapped(cache, keyReq, jsonText, FILTERS_S_MAXAGE, putMode, ctx, privateCache);
  return { kind: "ok", body: mapped, jsonText, private: privateCache };
}

async function getDetail(
  type: ResourceType,
  id: string,
  env: Env,
  fetchImpl: FetchImpl,
  cache: Cache,
  ctx: ExecutionContext,
  putMode: CachePutMode,
  acting: ActingContext | null,
  opts?: { baseUrl?: string },
): Promise<
  | { kind: "ok"; body: LibraryDetailBody; jsonText: string; private: boolean }
  | { kind: "nokey" }
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "locked"; body: LibraryDetailBody; jsonText: string; private: boolean }
> {
  const key = readApiKey(env);
  if (key == null) return { kind: "nokey" };

  if (type === "daily_fix") {
    // Reader redirects client-side; API returns a stub pointing at Daily Fix.
    const body: LibraryDetailBody = {
      resource: {
        id: Number(id),
        type: "daily_fix",
        title: "The Daily Fix",
        excerpt: "Open this day on The Daily Fix.",
        date: new Date(0).toISOString(),
        image: null,
        permalink: null,
        author: null,
        categories: [],
        topics: [],
        content_types: [],
        access: {
          access: "full",
          has_content_access: false,
          user_has_access: true,
          has_preview: false,
          is_exclusive: false,
          show_same: 0,
          show_video_in_preview: false,
          access_group_labels: [],
        },
        content: "",
        video: null,
        locked: false,
        daily_fix_date: null,
      },
    };
    const jsonText = JSON.stringify(body);
    return { kind: "ok", body, jsonText, private: false };
  }

  const salt = userSalt(acting);
  const privateCache = salt != null;
  const keyReq = libraryDetailCacheKey(type, id, salt);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const text = await cached.clone().text();
      const json: unknown = JSON.parse(text);
      if (isLibraryDetailBody(json)) {
        return {
          kind: json.resource.locked ? "locked" : "ok",
          body: json,
          jsonText: text,
          private: privateCache,
        };
      }
    } catch {
      /* refetch */
    }
  }

  let url: string;
  if (type === "exclusive_resource") {
    const base = opts?.baseUrl ? exclusiveBase(env, opts) : BSI_EXCLUSIVE_BASE;
    url = `${base}/${id}`;
  } else if (type === "course" || type === "event" || type === "infographic") {
    // No first-party body renderer yet — return search-shaped metadata via posts if numeric,
    // else locked shell with permalink from a lightweight search.
    const base = opts?.baseUrl ? postsBase(env, opts) : BSI_POSTS_DETAIL_BASE;
    url = `${base}/${id}`;
  } else {
    // post / page
    const base = opts?.baseUrl ? postsBase(env, opts) : BSI_POSTS_DETAIL_BASE;
    url = `${base}/${id}`;
  }

  const call = (access: string | null) => fetchBsi(url, key, access, fetchImpl, env);

  let upstream: UpstreamResult;
  if (acting) {
    const ran = await runUserBsiCall(acting, env, fetchImpl, opts, (access) =>
      call(access),
    );
    if (ran instanceof Response) return { kind: "unavailable" };
    upstream = ran.result;
  } else {
    upstream = await call(null);
  }

  if (
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "size" ||
    upstream.kind === "redirect"
  ) {
    return { kind: "unavailable" };
  }

  if (upstream.status === 404) {
    // Access:none often surfaces as 404 from BSI — return locked shell for join CTA.
    const shell = lockedDetailShell({
      id: Number(id),
      type,
      title: "Members-only resource",
    });
    const body: LibraryDetailBody = { resource: shell };
    const jsonText = JSON.stringify(body);
    const sMax = privateCache ? DETAIL_S_MAXAGE_USER : DETAIL_S_MAXAGE_ANON;
    await storeMapped(cache, keyReq, jsonText, sMax, putMode, ctx, privateCache);
    return { kind: "locked", body, jsonText, private: privateCache };
  }

  if (upstream.status !== 200) {
    console.info("library:detail_upstream", upstream.status);
    return { kind: "unavailable" };
  }

  let json: unknown;
  try {
    json = JSON.parse(upstream.text);
  } catch {
    return { kind: "unavailable" };
  }

  const mapped = mapDetailBody(json, type);
  if (!mapped) {
    // Exclusive payload shape may nest differently
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const alt = mapDetailBody(
        { post: (json as Record<string, unknown>).resource ?? json },
        type,
      );
      if (alt) {
        const jsonText = JSON.stringify(alt);
        const sMax = privateCache ? DETAIL_S_MAXAGE_USER : DETAIL_S_MAXAGE_ANON;
        await storeMapped(cache, keyReq, jsonText, sMax, putMode, ctx, privateCache);
        return {
          kind: alt.resource.locked ? "locked" : "ok",
          body: alt,
          jsonText,
          private: privateCache,
        };
      }
    }
    return { kind: "unavailable" };
  }

  const jsonText = JSON.stringify(mapped);
  const sMax = privateCache ? DETAIL_S_MAXAGE_USER : DETAIL_S_MAXAGE_ANON;
  await storeMapped(cache, keyReq, jsonText, sMax, putMode, ctx, privateCache);
  return {
    kind: mapped.resource.locked ? "locked" : "ok",
    body: mapped,
    jsonText,
    private: privateCache,
  };
}

export function isValidLibraryId(id: string): boolean {
  if (!RESOURCE_ID_RE.test(id)) return false;
  const n = Number(id);
  return Number.isInteger(n) && n >= 1 && n <= RESOURCE_ID_MAX;
}

/** API: /api/library/search | /popular | /filters | /item/:type/:id */
export async function handleLibraryApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  deps: LibraryDeps = {},
): Promise<Response> {
  const method = request.method.toUpperCase();
  const isHead = method === "HEAD";
  if (method !== "GET" && method !== "HEAD") {
    return methodNotAllowed(false);
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cachesDefault ?? caches.default;
  const opts = deps.bsiBaseUrl ? { baseUrl: deps.bsiBaseUrl } : undefined;
  const url = new URL(request.url);
  const path = url.pathname;

  const acting = await optionalActing(request, env, fetchImpl, opts);

  if (path === "/api/library/search" || path === "/api/library/search/") {
    const qs = buildSearchUpstreamQuery(url.searchParams);
    if (qs == null) return badRequestJson(isHead);
    const result = await getSearch(
      qs,
      env,
      fetchImpl,
      cache,
      ctx,
      "waitUntil",
      acting,
      opts,
    );
    if (result.kind === "ok") {
      const headers = new Headers(apiOkHeaders(result.private));
      if (isHead) return new Response(null, { status: 200, headers });
      return new Response(result.jsonText, { status: 200, headers });
    }
    return unavailableJson(isHead);
  }

  if (path === "/api/library/popular" || path === "/api/library/popular/") {
    const qs = buildPopularUpstreamQuery(url.searchParams);
    if (qs == null) return badRequestJson(isHead);
    const result = await getPopular(
      qs,
      env,
      fetchImpl,
      cache,
      ctx,
      "waitUntil",
      acting,
      opts,
    );
    if (result.kind === "ok") {
      const headers = new Headers(apiOkHeaders(result.private));
      if (isHead) return new Response(null, { status: 200, headers });
      return new Response(result.jsonText, { status: 200, headers });
    }
    return unavailableJson(isHead);
  }

  if (path === "/api/library/filters" || path === "/api/library/filters/") {
    const result = await getFilters(
      env,
      fetchImpl,
      cache,
      ctx,
      "waitUntil",
      acting,
      opts,
    );
    if (result.kind === "ok") {
      const headers = new Headers(apiOkHeaders(result.private));
      if (isHead) return new Response(null, { status: 200, headers });
      return new Response(result.jsonText, { status: 200, headers });
    }
    return unavailableJson(isHead);
  }

  const itemMatch = path.match(/^\/api\/library\/item\/([^/]+)\/([^/]+)\/?$/);
  if (itemMatch) {
    const typePart = itemMatch[1]!;
    const idPart = itemMatch[2]!;
    if (!isResourceType(typePart) || !isValidLibraryId(idPart)) {
      return notFoundJson(isHead);
    }
    const result = await getDetail(
      typePart,
      idPart,
      env,
      fetchImpl,
      cache,
      ctx,
      "waitUntil",
      acting,
      opts,
    );
    if (result.kind === "ok" || result.kind === "locked") {
      const headers = new Headers(apiOkHeaders(result.private));
      if (isHead) return new Response(null, { status: 200, headers });
      return new Response(result.jsonText, { status: 200, headers });
    }
    if (result.kind === "not_found") return notFoundJson(isHead);
    return unavailableJson(isHead);
  }

  return notFoundJson(isHead);
}

/** HTML: GET|HEAD /library and /library/:type/:id */
export async function handleLibraryHtml(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  deps: LibraryDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isHead = request.method.toUpperCase() === "HEAD";
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cachesDefault ?? caches.default;
  const opts = deps.bsiBaseUrl ? { baseUrl: deps.bsiBaseUrl } : undefined;

  if (path === "/library/") {
    return redirectResponse(`/library${url.search}`);
  }
  const trail = path.match(/^\/library\/([^/]+)\/([^/]+)\/$/);
  if (trail) {
    return redirectResponse(`/library/${trail[1]}/${trail[2]}${url.search}`);
  }

  const acting = await optionalActing(request, env, fetchImpl, opts);

  if (path === "/library") {
    const head = buildLibraryHead({ kind: "hub" });
    return htmlOk(request, env, libraryHeadPlan(head), isHead);
  }

  // SR18 / E1: SPA search page (not a resource type/id). Same shell as hub.
  if (path === "/library/search") {
    const head = buildLibraryHead({ kind: "hub" });
    return htmlOk(request, env, libraryHeadPlan(head), isHead);
  }

  const topicRoot = path.match(/^\/topic\/([^/]+)$/);
  if (topicRoot) {
    const slug = topicRoot[1]!;
    if (!SLUG_RE.test(slug)) return htmlNotFound(request, env);
    const head = buildLibraryHead({ kind: "hub" });
    return htmlOk(request, env, libraryHeadPlan(head), isHead);
  }

  const taxonomy = path.match(/^\/library\/(topic|content-type|category)\/([^/]+)$/);
  if (taxonomy) {
    const slug = taxonomy[2]!;
    if (!SLUG_RE.test(slug)) return htmlNotFound(request, env);
    const head = buildLibraryHead({ kind: "hub" });
    return htmlOk(request, env, libraryHeadPlan(head), isHead);
  }

  const detail = path.match(/^\/library\/([^/]+)\/([^/]+)$/);
  if (detail) {
    const typePart = detail[1]!;
    const idPart = detail[2]!;
    if (!isResourceType(typePart) || !isValidLibraryId(idPart)) {
      return htmlNotFound(request, env);
    }
    const result = await getDetail(
      typePart,
      idPart,
      env,
      fetchImpl,
      cache,
      ctx,
      "await",
      acting,
      opts,
    );
    if (result.kind === "ok" || result.kind === "locked") {
      const r = result.body.resource;
      const head = buildLibraryHead({
        kind: "detail",
        type: r.type,
        id: r.id,
        title: r.title,
        excerpt: r.excerpt,
        permalink: r.permalink,
        image: r.image,
      });
      return htmlOk(request, env, libraryHeadPlan(head), isHead);
    }
    if (result.kind === "not_found") return htmlNotFound(request, env);
    return htmlServiceUnavailable(request, env, isHead);
  }

  return htmlNotFound(request, env);
}
