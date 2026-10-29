/**
 * Account dashboard + public member profile Worker routes (PR B / DP1–DP31).
 * Bearer-only BSI via runUserBsiCall + bsiAccountBearerHeaders (never shared API-key header).
 */
import {
  BSI_REF_RE,
  COURSE_ID_RE,
  buildCheckoutUrlDto,
  buildClaimCheckoutUrlDto,
  buildReferralsDto,
  emitDropLogs,
  logEarningsUpstreamOmitted,
} from "../shared/account/courseReferrals";
import {
  buildClaimOptionsDto,
  isValidIdempotencyKey,
  mapClaimIneligible,
  mapRedeemLtvSuccess,
  type ClaimInProgressBody,
  type ClaimLockTimeoutBody,
  type ClaimPathId,
} from "../shared/account/claimOptions";
import { emitStrayFieldLogs, stripStrayFields } from "./stripStrayFields";
import { sanitizeReturnPath } from "../shared/account/returnPath";
import { computeLtvBudget } from "../shared/account/ltv";
import { normalizeFoundationsCoachStatus } from "../shared/account/foundations-coach";
import {
  extractSubscriptionTierItems,
  normalizeCanonicalTier,
  resolveAccountCanonicalTier,
  type LegacySubscriptionSource,
} from "../shared/account/tiers";
import { isWhopCheckoutUrl, sanitizeExternalBillingUrl } from "../shared/account/url-allowlist";
import {
  accountCancelDuplicatePath,
  accountClaimCertificatePath,
  accountConvertToWhopPath,
  accountCourseCheckoutPath,
  accountCourseGiftsPath,
  accountEmailConfirmPath,
  accountEmailPath,
  accountFavoriteItemPath,
  accountFavoritesPath,
  accountMePath,
  accountMeProfilePath,
  accountMemberSummaryPath,
  accountMyCoursesPath,
  accountNewsletterPath,
  accountNotificationPreferencesPath,
  accountPasswordResetPath,
  accountPaymentsPath,
  accountPortalLinkPath,
  accountPrivacySettingsPath,
  accountProfilesMeAttributesPath,
  accountProfilesMePath,
  accountProfilesMePicturePath,
  accountReferralCodePath,
  accountReferralEarningsPath,
  accountReferralsPath,
  accountSpendPath,
  accountSubscriptionsPath,
  certificateClaimOptionsPath,
  certificatePrepayCheckoutPath,
} from "../shared/account/bsi-paths";
import { BEP_WHOP_COMPANY_ID } from "../shared/account/whop";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { getSid } from "./auth/cookies";
import { csrfForSid, sha256Hex, timingSafeEqualStr } from "./auth/crypto";
import { isAllowedAuthOrigin } from "./auth/csrf";
import { isAuthHost } from "./auth/host";
import { publicDisplayName } from "./auth/public-name";
import { clientIp } from "./auth/throttle";
import {
  assertBsiHost,
  bsiAccountBearerHeaders,
  parseRetryAfter,
  resolveBsiOrigin,
  UPSTREAM_USER_AGENT,
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
/** DP-T-26b: only these top-level keys may leave the Worker toward BSI. */
const NOTIFICATION_PUT_KEYS = new Set([
  "email_digest",
  "product_updates",
  "newsletter",
  "newsletter_subscribed",
  "preferences",
]);
const NOTIFICATION_PREF_KEYS = new Set(["email_digest", "product_updates"]);

const REFERRAL_INELIGIBLE_CODES = new Set([
  "bsi_referral_ineligible",
  "bsi_referral_coach_expired",
]);

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

/**
 * CQ B3 / DP-T-CFG3 / R2-N3: per-user limiter key.
 * Prefer real `bsi_user_id`. Treat missing, `""`, and `"0"` (session.ts stores
 * `String(user_id ?? "0")`) as absent → hashed sid fallback. Never raw sid;
 * never `acct:0`.
 */
export async function accountRateLimitKey(ctx: ActingContext): Promise<string> {
  const uid = ctx.record.bsi_user_id;
  if (typeof uid === "string" && uid.length > 0 && uid !== "0") {
    return `acct:${uid}`;
  }
  return `sid:${await sha256Hex(ctx.sid)}`;
}

function whitelistNotificationsPut(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of NOTIFICATION_PUT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const val = body[key];
    if (key === "preferences") {
      const pref = asRecord(val);
      if (!pref) continue;
      const cleaned: Record<string, boolean> = {};
      for (const pk of NOTIFICATION_PREF_KEYS) {
        if (Object.prototype.hasOwnProperty.call(pref, pk) && typeof pref[pk] === "boolean") {
          cleaned[pk] = pref[pk] as boolean;
        }
      }
      out.preferences = cleaned;
      continue;
    }
    if (typeof val === "boolean") out[key] = val;
  }
  return out;
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
  init?: {
    body?: string | ArrayBuffer;
    contentType?: string;
    query?: string;
    /** Extra request headers (e.g. Idempotency-Key). Never logs values. */
    extraHeaders?: Record<string, string>;
  },
): Promise<{ ctx: ActingContext; result: BsiHttpResult } | Response> {
  return runUserBsiCall(ctx, env, fetchImpl, opts, (access) => {
    const bearer = bsiAccountBearerHeaders(access, init?.contentType);
    // N3: use shared header+UA from bsiAccountBearerHeaders (plain Record for RequestInit).
    const headers: Record<string, string> = {
      Authorization: bearer.Authorization,
      Accept: bearer.Accept,
      "User-Agent": bearer["User-Agent"],
    };
    if (bearer["Content-Type"]) headers["Content-Type"] = bearer["Content-Type"];
    if (init?.extraHeaders) {
      for (const [k, v] of Object.entries(init.extraHeaders)) {
        headers[k] = v;
      }
    }
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

/** Allowlisted upstream error shapes — never pass BSI bodies through verbatim (CQ N). */
function mapUpstreamErrorBody(json: unknown, status: number): Record<string, unknown> {
  const obj = asRecord(json);
  if (!obj) return { error: "upstream_error" };
  const err = typeof obj.error === "string" ? obj.error : null;
  if (err === "insufficient_ltv") {
    return {
      error: "insufficient_ltv",
      required_cents: typeof obj.required_cents === "number" ? obj.required_cents : undefined,
      available_cents: typeof obj.available_cents === "number" ? obj.available_cents : undefined,
      shortfall_cents: typeof obj.shortfall_cents === "number" ? obj.shortfall_cents : undefined,
    };
  }
  if (err === "already_claimed") return { error: "already_claimed" };
  if (status === 404) return { error: "not_found" };
  // R2-N2: map 400/409 to our codes — never echo arbitrary upstream strings.
  if (status === 409) return { error: "already_claimed" };
  if (status === 400) return { error: "invalid_request" };
  return { error: "upstream_error" };
}

function mapUpstreamResult(result: BsiHttpResult): Response | { json: unknown; status: number } {
  if (result.kind === "ok") return { json: result.json, status: result.status };
  if (result.kind === "http") {
    return accountJson(mapUpstreamErrorBody(result.json, result.status), result.status);
  }
  if (result.kind === "bad_json") {
    return accountJson({ error: "unavailable" }, 502);
  }
  return accountJson({ error: "unavailable" }, 503, { "Retry-After": "60" });
}

function upstreamErrorCode(json: unknown): string | null {
  const obj = asRecord(json);
  if (!obj) return null;
  return typeof obj.code === "string" ? obj.code : null;
}

/** R2-N3: positive safe integer, or digit-only string normalized to number; else null. */
export function parsePositiveCourseId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return null;
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
  const canonical_tier = resolveAccountCanonicalTier({
    canonical_tier: obj.canonical_tier,
    items: extractSubscriptionTierItems(obj),
  });
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
      // CQ B1: badge only when coach is active (not expired / not missing granted_at).
      foundations_coach: coach.active,
    },
    canonical_tier,
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
  const canonical_tier = resolveAccountCanonicalTier({
    canonical_tier: obj.canonical_tier,
    items,
  });
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
  // errata d3 DR-4: may drop a bad allocated_cents row when total is valid (logged once).
  const claimedOverrideValid =
    typeof obj.claimed_courses_value_cents === "number" &&
    Number.isSafeInteger(obj.claimed_courses_value_cents) &&
    obj.claimed_courses_value_cents >= 0;
  // 1.2.9 CQ F1 / W-N26: unknown/`'ltv'` method → keep row, method null, log once.
  let loggedUnknownMethod = false;
  let loggedBadAllocated = false;
  for (const row of claimedList) {
    const r = asRecord(row);
    if (!r) continue;
    const courseId = parsePositiveCourseId(r.course_id);
    const allocated =
      typeof r.allocated_cents === "number" && Number.isSafeInteger(r.allocated_cents)
        ? r.allocated_cents
        : null;
    const cm = r.claim_method;
    const knownMethod =
      cm === "redeem_ltv" ||
      cm === "prepay_credit" ||
      cm === "buy_outright" ||
      cm === "direct_purchase";
    const claimMethod = knownMethod ? cm : null;
    if (cm != null && !knownMethod && !loggedUnknownMethod) {
      loggedUnknownMethod = true;
      console.warn(
        JSON.stringify({
          event: "ltv_row_method_unknown",
          keys: ["claim_method"],
          course_id: courseId,
        }),
      );
    }
    if (allocated == null || allocated < 0) {
      // Branch B (r2.11 / d2): no valid total → 502 upstream_error, no LTV figure / no claim.
      if (!claimedOverrideValid) {
        console.warn(
          JSON.stringify({ event: "ltv_row_allocated_invalid", course_id: courseId }),
        );
        return accountJson({ error: "upstream_error" }, 502);
      }
      // Branch A (errata d3 DR-4): drop bad row + log once {event, course_id}.
      // No allocated_cents:null in the response. Types stay number|null for null-safety.
      if (!loggedBadAllocated) {
        loggedBadAllocated = true;
        console.warn(
          JSON.stringify({ event: "ltv_row_allocated_invalid", course_id: courseId }),
        );
      }
      continue;
    }
    claimedSum += allocated;
    claimed_certificates.push({
      course_id: courseId,
      course_slug: strOrNull(r.course_slug),
      course_title: strOrNull(r.course_title),
      allocated_cents: allocated,
      claimed_at: strOrNull(r.claimed_at),
      claim_method: claimMethod,
      certificate_url: typeof r.certificate_url === "string" ? r.certificate_url : undefined,
    });
  }
  const claimedOverride = claimedOverrideValid
    ? (obj.claimed_courses_value_cents as number)
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
    canonical_tier: resolveAccountCanonicalTier({
      canonical_tier: obj.canonical_tier,
      items: extractSubscriptionTierItems(obj),
    }),
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
        r.certificate_claim_method === "redeem_ltv" ||
        r.certificate_claim_method === "prepay_credit" ||
        r.certificate_claim_method === "buy_outright" ||
        r.certificate_claim_method === "direct_purchase"
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

/** R3-B1: public member DTO — badge boolean only; no foundations_coach object. */
export const PUBLIC_MEMBER_SUMMARY_KEYS = [
  "member_id",
  "display_name",
  "bio",
  "location",
  "badges",
] as const;

function shapeMemberSummary(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const badgesRaw = asRecord(obj.badges) ?? {};
  // Coach badge ONLY via normalizeFoundationsCoachStatus (never raw BSI badge).
  // R3-B1: do not expose foundations_coach object on public /api/members/:id.
  const coach = normalizeFoundationsCoachStatus(obj.foundations_coach);
  return {
    member_id: obj.member_id ?? null,
    display_name: publicDisplayName({ display_name: obj.display_name }),
    bio: typeof obj.bio === "string" ? obj.bio : null,
    location: typeof obj.location === "string" ? obj.location : null,
    badges: {
      medical: boolOrFalse(badgesRaw.medical),
      affiliate: boolOrFalse(badgesRaw.affiliate),
      foundations_coach: coach.active,
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

  // CR3 alias: POST /api/courses/:courseId/checkout
  const coursesCheckout = path.match(/^\/api\/courses\/([^/]+)\/checkout$/);
  if (method === "POST" && coursesCheckout) {
    return {
      id: "DP7",
      method: "POST",
      params: { courseId: coursesCheckout[1]! },
      limiter: "write",
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
  // CR3: purchase-checkout + checkout aliases under /api/account/courses/
  const purchase = rest.match(/^courses\/([^/]+)\/(purchase-checkout|checkout)$/);
  if (method === "POST" && purchase) {
    return { id: "DP7", method: "POST", params: { courseId: purchase[1]! }, limiter: "write" };
  }
  // CL1 — three-path claim options (single route, N4)
  if (method === "GET" && rest === "certificate-claim-options") {
    return { id: "CL1", method: "GET", params: {}, limiter: "read" };
  }
  // CL2 — three-path claim mutation
  const claimPath = rest.match(/^courses\/([^/]+)\/claim$/);
  if (method === "POST" && claimPath) {
    return { id: "CL2", method: "POST", params: { courseId: claimPath[1]! }, limiter: "write" };
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
  // CR1 aliases
  if (method === "GET" && (rest === "referrals" || rest === "course-referrals")) {
    return { id: "DP24", method: "GET", params: {}, limiter: "read" };
  }
  // CR2 aliases
  if (method === "POST" && (rest === "referral-code" || rest === "course-referrals")) {
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
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", accountMePath());
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
        accountSubscriptionsPath(),
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
        accountPortalLinkPath(),
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
        accountConvertToWhopPath(),
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
        accountCancelDuplicatePath(subRef),
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
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", accountPaymentsPath(), {
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
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", accountSpendPath());
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeLtv(mapped.json);
      if (shaped instanceof Response) return shaped;
      return accountJson(shaped, 200);
    }
    case "DP7": {
      // CR3 — exactly `{ checkout_url }` (lead ruling A / CR-CO-1 / N1 ignore extras).
      const courseId = match.params.courseId!;
      if (!COURSE_ID_RE.test(courseId)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};

      // Allowlist body: only bsi_ref + return_path; drop client attribution overrides.
      let bsi_ref: string | undefined;
      if ("bsi_ref" in body) {
        if (typeof body.bsi_ref !== "string" || !BSI_REF_RE.test(body.bsi_ref)) {
          return accountJson({ error: "invalid_referral_code" }, 400);
        }
        bsi_ref = body.bsi_ref;
      }
      let return_path: string | undefined;
      if ("return_path" in body) {
        const sanitized = sanitizeReturnPath(body.return_path);
        if (sanitized == null) {
          return accountJson({ error: "invalid_request" }, 400);
        }
        return_path = sanitized;
      }
      const upstreamBody: Record<string, string> = {};
      if (bsi_ref !== undefined) upstreamBody.bsi_ref = bsi_ref;
      if (return_path !== undefined) upstreamBody.return_path = return_path;

      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountCourseCheckoutPath(courseId),
        { body: JSON.stringify(upstreamBody), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      if (ran.result.kind === "http") {
        const code = upstreamErrorCode(ran.result.json);
        if (
          code === "bsi_course_not_found" ||
          code === "bsi_course_whop_mapping_not_found"
        ) {
          return accountJson({ error: code }, 404);
        }
        if (code === "whop_company_mismatch") {
          return accountJson({ error: "whop_company_mismatch" }, 422);
        }
        if (code === "whop_checkout_upstream_error") {
          return accountJson({ error: "whop_checkout_upstream_error" }, 502);
        }
        return accountJson({ error: "upstream_error" }, 502);
      }
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;

      // errata d6 DR-24/DR-28: strip stray fields before CR3 checkout DTO.
      {
        const stripped = stripStrayFields(mapped.json);
        emitStrayFieldLogs(stripped.strayKeys);
        mapped.json = stripped.body;
      }
      const built = buildCheckoutUrlDto(mapped.json, BEP_WHOP_COMPANY_ID);
      if (!built.ok || !isWhopCheckoutUrl(built.dto.checkout_url)) {
        return accountJson({ error: "upstream_error" }, 502);
      }
      // LR-1: log unknown extra keys by name only (no values).
      const upstreamObj = asRecord(mapped.json);
      if (upstreamObj) {
        const extras = Object.keys(upstreamObj).filter((k) => k !== "checkout_url");
        if (extras.length > 0) {
          console.warn(JSON.stringify({ event: "checkout_extra_keys", keys: extras }));
        }
      }
      const dto = { checkout_url: built.dto.checkout_url } satisfies {
        checkout_url: string;
      };
      return accountJson(dto, 200);
    }
    case "CL1": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        certificateClaimOptionsPath(),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      // errata d6 DR-15/DR-22/DR-24: strip promo/credit strays before CL1 validation.
      {
        const stripped = stripStrayFields(mapped.json);
        emitStrayFieldLogs(stripped.strayKeys);
        mapped.json = stripped.body;
      }
      const built = buildClaimOptionsDto(mapped.json);
      if (!built.ok) {
        console.warn(
          JSON.stringify({ event: "claim_options_rejected", reason: built.reason }),
        );
        return accountJson({ error: "upstream_error" }, 502);
      }
      for (const log of built.logs) {
        console.warn(JSON.stringify(log));
      }
      return accountJson(built.dto, 200);
    }
    case "CL2": {
      const courseId = match.params.courseId!;
      if (!COURSE_ID_RE.test(courseId)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      const pathRaw = body?.path;
      const CLAIM_PATHS = new Set(["redeem_ltv", "prepay_credit", "buy_outright"]);
      if (typeof pathRaw !== "string" || !CLAIM_PATHS.has(pathRaw)) {
        return accountJson({ error: "invalid_claim_path" }, 400);
      }
      const claimPath = pathRaw as ClaimPathId;
      // Exact header read — no trim, no case fold (CL-IDEM-1 / Q-G).
      const idemKey = request.headers.get("Idempotency-Key");
      if (!isValidIdempotencyKey(idemKey)) {
        return accountJson({ error: "invalid_idempotency_key" }, 400);
      }

      let upstreamPath: string;
      let upstreamBody: Record<string, string>;
      if (claimPath === "redeem_ltv") {
        // B-R3-1: exactly one upstream POST per claim — no spend preflight.
        upstreamPath = accountClaimCertificatePath(courseId);
        upstreamBody = { method: "redeem_ltv" };
      } else if (claimPath === "prepay_credit") {
        upstreamPath = certificatePrepayCheckoutPath(courseId);
        upstreamBody = {};
      } else {
        upstreamPath = accountCourseCheckoutPath(courseId);
        upstreamBody = {};
      }

      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        upstreamPath,
        {
          body: JSON.stringify(upstreamBody),
          contentType: "application/json",
          extraHeaders: { "Idempotency-Key": idemKey },
        },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);

      if (ran.result.kind === "http") {
        const code = upstreamErrorCode(ran.result.json);
        const status = ran.result.status;

        if (status === 409 && code === "bsi_idempotency_key_in_progress") {
          const dto = { error: "claim_in_progress" } satisfies ClaimInProgressBody;
          return accountJson(dto, 409);
        }
        if (status === 409 && code === "idempotency_key_mismatch") {
          return accountJson({ error: "idempotency_key_mismatch" }, 409);
        }
        // Lead ruling (E): only bsi_already_claimed maps; bare already_claimed → 502.
        if (status === 409 && code === "bsi_already_claimed") {
          const dto = { already_claimed: true } satisfies { already_claimed: boolean };
          return accountJson(dto, 200);
        }
        // LR-3 / 1.2.10 CQ N1: lock timeout → ClaimLockTimeoutBody (distinct from 409).
        if (status === 503 && code === "bsi_claim_lock_timeout") {
          const dto = {
            error: "claim_in_progress",
            reason_code: "claim_in_progress",
          } satisfies ClaimLockTimeoutBody;
          return accountJson(dto, 503);
        }
        if (status === 400 && code === "bsi_idempotency_key_invalid") {
          return accountJson({ error: "invalid_idempotency_key" }, 400);
        }
        // errata d6 DR-26: S<=0 prepay → 409 claim_unavailable / no_shortfall (final).
        if (status === 400 && code === "bsi_prepay_invalid_shortfall") {
          console.warn(JSON.stringify({ event: "prepay_invalid_shortfall" }));
          return accountJson(
            { error: "claim_unavailable", reason_code: "no_shortfall" },
            409,
          );
        }
        if (status === 404 && code === "bsi_course_not_found") {
          return accountJson({ error: "course_not_found" }, 404);
        }
        if (status === 400 && code === "bsi_invalid_course_price") {
          return accountJson({ error: "invalid_course_price" }, 400);
        }
        if (status === 422 && code === "whop_company_mismatch") {
          return accountJson({ error: "whop_company_mismatch" }, 422);
        }
        if (status === 402 || status === 403) {
          const mapped = mapClaimIneligible(code);
          if (mapped) {
            const dto = {
              error: mapped.error,
              reason_code: mapped.reason_code,
            } satisfies { error: "claim_ineligible"; reason_code: string };
            return accountJson(dto, status);
          }
          return accountJson({ error: "upstream_error" }, 502);
        }
        return accountJson({ error: "upstream_error" }, 502);
      }

      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      // errata d6 DR-24: strip stray fields on every CL2 success body.
      {
        const stripped = stripStrayFields(mapped.json);
        emitStrayFieldLogs(stripped.strayKeys);
        mapped.json = stripped.body;
      }
      const raw = asRecord(mapped.json) ?? {};

      // Duplicate / repeat claim (CL-REPEAT-1 / §R120 / W-N14 / 1.2.9 F3):
      // allocated_cents must be exactly 0; missing / non-integer / negative / nonzero → 502, no charge.
      if (raw.already_claimed === true) {
        if (
          typeof raw.allocated_cents !== "number" ||
          !Number.isSafeInteger(raw.allocated_cents) ||
          raw.allocated_cents !== 0
        ) {
          console.warn(
            JSON.stringify({
              event: "claim_repeat_allocated_invalid",
              keys: ["allocated_cents"],
            }),
          );
          return accountJson({ error: "upstream_error" }, 502);
        }
        // N17: legacy direct_purchase on repeat claim_method — log once; never outbound.
        if (raw.claim_method === "direct_purchase") {
          console.warn(
            JSON.stringify({ event: "legacy_claimed_via_mapped", keys: ["claim_method"] }),
          );
        }
        const dto = { already_claimed: true } satisfies { already_claimed: boolean };
        return accountJson(dto, 200);
      }

      if (claimPath === "redeem_ltv") {
        const redeemed = mapRedeemLtvSuccess(mapped.json);
        if (!redeemed.ok) {
          return accountJson({ error: "upstream_error" }, 502);
        }
        return accountJson(redeemed.dto, 200);
      }

      // LR-4: prepay/buy idempotent replay — map BSI stored body the same way (checkout_url).
      const built = buildClaimCheckoutUrlDto(mapped.json, BEP_WHOP_COMPANY_ID);
      if (!built.ok || !isWhopCheckoutUrl(built.dto.checkout_url)) {
        return accountJson({ error: "upstream_error" }, 502);
      }
      const dto = { checkout_url: built.dto.checkout_url } satisfies {
        checkout_url: string;
      };
      return accountJson(dto, 200);
    }
    case "DP12": {
      // Ignore client-supplied member_id / user_id (T2).
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "GET", accountProfilesMePath());
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
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "PATCH", accountMeProfilePath(), {
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
        accountProfilesMeAttributesPath(),
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
        accountProfilesMePicturePath(),
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
        accountMyCoursesPath(),
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
        accountFavoritesPath(),
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
        accountFavoritesPath(),
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
        accountFavoriteItemPath(sourceType, sourceId),
        { body: "{}", contentType: "application/json" },
      );
      if (postRan instanceof Response) return mapUnauthenticated(postRan);
      const postMapped = mapUpstreamResult(postRan.result);
      if (postMapped instanceof Response) return postMapped;
      return accountJson({ favorited: desired }, 200);
    }
    case "DP24": {
      // CR1 — referrals + earnings merged; strip commission_policy / internal IDs.
      const [refRan, earnRan] = await Promise.all([
        runBearer(ctx!, env, fetchImpl, opts, "GET", accountReferralsPath()),
        runBearer(ctx!, env, fetchImpl, opts, "GET", accountReferralEarningsPath()),
      ]);
      if (refRan instanceof Response) return mapUnauthenticated(refRan);
      if (earnRan instanceof Response) return mapUnauthenticated(earnRan);
      const refMapped = mapUpstreamResult(refRan.result);
      if (refMapped instanceof Response) return refMapped;
      let earningsJson: unknown = undefined;
      if (earnRan.result.kind === "ok") {
        earningsJson = earnRan.result.json;
      } else {
        // CR-EARN-1: upstream fail → omit earnings + PII-free log; never 502.
        logEarningsUpstreamOmitted();
      }
      {
        const stripped = stripStrayFields(refMapped.json);
        emitStrayFieldLogs(stripped.strayKeys);
        refMapped.json = stripped.body;
      }
      const built = buildReferralsDto(refMapped.json, earningsJson, Date.now());
      if (!built.ok) {
        return accountJson({ error: "upstream_error" }, 502);
      }
      emitDropLogs(built.logs);
      return accountJson(built.dto, 200);
    }
    case "DP24w": {
      // CR2 — generate / rotate / revoke referral code.
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json);
      if (!body || typeof body.action !== "string" || !REFERRAL_ACTIONS.has(body.action)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      let entity_id: number | undefined;
      if ("entity_id" in body) {
        if (
          typeof body.entity_id !== "number" ||
          !Number.isSafeInteger(body.entity_id) ||
          body.entity_id < 1
        ) {
          return accountJson({ error: "invalid_request" }, 400);
        }
        entity_id = body.entity_id;
      }

      // CQ B3: generate/rotate/revoke = exactly 1 upstream mutation.
      // Drop eligibility pre-check + earnings GET; rely on upstream 403.
      const upstreamPayload: Record<string, unknown> = { action: body.action };
      if (entity_id !== undefined) upstreamPayload.entity_id = entity_id;

      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountReferralCodePath(),
        { body: JSON.stringify(upstreamPayload), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      if (ran.result.kind === "http" && ran.result.status === 403) {
        const code = upstreamErrorCode(ran.result.json);
        if (code && REFERRAL_INELIGIBLE_CODES.has(code)) {
          return accountJson(
            { error: "referral_ineligible", reason_code: code },
            403,
          );
        }
      }
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      // CR2 200 reuses CR1 builder — mutation response body only (no earnings GET).
      {
        const stripped = stripStrayFields(mapped.json);
        emitStrayFieldLogs(stripped.strayKeys);
        mapped.json = stripped.body;
      }
      const built = buildReferralsDto(mapped.json, undefined, Date.now());
      if (!built.ok) {
        return accountJson({ error: "upstream_error" }, 502);
      }
      emitDropLogs(built.logs);
      return accountJson(built.dto, 200);
    }
    case "DP25": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCourseGiftsPath(),
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
        accountNotificationPreferencesPath(),
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
      // DP-T-26b: whitelist before BSI — unknown keys never forwarded.
      const safeBody = whitelistNotificationsPut(body);
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        accountNotificationPreferencesPath(),
        { body: JSON.stringify(safeBody), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      if ("newsletter" in safeBody || "newsletter_subscribed" in safeBody) {
        const newsRan = await runBearer(
          ran.ctx,
          env,
          fetchImpl,
          opts,
          "PUT",
          accountNewsletterPath(),
          {
            body: JSON.stringify({
              subscribed:
                safeBody.newsletter === true || safeBody.newsletter_subscribed === true,
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
        accountPrivacySettingsPath(),
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
        accountPrivacySettingsPath(),
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
        accountPasswordResetPath(),
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
      const ran = await runBearer(ctx!, env, fetchImpl, opts, "PUT", accountEmailPath(), {
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
        accountEmailConfirmPath(),
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
          accountMemberSummaryPath(memberId),
        );
        if (ran instanceof Response) return mapUnauthenticated(ran);
        const mapped = mapUpstreamResult(ran.result);
        if (mapped instanceof Response) return mapped;
        const shaped = shapeMemberSummary(mapped.json);
        if (!shaped) return accountJson({ error: "unavailable" }, 502);
        return accountJson(shaped, 200);
      }
      // Public: Bearer-less GET (no user token). Never attach X-API-Key.
      // N3: shared Accept + UPSTREAM_USER_AGENT.
      const result = await accountBsiFetch(
        bsiUrl(env, accountMemberSummaryPath(memberId), opts),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": UPSTREAM_USER_AGENT,
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

/** Index entrypoint — null when path is not an account/members/courses API route. */
export async function handleAccountRoutes(
  request: Request,
  env: Env,
  deps: AccountDeps = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (
    !(
      path.startsWith("/api/account") ||
      path.startsWith("/api/members/") ||
      path.startsWith("/api/courses/")
    )
  ) {
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
  } else if (getSid(request)) {
    // Optional session for members (Bearer when signed in).
    const resolved = await resolveAccountSession(request, env, fetchImpl, opts);
    if (!(resolved instanceof Response)) ctx = resolved;
  }

  if (match.method !== "GET" && match.method !== "HEAD") {
    if (!ctx) return accountJson({ error: "unauthenticated" }, 401);
    const csrfFail = await requireAccountCsrf(request, env, ctx.sid);
    if (csrfFail) return csrfFail;
  }

  const limitKey = match.public
    ? `ip:${await sha256Hex(clientIp(request))}`
    : await accountRateLimitKey(ctx!);
  const limited = await checkAccountLimit(env, match.limiter, limitKey);
  if (limited) return limited;

  return dispatch(match, request, env, fetchImpl, opts, ctx);
}
