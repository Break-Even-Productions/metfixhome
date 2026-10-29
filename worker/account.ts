/**
 * Account dashboard + public member profile Worker routes (PR B / DP1–DP31).
 * Bearer-only BSI via runUserBsiCall + bsiAccountBearerHeaders (never shared API-key header).
 */
import { computeLtvBudget } from "../shared/account/ltv";
import { normalizeFoundationsCoachStatus } from "../shared/account/foundations-coach";
import {
  normalizeCanonicalTier,
  type LegacySubscriptionSource,
} from "../shared/account/tiers";
import { sanitizeExternalBillingUrl } from "../shared/account/url-allowlist";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { csrfForSid, timingSafeEqualStr } from "./auth/crypto";
import { isAllowedAuthOrigin } from "./auth/csrf";
import { isAuthHost } from "./auth/host";
import { publicDisplayName } from "./auth/public-name";
import { clientIp } from "./auth/throttle";
import {
  assertBsiHost,
  bsiAccountBearerHeaders,
  parseRetryAfter,
  resolveBsiOrigin,
  type BsiHttpResult,
  type Env,
  type FetchImpl,
  type RateLimitBinding,
} from "./upstream";

const MAX_JSON_BYTES = 65_536;
const MAX_PICTURE_BYTES = 5_242_880;
const POSITIVE_INT_RE = /^[1-9][0-9]{0,9}$/;
const SOURCE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const STRIPE_LIKE_ID_RE = /^(cus|sub|mem|seti|pi)_[A-Za-z0-9]+$/;
const EMAIL_VALUE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/**
 * Editable profile attribute IDs (non-email). Common BSI attr slots for
 * credentials / location / bio extras — email attrs are never listed here.
 */
export const EDITABLE_ATTR_IDS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5]);

const FAVORITE_SOURCE_TYPES = new Set([
  "articles",
  "recipes",
  "workouts",
  "videos",
  "post",
  "daily_fix",
]);

const FAVORITE_FILTER_TYPES = new Set(["all", "articles", "recipes", "workouts", "videos"]);

const PROFILE_PATCH_FIELDS = new Set([
  "first_name",
  "last_name",
  "display_name",
  "bio",
  "location",
  "credentials",
  "community_opt_in",
]);

const PORTAL_INTENTS = new Set(["manage", "upgrade", "cancel_duplicate"]);
const CONVERT_TIERS = new Set(["metfix_pro", "organization_owner"]);
const REFERRAL_ACTIONS = new Set(["generate", "rotate", "revoke"]);

type LimiterKind = "read" | "write" | "portal";

type AccountDeps = {
  fetchImpl?: FetchImpl;
  bsiBaseUrl?: string;
};

type RouteMatch = {
  id: string;
  method: string;
  params: Record<string, string>;
  limiter: LimiterKind;
  /** Public GET /api/members/:id — no session. */
  public?: boolean;
};

function accountJson(
  body: unknown,
  status: number,
  extra: HeadersInit = {},
): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Cookie");
  return new Response(JSON.stringify(body), { status, headers });
}

function mapUnauthenticated(res: Response): Response {
  if (res.status !== 401) return res;
  const setCookie = res.headers.get("Set-Cookie");
  const extra: HeadersInit = {};
  if (setCookie) extra["Set-Cookie"] = setCookie;
  return accountJson({ error: "unauthenticated" }, 401, extra);
}

async function resolveAccountSession(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  const resolved = await resolveActingSession(request, env, fetchImpl, opts);
  if (resolved instanceof Response) return mapUnauthenticated(resolved);
  return resolved;
}

async function requireAccountCsrf(
  request: Request,
  env: Env,
  sid: string,
): Promise<Response | null> {
  if (!env.CSRF_SECRET) {
    return accountJson({ error: "unavailable" }, 503, { "Retry-After": "300" });
  }
  if (!isAllowedAuthOrigin(request.headers.get("Origin"), env)) {
    return accountJson({ error: "forbidden" }, 403);
  }
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs != null && sfs !== "same-origin") {
    return accountJson({ error: "forbidden" }, 403);
  }
  const token = request.headers.get("X-CSRF-Token") ?? "";
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(token, expected)) {
    return accountJson({ error: "forbidden" }, 403);
  }
  return null;
}

function limiterBinding(env: Env, kind: LimiterKind): RateLimitBinding | undefined {
  if (kind === "read") return env.ACCOUNT_READ_LIMITER;
  if (kind === "write") return env.ACCOUNT_WRITE_LIMITER;
  return env.ACCOUNT_PORTAL_LIMITER;
}

async function checkAccountLimit(
  env: Env,
  kind: LimiterKind,
  key: string,
): Promise<Response | null> {
  const binding = limiterBinding(env, kind);
  if (!binding) {
    return accountJson({ error: "unavailable" }, 503, { "Retry-After": "60" });
  }
  const r = await binding.limit({ key });
  if (r.success !== true) {
    return accountJson(
      { error: "rate_limited", retry_after: 60 },
      429,
      { "Retry-After": "60" },
    );
  }
  return null;
}

