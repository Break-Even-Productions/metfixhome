import {
  isIsoDate,
  mapDailyFixDay,
  type DailyFixDay,
  type UpstreamOutcome,
} from "../shared/daily-fix";

export const BSI_DAILY_FIX_URL = "https://brokenscience.org/wp-json/metfix/v1/daily-fix";
export const BSI_ORIGIN = "https://brokenscience.org";
export const BSI_HOST = "brokenscience.org";
/** Spec 1.6.12 §0w.2 — staging BSI base (same paths as prod). */
export const BSI_STAGING_ORIGIN = "https://brokenstaging.wpengine.com";
export const BSI_STAGING_HOST = "brokenstaging.wpengine.com";
const ALLOWED_BSI_HOSTS = new Set([BSI_HOST, BSI_STAGING_HOST]);
/** brokenscience.org's Cloudflare bot rules challenge requests with no User-Agent. */
export const UPSTREAM_USER_AGENT = "metfixhome-worker/1.0";

export const METFIX_CALLBACK_URI = "https://metfix.org/api/auth/callback";

/**
 * Hard cap on sitemap Cloudflare subrequests (CQ2).
 * Includes Cache API match (+1) and reserves one slot for put; upstream
 * fetches stop at MAX-1.
 */
export const SITEMAP_MAX_SUBREQUESTS = 40;

/** Seconds in Retry-After responses: branded 1..600 (AU26.11). */
export type RetryAfterSeconds = number & { readonly __brand: "RetryAfterSeconds" };

/**
 * Shared Retry-After parser for login and comment write/like 429 paths (AU26.11).
 * Ethan ruling: all-digit value is the integer, clamp 1..600.
 * Strip leading zeros before the length guard: "0000017"→17, "0000000"→1.
 * After strip, 7+ significant digits → 600. Missing / non-numeric / HTTP-date / decimal → 60.
 */
export function parseRetryAfter(header: string | null | undefined): RetryAfterSeconds {
  if (header == null || header === "") return 60 as RetryAfterSeconds;
  if (!/^[0-9]+$/.test(header)) return 60 as RetryAfterSeconds;
  // Strip leading zeros before length guard (CQ r2): "0000017"→"17", "0000000"→"0".
  const significant = header.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;
  // 7+ significant digits cannot be in 1..600; avoid Number() on huge strings (M-RA4).
  if (digits.length >= 7) return 600 as RetryAfterSeconds;
  const n = Number(digits);
  if (!Number.isFinite(n)) return 600 as RetryAfterSeconds;
  if (n < 1) return 1 as RetryAfterSeconds;
  if (n > 600) return 600 as RetryAfterSeconds;
  return n as RetryAfterSeconds;
}

/** CM6 / CW12.2: only JSON `true` is moderator; omit/non-boolean → false. */
export function normalizeCanModerate(value: unknown): boolean {
  return value === true;
}

export type CommentType = "belly" | "body" | "brain" | "all";

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type Env = {
  ASSETS: Fetcher;
  DAILY_FIX_API_KEY?: string;
  AUTH_SESSIONS: KVNamespace;
  SESSION: DurableObjectNamespace;
  LOGIN_THROTTLE: DurableObjectNamespace;
  OAUTH_STATE: DurableObjectNamespace;
  /** Dedicated metfix.org WP OAuth client id (non-secret). */
  BSI_OAUTH_CLIENT_ID?: string;
  /** WP OAuth confidential client secret (Worker-only). */
  METFIX_ORG_OAUTH_CLIENT_SECRET?: string;
  SESSION_ENC_KEY?: string;
  SESSION_ENC_KEY_PREV?: string;
  CSRF_SECRET?: string;
  RECAPTCHA_SECRET?: string;
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_WEB_CLIENT_SECRET?: string;
  /** When "1"/"true", Google auth routes are live (R9 gate). */
  GOOGLE_AUTH_ENABLED?: string;
  SIGNUP_LIMITER?: RateLimitBinding;
  USERNAME_CHECK_LIMITER?: RateLimitBinding;
  GOOGLE_AUTH_LIMITER?: RateLimitBinding;
  COMMENT_WRITE_LIMITER?: RateLimitBinding;
  COMMENT_LIKE_LIMITER?: RateLimitBinding;
  COMMENT_LIKE_TOGGLE_LIMITER?: RateLimitBinding;
  LEADERBOARD_LIMITER?: RateLimitBinding;
};

