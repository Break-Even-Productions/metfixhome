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
import { resolveNotificationHref } from "../shared/account/notificationDeepLinks";
import { computeLtvBudget } from "../shared/account/ltv";
import { normalizeFoundationsCoachStatus } from "../shared/account/foundations-coach";
import {
  extractSubscriptionTierItems,
  normalizeCanonicalTier,
  resolveAccountCanonicalTier,
  type CanonicalSubscriptionTier,
  type LegacySubscriptionSource,
} from "../shared/account/tiers";
import {
  isOnboardingRoleId,
  type RoleId,
} from "../shared/join/membership-domain";
import { isWhopCheckoutUrl, sanitizeExternalBillingUrl } from "../shared/account/url-allowlist";
import {
  accountCalendarMealsPath,
  accountCalendarMealsUpcomingPath,
  accountCalendarSurfacePath,
  accountCancelDuplicatePath,
  accountClaimCertificatePath,
  accountConvertToWhopPath,
  accountCourseCheckoutPath,
  accountCourseGiftsPath,
  accountEmailConfirmPath,
  accountEmailPath,
  accountFavoriteItemPath,
  accountFavoritesPath,
  accountInAppNotificationsPath,
  accountNotificationsListPath,
  accountMacrosDailyPath,
  accountMeCommunityChoicesPath,
  accountMePath,
  accountMeProfilePath,
  accountMemberSummaryPath,
  accountMessagesConversationsPath,
  accountMyCoursesPath,
  accountNewsletterPath,
  accountNotificationPreferencesPath,
  accountPasswordResetPath,
  accountPaymentsPath,
  accountPlanMealPath,
  accountPortalLinkPath,
  accountPrOverviewPath,
  accountPrivacySettingsPath,
  accountProfilesMeAttributesPath,
  accountProfilesMePath,
  accountProfilesMePicturePath,
  accountReferralCodePath,
  accountReferralEarningsPath,
  accountReferralsPath,
  accountCalendarMealPath,
  accountCustomRecipePath,
  accountCustomRecipesPath,
  accountMacrosRangePath,
  accountPlanAclPath,
  accountPlanActivePath,
  accountPlanPath,
  accountPlanPublishPath,
  accountPlanSchedulePath,
  accountPlansLibraryPath,
  accountPtCoachClientsPath,
  accountShoppingListEmailPath,
  accountShoppingListGeneratePath,
  accountShoppingListGeneratedDatesPath,
  accountShoppingListPath,
  accountShoppingListsPath,
  accountCalendarPlannedWorkoutsPath,
  accountCalendarWorkoutsPath,
  accountCustomWorkoutPath,
  accountCustomWorkoutsPath,
  accountDailyFixWorkoutPath,
  accountMovementsPath,
  accountPlansCollectionPath,
  accountPlannedWorkoutPath,
  accountProgrammingSeriesDaysPath,
  accountProgrammingSeriesPath,
  accountProgrammingSubscribePath,
  accountProgrammingSubscriptionPath,
  accountProgrammingSubscriptionsPath,
  accountPtClientCoachesPath,
  accountPtCoachProfilePath,
  accountPtDirectoryPath,
  accountPtRelationshipActionPath,
  accountPtRelationshipNotesPath,
  accountPtRelationshipsPath,
  accountSparkEntriesPath,
  accountSparkMeasurementsPath,
  accountSparkUnitsPath,
  accountSparkUserInfoPath,
  accountSpendPath,
  accountSubscriptionsPath,
  accountWorkoutLogPath,
  accountWorkoutsCollectionPath,
  certificateClaimOptionsPath,
  certificatePrepayCheckoutPath,
} from "../shared/account/bsi-paths";
import {
  directoryQuery,
  parseRouteId,
  parseYmdRange,
  shapeCoachNote,
  shapeCoachNotes,
  shapeCoachProfile,
  shapeCoachingClient,
  shapeCoachingCoach,
  customWorkoutListQuery,
  dailyFixQuery,
  movementQuery,
  planScheduleQuery,
  shapeCustomWorkout,
  shapeCustomWorkoutList,
  shapeDailyFixWorkout,
  shapeMovementList,
  shapePlanDetail,
  shapePlanList,
  shapeSparkUserInfo,
  validateCustomWorkoutBody,
  validatePlanActiveBody,
  validatePlanWriteBody,
  shapeDirectory,
  shapePlanLibrary,
  shapePlannedWorkouts,
  shapeProgrammingDays,
  shapeProgrammingSeriesList,
  shapeProgrammingSubscriptions,
  shapeWorkoutLog,
  shapeWorkoutLogs,
  validateCoachNoteBody,
  validateCoachProfileBody,
  validateLogWorkoutBody,
  validatePtInviteBody,
} from "./account-body";
import { validateCustomRecipeBody } from "./belly-coaching";
import { BEP_WHOP_COMPANY_ID } from "../shared/account/whop";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { accountRateLimitKey as accountRateLimitKeyImpl } from "./auth/account-rate-limit";
import { getSid } from "./auth/cookies";
import { sha256Hex, timingSafeEqualStr } from "./auth/crypto";
import { requireCsrf } from "./auth/csrf";
import { isAuthHost } from "./auth/host";
import { publicDisplayName } from "./auth/public-name";
import { clientIp } from "./auth/throttle";
import { readJsonBody as readJsonBodyShared, requireSidCsrf } from "./auth/sid-guards";
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

/** G6 / BSI PATCH /me/profile — names only (1–60, no @). */
const PROFILE_PATCH_FIELDS = new Set(["first_name", "last_name", "display_name"]);

const PROFILE_ATTR_MEMBER_TYPES = new Set(["general", "metfix", "medical"]);

const PROFILE_ATTR_SECTION_TO_TYPE: Record<string, string> = {
  personal: "general",
  affiliate: "metfix",
  clinic: "medical",
  general: "general",
  metfix: "metfix",
  medical: "medical",
};

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
  /**
   * Public routes: no required session.
   * - GET /api/members/:id
   * - POST course checkout (signed-in bearer, or guest with email)
   */
  public?: boolean;
};

/** Guest checkout email. Null when missing or not a single mailbox. */
function guestCheckoutEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

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

function limiterBinding(env: Env, kind: LimiterKind): RateLimitBinding | undefined {
  if (kind === "read") return env.ACCOUNT_READ_LIMITER;
  if (kind === "write") return env.ACCOUNT_WRITE_LIMITER;
  return env.ACCOUNT_PORTAL_LIMITER;
}

/** Re-export shared key helper (single implementation in auth/account-rate-limit). */
export async function accountRateLimitKey(ctx: ActingContext): Promise<string> {
  return accountRateLimitKeyImpl(ctx);
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

async function readJsonBody(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ ok: true; json: unknown } | Response> {
  return readJsonBodyShared(request, accountJson, maxBytes);
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

/** BSI may send badge strings (`none` / `owner` / `approved`) or booleans. */
function badgePresent(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s !== "" && s !== "none" && s !== "false" && s !== "0";
  }
  if (typeof v === "number") return v !== 0;
  return false;
}

function normalizeLegacySource(raw: unknown): LegacySubscriptionSource {
  if (raw === "medical_society_stripe" || raw === "affiliate_stripe") return raw;
  return null;
}

function containsProviderIdToken(value: string): boolean {
  return STRIPE_LIKE_ID_RE.test(value) || /(?:cus|sub|mem|seti|pi)_/.test(value);
}

function normalizeCard(raw: unknown): { brand: string; last4: string } | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const brand = typeof obj.brand === "string" ? obj.brand : null;
  const last4 = typeof obj.last4 === "string" ? obj.last4 : null;
  if (!brand || !last4) return null;
  if (containsProviderIdToken(brand) || containsProviderIdToken(last4)) return null;
  return { brand, last4 };
}

function opaqueSubRef(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 128) return null;
  if (containsProviderIdToken(raw)) return null;
  return raw;
}

function productSlug(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Stable opaque ref when BSI omits `sub_ref`. Never includes provider id prefixes. */
function syntheticSubRef(provider: "whop" | "stripe", product: unknown): string | null {
  const slug = productSlug(product);
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) return null;
  const ref = `ent:${provider}:${slug}`;
  if (ref.length > 128 || containsProviderIdToken(ref)) return null;
  return ref;
}

function canonicalTierFromRaw(raw: unknown): CanonicalSubscriptionTier | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const key = raw.trim().toLowerCase();
  if (
    key === "free" ||
    key === "member" ||
    key === "metfix_pro" ||
    key === "organization_owner" ||
    key === "medical_society"
  ) {
    return normalizeCanonicalTier(raw);
  }
  return null;
}

function tierFromProduct(product: string): CanonicalSubscriptionTier | null {
  if (product === "pro") return "metfix_pro";
  if (product === "metfix") return "organization_owner";
  return null;
}

/**
 * Use an explicit canonical tier when BSI sent one.
 * Otherwise derive pro → metfix_pro and metfix → organization_owner.
 * medical/med stay without a tier so they are not labeled Pro.
 */
function resolveItemTier(obj: Record<string, unknown>): CanonicalSubscriptionTier | null {
  const fromTier = canonicalTierFromRaw(obj.tier);
  if (fromTier) return fromTier;
  const product = productSlug(obj.product);
  if (product === "medical" || product === "med") return null;
  return tierFromProduct(product);
}

function unixSecondsToIso(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 1e12) return null;
  const ms = Math.trunc(seconds) * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatPeriodEnd(raw: unknown): string | null {
  if (typeof raw === "number") return unixSecondsToIso(raw);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (/^\d+$/.test(trimmed)) return unixSecondsToIso(Number(trimmed));
  return trimmed;
}