function isJsonContentType(ct: string | null): boolean {
  if (!ct) return false;
  const base = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  return base === "application/json";
}

async function readJsonBody(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ ok: true; json: unknown } | Response> {
  if (!isJsonContentType(request.headers.get("Content-Type"))) {
    return accountJson({ error: "unsupported_media_type" }, 415);
  }
  const cl = request.headers.get("Content-Length");
  if (cl != null) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > maxBytes) {
      return accountJson({ error: "payload_too_large" }, 413);
    }
  }
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    return accountJson({ error: "payload_too_large" }, 413);
  }
  try {
    return { ok: true, json: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return accountJson({ error: "invalid_request" }, 400);
  }
}

async function accountBsiFetch(
  url: string,
  init: RequestInit,
  fetchImpl: FetchImpl,
  env: Env,
): Promise<BsiHttpResult> {
  try {
    assertBsiHost(url, env);
  } catch {
    return { kind: "throw" };
  }
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(8000),
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
    return {
      kind: "http",
      status: response.status,
      json,
      bodyText,
      code: null,
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

function bsiUrl(env: Env, path: string, opts?: { baseUrl?: string }, query?: string): string {
  const origin = resolveBsiOrigin(env, opts);
  return `${origin}${path}${query ? `?${query}` : ""}`;
}

async function runBearer(
  ctx: ActingContext,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  method: string,
  path: string,
  init?: { body?: string | ArrayBuffer; contentType?: string; query?: string },
): Promise<{ ctx: ActingContext; result: BsiHttpResult } | Response> {
  return runUserBsiCall(ctx, env, fetchImpl, opts, (access) => {
    const bearer = bsiAccountBearerHeaders(access, init?.contentType);
    // Spread into a plain Record so RequestInit accepts it (UserBearerHeaders forbids API-key).
    const headers: Record<string, string> = {
      Authorization: bearer.Authorization,
      Accept: bearer.Accept,
      "User-Agent": bearer["User-Agent"],
    };
    if (bearer["Content-Type"]) headers["Content-Type"] = bearer["Content-Type"];
    return accountBsiFetch(
      bsiUrl(env, path, opts, init?.query),
      {
        method,
        headers,
        body: init?.body,
      },
      fetchImpl,
      env,
    );
  });
}

function mapUpstreamResult(result: BsiHttpResult): Response | { json: unknown; status: number } {
  if (result.kind === "ok") return { json: result.json, status: result.status };
  if (result.kind === "http") {
    const errBody =
      result.json && typeof result.json === "object"
        ? result.json
        : { error: "upstream_error" };
    return accountJson(errBody, result.status);
  }
  if (result.kind === "bad_json") {
    return accountJson({ error: "unavailable" }, 502);
  }
  return accountJson({ error: "unavailable" }, 503, { "Retry-After": "60" });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function boolOrFalse(v: unknown): boolean {
  return v === true;
}

function normalizeLegacySource(raw: unknown): LegacySubscriptionSource {
  if (raw === "medical_society_stripe" || raw === "affiliate_stripe") return raw;
  return null;
}

function normalizeCard(raw: unknown): { brand: string; last4: string } | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const brand = typeof obj.brand === "string" ? obj.brand : null;
  const last4 = typeof obj.last4 === "string" ? obj.last4 : null;
  if (!brand || !last4) return null;
  return { brand, last4 };
}

function opaqueSubRef(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 128) return null;
  if (STRIPE_LIKE_ID_RE.test(raw)) return null;
  if (/cus_|sub_|mem_|seti_|pi_/.test(raw)) return null;
  return raw;
}

/** Walk DTO values for raw Stripe-like provider ids (T6). */
function containsProviderIdValues(value: unknown): boolean {
  if (typeof value === "string") return STRIPE_LIKE_ID_RE.test(value);
  if (Array.isArray(value)) return value.some(containsProviderIdValues);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsProviderIdValues);
  }
  return false;
}

function shapeSubscriptionItem(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const sub_ref = opaqueSubRef(obj.sub_ref);
  if (!sub_ref) return null;
  const provider = obj.provider === "whop" || obj.provider === "stripe" ? obj.provider : null;
  if (!provider) return null;
  const tier = normalizeCanonicalTier(obj.tier);
  const card = normalizeCard(obj.card ?? obj.payment_method);
  const item: Record<string, unknown> = {
    sub_ref,
    provider,
    tier,
    status: typeof obj.status === "string" ? obj.status : "unknown",
    current_period_end: strOrNull(obj.current_period_end),
    paid_through: strOrNull(obj.paid_through),
    cancel_at_period_end: boolOrFalse(obj.cancel_at_period_end),
    card,
  };
  const legacy = normalizeLegacySource(obj.legacy_source);
  if (legacy) item.legacy_source = legacy;
  if (obj.is_duplicate_stripe === true) item.is_duplicate_stripe = true;
  if (obj.can_convert_to_whop === true) item.can_convert_to_whop = true;
  return item;
}

