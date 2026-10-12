import {
  bsiTodayIso,
  cacheKeyRequest,
  cacheTtlSeconds,
  escapeScriptJson,
  isIsoDate,
  mapDailyFixDay,
  normalizeDailyFixPath,
  resolveDailyFixStatus,
  sitemapCacheKeyRequest,
  yymmddFromIso,
  type UpstreamOutcome,
} from "../shared/daily-fix";
import { buildFullHead, rewriteHtml, type HeadMode } from "./head";
import {
  fetchDailyFixDay,
  fetchDailyFixListPage,
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
  } = {},
): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cache = deps.cachesDefault ?? caches.default;
  const url = new URL(request.url);
  const path = url.pathname;

  // /api/daily-fix — always handled by worker
  if (path === "/api/daily-fix" || path === "/api/daily-fix/") {
    return handleApi(request, env, ctx, fetchImpl, cache);
  }

  // Sitemap
  if (path === "/sitemap-daily-fix.xml") {
    return handleSitemap(request, env, ctx, fetchImpl, cache);
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
    return handleDailyFixHtml(request, env, ctx, fetchImpl, cache);
  }

  // Anything else under run_worker_first that we don't own → ASSETS
  return env.ASSETS.fetch(request);
}

function acceptsHtml(request: Request): boolean {
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

async function handleDailyFixHtml(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
): Promise<Response> {
  const url = new URL(request.url);
  const normalized = normalizeDailyFixPath(url.pathname, url.search);

  if (normalized.kind === "redirect") {
    return new Response(null, {
      status: 301,
      headers: { Location: normalized.location },
    });
  }

  if (normalized.kind === "notFound") {
    return htmlNotFound(request, env);
  }

  const isHead = request.method.toUpperCase() === "HEAD";
  const tab = normalized.tab;
  const route = normalized.mode;
  const requestIso = route === "bare" ? bsiTodayIso() : normalized.iso;
  const yymmdd = route === "bare" ? "" : normalized.yymmdd;

  // Try edge cache first
  let outcome: UpstreamOutcome | null = null;
  let rawJson: unknown = null;
  const keyReq = cacheKeyRequest(requestIso);
  const cached = await cache.match(keyReq);
  if (cached) {
    try {
      rawJson = await cached.clone().json();
      const mapped = mapDailyFixDay(rawJson, requestIso);
      if (mapped && mapped.date === requestIso) {
        outcome = { kind: "ok", status: 200, json: rawJson, mapped };
      } else if (mapped && route === "dated") {
        // W37: dated hit whose date doesn't match → 404
        outcome = { kind: "mismatch", status: 200, json: rawJson, mapped };
      } else if (mapped && route === "bare") {
        // Bare may display closer day; cache key was request ISO (Q2)
        outcome = { kind: "ok", status: 200, json: rawJson, mapped };
      } else {
        outcome = { kind: "unmappable", status: 200, json: rawJson };
      }
    } catch {
      outcome = null;
    }
  }

  if (!outcome) {
    outcome = await fetchDailyFixDay(requestIso, env, fetchImpl);
    // Bare closer-day: treat mapped mismatch as ok (BSI source of truth) and cache under request ISO (Q2).
    if (route === "bare" && outcome.kind === "mismatch") {
      outcome = {
        kind: "ok",
        status: 200,
        json: outcome.json,
        mapped: outcome.mapped,
      };
    }
    if (outcome.kind === "ok") {
      const ttl = cacheTtlSeconds(requestIso, new Date(), { bare: route === "bare" });
      const store = new Response(JSON.stringify(outcome.json), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `s-maxage=${ttl}`,
        },
      });
      ctx.waitUntil(cache.put(keyReq, store));
      rawJson = outcome.json;
    } else if (outcome.kind === "mismatch" || outcome.kind === "unmappable") {
      rawJson = outcome.json;
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

  const assetRes = await env.ASSETS.fetch(indexAssetRequest(request));
  const bodyRes = await rewriteHtml(assetRes, plan);
  // Clone headers and set status
  const headers = new Headers(bodyRes.headers);
  // HTML must not get s-maxage (W36 / Q7)
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
  const assetRes = await env.ASSETS.fetch(indexAssetRequest(request));
  const rewritten = await rewriteHtml(assetRes, { mode: "generic_noindex" });
  const headers = new Headers(rewritten.headers);
  if (isHead) return new Response(null, { status: 404, headers });
  return new Response(rewritten.body, { status: 404, headers });
}

async function htmlServiceUnavailable(
  request: Request,
  env: Env,
  isHead: boolean,
): Promise<Response> {
  const assetRes = await env.ASSETS.fetch(indexAssetRequest(request));
  const rewritten = await rewriteHtml(assetRes, { mode: "generic" });
  const headers = new Headers(rewritten.headers);
  headers.set("Retry-After", "300");
  headers.set("Cache-Control", "no-store");
  if (isHead) return new Response(null, { status: 503, headers });
  return new Response(rewritten.body, { status: 503, headers });
}

function indexAssetRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = "/index.html";
  url.search = "";
  return new Request(url.toString(), {
    method: "GET",
    headers: request.headers,
  });
}

async function handleApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
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
      const json = await cached.clone().json();
      const mapped = mapDailyFixDay(json, date);
      if (mapped && mapped.date === date) {
        return jsonResponse(json, 200, apiOkHeaders(), method === "HEAD", true);
      }
    } catch {
      /* fall through */
    }
  }

  const outcome = await fetchDailyFixDay(date, env, fetchImpl);

  if (outcome.kind === "ok") {
    const ttl = cacheTtlSeconds(date, new Date());
    const store = new Response(JSON.stringify(outcome.json), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${ttl}`,
      },
    });
    ctx.waitUntil(cache.put(keyReq, store));
    return jsonResponse(outcome.json, 200, apiOkHeaders(), method === "HEAD", true);
  }

  if (outcome.kind === "unmappable") {
    // Rev 2.1: raw 200, not edge-cached
    return jsonResponse(outcome.json, 200, apiOkHeaders(), method === "HEAD", true);
  }

  if (outcome.kind === "not_found" || outcome.kind === "mismatch") {
    // API: mismatch is client's concern today — dated mismatch on API returns raw?
    // Spec 5.4: 404 for upstream 404. Mismatch: "The client maps the body… A dated mismatch is handled in the client"
    // So API returns raw 200 for mismatch (like unmappable with a body that maps but wrong date).
    if (outcome.kind === "mismatch") {
      return jsonResponse(outcome.json, 200, apiOkHeaders(), method === "HEAD", true);
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

function jsonResponse(
  body: unknown,
  status: number,
  extra: HeadersInit,
  head: boolean,
  rawBody = false,
): Response {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (head) return new Response(null, { status, headers });
  const text = rawBody && typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers });
}

async function handleSitemap(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: typeof fetch,
  cache: Cache,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const keyReq = sitemapCacheKeyRequest();
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

  while (offset < total) {
    const page = await fetchDailyFixListPage(offset, env, fetchImpl);
    if (!page.ok) {
      return new Response(method === "HEAD" ? null : "Service Unavailable", {
        status: 503,
        headers: {
          "Retry-After": "300",
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
    total = page.page.total;
    for (const item of page.page.items) {
      if (isIsoDate(item.date) && item.date <= today) {
        dates.push(item.date);
      }
    }
    offset += 100;
    if (page.page.items.length === 0 && offset >= total) break;
    // total=0 → one call then stop
    if (total === 0) break;
  }

  // Deduplicate, newest first already from API; keep stable unique
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

// silence unused in some builds
void acceptsHtml;
