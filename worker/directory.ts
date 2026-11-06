/**
 * Public gym/clinic directory plus a gated coach map.
 * Map secrets stay on the Worker. The browser only sees normalized listings.
 */
import { accountMePath } from "../shared/account/bsi-paths";
import { mayViewCoachDirectory } from "../shared/directory/access";
import { affiliatesMapPath, clinicsPath, coachesMapPath } from "../shared/directory/bsi-paths";
import {
  directoryHasMore,
  directoryRows,
  findADoctorEnabled,
  normalizeDirectoryRow,
} from "../shared/directory/normalize";
import type { DirectoryKind, DirectoryListing, DirectoryListResponse } from "../shared/directory/types";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import {
  assertBsiHost,
  bsiAccountBearerHeaders,
  resolveBsiOrigin,
  UPSTREAM_USER_AGENT,
  type BsiHttpResult,
  type Env,
  type FetchImpl,
} from "./upstream";

const PAGE_SIZE = 1000;
const MAX_PAGES = 6;
const CACHE_SECONDS = 120;
const UPSTREAM_TIMEOUT_MS = 12_000;

type DirectoryDeps = {
  fetchImpl?: FetchImpl;
  bsiBaseUrl?: string;
  cachesDefault?: Cache;
  /** Test override. Production uses the metfix.org session. */
  resolveSession?: typeof resolveActingSession;
};

function json(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function secretValue(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";
  return value.length > 0 ? value : null;
}

async function bsiGet(env: Env, fetchImpl: FetchImpl, url: string): Promise<BsiHttpResult> {
  try {
    assertBsiHost(url, env);
  } catch {
    return { kind: "throw" };
  }
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const bodyText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return { kind: "bad_json", status: response.status, bodyText: "", retryAfter: null };
    }
    if (!response.ok) {
      return {
        kind: "http",
        status: response.status,
        json: null,
        bodyText: "",
        code: null,
        retryAfter: null,
      };
    }
    return { kind: "ok", status: response.status, json: parsed, bodyText: "", retryAfter: null };
  } catch {
    return { kind: "throw" };
  }
}

async function loadPages(
  env: Env,
  fetchImpl: FetchImpl,
  origin: string,
  path: string,
  secret: string | null,
  rowKeys: readonly string[],
): Promise<{ rows: unknown[]; truncated: boolean; last: unknown } | { error: "upstream" }> {
  const rows: unknown[] = [];
  let last: unknown = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      page: String(page),
      perpage: String(PAGE_SIZE),
      view: "public",
    });
    if (secret) params.set("secret", secret);
    const result = await bsiGet(env, fetchImpl, `${origin}${path}?${params.toString()}`);
    if (result.kind !== "ok") return { error: "upstream" };
    last = result.json;
    rows.push(...directoryRows(result.json, rowKeys));
    if (!directoryHasMore(result.json)) return { rows, truncated: false, last };
  }
  return { rows, truncated: true, last };
}

function listingsFrom(rows: unknown[], kind: DirectoryKind): DirectoryListing[] {
  const out: DirectoryListing[] = [];
  for (const row of rows) {
    const listing = normalizeDirectoryRow(row, kind);
    if (listing) out.push(listing);
  }
  return out;
}

function cacheKey(kind: "gyms" | "clinics"): Request {
  return new Request(`https://directory-cache.internal/${kind}`);
}

async function readCached(cache: Cache | undefined, request: Request): Promise<string | null> {
  if (!cache) return null;
  try {
    const hit = await cache.match(request);
    if (!hit) return null;
    return await hit.text();
  } catch {
    return null;
  }
}

function writeCached(
  cache: Cache | undefined,
  ctx: ExecutionContext | undefined,
  request: Request,
  body: string,
): void {
  if (!cache) return;
  const stored = new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
  const put = cache.put(request, stored).catch(() => undefined);
  if (ctx) ctx.waitUntil(put);
}

async function accountOverview(
  ctx: ActingContext,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
): Promise<unknown | Response> {
  const ran = await runUserBsiCall(ctx, env, fetchImpl, opts, async (access) => {
    const headers = bsiAccountBearerHeaders(access);
    const url = `${resolveBsiOrigin(env, opts)}${accountMePath()}`;
    try {
      assertBsiHost(url, env);
    } catch {
      return { kind: "throw" as const };
    }
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: headers.Authorization,
          Accept: headers.Accept,
          "User-Agent": headers["User-Agent"],
        },
        signal: AbortSignal.timeout(8000),
      });
      const bodyText = await response.text();
      let parsed: unknown = null;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        return {
          kind: "bad_json" as const,
          status: response.status,
          bodyText: "",
          retryAfter: null,
        };
      }
      if (!response.ok) {
        return {
          kind: "http" as const,
          status: response.status,
          json: null,
          bodyText: "",
          code: null,
          retryAfter: null,
        };
      }
      return {
        kind: "ok" as const,
        status: response.status,
        json: parsed,
        bodyText: "",
        retryAfter: null,
      };
    } catch {
      return { kind: "throw" as const };
    }
  });
  if (ran instanceof Response) return ran;
  if (ran.result.kind !== "ok") return json({ error: "unavailable" }, 502, "private, no-store");
  return ran.result.json;
}