function shapeConversion(raw: unknown): Record<string, unknown> | undefined {
  const obj = asRecord(raw);
  if (!obj) return undefined;
  const state =
    obj.state === "awaiting_checkout" || obj.state === "completed" || obj.state === "none"
      ? obj.state
      : "none";
  const out: Record<string, unknown> = { state };
  if (obj.target_tier === "metfix_pro" || obj.target_tier === "organization_owner") {
    out.target_tier = obj.target_tier;
  }
  const purchase = sanitizeExternalBillingUrl(obj.purchase_url, "whop_only");
  if (purchase) out.purchase_url = purchase;
  if (typeof obj.trial_period_days === "number" && Number.isFinite(obj.trial_period_days)) {
    out.trial_period_days = Math.floor(obj.trial_period_days);
  }
  if (typeof obj.stripe_period_end === "string") out.stripe_period_end = obj.stripe_period_end;
  return out;
}

function shapeOverview(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const badges = asRecord(obj.badges) ?? {};
  const coach = normalizeFoundationsCoachStatus(obj.foundations_coach);
  return {
    user_id: obj.user_id ?? null,
    member_id: obj.member_id ?? null,
    display_name: publicDisplayName({ display_name: obj.display_name }),
    email: typeof obj.email === "string" ? obj.email : null,
    member_since: strOrNull(obj.member_since),
    badges: {
      medical: boolOrFalse(badges.medical),
      affiliate: boolOrFalse(badges.affiliate),
      subscription: boolOrFalse(badges.subscription),
      foundations_coach: boolOrFalse(badges.foundations_coach) || coach.active,
    },
    canonical_tier: normalizeCanonicalTier(obj.canonical_tier),
    foundations_coach: coach,
    tabs: Array.isArray(obj.tabs) ? obj.tabs : [],
    links: asRecord(obj.links) ?? {},
  };
}

function shapeSubscriptions(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const itemsIn = Array.isArray(obj.items) ? obj.items : [];
  const items: Record<string, unknown>[] = [];
  for (const row of itemsIn) {
    const shaped = shapeSubscriptionItem(row);
    if (shaped) items.push(shaped);
  }
  let canonical_tier = normalizeCanonicalTier(obj.canonical_tier);
  for (const item of items) {
    if (
      item.legacy_source === "medical_society_stripe" &&
      item.status === "active" &&
      canonical_tier !== "organization_owner"
    ) {
      canonical_tier = "metfix_pro";
    }
  }
  const out: Record<string, unknown> = { canonical_tier, items };
  const conversion = shapeConversion(obj.conversion);
  if (conversion) out.conversion = conversion;
  return out;
}

function shapePayments(raw: unknown, page: number, perPage: number): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const itemsIn = Array.isArray(obj.items) ? obj.items : [];
  const items: Record<string, unknown>[] = [];
  for (const row of itemsIn) {
    const r = asRecord(row);
    if (!r) continue;
    const provider =
      r.provider === "whop" || r.provider === "stripe" || r.provider === "woo" ? r.provider : null;
    if (!provider) continue;
    const amount =
      typeof r.amount_cents === "number" && Number.isSafeInteger(r.amount_cents) ? r.amount_cents : null;
    if (amount == null || amount < 0) continue;
    const item: Record<string, unknown> = {
      id: r.id ?? null,
      created_at: strOrNull(r.created_at),
      description: typeof r.description === "string" ? r.description : "",
      amount_cents: amount,
      currency: typeof r.currency === "string" ? r.currency : "usd",
      provider,
      status: typeof r.status === "string" ? r.status : "unknown",
    };
    const receipt = sanitizeExternalBillingUrl(r.receipt_url, "billing_portal");
    if (receipt) item.receipt_url = receipt;
    items.push(item);
  }
  return {
    items,
    page,
    per_page: perPage,
    total: typeof obj.total === "number" && Number.isSafeInteger(obj.total) ? obj.total : items.length,
  };
}

