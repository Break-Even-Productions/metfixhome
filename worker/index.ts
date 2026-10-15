import {
  archiveCacheKeyRequest,
  bsiTodayIso,
  cacheKeyRequest,
  cacheTtlSeconds,
  escapeScriptJson,
  isIsoDate,
  mapDailyFixDay,
  normalizeDailyFixPath,
  outOfRangeLocation,
  resolveDailyFixStatus,
  nextDfxMidnight,
  secondsUntilNextDfxMidnight,
  sitemapCacheKeyRequest,
  toArchiveEntry,
  yymmddFromIso,
  type DailyFixArchive,
  type DailyFixArchiveEntry,
  type UpstreamOutcome,
} from "../shared/daily-fix";
import { buildFullHead, rewriteHtml, type HeadMode } from "./head";
import {
  fetchDailyFixDay,
  fetchDailyFixListPage,
  isPublicListItem,
  LIST_PAGE_SIZE,
  SITEMAP_MAX_SUBREQUESTS,
  type Env,
  type ListPage,
} from "./upstream";

export type { Env };

/** Sitemap-only per-page upstream timeout (other routes keep 3000). */
const SITEMAP_PAGE_TIMEOUT_MS = 8000;
/** Overall sitemap build budget; under waitUntil's 30 s with margin. */
const SITEMAP_BUILD_BUDGET_MS = 20_000;
/** Cache API retention for the stored sitemap entry. */
const SITEMAP_STORE_S_MAXAGE = 604800;
/** After a failed stale rebuild, suppress new rebuilds for this long (G6). */
const SITEMAP_FAILURE_BACKOFF_MS = 60_000;

type SitemapBuildResult =
  | { ok: true; body: string; freshUntil: string }
  | { ok: false };

type InflightSitemapBuild = {
  promise: Promise<SitemapBuildResult>;
  deadline: number;
};

/** Per-isolate single-flight for sitemap builds (S6). */
let sitemapBuild: InflightSitemapBuild | null = null;
/** Per-isolate backoff after a failed stale rebuild (G6). */
let sitemapRebuildBackoffUntil = 0;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  deps: {
    fetchImpl?: typeof fetch;
    cachesDefault?: Cache;
    /** Test-only override for W20 host-guard (defaults to BSI URL). */
    bsiBaseUrl?: string;
  } = {},
): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cachesDefault ?? caches.default;
  const bsiBaseUrl = deps.bsiBaseUrl;
  const url = new URL(request.url);
  const path = url.pathname;

  // /api/* — worker-owned
  if (path === "/api/daily-fix" || path === "/api/daily-fix/") {
    return handleApi(request, env, ctx, fetchImpl, cache, bsiBaseUrl);
  }
  if (path === "/api/daily-fix/archive") {
    return handleArchive(request, env, ctx, fetchImpl, cache, bsiBaseUrl);
  }
  if (path.startsWith("/api/")) {
    return jsonResponse({ error: "not_found" }, 404, {}, request.method.toUpperCase() === "HEAD");
  }

  // Sitemap
  if (path === "/sitemap-daily-fix.xml") {
    return handleSitemap(request, env, ctx, fetchImpl, cache, bsiBaseUrl);
  }

  // Daily Fix HTML routes — only GET/HEAD with Accept: text/html
  if (path === "/the-daily-fix" || path.startsWith("/the-daily-fix/")) {
    const method = request.method.toUpperCase();
    const accept = request.headers.get("Accept") ?? "";
    const wantsHtml = accept.includes("text/html");
    if (method !== "GET" && method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }
    if (!wantsHtml) {
      return env.ASSETS.fetch(request);
    }
    return handleDailyFixHtml(request, env, ctx, fetchImpl, cache, bsiBaseUrl);
  }

  // Anything else under run_worker_first that we don't own → ASSETS
  return env.ASSETS.fetch(request);
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

async function fetchIndexHtml(request: Request, env: Env): Promise<Response> {
  const assetRes = await env.ASSETS.fetch(indexAssetRequest(request));
  if (assetRes.status !== 200) {
    throw new Error(`ASSETS index fetch returned ${assetRes.status}`);
  }
  return assetRes;
}