export type FetchImpl = typeof fetch;

export function assertBsiHost(url: string): void {
  const host = new URL(url).hostname;
  if (!ALLOWED_BSI_HOSTS.has(host)) {
    throw new Error(`BSI host not allowed: ${host}`);
  }
}

/** W5 + Content-Type for JSON POSTs. Never forwards IP or Authorization. */
export function bsiJsonHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
    "X-API-Key": apiKey,
  };
}

/** W5 GET headers (no Content-Type). */
export function bsiGetHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
    "X-API-Key": apiKey,
  };
}

/** W5 + Bearer for user-acting calls. */
export function bsiBearerHeaders(apiKey: string, accessToken: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
    "X-API-Key": apiKey,
    Authorization: `Bearer ${accessToken}`,
  };
}

function originFromOpts(opts?: { baseUrl?: string }): string {
  if (!opts?.baseUrl) return BSI_ORIGIN;
  try {
    const u = new URL(opts.baseUrl);
    return u.origin;
  } catch {
    return BSI_ORIGIN;
  }
}

export type BsiHttpResult =
  | { kind: "ok"; status: number; json: unknown; bodyText: string; retryAfter: RetryAfterSeconds | null }
  | { kind: "http"; status: number; json: unknown; bodyText: string; code: string | null; retryAfter: RetryAfterSeconds | null }
  | { kind: "nokey" }
  | { kind: "timeout" }
  | { kind: "throw" }
  | { kind: "bad_json"; status: number; bodyText: string; retryAfter: RetryAfterSeconds | null };

function readBsiCode(json: unknown): string | null {
  if (json && typeof json === "object" && typeof (json as { code?: unknown }).code === "string") {
    return (json as { code: string }).code;
  }
  return null;
}

function readOAuthError(json: unknown): string | null {
  if (json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string") {
    return (json as { error: string }).error;
  }
  return null;
}

export function oauthClientId(env: Env): string | null {
  const v = env.BSI_OAUTH_CLIENT_ID;
  return v && v.length > 0 ? v : null;
}

export function oauthClientSecret(env: Env): string | null {
  const v = env.METFIX_ORG_OAUTH_CLIENT_SECRET;
  return v && v.length > 0 ? v : null;
}

export function dailyFixApiKey(env: Env): string | null {
  const v = env.DAILY_FIX_API_KEY;
  return v && v.length > 0 ? v : null;
}

export function recaptchaSecret(env: Env): string | null {
  const v = env.RECAPTCHA_SECRET;
  return v && v.length > 0 ? v : null;
}

export type AuthConfig = {
  clientId: string;
  clientSecret: string;
  recaptchaSecret: string;
  apiKey: string;
  origin: string;
};

export type RequireAuthConfigOpts = {
  /** When true, require non-empty RECAPTCHA_SECRET (login). */
  needRecaptcha?: boolean;
  /** When true, require non-empty DAILY_FIX_API_KEY (/me and BSI routes). */
  needApiKey?: boolean;
  /** Test/prod BSI base URL; `""` is treated as missing (`BSI_BASE_URL`). */
  baseUrl?: string;
};

function logAuthConfigMissing(field: string): void {
  console.log("auth_config_missing", field);
}

function resolveAuthOrigin(baseUrl?: string): { origin: string } | { missing: "BSI_BASE_URL" } {
  if (baseUrl === "") return { missing: "BSI_BASE_URL" };
  return { origin: originFromOpts({ baseUrl }) };
}

/**
 * Validates auth-related bindings. Logs `auth_config_missing` with the field name only.
 * Returns null when any required value is missing or empty.
 */
export function requireAuthConfig(env: Env, opts?: RequireAuthConfigOpts): AuthConfig | null {
  const originRes = resolveAuthOrigin(opts?.baseUrl);
  if ("missing" in originRes) {
    logAuthConfigMissing(originRes.missing);
    return null;
  }
  const clientId = oauthClientId(env);
  if (!clientId) {
    logAuthConfigMissing("BSI_OAUTH_CLIENT_ID");
    return null;
  }
  const clientSecret = oauthClientSecret(env);
  if (!clientSecret) {
    logAuthConfigMissing("METFIX_ORG_OAUTH_CLIENT_SECRET");
    return null;
  }
  if (opts?.needRecaptcha) {
    const rs = recaptchaSecret(env);
    if (!rs) {
      logAuthConfigMissing("RECAPTCHA_SECRET");
      return null;
    }
  }
  if (opts?.needApiKey) {
    const apiKey = dailyFixApiKey(env);
    if (!apiKey) {
      logAuthConfigMissing("DAILY_FIX_API_KEY");
      return null;
    }
  }
  return {
    clientId,
    clientSecret,
    recaptchaSecret: recaptchaSecret(env) ?? "",
    apiKey: dailyFixApiKey(env) ?? "",
    origin: originRes.origin,
  };
}