function shapeLtv(raw: unknown): Record<string, unknown> | Response {
  const obj = asRecord(raw);
  if (!obj) return accountJson({ error: "unavailable" }, 502);
  const totalRaw =
    typeof obj.total_ltv_cents === "number"
      ? obj.total_ltv_cents
      : typeof obj.net_spend_cents === "number"
        ? obj.net_spend_cents
        : null;
  if (totalRaw == null || !Number.isSafeInteger(totalRaw) || totalRaw < 0) {
    return accountJson({ error: "unavailable" }, 502);
  }
  const claimedList = Array.isArray(obj.claimed_certificates) ? obj.claimed_certificates : [];
  const claimed_certificates: Record<string, unknown>[] = [];
  let claimedSum = 0;
  for (const row of claimedList) {
    const r = asRecord(row);
    if (!r) continue;
    const allocated =
      typeof r.allocated_cents === "number" && Number.isSafeInteger(r.allocated_cents)
        ? r.allocated_cents
        : null;
    if (allocated == null || allocated < 0) continue;
    if (r.claim_method === "ltv") claimedSum += allocated;
    claimed_certificates.push({
      course_id: r.course_id ?? null,
      course_slug: strOrNull(r.course_slug),
      course_title: strOrNull(r.course_title),
      allocated_cents: allocated,
      claimed_at: strOrNull(r.claimed_at),
      claim_method:
        r.claim_method === "ltv" || r.claim_method === "direct_purchase" ? r.claim_method : null,
      certificate_url: typeof r.certificate_url === "string" ? r.certificate_url : undefined,
    });
  }
  const claimedOverride =
    typeof obj.claimed_courses_value_cents === "number" &&
    Number.isSafeInteger(obj.claimed_courses_value_cents) &&
    obj.claimed_courses_value_cents >= 0
      ? obj.claimed_courses_value_cents
      : claimedSum;
  let budget;
  try {
    budget = computeLtvBudget(totalRaw, claimedOverride);
  } catch {
    return accountJson({ error: "unavailable" }, 502);
  }
  return {
    total_ltv_cents: budget.total_ltv_cents,
    claimed_courses_value_cents: budget.claimed_courses_value_cents,
    available_certificate_ltv_cents: budget.available_certificate_ltv_cents,
    claimed_certificates,
    canonical_tier: normalizeCanonicalTier(obj.canonical_tier),
    foundations_coach: normalizeFoundationsCoachStatus(obj.foundations_coach),
  };
}

function shapeCourses(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const itemsIn = Array.isArray(obj.items) ? obj.items : Array.isArray(obj) ? (raw as unknown[]) : [];
  const items: Record<string, unknown>[] = [];
  for (const row of itemsIn) {
    const r = asRecord(row);
    if (!r) continue;
    items.push({
      id: r.id ?? null,
      slug: strOrNull(r.slug),
      title: strOrNull(r.title),
      progress_percent:
        typeof r.progress_percent === "number" ? r.progress_percent : 0,
      completed: boolOrFalse(r.completed),
      is_metfix_essentials: boolOrFalse(r.is_metfix_essentials),
      course_price_cents:
        typeof r.course_price_cents === "number" && Number.isSafeInteger(r.course_price_cents)
          ? r.course_price_cents
          : 0,
      included_with_subscription: boolOrFalse(r.included_with_subscription),
      purchased_directly: boolOrFalse(r.purchased_directly),
      certificate_claimed: boolOrFalse(r.certificate_claimed),
      certificate_claim_method:
        r.certificate_claim_method === "ltv" || r.certificate_claim_method === "direct_purchase"
          ? r.certificate_claim_method
          : null,
      certificate_url: typeof r.certificate_url === "string" ? r.certificate_url : null,
    });
  }
  return {
    items,
    page: typeof obj.page === "number" ? obj.page : 1,
    per_page: typeof obj.per_page === "number" ? obj.per_page : items.length,
    total: typeof obj.total === "number" ? obj.total : items.length,
  };
}

function shapeMemberSummary(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const badgesRaw = asRecord(obj.badges) ?? {};
  return {
    member_id: obj.member_id ?? null,
    display_name: publicDisplayName({ display_name: obj.display_name }),
    bio: typeof obj.bio === "string" ? obj.bio : null,
    location: typeof obj.location === "string" ? obj.location : null,
    badges: {
      medical: boolOrFalse(badgesRaw.medical),
      affiliate: boolOrFalse(badgesRaw.affiliate),
      foundations_coach: boolOrFalse(badgesRaw.foundations_coach),
    },
  };
}