/** Drop provider-id strings so one Stripe customer id cannot 502 the list. */
function stripProviderIdValues(value: unknown): unknown {
  if (typeof value === "string") {
    return containsProviderIdToken(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    return value.map(stripProviderIdValues).filter((entry) => entry !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const next = stripProviderIdValues(entry);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
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
  const provider = obj.provider === "whop" || obj.provider === "stripe" ? obj.provider : null;
  if (!provider) return null;
  const tier = resolveItemTier(obj);
  if (!tier) return null;
  const sub_ref = opaqueSubRef(obj.sub_ref) ?? syntheticSubRef(provider, obj.product);
  if (!sub_ref) return null;
  const card = normalizeCard(obj.card ?? obj.payment_method);
  const status =
    typeof obj.status === "string" && !containsProviderIdToken(obj.status) ? obj.status : "unknown";
  const paidThrough = strOrNull(obj.paid_through);
  const item: Record<string, unknown> = {
    sub_ref,
    provider,
    tier,
    status,
    current_period_end: formatPeriodEnd(obj.current_period_end),
    paid_through: paidThrough && !containsProviderIdToken(paidThrough) ? paidThrough : null,
    cancel_at_period_end: boolOrFalse(obj.cancel_at_period_end),
    card,
  };
  const legacy = normalizeLegacySource(obj.legacy_source);
  if (legacy) item.legacy_source = legacy;
  if (obj.is_duplicate_stripe === true) item.is_duplicate_stripe = true;
  if (obj.can_convert_to_whop === true) item.can_convert_to_whop = true;
  if (obj.can_open_portal === true) item.can_open_portal = true;
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

const STAFF_ROLE_SLUGS = ["administrator", "metfix_admin"] as const;

function normalizeStaffRoleSlug(raw: unknown): (typeof STAFF_ROLE_SLUGS)[number] | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (slug === "administrator" || slug === "admin" || slug === "site_admin") {
    return "administrator";
  }
  if (slug === "metfix_admin" || slug === "metfixadmin") return "metfix_admin";
  return null;
}

/** Admin and MetFix Admin only. Other role slugs are dropped. */
function shapeStaffRoles(obj: Record<string, unknown>): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    const slug = normalizeStaffRoleSlug(raw);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    found.push(slug);
  };
  const lists: unknown[] = [obj.roles, obj.wp_roles, obj.user_roles];
  const user = asRecord(obj.user);
  if (user) lists.push(user.roles);
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string") {
        push(item);
        continue;
      }
      const rec = asRecord(item);
      if (rec) push(rec.slug ?? rec.role ?? rec.name);
    }
  }
  if (obj.is_administrator === true || obj.administrator === true) push("administrator");
  if (obj.is_metfix_admin === true || obj.metfix_admin === true) push("metfix_admin");
  return STAFF_ROLE_SLUGS.filter((slug) => found.includes(slug));
}

/** Opt-in onboarding audience slugs — never WP/entitlement staff roles. */
function shapeOnboardingRoles(raw: unknown): RoleId[] {
  const obj = asRecord(raw);
  // Prefer dedicated onboarding_roles; never read staff `roles` (admin / metfix_admin).
  const list = obj
    ? Array.isArray(obj.onboarding_roles)
      ? obj.onboarding_roles
      : null
    : Array.isArray(raw)
      ? raw
      : null;
  if (!list) return [];
  const out: RoleId[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!isOnboardingRoleId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
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
  const avatarRaw = obj.avatar_url;
  const avatar_url =
    typeof avatarRaw === "string" && /^https?:\/\//i.test(avatarRaw.trim())
      ? avatarRaw.trim()
      : null;
  const onboarding_roles = shapeOnboardingRoles(obj);
  return {
    user_id: obj.user_id ?? null,
    member_id: obj.member_id ?? null,
    display_name: publicDisplayName({ display_name: obj.display_name }),
    email: typeof obj.email === "string" ? obj.email : null,
    member_since: strOrNull(obj.member_since),
    avatar_url,
    badges: {
      medical: badgePresent(badges.medical),
      affiliate: badgePresent(badges.affiliate),
      subscription: badgePresent(badges.subscription),
      // CQ B1: badge only when coach is active (not expired / not missing granted_at).
      foundations_coach: coach.active,
    },
    canonical_tier,
    foundations_coach: coach,
    tabs: Array.isArray(obj.tabs) ? obj.tabs : [],
    links: asRecord(obj.links) ?? {},
    roles: shapeStaffRoles(obj),
    onboarding_roles,
    has_physical_gym: obj.has_physical_gym === true || obj.hasPhysicalGym === true,
    has_physical_clinic:
      obj.has_physical_clinic === true || obj.hasPhysicalClinic === true,
  };
}

function validateOnboardingRolesBody(
  json: unknown,
): Response | { onboarding_roles: RoleId[]; has_physical_gym: boolean | null; has_physical_clinic: boolean | null } {
  const obj = asRecord(json);
  if (!obj) return accountJson({ error: "invalid_request" }, 400);
  const rolesIn = obj.onboarding_roles ?? obj.roles;
  if (!Array.isArray(rolesIn) || rolesIn.length < 1 || rolesIn.length > 5) {
    return accountJson({ error: "invalid_request" }, 400);
  }
  const seen = new Set<RoleId>();
  const onboarding_roles: RoleId[] = [];
  for (const r of rolesIn) {
    if (!isOnboardingRoleId(r)) return accountJson({ error: "invalid_request" }, 400);
    if (seen.has(r)) continue;
    seen.add(r);
    onboarding_roles.push(r);
  }
  if (onboarding_roles.length < 1) {
    return accountJson({ error: "invalid_request" }, 400);
  }
  const needsGym = onboarding_roles.includes("gym_owner");
  const needsClinic = onboarding_roles.includes("clinician");
  let has_physical_gym: boolean | null = null;
  let has_physical_clinic: boolean | null = null;
  if (needsGym) {
    if (typeof obj.has_physical_gym !== "boolean") {
      return accountJson({ error: "invalid_request" }, 400);
    }
    has_physical_gym = obj.has_physical_gym;
  } else if (obj.has_physical_gym === true) {
    return accountJson({ error: "invalid_request" }, 400);
  } else if (obj.has_physical_gym === false) {
    has_physical_gym = false;
  }
  if (needsClinic) {
    if (typeof obj.has_physical_clinic !== "boolean") {
      return accountJson({ error: "invalid_request" }, 400);
    }
    has_physical_clinic = obj.has_physical_clinic;
  } else if (obj.has_physical_clinic === true) {
    return accountJson({ error: "invalid_request" }, 400);
  } else if (obj.has_physical_clinic === false) {
    has_physical_clinic = false;
  }
  return { onboarding_roles, has_physical_gym, has_physical_clinic };
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
  for (const item of itemsIn) {
    const r = asRecord(item);
    if (!r) continue;
    const row: Record<string, unknown> = {
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
    };
    if (typeof r.notes === "string" && r.notes.trim()) {
      row.notes = r.notes.trim().slice(0, 500);
    }
    if (typeof r.image_url === "string" && r.image_url.startsWith("https://")) {
      row.image_url = r.image_url;
    }
    const features = asRecord(r.features);
    if (features) {
      const lite: Record<string, unknown> = {};
      if (Array.isArray(features.navigation)) {
        lite.navigation = features.navigation
          .map((n) => {
            const nav = asRecord(n);
            if (!nav) return null;
            return {
              key: typeof nav.key === "string" ? nav.key : undefined,
              label: typeof nav.label === "string" ? nav.label : undefined,
              segment: typeof nav.segment === "string" ? nav.segment : undefined,
            };
          })
          .filter(Boolean)
          .slice(0, 12);
      }
      if (features.counts && typeof features.counts === "object" && !Array.isArray(features.counts)) {
        lite.counts = features.counts;
      }
      const progress = asRecord(features.progress);
      if (progress) {
        lite.progress = {
          percentage: typeof progress.percentage === "number" ? progress.percentage : undefined,
          completed_items:
            typeof progress.completed_items === "number" ? progress.completed_items : undefined,
          total_items: typeof progress.total_items === "number" ? progress.total_items : undefined,
        };
      }
      if (Object.keys(lite).length > 0) row.features = lite;
    }
    items.push(row);
  }
  return {
    items,
    page: typeof obj.page === "number" ? obj.page : 1,
    per_page: typeof obj.per_page === "number" ? obj.per_page : items.length,
    total: typeof obj.total === "number" ? obj.total : items.length,
  };
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function shapePlannedMeal(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = typeof r.id === "number" && Number.isSafeInteger(r.id) ? r.id : null;
  const date = typeof r.date === "string" && YMD_RE.test(r.date) ? r.date : null;
  if (id == null || !date) return null;
  const preview = asRecord(r.recipe_preview);
  const macros = preview ? asRecord(preview.macros) : null;
  return {
    id,
    date,
    slot_index: typeof r.slot_index === "number" ? r.slot_index : 1,
    recipe_source_type:
      r.recipe_source_type === "custom_recipe" ? "custom_recipe" : "daily_mod",
    recipe_source_id:
      typeof r.recipe_source_id === "number" && Number.isSafeInteger(r.recipe_source_id)
        ? r.recipe_source_id
        : null,
    label: typeof r.label === "string" ? r.label : null,
    notes: typeof r.notes === "string" ? r.notes : null,
    logged: r.logged === 1 || r.logged === true ? 1 : 0,
    recipe_preview: preview
      ? {
          title: typeof preview.title === "string" ? preview.title : "Meal",
          photo_url: typeof preview.photo_url === "string" ? preview.photo_url : null,
          macros: {
            protein: typeof macros?.protein === "number" ? macros.protein : 0,
            fat: typeof macros?.fat === "number" ? macros.fat : 0,
            carbs: typeof macros?.carbs === "number" ? macros.carbs : 0,
          },
        }
      : null,
  };
}

function shapeMeals(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const mealsIn = Array.isArray(obj?.meals)
    ? obj!.meals
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const meals: Record<string, unknown>[] = [];
  for (const row of mealsIn) {
    const shaped = shapePlannedMeal(row);
    if (shaped) meals.push(shaped);
  }
  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const m of meals) {
    const d = String(m.date);
    if (!grouped[d]) grouped[d] = [];
    grouped[d]!.push(m);
  }
  return { meals, grouped_by_date: grouped };
}

function shapeMealsUpcoming(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const mealsIn = Array.isArray(obj?.meals) ? obj!.meals : [];
  const meals: Record<string, unknown>[] = [];
  for (const row of mealsIn) {
    const shaped = shapePlannedMeal(row);
    if (shaped) meals.push(shaped);
  }
  const meta = asRecord(obj?.meta) ?? {};
  return {
    meals,
    meta: {
      count: typeof meta.count === "number" ? meta.count : meals.length,
      total: typeof meta.total === "number" ? meta.total : meals.length,
      limit: typeof meta.limit === "number" ? meta.limit : 20,
      offset: typeof meta.offset === "number" ? meta.offset : 0,
      has_more: meta.has_more === true,
    },
  };
}

function shapeMacrosDaily(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const totals = asRecord(obj.totals) ?? asRecord(obj.macros) ?? obj;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    date: typeof obj.date === "string" ? obj.date : null,
    protein: num(totals.protein ?? totals.protein_g),
    fat: num(totals.fat ?? totals.fat_g),
    carbs: num(totals.carbs ?? totals.carbohydrates ?? totals.carbs_g),
    calories: num(totals.calories ?? totals.kcal),
    goal_protein: num(obj.goal_protein ?? asRecord(obj.goals)?.protein),
    goal_fat: num(obj.goal_fat ?? asRecord(obj.goals)?.fat),
    goal_carbs: num(obj.goal_carbs ?? asRecord(obj.goals)?.carbs),
  };
}