/** W5 OAuth token POST (no X-API-Key, no Authorization). */
function oauthFormHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

/** GET /wp-json/bsi/v1/me headers (§0v.1 Q2 — Bearer only, no X-API-Key). */
function bsiMeHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": UPSTREAM_USER_AGENT,
  };
}

async function oauthTokenFetch(
  url: string,
  body: URLSearchParams,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<BsiHttpResult> {
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "throw" };
  }
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: oauthFormHeaders(),
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bodyText = await response.text();
    const raRaw = response.headers.get("Retry-After");
    const retryAfter = raRaw != null ? parseRetryAfter(raRaw) : null;
    let json: unknown = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return { kind: "bad_json", status: response.status, bodyText, retryAfter };
    }
    if (response.ok) {
      return { kind: "ok", status: response.status, json, bodyText, retryAfter };
    }
    // Map on OAuth `error` only — never surface or prefer `bsi_code` (§0v.3).
    const oauthErr = readOAuthError(json);
    void readBsiCode(json);
    return {
      kind: "http",
      status: response.status,
      json,
      bodyText,
      code: oauthErr,
      retryAfter,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") return { kind: "timeout" };
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { kind: "timeout" };
    }
    return { kind: "throw" };
  }
}

export type BsiMeProfile = {
  id: number;
  display_name: string;
  avatar_url?: string;
  can_moderate: boolean;
};

export function parseBsiMeProfile(json: unknown): BsiMeProfile | null {
  if (!json || typeof json !== "object") return null;
  const id = (json as { id?: unknown }).id;
  if (typeof id !== "number" || !Number.isInteger(id)) return null;
  const display_name = (json as { display_name?: unknown }).display_name;
  if (typeof display_name !== "string") return null;
  const avatar_url = (json as { avatar_url?: unknown }).avatar_url;
  const can_moderate = normalizeCanModerate((json as { can_moderate?: unknown }).can_moderate);
  return {
    id,
    display_name,
    avatar_url: typeof avatar_url === "string" ? avatar_url : undefined,
    can_moderate,
  };
}

async function bsiFetch(
  url: string,
  init: RequestInit,
  fetchImpl: FetchImpl,
): Promise<BsiHttpResult> {
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "throw" };
  }
  try {
    const response = await fetchImpl(url, init);
    const bodyText = await response.text();
    const raRaw = response.headers.get("Retry-After");
    const retryAfter = raRaw != null ? parseRetryAfter(raRaw) : null;
    let json: unknown = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return { kind: "bad_json", status: response.status, bodyText, retryAfter };
    }
    if (response.ok) {
      return { kind: "ok", status: response.status, json, bodyText, retryAfter };
    }
    return {
      kind: "http",
      status: response.status,
      json,
      bodyText,
      code: readBsiCode(json),
      retryAfter,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") return { kind: "timeout" };
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { kind: "timeout" };
    }
    return { kind: "throw" };
  }
}

// ── Daily Fix day / list / comments (existing) ──────────────────────────────