function publicJson(body: unknown): Response {
  return json(body, 200, `public, max-age=${CACHE_SECONDS}`);
}

async function handleGyms(
  env: Env,
  ctx: ExecutionContext | undefined,
  fetchImpl: FetchImpl,
  cache: Cache | undefined,
  origin: string,
): Promise<Response> {
  const key = cacheKey("gyms");
  const cached = await readCached(cache, key);
  if (cached) return publicJson(JSON.parse(cached) as DirectoryListResponse);
  const secret = secretValue(env.BSI_AFFILIATES_MAP_SECRET);
  if (!secret) return json({ error: "unavailable" }, 503, "private, no-store");
  const loaded = await loadPages(env, fetchImpl, origin, affiliatesMapPath(), secret, ["affiliates"]);
  if ("error" in loaded) return json({ error: "unavailable" }, 502, "private, no-store");
  const body: DirectoryListResponse = {
    listings: listingsFrom(loaded.rows, "gym"),
    truncated: loaded.truncated,
  };
  writeCached(cache, ctx, key, JSON.stringify(body));
  return publicJson(body);
}

async function handleClinics(
  env: Env,
  ctx: ExecutionContext | undefined,
  fetchImpl: FetchImpl,
  cache: Cache | undefined,
  origin: string,
): Promise<Response> {
  const key = cacheKey("clinics");
  const cached = await readCached(cache, key);
  if (cached) return publicJson(JSON.parse(cached) as DirectoryListResponse);
  const loaded = await loadPages(env, fetchImpl, origin, clinicsPath(), null, [
    "items",
    "clinics",
    "affiliates",
  ]);
  if ("error" in loaded) return json({ error: "unavailable" }, 502, "private, no-store");
  const listings = listingsFrom(loaded.rows, "doctor");
  const body: DirectoryListResponse = {
    listings,
    truncated: loaded.truncated,
    find_a_doctor_enabled: findADoctorEnabled(loaded.last) && listings.length > 0,
  };
  writeCached(cache, ctx, key, JSON.stringify(body));
  return publicJson(body);
}

async function handleGeocode(
  request: Request,
  fetchImpl: FetchImpl,
): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 120) {
    return json({ error: "invalid_request" }, 400, "private, no-store");
  }
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  try {
    const upstream = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "metfixhome-worker/1.0 (find-a-gym; https://metfix.org)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return json({ error: "unavailable" }, 502, "private, no-store");
    const rows = (await upstream.json()) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ found: false }, 200, "public, max-age=300");
    }
    const row = rows[0] as { lat?: string; lon?: string; display_name?: string };
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ found: false }, 200, "public, max-age=300");
    }
    return json(
      {
        found: true,
        lat,
        lng,
        label: typeof row.display_name === "string" ? row.display_name : q,
      },
      200,
      "public, max-age=86400",
    );
  } catch {
    return json({ error: "unavailable" }, 502, "private, no-store");
  }
}

async function handleCoaches(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  origin: string,
  deps: DirectoryDeps,
): Promise<Response> {
  const resolve = deps.resolveSession ?? resolveActingSession;
  const session = await resolve(request, env, fetchImpl, { baseUrl: deps.bsiBaseUrl });
  if (session instanceof Response) return session;
  const overview = await accountOverview(session, env, fetchImpl, { baseUrl: deps.bsiBaseUrl });
  if (overview instanceof Response) return overview;
  if (!mayViewCoachDirectory(overview)) {
    return json({ error: "forbidden" }, 403, "private, no-store");
  }
  const secret = secretValue(env.BSI_COACHES_MAP_SECRET);
  if (!secret) return json({ error: "unavailable" }, 503, "private, no-store");
  const loaded = await loadPages(env, fetchImpl, origin, coachesMapPath(), secret, ["coaches"]);
  if ("error" in loaded) return json({ error: "unavailable" }, 502, "private, no-store");
  const body: DirectoryListResponse = {
    listings: listingsFrom(loaded.rows, "coach"),
    truncated: loaded.truncated,
  };
  return json(body, 200, "private, no-store");
}

export async function handleDirectoryRoutes(
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
  deps: DirectoryDeps = {},
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405, "private, no-store");
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const origin = resolveBsiOrigin(env, { baseUrl: deps.bsiBaseUrl });
  const path = new URL(request.url).pathname;
  let response: Response;
  if (path === "/api/directory/gyms") {
    response = await handleGyms(env, ctx, fetchImpl, deps.cachesDefault, origin);
  } else if (path === "/api/directory/clinics") {
    response = await handleClinics(env, ctx, fetchImpl, deps.cachesDefault, origin);
  } else if (path === "/api/directory/coaches") {
    response = await handleCoaches(request, env, fetchImpl, origin, deps);
  } else if (path === "/api/directory/geocode") {
    response = await handleGeocode(request, fetchImpl);
  } else {
    response = json({ error: "not_found" }, 404, "private, no-store");
  }
  if (method === "HEAD") {
    return new Response(null, { status: response.status, headers: response.headers });
  }
  return response;
}