async function handleDailyFixHtml(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
  bsiBaseUrl?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const normalized = normalizeDailyFixPath(url.pathname, url.search);

  if (normalized.kind === "redirect") {
    return redirectResponse(normalized.location);
  }

  if (normalized.kind === "notFound") {
    return htmlNotFound(request, env);
  }

  if (normalized.mode === "dated") {
    const moved = outOfRangeLocation(normalized.iso, bsiTodayIso(), url.search);
    if (moved) {
      return new Response(null, {
        status: 302,
        headers: { Location: moved, "Cache-Control": "no-store" },
      });
    }
  }

  const isHead = request.method.toUpperCase() === "HEAD";
  const tab = normalized.tab;
  const route = normalized.mode;
  const requestIso = route === "bare" ? bsiTodayIso() : normalized.iso;
  const yymmdd = route === "bare" ? "" : normalized.yymmdd;

  // Try edge cache first
  let outcome: UpstreamOutcome | null = null;
  let rawJson: unknown = null;
  let bodyText: string | null = null;
  const keyReq = cacheKeyRequest(requestIso);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      bodyText = await cached.clone().text();
      rawJson = JSON.parse(bodyText);
      const mapped = mapDailyFixDay(rawJson, requestIso);
      if (mapped && mapped.date === requestIso) {
        outcome = { kind: "ok", status: 200, json: rawJson, mapped, bodyText };
      } else if (mapped && route === "dated") {
        // W37: dated hit whose date doesn't match → 404
        outcome = { kind: "mismatch", status: 200, json: rawJson, mapped, bodyText };
      } else if (mapped && route === "bare") {
        // Bare may display closer day; cache key was request ISO (Q2)
        outcome = { kind: "ok", status: 200, json: rawJson, mapped, bodyText };
      } else {
        outcome = { kind: "unmappable", status: 200, json: rawJson, bodyText };
      }
    } catch {
      outcome = null;
      bodyText = null;
    }
  }

  if (!outcome) {
    outcome = await fetchDailyFixDay(requestIso, env, fetchImpl, { baseUrl: bsiBaseUrl });
    // Bare closer-day: BSI may return a different date for "today". We still treat that
    // as ok for the bare route and store the closer-day body under today's cache key
    // (request ISO), per Q2 — dated routes that later hit this entry get a mismatch 404.
    if (route === "bare" && outcome.kind === "mismatch") {
      outcome = {
        kind: "ok",
        status: 200,
        json: outcome.json,
        mapped: outcome.mapped,
        bodyText: outcome.bodyText,
      };
    }
    if (outcome.kind === "ok") {
      const ttl = cacheTtlSeconds(requestIso, new Date(), { bare: route === "bare" });
      // Store upstream bytes as-is (no re-serialization).
      const store = new Response(outcome.bodyText, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `s-maxage=${ttl}`,
        },
      });
      ctx.waitUntil(cache.put(keyReq, store));
      rawJson = outcome.json;
      bodyText = outcome.bodyText;
    } else if (outcome.kind === "mismatch" || outcome.kind === "unmappable") {
      rawJson = outcome.json;
      bodyText = outcome.bodyText;
      // never cache dated mismatch / unmappable (Q6)
    }
  }

  const status = resolveDailyFixStatus(route, outcome);

  if (status.httpStatus === 503) {
    return htmlServiceUnavailable(request, env, isHead);
  }

  let plan: HeadMode;
  if (status.headKind === "full" && (outcome.kind === "ok" || outcome.kind === "mismatch")) {
    const day = outcome.mapped;
    const digits =
      route === "bare" ? yymmddFromIso(day.date) || "" : yymmdd;
    const head = buildFullHead(day, {
      bare: route === "bare",
      yymmdd: digits,
      tab,
      raw: rawJson,
    });
    plan = {
      mode: "full",
      head,
      dfInitialJson: status.injectInitial ? escapeScriptJson(rawJson) : null,
    };
  } else if (status.headKind === "generic_noindex") {
    plan = { mode: "generic_noindex" };
  } else {
    plan = { mode: "generic" };
  }

  let assetRes: Response;
  try {
    assetRes = await fetchIndexHtml(request, env);
  } catch {
    return htmlServiceUnavailable(request, env, isHead, /* assetsFailed */ true);
  }
  const bodyRes = rewriteHtml(assetRes, plan);
  const headers = new Headers(bodyRes.headers);
  const cc = headers.get("Cache-Control");
  if (cc && /s-maxage/i.test(cc)) {
    headers.delete("Cache-Control");
  }
  if (isHead) {
    return new Response(null, { status: status.httpStatus, headers });
  }
  return new Response(bodyRes.body, { status: status.httpStatus, headers });
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