export async function fetchDailyFixDay(
  iso: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<UpstreamOutcome> {
  if (!env.DAILY_FIX_API_KEY) {
    return { kind: "nokey" };
  }

  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}?date=${encodeURIComponent(iso)}`;
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "throw" };
  }

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: bsiGetHeaders(env.DAILY_FIX_API_KEY),
      signal: AbortSignal.timeout(3000),
    });

    if (response.status === 404) {
      return { kind: "not_found", status: 404 };
    }
    if (response.status >= 500) {
      return { kind: "upstream_error", status: response.status };
    }
    if (!response.ok) {
      return { kind: "upstream_error", status: response.status };
    }

    const bodyText = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      return { kind: "unmappable", status: 200, json: null, bodyText };
    }

    const mapped = mapDailyFixDay(json, iso);
    if (!mapped) {
      return { kind: "unmappable", status: 200, json, bodyText };
    }
    if (mapped.date !== iso) {
      return { kind: "mismatch", status: 200, json, mapped, bodyText };
    }
    return { kind: "ok", status: 200, json, mapped, bodyText };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { kind: "timeout" };
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { kind: "timeout" };
    }
    return { kind: "throw" };
  }
}

export type ListItem = {
  date: string;
  /** Present when upstream includes it; filter to published when set. */
  status?: string;
  /** Full mapped day when the row carries a complete day payload. */
  day: DailyFixDay | null;
};

export type ListPage = {
  items: ListItem[];
  total: number;
};

export const LIST_PAGE_SIZE = 100;

/** True for list rows that may be shown publicly: no status, published, or scheduled, and not in the future. */
export function isPublicListItem(item: ListItem, todayIso: string): boolean {
  if (item.status != null && item.status !== "published" && item.status !== "scheduled") {
    return false;
  }
  return isIsoDate(item.date) && item.date <= todayIso;
}

export async function fetchDailyFixListPage(
  offset: number,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<{ ok: true; page: ListPage } | { ok: false; reason: "nokey" | "fail" }> {
  if (!env.DAILY_FIX_API_KEY) return { ok: false, reason: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}?limit=${LIST_PAGE_SIZE}&offset=${offset}`;
  try {
    assertBsiHost(url);
  } catch {
    return { ok: false, reason: "fail" };
  }
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: bsiGetHeaders(env.DAILY_FIX_API_KEY),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 3000),
    });
    if (!response.ok) return { ok: false, reason: "fail" };
    const json = (await response.json()) as {
      days?: unknown;
      items?: unknown;
      meta?: { total?: unknown };
    };
    const total = typeof json.meta?.total === "number" ? json.meta.total : 0;
    const rows = Array.isArray(json.days) ? json.days : json.items;
    const items: ListItem[] = [];
    if (Array.isArray(rows)) {
      for (const item of rows) {
        if (item && typeof item === "object" && typeof (item as { date?: unknown }).date === "string") {
          const row = item as { date: string; status?: unknown };
          const entry: ListItem = { date: row.date, day: mapDailyFixDay(item, row.date) };
          if (typeof row.status === "string") entry.status = row.status;
          items.push(entry);
        }
      }
    }
    return { ok: true, page: { items, total } };
  } catch {
    return { ok: false, reason: "fail" };
  }
}

export function outcomeForCache(outcome: UpstreamOutcome): DailyFixDay | null {
  return outcome.kind === "ok" ? outcome.mapped : null;
}

export type CommentsUpstream =
  | { kind: "ok"; bodyText: string }
  | { kind: "not_found" }
  | { kind: "bad_request" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "rate_limited"; retryAfter: RetryAfterSeconds }
  | { kind: "nokey" }
  | { kind: "unavailable" };

/**
 * GET BSI comments for one ISO date. Raw body only — Worker shapes via W7.
 * Distinct 401/403 kinds for logging (W6.3/W6.4); does not touch the day cache.
 */