function boolFlag(v: string | null, fallback: boolean): boolean {
  if (v == null || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function shapeCountMap(raw: unknown): Record<string, number> {
  const obj = asRecord(raw);
  if (!obj) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!YMD_RE.test(k)) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function shapeCalendarSurface(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const meta = asRecord(obj.meta) ?? {};
  return {
    meal_counts: shapeCountMap(obj.meal_counts),
    logged_meal_counts: shapeCountMap(obj.logged_meal_counts),
    unlogged_meal_counts: shapeCountMap(obj.unlogged_meal_counts),
    workout_counts: shapeCountMap(obj.workout_counts),
    planned_workout_counts: shapeCountMap(obj.planned_workout_counts),
    logged_planned_workout_counts: shapeCountMap(obj.logged_planned_workout_counts),
    unlogged_planned_workout_counts: shapeCountMap(obj.unlogged_planned_workout_counts),
    brain_counts: shapeCountMap(obj.brain_counts),
    logged_brain_counts: shapeCountMap(obj.logged_brain_counts),
    unlogged_brain_counts: shapeCountMap(obj.unlogged_brain_counts),
    event_counts: shapeCountMap(obj.event_counts),
    meta: {
      start_date: typeof meta.start_date === "string" ? meta.start_date : null,
      end_date: typeof meta.end_date === "string" ? meta.end_date : null,
      total_dates: typeof meta.total_dates === "number" ? meta.total_dates : null,
    },
  };
}

function shapeShoppingList(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id =
    typeof obj.id === "number" && Number.isSafeInteger(obj.id)
      ? obj.id
      : typeof obj.id === "string" && /^\d+$/.test(obj.id)
        ? Number(obj.id)
        : null;
  if (id == null) return null;
  const itemsByCat = asRecord(obj.items_by_category) ?? {};
  const shapedCat: Record<string, unknown[]> = {};
  for (const [cat, rows] of Object.entries(itemsByCat)) {
    if (!Array.isArray(rows)) continue;
    shapedCat[cat] = rows
      .map((row) => {
        const r = asRecord(row);
        if (!r) return null;
        const name = typeof r.item_name === "string" ? r.item_name : null;
        if (!name) return null;
        return {
          id: typeof r.id === "number" ? r.id : 0,
          item_name: name,
          quantity: typeof r.quantity === "string" ? r.quantity : "",
          sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
          category: typeof r.category === "string" ? r.category : cat,
        };
      })
      .filter(Boolean);
  }
  return {
    id,
    title: typeof obj.title === "string" ? obj.title : null,
    status: typeof obj.status === "string" ? obj.status : null,
    dates: Array.isArray(obj.dates)
      ? obj.dates.filter((d): d is string => typeof d === "string" && YMD_RE.test(d))
      : [],
    meals: Array.isArray(obj.meals) ? obj.meals : [],
    items: Array.isArray(obj.items) ? obj.items : [],
    items_by_category: shapedCat,
    generated_at: typeof obj.generated_at === "string" ? obj.generated_at : null,
    created_at: typeof obj.created_at === "string" ? obj.created_at : null,
  };
}

function shapeSparkEntries(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw);
  const entriesIn = Array.isArray(obj?.entries)
    ? obj!.entries
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const entries: Record<string, unknown>[] = [];
  for (const row of entriesIn) {
    const r = asRecord(row);
    if (!r) continue;
    const value =
      typeof r.value === "number"
        ? r.value
        : typeof r.value === "string"
          ? Number(r.value)
          : NaN;
    const measurement_date =
      typeof r.measurement_date === "string" ? r.measurement_date : null;
    if (!measurement_date || !Number.isFinite(value)) continue;
    const measurementType =
      typeof r.measurement_type === "string" ? r.measurement_type.toLowerCase() : null;
    const subType = typeof r.sub_type === "string" ? r.sub_type.toLowerCase() : null;
    const mid =
      parsePositiveCourseId(r.bsi_measurement_id) ??
      parsePositiveCourseId(r.measurement_id);
    const prDirectionRaw =
      typeof r.pr_direction === "string"
        ? r.pr_direction.toLowerCase()
        : typeof r.scoring_direction === "string"
          ? r.scoring_direction.toLowerCase()
          : null;
    entries.push({
      id: r.id ?? null,
      measurement_date,
      value,
      bsi_measurement_id: mid ?? undefined,
      unit_id: parsePositiveCourseId(r.unit_id) ?? undefined,
      unit_abbreviation:
        typeof r.unit_abbreviation === "string" ? r.unit_abbreviation : null,
      measurement_name:
        typeof r.measurement_name === "string" ? r.measurement_name : undefined,
      measurement_type:
        measurementType === "health" || measurementType === "movement"
          ? measurementType
          : null,
      sub_type: subType,
      pr_direction:
        prDirectionRaw === "higher_better" ||
        prDirectionRaw === "lower_better" ||
        prDirectionRaw === "closer_to_target"
          ? prDirectionRaw
          : null,
      type: typeof r.type === "string" ? r.type : undefined,
      status: typeof r.status === "string" ? r.status : undefined,
    });
  }
  const meta = asRecord(obj?.meta) ?? {};
  return {
    entries,
    meta: {
      count: typeof meta.count === "number" ? meta.count : entries.length,
      limit: typeof meta.limit === "number" ? meta.limit : 100,
      offset: typeof meta.offset === "number" ? meta.offset : 0,
    },
  };
}

function shapeSparkMeasurements(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const list = Array.isArray(obj.measurements)
    ? obj.measurements
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const measurements: Record<string, unknown>[] = [];
  for (const row of list) {
    const r = asRecord(row);
    if (!r) continue;
    const id =
      parsePositiveCourseId(r.bsi_measurement_id) ??
      parsePositiveCourseId(r.measurement_id) ??
      parsePositiveCourseId(r.id);
    if (id == null) continue;
    const measurementType =
      typeof r.measurement_type === "string" ? r.measurement_type.toLowerCase() : null;
    const prRaw =
      typeof r.pr_direction === "string" ? r.pr_direction.toLowerCase() : null;
    const defaultUnitId =
      parsePositiveCourseId(r.default_unit_id) ?? parsePositiveCourseId(r.unit_id);
    measurements.push({
      bsi_measurement_id: id,
      name: typeof r.name === "string" ? r.name : `Metric ${id}`,
      measurement_type:
        measurementType === "health" || measurementType === "movement"
          ? measurementType
          : null,
      sub_type: typeof r.sub_type === "string" ? r.sub_type.toLowerCase() : null,
      pr_direction:
        prRaw === "higher_better" ||
        prRaw === "lower_better" ||
        prRaw === "closer_to_target"
          ? prRaw
          : "higher_better",
      default_unit_id: defaultUnitId,
      unit_abbreviation:
        typeof r.default_unit_abbreviation === "string"
          ? r.default_unit_abbreviation
          : typeof r.unit_abbreviation === "string"
            ? r.unit_abbreviation
            : null,
    });
  }
  return { measurements, count: measurements.length };
}

function shapeSparkUnits(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const list = Array.isArray(obj.units) ? obj.units : Array.isArray(raw) ? (raw as unknown[]) : [];
  const units: Record<string, unknown>[] = [];
  for (const row of list) {
    const r = asRecord(row);
    if (!r) continue;
    const unit_id = parsePositiveCourseId(r.unit_id) ?? parsePositiveCourseId(r.id);
    if (unit_id == null) continue;
    const name = typeof r.name === "string" ? r.name : null;
    const abbreviation = typeof r.abbreviation === "string" ? r.abbreviation : null;
    if (!name && !abbreviation) continue;
    units.push({
      unit_id,
      name: name ?? abbreviation,
      abbreviation: abbreviation ?? name,
    });
  }
  return { units, count: units.length };
}

/** Shape BSI in-app notification rows for the web inbox / notifications page. */
function shapeInboxNotification(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = obj.id;
  if (id == null || id === "") return null;
  const type = typeof obj.type === "string" ? obj.type : null;
  const link = typeof obj.link === "string" ? obj.link : null;
  const postId =
    typeof obj.post_id === "number" || typeof obj.post_id === "string" ? obj.post_id : null;
  const readAt = typeof obj.read_at === "string" ? obj.read_at : null;
  const href = resolveNotificationHref({ type, link, post_id: postId });
  const title = typeof obj.title === "string" ? obj.title : null;
  const content =
    typeof obj.content === "string"
      ? obj.content
      : typeof obj.message === "string"
        ? obj.message
        : null;
  return {
    id,
    type,
    title,
    content,
    message: content,
    created_at: typeof obj.created_at === "string" ? obj.created_at : null,
    read_at: readAt,
    read: Boolean(readAt),
    source: typeof obj.source === "string" ? obj.source : null,
    post_id: postId,
    link,
    href,
  };
}

function unreadCountFromPayload(raw: unknown): number | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const n = obj.unread_count;
  if (typeof n === "number" && Number.isFinite(n) && n >= 0) return Math.floor(n);
  if (typeof n === "string" && /^\d+$/.test(n)) return Number.parseInt(n, 10);
  return null;
}