function matchRoute(method: string, path: string): RouteMatch | null {
  if (path === "/api/account" || path === "/api/account/") {
    return null;
  }

  const member = path.match(/^\/api\/members\/([^/]+)$/);
  if (member && method === "GET") {
    return {
      id: "DP31",
      method: "GET",
      params: { memberId: member[1]! },
      limiter: "read",
      public: true,
    };
  }

  if (!path.startsWith("/api/account/")) return null;

  const rest = path.slice("/api/account/".length);

  if (method === "GET" && (rest === "overview")) {
    return { id: "DP1", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "subscriptions") {
    return { id: "DP2", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "POST" && rest === "subscriptions/portal-link") {
    return { id: "DP3", method: "POST", params: {}, limiter: "portal" };
  }
  if (method === "POST" && rest === "subscriptions/convert-to-whop") {
    return { id: "DP3b", method: "POST", params: {}, limiter: "portal" };
  }
  const cancelDup = rest.match(/^subscriptions\/([^/]+)\/cancel-duplicate$/);
  if (method === "POST" && cancelDup) {
    return {
      id: "DP3c",
      method: "POST",
      params: { subRef: cancelDup[1]! },
      limiter: "portal",
    };
  }
  if (method === "GET" && rest === "payments") {
    return { id: "DP4", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && (rest === "ltv-certificates" || rest === "spend")) {
    return { id: "DP5", method: "GET", params: {}, limiter: "read" };
  }
  const claim = rest.match(/^courses\/([^/]+)\/claim-certificate$/);
  if (method === "POST" && claim) {
    return { id: "DP6", method: "POST", params: { courseId: claim[1]! }, limiter: "write" };
  }
  const purchase = rest.match(/^courses\/([^/]+)\/purchase-checkout$/);
  if (method === "POST" && purchase) {
    return { id: "DP7", method: "POST", params: { courseId: purchase[1]! }, limiter: "write" };
  }
  if (method === "GET" && rest === "profile") {
    return { id: "DP12", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "PATCH" && rest === "profile") {
    return { id: "DP13", method: "PATCH", params: {}, limiter: "write" };
  }
  if (method === "POST" && rest === "profile/attributes") {
    return { id: "DP14", method: "POST", params: {}, limiter: "write" };
  }
  if (method === "POST" && rest === "profile/picture") {
    return { id: "DP16", method: "POST", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "courses") {
    return { id: "DP18", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "favorites") {
    return { id: "DP21", method: "GET", params: {}, limiter: "read" };
  }
  const fav = rest.match(/^favorites\/([^/]+)\/([^/]+)$/);
  if (fav && (method === "PUT" || method === "DELETE")) {
    return {
      id: "DP22",
      method,
      params: { sourceType: fav[1]!, sourceId: fav[2]! },
      limiter: "write",
    };
  }
  if (method === "GET" && rest === "referrals") {
    return { id: "DP24", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "POST" && rest === "referral-code") {
    return { id: "DP24w", method: "POST", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "course-gifts") {
    return { id: "DP25", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "notifications") {
    return { id: "DP26", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "PUT" && rest === "notifications") {
    return { id: "DP26w", method: "PUT", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "privacy") {
    return { id: "DP28", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "PUT" && rest === "privacy") {
    return { id: "DP28w", method: "PUT", params: {}, limiter: "write" };
  }
  if (method === "POST" && rest === "password-reset") {
    return { id: "DP29", method: "POST", params: {}, limiter: "portal" };
  }
  if (method === "PUT" && rest === "email") {
    return { id: "DP30", method: "PUT", params: {}, limiter: "portal" };
  }
  if (method === "POST" && rest === "email/confirm") {
    return { id: "DP30c", method: "POST", params: {}, limiter: "portal" };
  }

  return null;
}

function parsePageParams(url: URL): { page: number; per_page: number } | Response {
  const pageRaw = url.searchParams.get("page");
  const perRaw = url.searchParams.get("per_page");
  const pageStr = pageRaw ?? "1";
  const perStr = perRaw ?? "20";
  if (!/^[1-9][0-9]*$/.test(pageStr) || !/^[1-9][0-9]*$/.test(perStr)) {
    return accountJson({ error: "invalid_request" }, 400);
  }
  const page = Number(pageStr);
  const per_page = Number(perStr);
  if (page < 1 || page > 50 || per_page < 1 || per_page > 50 || page * per_page > 1000) {
    return accountJson({ error: "invalid_request" }, 400);
  }
  return { page, per_page };
}

function magicBytesOk(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

function favoriteCurrentlySet(list: unknown, sourceType: string, sourceId: string): boolean {
  const obj = asRecord(list);
  const items = Array.isArray(list)
    ? list
    : obj && Array.isArray(obj.items)
      ? obj.items
      : obj && Array.isArray(obj.favorites)
        ? obj.favorites
        : [];
  for (const row of items) {
    const r = asRecord(row);
    if (!r) continue;
    const t = String(r.source_type ?? r.type ?? "");
    const id = String(r.source_id ?? r.id ?? "");
    if (t === sourceType && id === sourceId) return true;
  }
  return false;
}

function validateAttributesPayload(json: unknown): Response | unknown {
  const obj = asRecord(json);
  if (!obj) return accountJson({ error: "invalid_request" }, 400);
  const attrs = Array.isArray(obj.attributes) ? obj.attributes : Array.isArray(json) ? json : null;
  if (!attrs) return accountJson({ error: "invalid_request" }, 400);
  for (const row of attrs) {
    const r = asRecord(row);
    if (!r) return accountJson({ error: "invalid_field" }, 400);
    const id = typeof r.attr_id === "number" ? r.attr_id : typeof r.id === "number" ? r.id : null;
    if (id == null || !EDITABLE_ATTR_IDS.has(id)) {
      return accountJson({ error: "invalid_field" }, 400);
    }
    for (const key of ["key", "name", "label"] as const) {
      const v = r[key];
      if (typeof v === "string" && /email/i.test(v)) {
        return accountJson({ error: "invalid_field" }, 400);
      }
    }
    const value = r.value;
    if (typeof value === "string" && (value.includes("@") || EMAIL_VALUE_RE.test(value))) {
      return accountJson({ error: "invalid_field" }, 400);
    }
  }
  return attrs;
}

function validateProfilePatch(json: unknown): Response | Record<string, unknown> {
  const obj = asRecord(json);
  if (!obj) return accountJson({ error: "invalid_request" }, 400);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!PROFILE_PATCH_FIELDS.has(key)) {
      return accountJson({ error: "invalid_field" }, 400);
    }
  }
  for (const key of PROFILE_PATCH_FIELDS) {
    if (!(key in obj)) continue;
    const v = obj[key];
    if (key === "community_opt_in") {
      if (typeof v !== "boolean") return accountJson({ error: "invalid_field" }, 400);
      out[key] = v;
      continue;
    }
    if (typeof v !== "string") return accountJson({ error: "invalid_field" }, 400);
    const max =
      key === "bio" ? 2000 : key === "display_name" ? 80 : key === "credentials" ? 200 : 100;
    if ([...v].length > max) return accountJson({ error: "invalid_field" }, 400);
    out[key] = v;
  }
  return out;
}

async function dispatch(
  match: RouteMatch,
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  ctx: ActingContext | null,
): Promise<Response> {
  const url = new URL(request.url);

  switch (match.id) {
    case "DP1": {
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", "/wp-json/bsi/v1/me/account");
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeOverview(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "DP2": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/bsi/v1/me/subscriptions",
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeSubscriptions(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      if (containsProviderIdValues(shaped)) {
        return accountJson({ error: "unavailable" }, 502);
      }
      return accountJson(shaped, 200);
    }
    case "DP3": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body) return accountJson({ error: "invalid_request" }, 400);
      const intent = body.intent;
      if (typeof intent !== "string" || !PORTAL_INTENTS.has(intent)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const payload: Record<string, unknown> = { intent };
      if (typeof body.sub_ref === "string") {
        const ref = opaqueSubRef(body.sub_ref);
        if (!ref) return accountJson({ error: "invalid_request" }, 400);
        payload.sub_ref = ref;
      }
      if (body.tier === "metfix_pro" || body.tier === "organization_owner") {
        payload.tier = body.tier;
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/me/subscriptions/portal-link",
        { body: JSON.stringify(payload), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json);
      const safe = sanitizeExternalBillingUrl(obj?.url, "billing_portal");
      if (!safe) return accountJson({ error: "bad_gateway" }, 502);
      return accountJson({ url: safe }, 200);
    }
    case "DP3b": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body) return accountJson({ error: "invalid_request" }, 400);
      if (typeof body.target_tier !== "string" || !CONVERT_TIERS.has(body.target_tier)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const payload: Record<string, unknown> = { target_tier: body.target_tier };
      if (typeof body.sub_ref === "string") {
        const ref = opaqueSubRef(body.sub_ref);
        if (!ref) return accountJson({ error: "invalid_request" }, 400);
        payload.sub_ref = ref;
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/me/subscriptions/convert-to-whop",
        { body: JSON.stringify(payload), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json);
      const purchase = sanitizeExternalBillingUrl(obj?.purchase_url, "whop_only");
      if (!purchase) return accountJson({ error: "bad_gateway" }, 502);
      return accountJson(
        {
          purchase_url: purchase,
          trial_period_days:
            typeof obj?.trial_period_days === "number" ? obj.trial_period_days : null,
          stripe_period_end: strOrNull(obj?.stripe_period_end),
        },
        200,
      );
    }
    case "DP3c": {
      const subRef = opaqueSubRef(match.params.subRef);
      if (!subRef) return accountJson({ error: "invalid_request" }, 400);
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const atPeriodEnd = body.at_period_end === false ? false : true;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        `/wp-json/bsi/v1/me/subscriptions/${encodeURIComponent(subRef)}/cancel-duplicate`,
        {
          body: JSON.stringify({ at_period_end: atPeriodEnd }),
          contentType: "application/json",
        },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP4": {
      const pages = parsePageParams(url);
      if (pages instanceof Response) return pages;
      const q = `page=${pages.page}&per_page=${pages.per_page}`;
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", "/wp-json/bsi/v1/me/payments", {
        query: q,
      });
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapePayments(mapped.json, pages.page, pages.per_page);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "DP5": {
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", "/wp-json/bsi/v1/me/spend");
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeLtv(mapped.json);
      if (shaped instanceof Response) return shaped;
      return accountJson(shaped, 200);
    }
    case "DP6": {
      const courseId = match.params.courseId!;
      if (!POSITIVE_INT_RE.test(courseId)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body || body.method !== "ltv") {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        `/wp-json/bsi/v1/courses/${courseId}/claim-certificate`,
        { body: JSON.stringify({ method: "ltv" }), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      if (obj.foundations_coach) {
        obj.foundations_coach = normalizeFoundationsCoachStatus(obj.foundations_coach);
      }
      return accountJson(obj, mapped.status);
    }
    case "DP7": {
      const courseId = match.params.courseId!;
      if (!POSITIVE_INT_RE.test(courseId)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        `/wp-json/bsi/v1/courses/${courseId}/purchase-checkout`,
        { body: "{}", contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json);
      const checkout = sanitizeExternalBillingUrl(
        obj?.checkout_url ?? obj?.url,
        "billing_portal",
      );
      if (!checkout) return accountJson({ error: "bad_gateway" }, 502);
      return accountJson({ checkout_url: checkout }, 200);
    }
    case "DP12": {
      // Ignore client-supplied member_id / user_id (T2).
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", "/wp-json/bsi/v1/profiles/me");
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      const { role_badges_html: _drop, ...rest } = obj;
      void _drop;
      if (typeof rest.display_name === "string") {
        rest.display_name = publicDisplayName({ display_name: rest.display_name });
      }
      return accountJson(rest, 200);
    }
    case "DP13": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const patch = validateProfilePatch(parsed.json);
      if (patch instanceof Response) return patch;
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "PATCH", "/wp-json/bsi/v1/me/profile", {
        body: JSON.stringify(patch),
        contentType: "application/json",
      });
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP14": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const attrs = validateAttributesPayload(parsed.json);
      if (attrs instanceof Response) return attrs;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/profiles/me/attributes",
        {
          body: JSON.stringify({ attributes: attrs }),
          contentType: "application/json",
        },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP16": {
      const ctRaw = request.headers.get("Content-Type") ?? "";
      const ct = ctRaw.split(";")[0]?.trim().toLowerCase() ?? "";
      if (ct !== "image/jpeg" && ct !== "image/png" && ct !== "image/webp") {
        return accountJson({ error: "invalid_image" }, 400);
      }
      const cl = request.headers.get("Content-Length");
      if (cl != null) {
        const n = Number(cl);
        if (Number.isFinite(n) && (n < 1 || n > MAX_PICTURE_BYTES)) {
          return accountJson({ error: n > MAX_PICTURE_BYTES ? "payload_too_large" : "invalid_image" }, n > MAX_PICTURE_BYTES ? 413 : 400);
        }
      }
      const buf = await request.arrayBuffer();
      if (buf.byteLength < 1 || buf.byteLength > MAX_PICTURE_BYTES) {
        return accountJson(
          { error: buf.byteLength > MAX_PICTURE_BYTES ? "payload_too_large" : "invalid_image" },
          buf.byteLength > MAX_PICTURE_BYTES ? 413 : 400,
        );
      }
      const bytes = new Uint8Array(buf);
      if (!magicBytesOk(bytes, ct)) {
        return accountJson({ error: "invalid_image" }, 400);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/profiles/me/profile-picture",
        { body: buf, contentType: ct },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP18": {
      const pages = parsePageParams(url);
      if (pages instanceof Response) return pages;
      const q = `page=${pages.page}&per_page=${pages.per_page}`;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/bsi/v1/courses/my-courses",
        { query: q },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeCourses(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "DP21": {
      const type = url.searchParams.get("type") ?? "all";
      if (!FAVORITE_FILTER_TYPES.has(type)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const q = type === "all" ? undefined : `type=${encodeURIComponent(type)}`;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/metfix/v1/favorites",
        { query: q },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { items: [] }, 200);
    }
    case "DP22": {
      const sourceType = match.params.sourceType!;
      const sourceId = match.params.sourceId!;
      if (!FAVORITE_SOURCE_TYPES.has(sourceType) || !SOURCE_ID_RE.test(sourceId)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const desired = match.method === "PUT";
      const getRan = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/metfix/v1/favorites",
      );
      if (getRan instanceof Response) return mapUnauthenticated(getRan);
      const getMapped = mapUpstreamResult(getRan.result);
      if (getMapped instanceof Response) return getMapped;
      const currently = favoriteCurrentlySet(getMapped.json, sourceType, sourceId);
      if (currently === desired) {
        return accountJson({ favorited: desired }, 200);
      }
      const postRan = await runBearer(
        getRan.ctx,
        env,
        fetchImpl,
        opts,
        "POST",
        `/wp-json/metfix/v1/favorites/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`,
        { body: "{}", contentType: "application/json" },
      );
      if (postRan instanceof Response) return mapUnauthenticated(postRan);
      const postMapped = mapUpstreamResult(postRan.result);
      if (postMapped instanceof Response) return postMapped;
      return accountJson({ favorited: desired }, 200);
    }
    case "DP24": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/bsi/v1/me/referral-earnings",
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? {}, 200);
    }
    case "DP24w": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body || typeof body.action !== "string" || !REFERRAL_ACTIONS.has(body.action)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/me/referral-code",
        { body: JSON.stringify({ action: body.action }), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP25": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/bsi/v1/me/course-gifts",
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { items: [] }, 200);
    }
    case "DP26": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/bsi/v1/notification-preferences",
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? {}, 200);
    }
    case "DP26w": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        "/wp-json/bsi/v1/notification-preferences",
        { body: JSON.stringify(body), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      if ("newsletter" in body || "newsletter_subscribed" in body) {
        const newsRan = await runBearer(
          ran.ctx,
          env,
          fetchImpl,
          opts,
          "PUT",
          "/wp-json/bsi/v1/me/newsletter",
          {
            body: JSON.stringify({
              subscribed: body.newsletter === true || body.newsletter_subscribed === true,
            }),
            contentType: "application/json",
          },
        );
        if (newsRan instanceof Response) return mapUnauthenticated(newsRan);
        const newsMapped = mapUpstreamResult(newsRan.result);
        if (newsMapped instanceof Response) return newsMapped;
      }
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP28": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        "/wp-json/bsi/v1/account/privacy-settings",
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? {}, 200);
    }
    case "DP28w": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        "/wp-json/bsi/v1/account/privacy-settings",
        { body: JSON.stringify(body), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP29": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/me/password-reset",
        { body: "{}", contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP30": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body || typeof body.email !== "string" || !EMAIL_VALUE_RE.test(body.email)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "PUT", "/wp-json/bsi/v1/me/email", {
        body: JSON.stringify({ email: body.email }),
        contentType: "application/json",
      });
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP30c": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body || typeof body.code !== "string" || body.code.length < 4) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        "/wp-json/bsi/v1/me/email/confirm",
        { body: JSON.stringify({ code: body.code }), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "DP31": {
      const memberId = match.params.memberId!;
      if (!POSITIVE_INT_RE.test(memberId)) {
        return accountJson({ error: "invalid_member_id" }, 400);
      }
      // Public summary — no user session; still Bearer is not available.
      // Spec maps to GET profiles/summary/{memberId}. Use unauthenticated fetch
      // only when no session; when session present, still Bearer via runUserBsiCall.
      if (ctx) {
        const ran = await runBearer(
          ctx,
          env,
          fetchImpl,
          opts,
          "GET",
          `/wp-json/bsi/v1/profiles/summary/${memberId}`,
        );
        if (ran instanceof Response) return mapUnauthenticated(ran);
        const mapped = mapUpstreamResult(ran.result);
        if (mapped instanceof Response) return mapped;
        const shaped = shapeMemberSummary(mapped.json);
        if (!shaped) return accountJson({ error: "unavailable" }, 502);
        return accountJson(shaped, 200);
      }
      // Public: Bearer-less GET (no user token). Never attach X-API-Key.
      const result = await accountBsiFetch(
        bsiUrl(env, `/wp-json/bsi/v1/profiles/summary/${memberId}`, opts),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "metfixhome-worker/1.0",
          },
        },
        fetchImpl,
        env,
      );
      const mapped = mapUpstreamResult(result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeMemberSummary(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    default:
      return accountJson({ error: "not_found" }, 404);
  }
}

/** Index entrypoint — null when path is not an account/members API route. */
export async function handleAccountRoutes(
  request: Request,
  env: Env,
  deps: AccountDeps = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!(path.startsWith("/api/account") || path.startsWith("/api/members/"))) {
    return null;
  }

  const method = request.method.toUpperCase();
  const matchMethod = method === "HEAD" ? "GET" : method;
  const match = matchRoute(matchMethod, path);
  if (!match) {
    return accountJson({ error: "not_found" }, 404);
  }

  if (!isAuthHost(request, env)) {
    return accountJson({ error: "forbidden" }, 403);
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const opts = deps.bsiBaseUrl ? { baseUrl: deps.bsiBaseUrl } : undefined;

  let ctx: ActingContext | null = null;
  if (!match.public) {
    const resolved = await resolveAccountSession(request, env, fetchImpl, opts);
    if (resolved instanceof Response) return resolved;
    ctx = resolved;
  } else {
    // Optional session for members (Bearer when signed in).
    const cookies = request.headers.get("Cookie") ?? "";
    if (cookies.includes("__Host-mfx_sid=")) {
      const resolved = await resolveAccountSession(request, env, fetchImpl, opts);
      if (!(resolved instanceof Response)) ctx = resolved;
    }
  }

  if (match.method !== "GET" && match.method !== "HEAD") {
    if (!ctx) return accountJson({ error: "unauthenticated" }, 401);
    const csrfFail = await requireAccountCsrf(request, env, ctx.sid);
    if (csrfFail) return csrfFail;
  }

  const limitKey = match.public
    ? `ip:${clientIp(request)}`
    : `acct:${ctx!.record.bsi_user_id || "0"}`;
  const limited = await checkAccountLimit(env, match.limiter, limitKey);
  if (limited) return limited;

  return dispatch(match, request, env, fetchImpl, opts, ctx);
}