export async function fetchDailyFixComments(
  iso: string,
  type: CommentType,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; accessToken?: string },
): Promise<CommentsUpstream> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };

  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}/comments?date=${encodeURIComponent(iso)}&type=${encodeURIComponent(type)}`;
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "unavailable" };
  }

  try {
    const headers =
      opts?.accessToken
        ? bsiBearerHeaders(env.DAILY_FIX_API_KEY, opts.accessToken)
        : bsiGetHeaders(env.DAILY_FIX_API_KEY);
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(3000),
    });
    if (response.status === 400) return { kind: "bad_request" };
    if (response.status === 404) return { kind: "not_found" };
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 403) return { kind: "forbidden" };
    if (response.status === 429) {
      return {
        kind: "rate_limited",
        retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
      };
    }
    if (!response.ok) return { kind: "unavailable" };
    return { kind: "ok", bodyText: await response.text() };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") return { kind: "unavailable" };
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { kind: "unavailable" };
    }
    return { kind: "unavailable" };
  }
}

// ── Auth upstream (BSI-C10 / C2 / C2a / C3 / C4 / C5) ───────────────────────

export type WebLoginBody = {
  username: string;
  password: string;
  client_id: string;
  recaptcha_token: string;
};

export type TokenPairBody = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user_id?: number | string;
  public_name?: string;
  member_id?: number | string;
  can_moderate?: unknown;
};

/** Pro OAuth: POST {origin}/oauth/token, grant_type=password (§0u.3). */
export async function oauthPasswordGrant(
  body: { username: string; password: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  const cfg = requireAuthConfig(env, { needApiKey: false, baseUrl: opts?.baseUrl });
  if (!cfg) return { kind: "nokey" };
  const url = `${cfg.origin}/oauth/token`;
  const form = new URLSearchParams({
    grant_type: "password",
    username: body.username,
    password: body.password,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  return oauthTokenFetch(url, form, fetchImpl, opts?.timeoutMs ?? 5000);
}

/** Pro OAuth: POST {origin}/oauth/token, grant_type=refresh_token (§0u.3). */
export async function oauthRefreshGrant(
  body: { refresh_token: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  const cfg = requireAuthConfig(env, { needApiKey: false, baseUrl: opts?.baseUrl });
  if (!cfg) return { kind: "nokey" };
  const url = `${cfg.origin}/oauth/token`;
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: body.refresh_token,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  return oauthTokenFetch(url, form, fetchImpl, opts?.timeoutMs ?? 5000);
}

/** BSI-C11: GET {origin}/wp-json/bsi/v1/me — no X-API-Key (§0v.1 Q2). */
export async function bsiFetchMe(
  accessToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  const cfg = requireAuthConfig(env, { needApiKey: false, baseUrl: opts?.baseUrl });
  if (!cfg) return { kind: "nokey" };
  const url = `${cfg.origin}/wp-json/bsi/v1/me`;
  return bsiFetch(
    url,
    {
      method: "GET",
      headers: bsiMeHeaders(accessToken),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** Pro OAuth: POST {origin}/oauth/token, grant_type=authorization_code (§0w.1). */
export async function oauthAuthorizationCodeGrant(
  body: { code: string; redirect_uri: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  const cfg = requireAuthConfig(env, { needApiKey: false, baseUrl: opts?.baseUrl });
  if (!cfg) return { kind: "nokey" };
  const url = `${cfg.origin}/oauth/token`;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: body.code,
    redirect_uri: body.redirect_uri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  return oauthTokenFetch(url, form, fetchImpl, opts?.timeoutMs ?? 5000);
}

/**
 * Pro OAuth: POST {origin}/oauth/revoke (§0v.1 Q6).
 * Body exactly `token` + `token_type_hint`; no secret, client_id, or Authorization.
 */
export async function oauthRevokeToken(
  body: { token: string; token_type_hint: "refresh_token" | "access_token" },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  const origin = originFromOpts(opts);
  const url = `${origin}/oauth/revoke`;
  const form = new URLSearchParams({
    token: body.token,
    token_type_hint: body.token_type_hint,
  });
  return oauthTokenFetch(url, form, fetchImpl, opts?.timeoutMs ?? 5000);
}

/** @deprecated BSI-C10 web-login — use oauthPasswordGrant + bsiFetchMe */
export async function bsiWebLogin(
  body: WebLoginBody,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/bsi/v1/auth/web-login`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** BSI-C2: POST /wp-json/bsi/v1/auth/register-direct */
export async function bsiRegisterDirect(
  body: {
    username: string;
    email: string;
    client_id: string;
    redirect_uri: string;
    state?: string;
  },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/bsi/v1/auth/register-direct`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** BSI-C2a: GET /wp-json/bsi/v1/auth/register/check-username */
export async function bsiCheckUsername(
  username: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/bsi/v1/auth/register/check-username?username=${encodeURIComponent(username)}`;
  return bsiFetch(
    url,
    {
      method: "GET",
      headers: bsiGetHeaders(env.DAILY_FIX_API_KEY),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 3000),
    },
    fetchImpl,
  );
}