/** BSI spark create requires Y-m-d H:i:s; dashboard date inputs send Y-m-d. */
function normalizeSparkMeasurementDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (YMD_RE.test(s)) return `${s} 12:00:00`;
  // datetime-local: Y-m-dTH:i (no seconds)
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(s)) {
    return `${s.replace("T", " ")}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace("T", " ");
  }
  return null;
}

/**
 * BSI GET /spark/pr-overview returns a merged `items` list where the stable id
 * lives on `id` (`type: "measurement"` → measurement id, `type: "workout"` →
 * custom workout id). Older/split shapes may use `bsi_measurement_id` /
 * `custom_workout_id` instead — accept all of them (number or digit string).
 */
function shapePrOverview(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const pickRows = (...keys: string[]): unknown[] => {
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
    }
    return [];
  };
  const shapeRow = (
    row: unknown,
    kindHint?: "workout" | "movement",
  ): Record<string, unknown> | null => {
    const r = asRecord(row);
    if (!r) return null;
    const name =
      (typeof r.name === "string" && r.name) ||
      (typeof r.title === "string" && r.title) ||
      (typeof r.group === "string" && r.group) ||
      "PR";
    const best =
      typeof r.best_score === "number"
        ? r.best_score
        : typeof r.best_score === "string"
          ? Number(r.best_score)
          : null;
    const last =
      typeof r.last_score === "number"
        ? r.last_score
        : typeof r.last_score === "string"
          ? Number(r.last_score)
          : null;
    const type =
      typeof r.type === "string"
        ? r.type
        : typeof r.row_kind === "string"
          ? r.row_kind
          : null;
    const typeLower = (type ?? "").toLowerCase();
    const asMovement =
      kindHint === "movement" ||
      typeLower.includes("measurement") ||
      typeLower.includes("movement");
    const asWorkout =
      kindHint === "workout" || typeLower.includes("workout");
    const explicitMid =
      parsePositiveCourseId(r.bsi_measurement_id) ??
      parsePositiveCourseId(r.measurement_id);
    const explicitWid =
      parsePositiveCourseId(r.custom_workout_id) ??
      parsePositiveCourseId(r.custom_workout_template_id);
    const rowId = parsePositiveCourseId(r.id);
    let measurement_id = explicitMid;
    let custom_workout_id = explicitWid;
    if (asMovement && measurement_id == null) measurement_id = rowId;
    else if (asWorkout && custom_workout_id == null) custom_workout_id = rowId;
    const totalRaw =
      typeof r.total_entries === "number"
        ? r.total_entries
        : typeof r.total_entries === "string"
          ? Number(r.total_entries)
          : 0;
    const scoreMode =
      typeof r.score_mode === "string" ? r.score_mode.toLowerCase() : null;
    const prDirection =
      typeof r.pr_direction === "string"
        ? r.pr_direction.toLowerCase()
        : typeof r.scoring_direction === "string"
          ? r.scoring_direction.toLowerCase()
          : null;
    return {
      name,
      type,
      custom_workout_id,
      measurement_id,
      best_score: best != null && Number.isFinite(best) ? best : null,
      last_score: last != null && Number.isFinite(last) ? last : null,
      total_entries: Number.isFinite(totalRaw) ? totalRaw : 0,
      unit_abbreviation:
        typeof r.unit_abbreviation === "string" ? r.unit_abbreviation : null,
      score_unit_id:
        parsePositiveCourseId(r.score_unit_id) ??
        parsePositiveCourseId(r.unit_id),
      score_mode: scoreMode,
      pr_direction:
        prDirection === "higher_better" || prDirection === "lower_better"
          ? prDirection
          : null,
      benchmark_classification:
        typeof r.benchmark_classification === "string"
          ? r.benchmark_classification
          : null,
      is_benchmark: r.is_benchmark === true || r.is_benchmark === 1,
    };
  };
  const workoutsIn = pickRows(
    "workout_benchmarks",
    "workout_benchmark_rows",
    "workouts",
    "workout_prs",
  );
  const movementsIn = pickRows(
    "movement_benchmarks",
    "movement_benchmark_rows",
    "movements",
    "measurement_prs",
  );
  let workouts: Record<string, unknown>[] = [];
  let movements: Record<string, unknown>[] = [];
  for (const row of workoutsIn) {
    const s = shapeRow(row, "workout");
    if (s) workouts.push(s);
  }
  for (const row of movementsIn) {
    const s = shapeRow(row, "movement");
    if (s) movements.push(s);
  }
  if (workouts.length === 0 && movements.length === 0) {
    const merged = pickRows("items", "rows", "overview", "data", "prs");
    for (const row of merged) {
      const s = shapeRow(row);
      if (!s) continue;
      const t = String(s.type ?? "").toLowerCase();
      if (t.includes("movement") || t.includes("measurement") || s.measurement_id) {
        movements.push(s);
      } else {
        workouts.push(s);
      }
    }
  }
  return { workouts, movements };
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

  // CR3 alias: POST /api/courses/:courseId/checkout (bearer when signed in; guest email otherwise)
  const coursesCheckout = path.match(/^\/api\/courses\/([^/]+)\/checkout$/);
  if (method === "POST" && coursesCheckout) {
    return {
      id: "DP7",
      method: "POST",
      params: { courseId: coursesCheckout[1]! },
      limiter: "write",
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
  // CR3: purchase-checkout + checkout (bearer when signed in; guest email otherwise)
  const purchase = rest.match(/^courses\/([^/]+)\/(purchase-checkout|checkout)$/);
  if (method === "POST" && purchase) {
    return {
      id: "DP7",
      method: "POST",
      params: { courseId: purchase[1]! },
      limiter: "write",
      public: true,
    };
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
  if (
    method === "PUT" &&
    (rest === "onboarding-roles" || rest === "community-choices")
  ) {
    return { id: "DP13b", method: "PUT", params: {}, limiter: "write" };
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
  if (method === "GET" && rest === "meals") {
    return { id: "MF1", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "meals/upcoming") {
    return { id: "MF2", method: "GET", params: {}, limiter: "read" };
  }
  const macrosDay = rest.match(/^macros\/daily\/(\d{4}-\d{2}-\d{2})$/);
  if (method === "GET" && macrosDay) {
    return {
      id: "MF3",
      method: "GET",
      params: { date: macrosDay[1]! },
      limiter: "read",
    };
  }
  if (method === "GET" && rest === "pr-overview") {
    return { id: "MF4", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "calendar/surface") {
    return { id: "MF5", method: "GET", params: {}, limiter: "read" };
  }
  const planMealDay = rest.match(/^meals\/days\/(\d{4}-\d{2}-\d{2})$/);
  if (method === "POST" && planMealDay) {
    return {
      id: "MF6",
      method: "POST",
      params: { date: planMealDay[1]! },
      limiter: "write",
    };
  }
  if (method === "GET" && rest === "shopping-lists") {
    return { id: "MF7", method: "GET", params: {}, limiter: "read" };
  }
  const shoppingListOne = rest.match(/^shopping-lists\/(\d+)$/);
  if (method === "GET" && shoppingListOne) {
    return {
      id: "MF8",
      method: "GET",
      params: { id: shoppingListOne[1]! },
      limiter: "read",
    };
  }
  if (method === "POST" && rest === "shopping-lists") {
    return { id: "MF9", method: "POST", params: {}, limiter: "write" };
  }
  const shoppingGenerate = rest.match(/^shopping-lists\/(\d+)\/generate$/);
  if (method === "POST" && shoppingGenerate) {
    return {
      id: "MF10",
      method: "POST",
      params: { id: shoppingGenerate[1]! },
      limiter: "write",
    };
  }
  const shoppingEmail = rest.match(/^shopping-lists\/(\d+)\/email$/);
  if (method === "POST" && shoppingEmail) {
    return {
      id: "MF11",
      method: "POST",
      params: { id: shoppingEmail[1]! },
      limiter: "write",
    };
  }
  if (method === "GET" && rest === "spark/user-info") {
    return { id: "MF50", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "spark/measurements") {
    return { id: "MF52", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "spark/units") {
    return { id: "MF63", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "spark/entries") {
    return { id: "MF12", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "POST" && rest === "spark/entries") {
    return { id: "MF13", method: "POST", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "inbox") {
    return { id: "MF14", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "workouts/planned") {
    return { id: "MF16", method: "GET", params: {}, limiter: "read" };
  }
  const plannedWorkout = rest.match(/^workouts\/planned\/([1-9][0-9]*)$/);
  if (method === "DELETE" && plannedWorkout) {
    return {
      id: "MF19",
      method: "DELETE",
      params: { id: plannedWorkout[1]! },
      limiter: "write",
    };
  }
  const customWorkout = rest.match(/^custom-workouts\/([1-9][0-9]*)$/);
  if (customWorkout && (method === "GET" || method === "PUT" || method === "DELETE")) {
    return {
      id: method === "GET" ? "MF21" : method === "PUT" ? "MF38" : "MF39",
      method,
      params: { id: customWorkout[1]! },
      limiter: method === "GET" ? "read" : "write",
    };
  }
  if ((method === "GET" || method === "POST") && rest === "custom-workouts") {
    return {
      id: method === "GET" ? "MF37" : "MF37w",
      method,
      params: {},
      limiter: method === "GET" ? "read" : "write",
    };
  }
  if (method === "GET" && rest === "movements") {
    return { id: "MF40", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "daily-fix") {
    return { id: "MF49", method: "GET", params: {}, limiter: "read" };
  }
  const planPublish = rest.match(/^plans\/([1-9][0-9]*)\/publish$/);
  if (method === "POST" && planPublish) {
    return {
      id: "MF46",
      method: "POST",
      params: { id: planPublish[1]! },
      limiter: "write",
    };
  }
  const planSchedule = rest.match(/^plans\/([1-9][0-9]*)\/schedule$/);
  if (method === "POST" && planSchedule) {
    return {
      id: "MF47",
      method: "POST",
      params: { id: planSchedule[1]! },
      limiter: "write",
    };
  }
  const planActive = rest.match(/^plans\/([1-9][0-9]*)\/active$/);
  if (method === "PATCH" && planActive) {
    return {
      id: "MF48",
      method: "PATCH",
      params: { id: planActive[1]! },
      limiter: "write",
    };
  }
  const planOne = rest.match(/^plans\/([1-9][0-9]*)$/);
  if (planOne && (method === "GET" || method === "PUT" || method === "DELETE")) {
    return {
      id: method === "GET" ? "MF43" : method === "PUT" ? "MF44" : "MF45",
      method,
      params: { id: planOne[1]! },
      limiter: method === "GET" ? "read" : "write",
    };
  }
  if ((method === "GET" || method === "POST") && rest === "plans") {
    return {
      id: method === "GET" ? "MF41" : "MF42",
      method,
      params: {},
      limiter: method === "GET" ? "read" : "write",
    };
  }
  const workoutOne = rest.match(/^workouts\/([1-9][0-9]*)$/);
  if (workoutOne && (method === "GET" || method === "DELETE")) {
    return {
      id: method === "GET" ? "MF17" : "MF18",
      method,
      params: { id: workoutOne[1]! },
      limiter: method === "GET" ? "read" : "write",
    };
  }
  if (method === "POST" && rest === "workouts") {
    return { id: "MF20", method: "POST", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "workouts") {
    return { id: "MF15", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "coaching/client") {
    return { id: "MF22", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "coaching/coach") {
    return { id: "MF23", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "coaching/directory") {
    return { id: "MF24", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "coaching/profile") {
    return { id: "MF35", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "PUT" && rest === "coaching/profile") {
    return { id: "MF36", method: "PUT", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "coaching/plans") {
    return { id: "MF34", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "coaching/programming/subscriptions") {
    return { id: "MF29", method: "GET", params: {}, limiter: "read" };
  }
  const programmingSub = rest.match(/^coaching\/programming\/subscriptions\/([1-9][0-9]*)$/);
  if (method === "DELETE" && programmingSub) {
    return {
      id: "MF33",
      method: "DELETE",
      params: { id: programmingSub[1]! },
      limiter: "write",
    };
  }
  const programmingDays = rest.match(
    /^coaching\/programming\/series\/([1-9][0-9]*)\/days$/,
  );
  if (method === "GET" && programmingDays) {
    return {
      id: "MF31",
      method: "GET",
      params: { id: programmingDays[1]! },
      limiter: "read",
    };
  }
  const programmingSubscribe = rest.match(
    /^coaching\/programming\/series\/([1-9][0-9]*)\/subscribe$/,
  );
  if (method === "POST" && programmingSubscribe) {
    return {
      id: "MF32",
      method: "POST",
      params: { id: programmingSubscribe[1]! },
      limiter: "write",
    };
  }
  if (method === "GET" && rest === "coaching/programming/series") {
    return { id: "MF30", method: "GET", params: {}, limiter: "read" };
  }
  const coachNotes = rest.match(/^coaching\/relationships\/([1-9][0-9]*)\/notes$/);
  if (coachNotes && (method === "GET" || method === "POST")) {
    return {
      id: method === "GET" ? "MF27" : "MF28",
      method,
      params: { id: coachNotes[1]! },
      limiter: method === "GET" ? "read" : "write",
    };
  }
  const coachAction = rest.match(
    /^coaching\/relationships\/([1-9][0-9]*)\/(accept|decline|end)$/,
  );
  if (method === "POST" && coachAction) {
    return {
      id: "MF26",
      method: "POST",
      params: { id: coachAction[1]!, action: coachAction[2]! },
      limiter: "write",
    };
  }
  if (method === "POST" && rest === "coaching/relationships") {
    return { id: "MF25", method: "POST", params: {}, limiter: "write" };
  }
  if (method === "GET" && rest === "plans/library") {
    return { id: "MF51", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "GET" && rest === "custom-recipes") {
    return { id: "MF53", method: "GET", params: {}, limiter: "read" };
  }
  if (method === "POST" && rest === "custom-recipes") {
    return { id: "MF54", method: "POST", params: {}, limiter: "write" };
  }
  const recipeOne = rest.match(/^custom-recipes\/(\d+)$/);
  if (recipeOne && method === "GET") {
    return { id: "MF55", method: "GET", params: { id: recipeOne[1]! }, limiter: "read" };
  }
  if (recipeOne && method === "PUT") {
    return { id: "MF56", method: "PUT", params: { id: recipeOne[1]! }, limiter: "write" };
  }
  if (recipeOne && method === "DELETE") {
    return { id: "MF57", method: "DELETE", params: { id: recipeOne[1]! }, limiter: "write" };
  }
  if (method === "GET" && rest === "macros/range") {
    return { id: "MF58", method: "GET", params: {}, limiter: "read" };
  }
  const mealDelete = rest.match(/^meals\/(\d+)$/);
  if (method === "DELETE" && mealDelete) {
    return { id: "MF59", method: "DELETE", params: { id: mealDelete[1]! }, limiter: "write" };
  }
  if (method === "GET" && rest === "shopping-lists/generated-dates") {
    return { id: "MF60", method: "GET", params: {}, limiter: "read" };
  }
  const planAcl = rest.match(/^plans\/(\d+)\/acl$/);
  if (planAcl && method === "GET") {
    return { id: "MF61", method: "GET", params: { id: planAcl[1]! }, limiter: "read" };
  }
  if (planAcl && method === "POST") {
    return { id: "MF62", method: "POST", params: { id: planAcl[1]! }, limiter: "write" };
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
  if (method === "GET" && rest === "notifications/unread-count") {
    return { id: "MF14u", method: "GET", params: {}, limiter: "read" };
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

type ProfileAttrWrite = {
  member_type: "general" | "metfix" | "medical";
  attr_id: number;
  attr_value: string;
};

function validateAttributesPayload(json: unknown): Response | ProfileAttrWrite[] {
  const obj = asRecord(json);
  if (!obj) return accountJson({ error: "invalid_request" }, 400);
  const attrs = Array.isArray(obj.attributes) ? obj.attributes : Array.isArray(json) ? json : null;
  if (!attrs || attrs.length < 1) return accountJson({ error: "invalid_request" }, 400);
  const out: ProfileAttrWrite[] = [];
  for (const row of attrs) {
    const r = asRecord(row);
    if (!r) return accountJson({ error: "invalid_field" }, 400);
    const id = typeof r.attr_id === "number" ? r.attr_id : typeof r.id === "number" ? r.id : null;
    if (id == null || !Number.isInteger(id) || id <= 0) {
      return accountJson({ error: "invalid_field" }, 400);
    }
    // Prefer explicit member_type; accept section aliases from MetFix.org UI.
    const typeRaw =
      typeof r.member_type === "string"
        ? r.member_type
        : typeof r.section === "string"
          ? r.section
          : null;
    const mapped = typeRaw ? PROFILE_ATTR_SECTION_TO_TYPE[typeRaw] : null;
    if (!mapped || !PROFILE_ATTR_MEMBER_TYPES.has(mapped)) {
      return accountJson({ error: "invalid_field" }, 400);
    }
    for (const key of ["key", "name", "label"] as const) {
      const v = r[key];
      if (typeof v === "string" && /email/i.test(v)) {
        return accountJson({ error: "invalid_field" }, 400);
      }
    }
    const value =
      typeof r.attr_value === "string"
        ? r.attr_value
        : typeof r.value === "string"
          ? r.value
          : null;
    if (value == null) return accountJson({ error: "invalid_field" }, 400);
    if (value.includes("@") || EMAIL_VALUE_RE.test(value)) {
      return accountJson({ error: "invalid_field" }, 400);
    }
    out.push({
      member_type: mapped as "general" | "metfix" | "medical",
      attr_id: id,
      attr_value: value,
    });
  }
  return out;
}

/** BSI G6: trim, length 1–60, reject @ / full-width ＠. */
function sanitizeProfileName(raw: unknown, field: string): Response | string {
  if (typeof raw !== "string") {
    return accountJson({ error: "invalid_field", param: field }, 400);
  }
  const v = raw.trim();
  const len = [...v].length;
  if (len < 1 || len > 60) {
    return accountJson({ error: "invalid_field", param: field }, 400);
  }
  if (v.includes("@") || v.includes("＠")) {
    return accountJson({ error: "invalid_field", param: field }, 400);
  }
  return v;
}

function validateProfilePatch(json: unknown): Response | Record<string, unknown> {
  const obj = asRecord(json);
  if (!obj) return accountJson({ error: "invalid_request" }, 400);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!PROFILE_PATCH_FIELDS.has(key)) {
      return accountJson({ error: "invalid_field", param: key }, 400);
    }
  }
  let any = false;
  for (const key of PROFILE_PATCH_FIELDS) {
    if (!(key in obj)) continue;
    const sanitized = sanitizeProfileName(obj[key], key);
    if (sanitized instanceof Response) return sanitized;
    out[key] = sanitized;
    any = true;
  }
  if (!any) return accountJson({ error: "invalid_request" }, 400);
  return out;
}

function shapeEditableAttrRow(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const attrId =
    typeof r.attr_id === "number"
      ? r.attr_id
      : typeof r.id === "number"
        ? r.id
        : null;
  if (attrId == null || !Number.isInteger(attrId) || attrId <= 0) return null;
  const label =
    typeof r.label === "string"
      ? r.label
      : typeof r.attr_name === "string"
        ? r.attr_name
        : typeof r.name === "string"
          ? r.name
          : typeof r.key === "string"
            ? r.key
            : null;
  if (!label || /email/i.test(label)) return null;
  const formType = typeof r.form_type === "string" ? r.form_type : "text";
  if (formType === "email" || formType === "file") return null;
  return {
    attr_id: attrId,
    key: typeof r.key === "string" ? r.key : undefined,
    label,
    form_type: formType,
    value: typeof r.value === "string" ? r.value : typeof r.current_value === "string" ? r.current_value : "",
  };
}

function shapeProfileAttributes(raw: unknown): {
  personal: Record<string, unknown>[];
  affiliate: Record<string, unknown>[];
  clinic: Record<string, unknown>[];
} {
  const empty: {
    personal: Record<string, unknown>[];
    affiliate: Record<string, unknown>[];
    clinic: Record<string, unknown>[];
  } = { personal: [], affiliate: [], clinic: [] };
  const obj = asRecord(raw);
  if (!obj) {
    // Legacy flat list → personal only (allowlisted ids).
    if (!Array.isArray(raw)) return empty;
    for (const row of raw) {
      const s = shapeEditableAttrRow(row);
      if (!s) continue;
      const id = s.attr_id as number;
      if (!EDITABLE_ATTR_IDS.has(id)) continue;
      empty.personal.push(s);
    }
    return empty;
  }
  const sections: Array<[keyof typeof empty, unknown]> = [
    ["personal", obj.personal ?? obj.general],
    ["affiliate", obj.affiliate ?? obj.metfix],
    ["clinic", obj.clinic ?? obj.medical],
  ];
  for (const [section, list] of sections) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const s = shapeEditableAttrRow(row);
      if (s) empty[section].push(s);
    }
  }
  return empty;
}

function shapeOwnProfile(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const attrsRaw = obj.attributes;
  const attributes = shapeProfileAttributes(attrsRaw);
  const avatarRaw = obj.avatar_url ?? obj.profile_picture_url;
  const avatar_url =
    typeof avatarRaw === "string" && /^https?:\/\//i.test(avatarRaw.trim())
      ? avatarRaw.trim()
      : null;
  return {
    first_name: typeof obj.first_name === "string" ? obj.first_name : "",
    last_name: typeof obj.last_name === "string" ? obj.last_name : "",
    display_name: publicDisplayName({
      display_name: typeof obj.display_name === "string" ? obj.display_name : null,
    }),
    email: typeof obj.email === "string" ? obj.email : null,
    avatar_url,
    member_since: strOrNull(obj.member_since),
    attributes,
  };
}

async function accountProxy(
  ctx: ActingContext,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  method: string,
  path: string,
  init?: { query?: string; jsonBody?: unknown },
): Promise<Response | { json: unknown; status: number }> {
  const ran = await runBearer(ctx, env, fetchImpl, opts, method, path, {
    query: init?.query,
    ...(init?.jsonBody !== undefined
      ? { body: JSON.stringify(init.jsonBody), contentType: "application/json" }
      : {}),
  });
  if (ran instanceof Response) return mapUnauthenticated(ran);
  return mapUpstreamResult(ran.result);
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
      const cleaned = stripProviderIdValues(shaped);
      if (!cleaned || typeof cleaned !== "object") {
        return accountJson({ error: "unavailable" }, 502);
      }
      if (containsProviderIdValues(cleaned)) {
        return accountJson({ error: "unavailable" }, 502);
      }
      return accountJson(cleaned, 200);
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
      const payload: Record<string, unknown> = {
        target_tier: body.target_tier,
        return_path: "/checkout/complete",
      };
      if (typeof body.sub_ref === "string") {
        const ref = opaqueSubRef(body.sub_ref);
        if (!ref) return accountJson({ error: "invalid_request" }, 400);
        payload.sub_ref = ref;
      }
      if (typeof body.return_path === "string") {
        const sanitized = sanitizeReturnPath(body.return_path);
        if (!sanitized) return accountJson({ error: "invalid_return_path" }, 400);
        payload.return_path = sanitized;
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
      // Signed-in: same Bearer as other /api/account writes.
      // Guest: email is required and forwarded; no Authorization. No email → 401.
      const courseId = match.params.courseId!;
      if (!COURSE_ID_RE.test(courseId)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};

      // Allowlist: bsi_ref + return_path. A signed-in body email is dropped.
      // Guest email is added only when there is no session.
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

      const checkoutPath = accountCourseCheckoutPath(courseId);
      let result: BsiHttpResult;
      if (ctx) {
        const ran = await runBearer(ctx, env, fetchImpl, opts, "POST", checkoutPath, {
          body: JSON.stringify(upstreamBody),
          contentType: "application/json",
        });
        if (ran instanceof Response) return mapUnauthenticated(ran);
        result = ran.result;
      } else {
        const email = guestCheckoutEmail(body.email);
        if (email == null) {
          const raw = body.email;
          const missing = raw == null || (typeof raw === "string" && raw.trim() === "");
          return accountJson(
            { error: missing ? "unauthenticated" : "invalid_email" },
            missing ? 401 : 400,
          );
        }
        upstreamBody.email = email;
        result = await accountBsiFetch(
          bsiUrl(env, checkoutPath, opts),
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": UPSTREAM_USER_AGENT,
            },
            body: JSON.stringify(upstreamBody),
          },
          fetchImpl,
          env,
        );
      }

      if (result.kind === "http") {
        const code = upstreamErrorCode(result.json);
        if (code === "bsi_unauthorized" || result.status === 401) {
          return accountJson({ error: "unauthenticated" }, 401);
        }
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
      const mapped = mapUpstreamResult(result);
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
      const shaped = shapeOwnProfile(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "DP13b": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validateOnboardingRolesBody(parsed.json);
      if (body instanceof Response) return body;
      const upstream: Record<string, unknown> = {
        onboarding_roles: body.onboarding_roles,
      };
      if (typeof body.has_physical_gym === "boolean") {
        upstream.has_physical_gym = body.has_physical_gym;
      }
      if (typeof body.has_physical_clinic === "boolean") {
        upstream.has_physical_clinic = body.has_physical_clinic;
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        accountMeCommunityChoicesPath(),
        {
          body: JSON.stringify(upstream),
          contentType: "application/json",
        },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const flags = asRecord(mapped.json) ?? {};
      return accountJson(
        {
          onboarding_roles: shapeOnboardingRoles(flags),
          has_physical_gym:
            flags.has_physical_gym === true || flags.hasPhysicalGym === true,
          has_physical_clinic:
            flags.has_physical_clinic === true || flags.hasPhysicalClinic === true,
        },
        200,
      );
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
      const shaped = shapeOwnProfile(mapped.json) ?? {
        first_name: typeof patch.first_name === "string" ? patch.first_name : "",
        last_name: typeof patch.last_name === "string" ? patch.last_name : "",
        display_name: publicDisplayName({
          display_name: typeof patch.display_name === "string" ? patch.display_name : null,
        }),
        email: null,
        avatar_url: null,
        member_since: null,
        attributes: { personal: [], affiliate: [], clinic: [] },
      };
      return accountJson(shaped, mapped.status >= 200 && mapped.status < 300 ? 200 : mapped.status);
    }
    case "DP14": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const attrs = validateAttributesPayload(parsed.json);
      if (attrs instanceof Response) return attrs;
      // BSI accepts one attribute per POST (member_type + attr_id + attr_value).
      const results: unknown[] = [];
      for (const row of attrs) {
        const ran = await runBearer(
          ctx!,
          env,
          fetchImpl,
          opts,
          "POST",
          accountProfilesMeAttributesPath(),
          {
            body: JSON.stringify({
              member_type: row.member_type,
              attr_id: row.attr_id,
              attr_value: row.attr_value,
            }),
            contentType: "application/json",
          },
        );
        if (ran instanceof Response) return mapUnauthenticated(ran);
        const mapped = mapUpstreamResult(ran.result);
        if (mapped instanceof Response) return mapped;
        results.push(mapped.json ?? { ok: true });
      }
      return accountJson({ ok: true, updated: results.length, results }, 200);
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
    case "MF1": {
      const start = url.searchParams.get("start_date") ?? "";
      const end = url.searchParams.get("end_date") ?? "";
      if (!YMD_RE.test(start) || !YMD_RE.test(end)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const q = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCalendarMealsPath(),
        { query: q },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeMeals(mapped.json), 200);
    }
    case "MF2": {
      const limitRaw = url.searchParams.get("limit") ?? "20";
      const offsetRaw = url.searchParams.get("offset") ?? "0";
      if (!/^[1-9][0-9]*$/.test(limitRaw) || !/^(0|[1-9][0-9]*)$/.test(offsetRaw)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const limit = Math.min(Number(limitRaw), 100);
      const offset = Number(offsetRaw);
      const from = url.searchParams.get("from_date");
      const parts = [`limit=${limit}`, `offset=${offset}`];
      if (from && YMD_RE.test(from)) parts.push(`from_date=${encodeURIComponent(from)}`);
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCalendarMealsUpcomingPath(),
        { query: parts.join("&") },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeMealsUpcoming(mapped.json), 200);
    }
    case "MF3": {
      const date = match.params.date!;
      if (!YMD_RE.test(date)) return accountJson({ error: "invalid_request" }, 400);
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountMacrosDailyPath(date),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeMacrosDaily(mapped.json), 200);
    }
    case "MF4": {
      const capRaw = url.searchParams.get("catalog_cap");
      const q =
        capRaw && /^[1-9][0-9]{0,3}$/.test(capRaw)
          ? `catalog_cap=${encodeURIComponent(capRaw)}`
          : undefined;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPrOverviewPath(),
        { query: q },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapePrOverview(mapped.json), 200);
    }
    case "MF5": {
      const start = url.searchParams.get("start_date") ?? "";
      const end = url.searchParams.get("end_date") ?? "";
      if (!YMD_RE.test(start) || !YMD_RE.test(end)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const parts = [
        `start_date=${encodeURIComponent(start)}`,
        `end_date=${encodeURIComponent(end)}`,
        `include_meals=${boolFlag(url.searchParams.get("include_meals"), true) ? "1" : "0"}`,
        `include_workouts=${boolFlag(url.searchParams.get("include_workouts"), true) ? "1" : "0"}`,
        `include_brain=${boolFlag(url.searchParams.get("include_brain"), true) ? "1" : "0"}`,
        `include_events=${boolFlag(url.searchParams.get("include_events"), true) ? "1" : "0"}`,
      ];
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCalendarSurfacePath(),
        { query: parts.join("&") },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeCalendarSurface(mapped.json), 200);
    }
    case "MF6": {
      const date = match.params.date!;
      if (!YMD_RE.test(date)) return accountJson({ error: "invalid_request" }, 400);
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const recipe_source_type =
        body.recipe_source_type === "custom_recipe" ? "custom_recipe" : "daily_mod";
      const recipe_source_id =
        typeof body.recipe_source_id === "number" &&
        Number.isSafeInteger(body.recipe_source_id) &&
        body.recipe_source_id > 0
          ? body.recipe_source_id
          : null;
      const slot_index =
        typeof body.slot_index === "number" &&
        Number.isSafeInteger(body.slot_index) &&
        body.slot_index >= 1 &&
        body.slot_index <= 6
          ? body.slot_index
          : undefined;
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
      if (recipe_source_id == null && !label) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const upstream: Record<string, unknown> = {
        recipe_source_type,
        ...(recipe_source_id != null ? { recipe_source_id } : {}),
        ...(slot_index != null ? { slot_index } : {}),
        ...(label ? { label } : {}),
      };
      if (typeof body.notes === "string" && body.notes.trim()) {
        upstream.notes = body.notes.trim().slice(0, 500);
      }
      // BSI requires recipe_source_id; free-text-only plans aren't supported upstream.
      if (recipe_source_id == null) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPlanMealPath(date),
        { body: JSON.stringify(upstream), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped =
        shapePlannedMeal(mapped.json) ??
        shapePlannedMeal(asRecord(mapped.json)?.planned_meal);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, mapped.status >= 200 && mapped.status < 300 ? mapped.status : 200);
    }
    case "MF7": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountShoppingListsPath(),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      const listsIn = Array.isArray(obj.lists) ? obj.lists : [];
      const lists = listsIn
        .map((row) => shapeShoppingList(row))
        .filter((x): x is Record<string, unknown> => x != null);
      return accountJson({ lists, meta: asRecord(obj.meta) ?? {} }, 200);
    }
    case "MF8": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountShoppingListPath(id),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeShoppingList(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "MF9": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const title =
        typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined;
      const dates = Array.isArray(body.dates)
        ? body.dates.filter((d): d is string => typeof d === "string" && YMD_RE.test(d))
        : [];
      const meals = Array.isArray(body.meals)
        ? body.meals
            .map((row) => {
              const r = asRecord(row);
              if (!r) return null;
              const planned_meal_id =
                typeof r.planned_meal_id === "number" && Number.isSafeInteger(r.planned_meal_id)
                  ? r.planned_meal_id
                  : null;
              if (planned_meal_id == null) return null;
              const servings =
                typeof r.servings === "number" && Number.isFinite(r.servings) && r.servings > 0
                  ? r.servings
                  : 1;
              return { planned_meal_id, servings };
            })
            .filter(Boolean)
        : [];
      const upstream: Record<string, unknown> = {
        ...(title ? { title } : {}),
        dates,
        meals,
      };
      if (typeof body.other_considerations === "string" && body.other_considerations.trim()) {
        upstream.other_considerations = body.other_considerations.trim().slice(0, 1000);
      }
      if (typeof body.notes === "string" && body.notes.trim()) {
        upstream.notes = body.notes.trim().slice(0, 1000);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountShoppingListsPath(),
        { body: JSON.stringify(upstream), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const shaped = shapeShoppingList(mapped.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, mapped.status === 201 ? 201 : 200);
    }
    case "MF10": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountShoppingListGeneratePath(id),
        { body: "{}", contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      const listRaw = obj.list ?? mapped.json;
      const shaped = shapeShoppingList(listRaw);
      if (!shaped) {
        // Generate often returns a partial list; keep id + items_by_category.
        const partial = asRecord(listRaw) ?? {};
        return accountJson(
          {
            success: obj.success !== false,
            list: {
              id: Number(id),
              status: typeof partial.status === "string" ? partial.status : "generated",
              items_by_category: asRecord(partial.items_by_category) ?? {},
            },
          },
          200,
        );
      }
      return accountJson({ success: obj.success !== false, list: shaped }, 200);
    }
    case "MF11": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountShoppingListEmailPath(id),
        { body: "{}", contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      return accountJson(
        {
          success: obj.success !== false,
          emailed_to: typeof obj.emailed_to === "string" ? obj.emailed_to : null,
          message: typeof obj.message === "string" ? obj.message : null,
        },
        200,
      );
    }
    case "MF50": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountSparkUserInfoPath(),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeSparkUserInfo(proxied.json), 200);
    }
    case "MF52": {
      const parts: string[] = [];
      const mtype = url.searchParams.get("measurement_type");
      if (mtype === "health" || mtype === "movement") {
        parts.push(`measurement_type=${encodeURIComponent(mtype)}`);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountSparkMeasurementsPath(),
        { query: parts.length ? parts.join("&") : undefined },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeSparkMeasurements(mapped.json), 200);
    }
    case "MF63": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountSparkUnitsPath(),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeSparkUnits(mapped.json), 200);
    }
    case "MF12": {
      const parts: string[] = [];
      const mid = url.searchParams.get("measurement_id");
      if (mid && /^[1-9][0-9]*$/.test(mid)) {
        parts.push(`measurement_id=${encodeURIComponent(mid)}`);
      }
      const start = url.searchParams.get("start_date");
      const end = url.searchParams.get("end_date");
      if (start && YMD_RE.test(start)) parts.push(`start_date=${encodeURIComponent(start)}`);
      if (end && YMD_RE.test(end)) parts.push(`end_date=${encodeURIComponent(end)}`);
      const limitRaw = url.searchParams.get("limit");
      if (limitRaw && /^[1-9][0-9]*$/.test(limitRaw)) {
        parts.push(`limit=${Math.min(Number(limitRaw), 500)}`);
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountSparkEntriesPath(),
        { query: parts.length ? parts.join("&") : undefined },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(shapeSparkEntries(mapped.json), 200);
    }
    case "MF13": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const measurement_id =
        typeof body.measurement_id === "number" &&
        Number.isSafeInteger(body.measurement_id) &&
        body.measurement_id > 0
          ? body.measurement_id
          : null;
      const value =
        typeof body.value === "number" && Number.isFinite(body.value)
          ? body.value
          : typeof body.value === "string"
            ? Number(body.value)
            : NaN;
      const measurement_date = normalizeSparkMeasurementDate(body.measurement_date);
      if (measurement_id == null || !Number.isFinite(value) || !measurement_date) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const upstream: Record<string, unknown> = {
        measurement_id,
        value,
        measurement_date,
        force_log: body.force_log !== false,
      };
      if (
        typeof body.unit_id === "number" &&
        Number.isSafeInteger(body.unit_id) &&
        body.unit_id > 0
      ) {
        upstream.unit_id = body.unit_id;
      }
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountSparkEntriesPath(),
        { body: JSON.stringify(upstream), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      // Spark may return skipped as 200 with flags — pass shaped fields through.
      if (ran.result.kind === "ok") {
        const obj = asRecord(ran.result.json) ?? {};
        return accountJson(
          {
            entry: asRecord(obj.entry) ?? undefined,
            message: typeof obj.message === "string" ? obj.message : undefined,
            skipped: obj.skipped === true,
            auto_log_skipped: obj.auto_log_skipped === true,
          },
          ran.result.status,
        );
      }
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "MF14": {
      const [convRan, notifRan, unreadRan] = await Promise.all([
        runBearer(ctx!, env, fetchImpl, opts, "GET", accountMessagesConversationsPath()),
        runBearer(ctx!, env, fetchImpl, opts, "GET", accountInAppNotificationsPath()),
        runBearer(
          ctx!,
          env,
          fetchImpl,
          opts,
          "GET",
          `${accountNotificationsListPath()}?limit=1&offset=0`,
        ),
      ]);
      if (convRan instanceof Response) return mapUnauthenticated(convRan);
      if (notifRan instanceof Response) return mapUnauthenticated(notifRan);
      const conversations: unknown[] = [];
      const notifications: Record<string, unknown>[] = [];
      if (convRan.result.kind === "ok") {
        const cobj = asRecord(convRan.result.json) ?? {};
        const list = Array.isArray(cobj.conversations)
          ? cobj.conversations
          : Array.isArray(cobj.items)
            ? cobj.items
            : Array.isArray(convRan.result.json)
              ? (convRan.result.json as unknown[])
              : [];
        conversations.push(...list);
      } else if (convRan.result.kind !== "http" || convRan.result.status !== 404) {
        // Soft-fail one side so a missing messages table doesn't blank notifications.
      }
      if (notifRan.result.kind === "ok") {
        const nobj = asRecord(notifRan.result.json) ?? {};
        const list = Array.isArray(nobj.notifications)
          ? nobj.notifications
          : Array.isArray(nobj.items)
            ? nobj.items
            : [];
        for (const row of list) {
          const shaped = shapeInboxNotification(row);
          if (shaped) notifications.push(shaped);
        }
      }
      let unread_count =
        unreadRan instanceof Response
          ? null
          : unreadRan.result.kind === "ok"
            ? unreadCountFromPayload(unreadRan.result.json)
            : null;
      if (unread_count == null) {
        unread_count = notifications.reduce(
          (sum, n) => sum + (n.read === true ? 0 : 1),
          0,
        );
      }
      // If both upstreams failed hard, surface unavailable.
      if (
        convRan.result.kind !== "ok" &&
        notifRan.result.kind !== "ok" &&
        !(convRan.result.kind === "http" && convRan.result.status === 404) &&
        !(notifRan.result.kind === "http" && notifRan.result.status === 404)
      ) {
        return accountJson({ error: "unavailable" }, 502);
      }
      return accountJson(
        { conversations, notifications, items: notifications, unread_count },
        200,
      );
    }
    case "MF14u": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        `${accountNotificationsListPath()}?limit=1&offset=0`,
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      if (ran.result.kind === "ok") {
        const count = unreadCountFromPayload(ran.result.json) ?? 0;
        return accountJson({ unread_count: count }, 200);
      }
      if (ran.result.kind === "http" && ran.result.status === 404) {
        return accountJson({ unread_count: 0 }, 200);
      }
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson({ unread_count: 0 }, 200);
    }
    case "MF51": {
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPlansLibraryPath(),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { active: {}, inactive: {} }, 200);
    }
    case "MF53": {
      const limitRaw = url.searchParams.get("limit") ?? "50";
      const limit = /^[1-9][0-9]*$/.test(limitRaw) ? Math.min(Number(limitRaw), 100) : 50;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCustomRecipesPath(),
        { query: `limit=${limit}` },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      const recipes = Array.isArray(obj.recipes)
        ? obj.recipes
        : Array.isArray(mapped.json)
          ? (mapped.json as unknown[])
          : [];
      return accountJson({ recipes, meta: asRecord(obj.meta) ?? {} }, 200);
    }
    case "MF58": {
      const start = url.searchParams.get("start_date") ?? "";
      const end = url.searchParams.get("end_date") ?? "";
      if (!YMD_RE.test(start) || !YMD_RE.test(end)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const includeMeals = boolFlag(url.searchParams.get("include_meals"), true);
      const q = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&include_meals=${includeMeals ? "1" : "0"}`;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountMacrosRangePath(),
        { query: q },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      const entries = Array.isArray(obj.entries) ? obj.entries : [];
      return accountJson({ entries }, 200);
    }
    case "MF59": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountCalendarMealPath(id),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status === 204 ? 200 : mapped.status);
    }
    case "MF54": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const validated = validateCustomRecipeBody(parsed.json);
      if (!validated.ok) return accountJson({ error: "invalid_request" }, 400);
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountCustomRecipesPath(),
        { body: JSON.stringify(validated.body), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      return accountJson(obj.recipe ?? mapped.json, mapped.status === 201 ? 201 : mapped.status);
    }
    case "MF55": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCustomRecipePath(id),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      return accountJson(obj.recipe ?? mapped.json, 200);
    }
    case "MF56": {
      const id = match.params.id!;
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const validated = validateCustomRecipeBody(parsed.json);
      if (!validated.ok) return accountJson({ error: "invalid_request" }, 400);
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        accountCustomRecipePath(id),
        { body: JSON.stringify(validated.body), contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      return accountJson(obj.recipe ?? mapped.json, 200);
    }
    case "MF57": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountCustomRecipePath(id),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status === 204 ? 200 : mapped.status);
    }
    case "MF61": {
      const id = match.params.id!;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPlanAclPath(id),
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { entries: [] }, 200);
    }
    case "MF62": {
      const id = match.params.id!;
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = asRecord(parsed.json) ?? {};
      const userId = body.user_id;
      const uid =
        typeof userId === "number"
          ? userId
          : typeof userId === "string" && /^[1-9][0-9]{0,9}$/.test(userId)
            ? Number(userId)
            : null;
      if (uid == null) return accountJson({ error: "invalid_request" }, 400);
      const permission = body.permission === "edit" ? "edit" : "view";
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPlanAclPath(id),
        {
          body: JSON.stringify({ user_id: uid, permission }),
          contentType: "application/json",
        },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson(mapped.json ?? { ok: true }, mapped.status);
    }
    case "MF60": {
      const start = url.searchParams.get("start_date") ?? "";
      const end = url.searchParams.get("end_date") ?? "";
      if (!YMD_RE.test(start) || !YMD_RE.test(end)) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const q = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountShoppingListGeneratedDatesPath(),
        { query: q },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      const obj = asRecord(mapped.json) ?? {};
      const dates = Array.isArray(obj.dates)
        ? obj.dates.filter((d): d is string => typeof d === "string" && YMD_RE.test(d))
        : Array.isArray(mapped.json)
          ? (mapped.json as unknown[]).filter(
              (d): d is string => typeof d === "string" && YMD_RE.test(d),
            )
          : [];
      return accountJson({ dates }, 200);
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
    case "MF15": {
      const range = parseYmdRange(
        url.searchParams.get("start_date"),
        url.searchParams.get("end_date"),
      );
      if (!range) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCalendarWorkoutsPath(),
        { query: `start_date=${range.start}&end_date=${range.end}` },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeWorkoutLogs(proxied.json), 200);
    }
    case "MF16": {
      const range = parseYmdRange(
        url.searchParams.get("start_date"),
        url.searchParams.get("end_date"),
      );
      if (!range) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCalendarPlannedWorkoutsPath(),
        { query: `start_date=${range.start}&end_date=${range.end}` },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapePlannedWorkouts(proxied.json), 200);
    }
    case "MF17": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountWorkoutLogPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapeWorkoutLog(proxied.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson({ workout: shaped }, 200);
    }
    case "MF18": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountWorkoutLogPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF19": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountPlannedWorkoutPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF20": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validateLogWorkoutBody(parsed.json);
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountWorkoutsCollectionPath(),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      const shaped =
        shapeWorkoutLog(proxied.json) ?? shapeWorkoutLog(asRecord(proxied.json)?.workout);
      return accountJson({ ok: true, workout: shaped }, 200);
    }
    case "MF21": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const names = url.searchParams.get("include_movement_names") === "1";
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCustomWorkoutPath(String(id)),
        names ? { query: "include_movement_names=1" } : undefined,
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapeCustomWorkout(proxied.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "MF37": {
      const query = customWorkoutListQuery(url.searchParams);
      if (!query) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountCustomWorkoutsPath(),
        { query },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeCustomWorkoutList(proxied.json), 200);
    }
    case "MF37w": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validateCustomWorkoutBody(parsed.json, "create");
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountCustomWorkoutsPath(),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapeCustomWorkout(proxied.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "MF38": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validateCustomWorkoutBody(parsed.json, "update");
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        accountCustomWorkoutPath(String(id)),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapeCustomWorkout(proxied.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson(shaped, 200);
    }
    case "MF39": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountCustomWorkoutPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF40": {
      const query = movementQuery(url.searchParams);
      if (!query) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountMovementsPath(),
        { query },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeMovementList(proxied.json), 200);
    }
    case "MF49": {
      const query = dailyFixQuery(url.searchParams);
      if (!query) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountDailyFixWorkoutPath(),
        { query },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeDailyFixWorkout(proxied.json), 200);
    }
    case "MF41": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPlansCollectionPath(),
        { query: "limit=30&offset=0" },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapePlanList(proxied.json), 200);
    }
    case "MF42": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validatePlanWriteBody(parsed.json, "create");
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPlansCollectionPath(),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      const shaped =
        shapePlanDetail(proxied.json) ?? shapePlanDetail(asRecord(proxied.json)?.plan);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson({ ...shaped, plan: shaped }, 200);
    }
    case "MF43": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPlanPath(String(id)),
        { query: "include_days=1" },
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapePlanDetail(proxied.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson({ ...shaped, plan: shaped }, 200);
    }
    case "MF44": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validatePlanWriteBody(parsed.json, "update");
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        accountPlanPath(String(id)),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapePlanDetail(proxied.json);
      if (!shaped) return accountJson({ error: "unavailable" }, 502);
      return accountJson({ ...shaped, plan: shaped }, 200);
    }
    case "MF45": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountPlanPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF46": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPlanPublishPath(String(id)),
        { jsonBody: {} },
      );
      if (proxied instanceof Response) return proxied;
      const shaped = shapePlanDetail(proxied.json);
      return accountJson({ ok: true, plan: shaped }, 200);
    }
    case "MF47": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const query = planScheduleQuery(url.searchParams);
      if (!query) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPlanSchedulePath(String(id)),
        { query },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF48": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validatePlanActiveBody(parsed.json);
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PATCH",
        accountPlanActivePath(String(id)),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF22": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPtClientCoachesPath(),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeCoachingClient(proxied.json), 200);
    }
    case "MF23": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPtCoachClientsPath(),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeCoachingCoach(proxied.json), 200);
    }
    case "MF24": {
      const query = directoryQuery(url.searchParams);
      if (!query) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPtDirectoryPath(),
        { query },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeDirectory(proxied.json), 200);
    }
    case "MF25": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validatePtInviteBody(parsed.json);
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPtRelationshipsPath(),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF26": {
      const id = parseRouteId(match.params.id);
      const action = match.params.action;
      if (!id || (action !== "accept" && action !== "decline" && action !== "end")) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPtRelationshipActionPath(String(id), action),
        { jsonBody: {} },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF27": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPtRelationshipNotesPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeCoachNotes(proxied.json), 200);
    }
    case "MF28": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validateCoachNoteBody(parsed.json);
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountPtRelationshipNotesPath(String(id)),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      const note =
        shapeCoachNote(proxied.json) ?? shapeCoachNote(asRecord(proxied.json)?.note);
      return accountJson({ ok: true, note }, 200);
    }
    case "MF29": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountProgrammingSubscriptionsPath(),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeProgrammingSubscriptions(proxied.json), 200);
    }
    case "MF30": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountProgrammingSeriesPath(),
        { query: "limit=30&offset=0" },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeProgrammingSeriesList(proxied.json), 200);
    }
    case "MF31": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const range = parseYmdRange(
        url.searchParams.get("start_date"),
        url.searchParams.get("end_date"),
        120,
      );
      const query = range ? `start_date=${range.start}&end_date=${range.end}` : undefined;
      if (
        (url.searchParams.get("start_date") || url.searchParams.get("end_date")) &&
        !range
      ) {
        return accountJson({ error: "invalid_request" }, 400);
      }
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountProgrammingSeriesDaysPath(String(id)),
        { query },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeProgrammingDays(proxied.json), 200);
    }
    case "MF32": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const ran = await runBearer(
        ctx!,
        env,
        fetchImpl,
        opts,
        "POST",
        accountProgrammingSubscribePath(String(id)),
        { body: "{}", contentType: "application/json" },
      );
      if (ran instanceof Response) return mapUnauthenticated(ran);
      if (ran.result.kind === "http" && ran.result.status === 402) {
        return accountJson({ error: "payment_required" }, 402);
      }
      const mapped = mapUpstreamResult(ran.result);
      if (mapped instanceof Response) return mapped;
      return accountJson({ ok: true }, 200);
    }
    case "MF33": {
      const id = parseRouteId(match.params.id);
      if (!id) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "DELETE",
        accountProgrammingSubscriptionPath(String(id)),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson({ ok: true }, 200);
    }
    case "MF34": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPlansLibraryPath(),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapePlanLibrary(proxied.json), 200);
    }
    case "MF35": {
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "GET",
        accountPtCoachProfilePath(),
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeCoachProfile(proxied.json), 200);
    }
    case "MF36": {
      const parsed = await readJsonBody(request);
      if (parsed instanceof Response) return parsed;
      const body = validateCoachProfileBody(parsed.json);
      if (!body.ok) return accountJson({ error: "invalid_request" }, 400);
      const proxied = await accountProxy(
        ctx!,
        env,
        fetchImpl,
        opts,
        "PUT",
        accountPtCoachProfilePath(),
        { jsonBody: body.body },
      );
      if (proxied instanceof Response) return proxied;
      return accountJson(shapeCoachProfile(proxied.json), 200);
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
    // Public routes only: attach a bearer when a sid resolves; ignore a dead sid.
    const resolved = await resolveAccountSession(request, env, fetchImpl, opts);
    if (!(resolved instanceof Response)) ctx = resolved;
  }

  if (match.method !== "GET" && match.method !== "HEAD") {
    if (match.public) {
      // Guest or signed-in: Origin + Sec-Fetch-Site + sid/pre CSRF.
      const csrf = await requireCsrf(request, env);
      if (!csrf.ok) {
        // Normalize to accountJson (private, no-store) — authJson uses bare no-store.
        if (timingSafeEqualStr(String(csrf.response.status), "503")) {
          return accountJson({ error: "unavailable" }, 503, {
            "Retry-After": csrf.response.headers.get("Retry-After") ?? "300",
          });
        }
        return accountJson({ error: "forbidden" }, 403);
      }
    } else {
      if (!ctx) return accountJson({ error: "unauthenticated" }, 401);
      const csrfFail = await requireSidCsrf(request, env, ctx.sid, accountJson);
      if (csrfFail) return csrfFail;
    }
  }

  const limitKey = match.public
    ? `ip:${await sha256Hex(clientIp(request))}`
    : await accountRateLimitKey(ctx!);
  const limited = await checkAccountLimit(env, match.limiter, limitKey);
  if (limited) return limited;

  return dispatch(match, request, env, fetchImpl, opts, ctx);
}