/** Prefer `/` over `/index.html` — Assets can 307 the latter. */
function indexAssetRequest(request: Request): Request {
  const url = new URL("/", request.url);
  return new Request(url.toString(), {
    method: "GET",
    headers: { Accept: "text/html" },
  });
}

async function handleApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
  bsiBaseUrl?: string,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return jsonResponse(
      { error: "method_not_allowed" },
      405,
      { Allow: "GET, HEAD" },
      method === "HEAD",
    );
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return jsonResponse({ error: "bad_date" }, 400, {}, method === "HEAD");
  }

  const keyReq = cacheKeyRequest(date);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      const bodyText = await cached.clone().text();
      const json = JSON.parse(bodyText);
      const mapped = mapDailyFixDay(json, date);
      if (mapped && mapped.date === date) {
        return apiRawBody(bodyText, 200, apiOkHeaders(), method === "HEAD");
      }
    } catch {
      /* fall through */
    }
  }

  const outcome = await fetchDailyFixDay(date, env, fetchImpl, { baseUrl: bsiBaseUrl });

  if (outcome.kind === "ok") {
    const ttl = cacheTtlSeconds(date, new Date());
    const store = new Response(outcome.bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${ttl}`,
      },
    });
    ctx.waitUntil(cache.put(keyReq, store));
    return apiRawBody(outcome.bodyText, 200, apiOkHeaders(), method === "HEAD");
  }

  if (outcome.kind === "unmappable") {
    // Rev 2.1: raw 200, not edge-cached — upstream bytes as-is
    return apiRawBody(outcome.bodyText, 200, apiOkHeaders(), method === "HEAD");
  }

  if (outcome.kind === "not_found" || outcome.kind === "mismatch") {
    // §5.4: dated mismatch is handled in the client — return raw 200 body.
    if (outcome.kind === "mismatch") {
      return apiRawBody(outcome.bodyText, 200, apiOkHeaders(), method === "HEAD");
    }
    return jsonResponse(
      { error: "not_found" },
      404,
      { "Cache-Control": "public, max-age=60" },
      method === "HEAD",
    );
  }

  return jsonResponse(
    { error: "unavailable" },
    503,
    { "Retry-After": "300", "Cache-Control": "no-store" },
    method === "HEAD",
  );
}

function apiOkHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60",
    "X-Content-Type-Options": "nosniff",
  };
}

/** Return upstream body text without re-serialization. */
function apiRawBody(bodyText: string, status: number, extra: HeadersInit, head: boolean): Response {
  const headers = new Headers(extra);
  if (head) return new Response(null, { status, headers });
  return new Response(bodyText, { status, headers });
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

function sitemapClientHeaders(): HeadersInit {
  return {
    "Content-Type": "application/xml",
    "Cache-Control": "public, max-age=3600",
  };
}

function sitemapClientResponse(body: string, method: string): Response {
  const headers = sitemapClientHeaders();
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(body, { status: 200, headers });
}

/** Fresh only when header parses to a finite instant strictly later than now (G2, G7). */
function isSitemapCacheFresh(cached: Response, now = new Date()): boolean {
  const until = cached.headers.get("X-Sitemap-Fresh-Until");
  if (!until) return false;
  const ts = Date.parse(until);
  if (!Number.isFinite(ts)) return false;
  return now.getTime() < ts;
}

function buildSitemapXml(dates: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const d of dates) {
    if (seen.has(d)) continue;
    seen.add(d);
    unique.push(d);
  }

  const bare = "https://metfix.org/the-daily-fix";
  const dated = unique.map((iso) => {
    const ymd = yymmddFromIso(iso)!;
    return { loc: `https://metfix.org/the-daily-fix/${ymd}`, lastmod: iso };
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    `  <url><loc>${bare}</loc></url>`,
    ...dated.map((entry) => `  <url><loc>${entry.loc}</loc><lastmod>${entry.lastmod}</lastmod></url>`),
    `</urlset>`,
    ``,
  ].join("\n");
}

