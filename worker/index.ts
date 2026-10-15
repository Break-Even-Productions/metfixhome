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
} from "./upstream";

export type { Env };

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
  // Cap counts Cache API: match = 1, reserve 1 for put, stop upstream at MAX-1.
  let subrequests = 1;
  const cached = await cache.match(keyReq);
  if (cached) {
    if (method === "HEAD") {
      return new Response(null, { status: cached.status, headers: cached.headers });
    }
    return cached;
  }

  const today = bsiTodayIso();
  const dates: string[] = [];
  let offset = 0;
  let total = Infinity;
  let hitCap = false;

  while (offset < total) {
    // Stop at MAX-1 so the final slot stays reserved for cache.put.
    if (subrequests >= SITEMAP_MAX_SUBREQUESTS - 1) {
      hitCap = true;
      break;
    }
    subrequests += 1;
    const page = await fetchDailyFixListPage(offset, env, fetchImpl, { baseUrl: bsiBaseUrl });
    if (!page.ok) {
      return sitemapUnavailable(method);
    }
    total = page.page.total;
    for (const item of page.page.items) {
      if (isPublicListItem(item, today)) dates.push(item.date);
    }
    // Stop on a short page (last page).
    if (page.page.items.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
    if (total === 0) break;
  }

  if (hitCap) {
    return sitemapUnavailable(method);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const d of dates) {
    if (seen.has(d)) continue;
    seen.add(d);
    unique.push(d);
  }

  const urls = [
    "https://metfix.org/the-daily-fix",
    ...unique.map((iso) => {
      const ymd = yymmddFromIso(iso)!;
      return { loc: `https://metfix.org/the-daily-fix/${ymd}`, lastmod: iso };
    }),
  ];

  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    `  <url><loc>${urls[0]}</loc></url>`,
    ...urls.slice(1).map((u) => {
      const entry = u as { loc: string; lastmod: string };
      return `  <url><loc>${entry.loc}</loc><lastmod>${entry.lastmod}</lastmod></url>`;
    }),
    `</urlset>`,
    ``,
  ].join("\n");

  const headers = {
    "Content-Type": "application/xml",
    "Cache-Control": "s-maxage=86400",
  };

  const store = new Response(body, { status: 200, headers });
  ctx.waitUntil(cache.put(keyReq, store.clone()));

  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(body, { status: 200, headers });
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