/** BSI-C3 refresh: POST /wp-json/metfix/v1/proxy/oauth/token */
export async function bsiRefreshToken(
  body: { grant_type: "refresh_token"; client_id: string; refresh_token: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/metfix/v1/proxy/oauth/token`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** BSI-C3 code exchange: exactly 4 keys (1.6.3). */
export async function bsiExchangeCode(
  body: {
    grant_type: "authorization_code";
    code: string;
    client_id: string;
    redirect_uri: string;
  },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/metfix/v1/proxy/oauth/token`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** BSI-C4: POST /wp-json/metfix/v1/proxy/oauth/revoke — no Authorization. */
export async function bsiRevokeToken(
  body: { client_id: string; refresh_token: string },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/metfix/v1/proxy/oauth/revoke`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** BSI-C5: POST /wp-json/bsi/v1/auth/social */
export async function bsiSocialAuth(
  body: {
    provider: "google";
    intent: "login" | "register";
    access_token: string;
    client_id: string;
    redirect_uri: string;
    state: string;
  },
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<BsiHttpResult> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const url = `${origin}/wp-json/bsi/v1/auth/social`;
  return bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiJsonHeaders(env.DAILY_FIX_API_KEY),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    },
    fetchImpl,
  );
}

/** Follow BSI-C5a bridge server-side (never 302 the browser). */
export async function bsiFollowBridge(
  bridgeUrl: string,
  fetchImpl: FetchImpl,
  opts?: { timeoutMs?: number },
): Promise<{ kind: "redirect"; location: string } | { kind: "fail" }> {
  try {
    assertBsiHost(bridgeUrl);
  } catch {
    return { kind: "fail" };
  }
  try {
    const response = await fetchImpl(bridgeUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
      },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    });
    const location = response.headers.get("Location");
    if ((response.status === 302 || response.status === 301) && location) {
      return { kind: "redirect", location };
    }
    return { kind: "fail" };
  } catch {
    return { kind: "fail" };
  }
}

// ── Comment write / like / leaderboard upstream ─────────────────────────────

export type CommentWriteUpstream =
  | { kind: "ok"; status: number; bodyText: string; json: unknown }
  | { kind: "rate_limited"; retryAfter: RetryAfterSeconds }
  | { kind: "http"; status: number; code: string | null; bodyText: string; json: unknown }
  | { kind: "nokey" }
  | { kind: "unavailable" };

function mapWriteResult(r: BsiHttpResult): CommentWriteUpstream {
  if (r.kind === "nokey") return { kind: "nokey" };
  if (r.kind === "timeout" || r.kind === "throw") return { kind: "unavailable" };
  if (r.kind === "bad_json") {
    if (r.status === 429) return { kind: "rate_limited", retryAfter: r.retryAfter ?? (60 as RetryAfterSeconds) };
    return { kind: "unavailable" };
  }
  if (r.kind === "ok") return { kind: "ok", status: r.status, bodyText: r.bodyText, json: r.json };
  if (r.status === 429) {
    return { kind: "rate_limited", retryAfter: r.retryAfter ?? parseRetryAfter(null) };
  }
  return { kind: "http", status: r.status, code: r.code, bodyText: r.bodyText, json: r.json };
}

export async function bsiPostComment(
  body: { date: string; type: string; content: string; parent_comment_id?: number },
  accessToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<CommentWriteUpstream> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}/comments`;
  const r = await bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiBearerHeaders(env.DAILY_FIX_API_KEY, accessToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}

export async function bsiPatchComment(
  id: string | number,
  body: { content: string },
  accessToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<CommentWriteUpstream> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}/comments/${encodeURIComponent(String(id))}`;
  const r = await bsiFetch(
    url,
    {
      method: "PATCH",
      headers: bsiBearerHeaders(env.DAILY_FIX_API_KEY, accessToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}

export async function bsiDeleteComment(
  id: string | number,
  accessToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<CommentWriteUpstream> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}/comments/${encodeURIComponent(String(id))}`;
  const r = await bsiFetch(
    url,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
        "X-API-Key": env.DAILY_FIX_API_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}

export async function bsiLikeComment(
  id: string | number,
  liked: boolean,
  accessToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<CommentWriteUpstream> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}/comments/${encodeURIComponent(String(id))}/like`;
  const r = await bsiFetch(
    url,
    {
      method: "POST",
      headers: bsiBearerHeaders(env.DAILY_FIX_API_KEY, accessToken),
      body: JSON.stringify({ liked }),
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}

export async function bsiFetchLeaderboard(
  dailyWorkoutId: string | number,
  accessToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string; query?: Record<string, string> },
): Promise<CommentWriteUpstream> {
  if (!env.DAILY_FIX_API_KEY) return { kind: "nokey" };
  const origin = originFromOpts(opts);
  const qs = new URLSearchParams(opts?.query ?? {});
  const q = qs.toString();
  const url = `${origin}/wp-json/metfix/v1/daily-fix/workouts/${encodeURIComponent(String(dailyWorkoutId))}/leaderboard${q ? `?${q}` : ""}`;
  const r = await bsiFetch(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
        "X-API-Key": env.DAILY_FIX_API_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(5000),
    },
    fetchImpl,
  );
  return mapWriteResult(r);
}