async function runSitemapBuild(
  env: Env,
  fetchImpl: typeof fetch,
  deadline: number,
  bsiBaseUrl?: string,
): Promise<SitemapBuildResult> {
  // G1: freeze DFX day + fresh-until at build START (before page 0).
  const buildStartedAt = new Date();
  const freshUntil = nextDfxMidnight(buildStartedAt).toISOString();
  const today = bsiTodayIso(buildStartedAt);
  const listOptsBase = {
    baseUrl: bsiBaseUrl,
    mapDays: false as const,
  };

  // Cap: match=1 + put reserved → at most 38 upstream pages.
  const maxPages = SITEMAP_MAX_SUBREQUESTS - 2;

  // S3/CQ7/S8: page 0 timeout clamped to remaining budget.
  const page0TimeoutMs = Math.min(SITEMAP_PAGE_TIMEOUT_MS, Math.max(1, deadline - Date.now()));
  const first = await fetchDailyFixListPage(0, env, fetchImpl, {
    ...listOptsBase,
    timeoutMs: page0TimeoutMs,
  });
  if (!first.ok) return { ok: false };

  // S9: exactly at the deadline counts as budget failure.
  if (Date.now() >= deadline) return { ok: false };

  // G5: if page 0 meta.total needs more than 38 pages, fail with no further calls.
  const pagesNeeded = Math.ceil(first.page.total / LIST_PAGE_SIZE);
  if (pagesNeeded > maxPages) return { ok: false };

  const offsets: number[] = [];
  for (
    let offset = LIST_PAGE_SIZE;
    offset < first.page.total && offsets.length < maxPages - 1;
    offset += LIST_PAGE_SIZE
  ) {
    offsets.push(offset);
  }

  // S3/CQ7: each parallel page's timeout is min(8000, time left before deadline).
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return { ok: false };
  const parallelTimeoutMs = Math.min(SITEMAP_PAGE_TIMEOUT_MS, remainingMs);
  const rest =
    offsets.length === 0
      ? []
      : await Promise.all(
          offsets.map((offset) =>
            fetchDailyFixListPage(offset, env, fetchImpl, {
              ...listOptsBase,
              timeoutMs: parallelTimeoutMs,
            }),
          ),
        );
  if (rest.some((page) => !page.ok)) return { ok: false };
  if (Date.now() >= deadline) return { ok: false };

  const dates: string[] = [];
  const pages: ListPage[] = [first.page, ...rest.map((p) => (p as { ok: true; page: ListPage }).page)];
  for (const page of pages) {
    for (const item of page.items) {
      if (isPublicListItem(item, today)) dates.push(item.date);
    }
  }

  return { ok: true, body: buildSitemapXml(dates), freshUntil };
}

function ensureSitemapBuild(
  env: Env,
  fetchImpl: typeof fetch,
  bsiBaseUrl?: string,
): InflightSitemapBuild {
  if (!sitemapBuild) {
    const deadline = Date.now() + SITEMAP_BUILD_BUDGET_MS;
    const promise = runSitemapBuild(env, fetchImpl, deadline, bsiBaseUrl).finally(() => {
      sitemapBuild = null;
    });
    sitemapBuild = { promise, deadline };
  }
  return sitemapBuild;
}

/** CQ2: joiners race the in-flight build against the time left in its 20 s budget. */
async function awaitSitemapBuild(
  env: Env,
  fetchImpl: typeof fetch,
  bsiBaseUrl?: string,
): Promise<SitemapBuildResult | { ok: false; waiterTimeout: true }> {
  const inflight = ensureSitemapBuild(env, fetchImpl, bsiBaseUrl);
  const remainingMs = Math.max(0, inflight.deadline - Date.now());
  if (remainingMs === 0) {
    return { ok: false, waiterTimeout: true };
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ ok: false; waiterTimeout: true }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ ok: false, waiterTimeout: true }), remainingMs);
  });
  try {
    return await Promise.race([inflight.promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function putSitemapCache(
  cache: Cache,
  body: string,
  freshUntil: string,
): Promise<void> {
  return cache.put(
    sitemapCacheKeyRequest(),
    new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": `s-maxage=${SITEMAP_STORE_S_MAXAGE}`,
        "X-Sitemap-Fresh-Until": freshUntil,
      },
    }),
  );
}

function scheduleStaleRebuild(
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
  bsiBaseUrl?: string,
): void {
  if (Date.now() < sitemapRebuildBackoffUntil) return;
  ctx.waitUntil(
    ensureSitemapBuild(env, fetchImpl, bsiBaseUrl).promise.then((result) => {
      if (result.ok) {
        sitemapRebuildBackoffUntil = 0;
        return putSitemapCache(cache, result.body, result.freshUntil);
      }
      sitemapRebuildBackoffUntil = Date.now() + SITEMAP_FAILURE_BACKOFF_MS;
    }),
  );
}

async function handleSitemap(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
  bsiBaseUrl?: string,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const keyReq = sitemapCacheKeyRequest();
  const cached = await cache.match(keyReq);
  if (cached) {
    const fresh = isSitemapCacheFresh(cached);
    if (!fresh) {
      scheduleStaleRebuild(env, ctx, fetchImpl, cache, bsiBaseUrl);
    }
    // CQ9: HEAD on a hit returns client headers with no body and does not read the store body.
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: sitemapClientHeaders() });
    }
    const body = await cached.text();
    return sitemapClientResponse(body, method);
  }

  const result = await awaitSitemapBuild(env, fetchImpl, bsiBaseUrl);
  if (!result.ok) {
    return sitemapUnavailable(method);
  }
  ctx.waitUntil(putSitemapCache(cache, result.body, result.freshUntil));
  return sitemapClientResponse(result.body, method);
}

/** BSI list pages can take several seconds each; they are fetched in parallel. */
const ARCHIVE_PAGE_TIMEOUT_MS = 20_000;

async function handleArchive(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
  bsiBaseUrl?: string,
): Promise<Response> {
  const method = request.method.toUpperCase();
  const isHead = method === "HEAD";
  if (method !== "GET" && !isHead) {
    return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" }, false);
  }

  const keyReq = archiveCacheKeyRequest();
  const cached = await cache.match(keyReq);
  if (cached) {
    return apiRawBody(await cached.text(), 200, apiOkHeaders(), isHead);
  }

  const listOpts = { baseUrl: bsiBaseUrl, timeoutMs: ARCHIVE_PAGE_TIMEOUT_MS };
  const first = await fetchDailyFixListPage(0, env, fetchImpl, listOpts);
  if (!first.ok) {
    return jsonResponse({ error: "unavailable" }, 503, { "Retry-After": "300", "Cache-Control": "no-store" }, isHead);
  }
  const offsets: number[] = [];
  const maxPages = SITEMAP_MAX_SUBREQUESTS - 3;
  for (let offset = LIST_PAGE_SIZE; offset < first.page.total && offsets.length < maxPages; offset += LIST_PAGE_SIZE) {
    offsets.push(offset);
  }
  const rest = await Promise.all(
    offsets.map((offset) => fetchDailyFixListPage(offset, env, fetchImpl, listOpts)),
  );
  if (rest.some((page) => !page.ok)) {
    return jsonResponse({ error: "unavailable" }, 503, { "Retry-After": "300", "Cache-Control": "no-store" }, isHead);
  }

  const today = bsiTodayIso();
  const byDate = new Map<string, DailyFixArchiveEntry>();
  for (const page of [first, ...rest]) {
    if (!page.ok) continue;
    for (const item of page.page.items) {
      if (!item.day || byDate.has(item.date) || !isPublicListItem(item, today)) continue;
      byDate.set(item.date, toArchiveEntry(item.day));
    }
  }
  const archive: DailyFixArchive = {
    days: Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
  const body = JSON.stringify(archive);

  ctx.waitUntil(
    cache.put(
      keyReq,
      new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `s-maxage=${secondsUntilNextDfxMidnight()}`,
        },
      }),
    ),
  );
  return apiRawBody(body, 200, apiOkHeaders(), isHead);
}

function sitemapUnavailable(method: string): Response {
  return new Response(method === "HEAD" ? null : "Service Unavailable", {
    status: 503,
    headers: {
      "Retry-After": "300",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
