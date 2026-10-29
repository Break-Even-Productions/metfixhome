/**
 * Account dashboard client store — module single-flight cache for /api/account/*.
 * Never fetch /api/auth/me here; callers use loadMe() from session.ts.
 */
import { getMetfixLoginUrl } from "@/const";
import { sanitizeClientBillingUrl } from "@/lib/billing-url";
import type { FoundationsCoachStatus } from "@shared/account/foundations-coach";
import type { CanonicalSubscriptionTier, LegacySubscriptionSource } from "@shared/account/tiers";
import { sanitizeReturnPath as sanitizeReturnPathShared } from "@shared/sanitize-return-path";

export type AccountOverview = {
  user_id: number | string | null;
  member_id: number | string | null;
  display_name: string;
  email: string | null;
  member_since: string | null;
  badges: {
    medical: boolean;
    affiliate: boolean;
    subscription: boolean;
    foundations_coach: boolean;
  };
  canonical_tier: CanonicalSubscriptionTier;
  foundations_coach: FoundationsCoachStatus;
  tabs: unknown[];
  links: Record<string, unknown>;
  avatar_url?: string | null;
};

export type SubscriptionItem = {
  sub_ref: string;
  provider: "whop" | "stripe";
  tier: CanonicalSubscriptionTier;
  legacy_source?: LegacySubscriptionSource;
  is_duplicate_stripe?: boolean;
  can_convert_to_whop?: boolean;
  status: string;
  current_period_end: string | null;
  paid_through: string | null;
  cancel_at_period_end: boolean;
  card: { brand: string; last4: string } | null;
};

export type SubscriptionConversion = {
  state: "awaiting_checkout" | "completed" | "none";
  target_tier?: "metfix_pro" | "organization_owner";
  purchase_url?: string;
  trial_period_days?: number;
  stripe_period_end?: string;
};

export type AccountSubscriptions = {
  canonical_tier: CanonicalSubscriptionTier;
  items: SubscriptionItem[];
  conversion?: SubscriptionConversion;
};

export type ClaimedCertificate = {
  course_id: number | string | null;
  course_slug: string | null;
  course_title: string | null;
  allocated_cents: number;
  claimed_at: string | null;
  claim_method: "ltv" | "direct_purchase" | null;
  certificate_url?: string;
};

export type LtvCertificates = {
  total_ltv_cents: number;
  claimed_courses_value_cents: number;
  available_certificate_ltv_cents: number;
  claimed_certificates: ClaimedCertificate[];
  canonical_tier: CanonicalSubscriptionTier;
  foundations_coach: FoundationsCoachStatus;
};

export type PaymentItem = {
  id: number | string | null;
  created_at: string | null;
  description: string;
  amount_cents: number;
  currency: string;
  provider: "whop" | "stripe" | "woo";
  status: string;
  receipt_url?: string;
};

export type PaymentsPage = {
  items: PaymentItem[];
  page: number;
  per_page: number;
  total: number;
};

export type CourseItem = {
  id: number | string | null;
  slug: string | null;
  title: string | null;
  progress_percent: number;
  completed: boolean;
  is_metfix_essentials: boolean;
  course_price_cents: number;
  included_with_subscription: boolean;
  purchased_directly: boolean;
  certificate_claimed: boolean;
  certificate_claim_method: "ltv" | "direct_purchase" | null;
  certificate_url: string | null;
};

export type CoursesPage = {
  items: CourseItem[];
  page: number;
  per_page: number;
  total: number;
};

export type AccountProfile = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  bio?: string | null;
  location?: string | null;
  credentials?: string | null;
  community_opt_in?: boolean;
  avatar_url?: string | null;
  attributes?: Array<{ attr_id: number; key?: string; name?: string; value?: string }>;
  [key: string]: unknown;
};

export type FavoriteItem = {
  source_type: string;
  source_id: string;
  title?: string | null;
  url?: string | null;
  [key: string]: unknown;
};

export type FavoritesPage = {
  items: FavoriteItem[];
  [key: string]: unknown;
};

export type ReferralsPayload = {
  referral_code?: string | null;
  earnings?: unknown;
  [key: string]: unknown;
};

export type CourseGiftsPayload = {
  items: Array<{
    code?: string;
    course_title?: string | null;
    status?: string | null;
    redeemed_at?: string | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type NotificationsPayload = {
  preferences?: Record<string, boolean>;
  newsletter?: boolean;
  [key: string]: unknown;
};

export type PrivacyPayload = {
  directory_visible?: boolean;
  profile_public?: boolean;
  [key: string]: unknown;
};

export type MemberSummary = {
  member_id: number | string | null;
  display_name: string;
  bio: string | null;
  location: string | null;
  badges: {
    medical: boolean;
    affiliate: boolean;
    foundations_coach: boolean;
  };
};

type CacheKey =
  | "overview"
  | "subscriptions"
  | "ltv"
  | "courses"
  | "profile"
  | "favorites"
  | "referrals"
  | "gifts"
  | "notifications"
  | "privacy"
  | `payments:${number}:${number}`
  | `favorites:${string}`
  | `member:${string}`;

const cache = new Map<CacheKey, unknown>();
const inflight = new Map<CacheKey, Promise<unknown>>();

/** Single in-flight LTV certificate claim (CQ §1.2 / CERT3b). */
let claimInflight: Promise<unknown> | null = null;

export function isClaimInFlight(): boolean {
  return claimInflight != null;
}

function withCallerAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/** Same rules as Worker sanitizeReturnPath; invalid → `/account`. */
export function sanitizeReturnPath(raw: string | null | undefined): string {
  return sanitizeReturnPathShared(raw) ?? "/account";
}

function redirectToLogin(currentPath?: string): never {
  clearAccountCache();
  const path =
    currentPath ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/account");
  const next = sanitizeReturnPath(path);
  if (typeof window !== "undefined") {
    window.location.assign(getMetfixLoginUrl(next));
  }
  throw new Error("unauthenticated");
}

export function clearAccountCache(): void {
  cache.clear();
  inflight.clear();
  claimInflight = null;
}

function invalidateKeys(keys: CacheKey[]): void {
  for (const key of keys) {
    cache.delete(key);
    inflight.delete(key);
  }
}

async function fetchCsrf(): Promise<string | null> {
  try {
    const res = await globalThis.fetch("/api/auth/csrf", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { csrf?: unknown };
    return typeof json.csrf === "string" && json.csrf ? json.csrf : null;
  } catch {
    return null;
  }
}

async function accountGet<T>(
  path: string,
  cacheKey: CacheKey,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<T> {
  if (!options?.force && cache.has(cacheKey)) {
    return withCallerAbort(Promise.resolve(cache.get(cacheKey) as T), options?.signal);
  }
  if (!options?.force && inflight.has(cacheKey)) {
    return withCallerAbort(inflight.get(cacheKey) as Promise<T>, options?.signal);
  }

  const shared = (async () => {
    const res = await globalThis.fetch(path, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (res.status === 401) {
      redirectToLogin();
    }
    if (!res.ok) {
      throw new Error(`account_get_failed:${res.status}`);
    }
    const json = (await res.json()) as T;
    cache.set(cacheKey, json);
    inflight.delete(cacheKey);
    return json;
  })().catch((err) => {
    inflight.delete(cacheKey);
    throw err;
  });

  inflight.set(cacheKey, shared);
  return withCallerAbort(shared, options?.signal);
}

async function accountMutate<T>(
  path: string,
  init: {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    bodyInit?: BodyInit;
    contentType?: string | null;
    invalidate?: CacheKey[];
  },
): Promise<T> {
  const csrf = await fetchCsrf();
  if (!csrf) throw new Error("csrf_unavailable");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-CSRF-Token": csrf,
  };
  let body: BodyInit | undefined = init.bodyInit;
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  } else if (init.contentType) {
    headers["Content-Type"] = init.contentType;
  } else if (init.contentType === null) {
    // multipart — browser sets boundary
  }

  const res = await globalThis.fetch(path, {
    method: init.method,
    headers,
    body,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    redirectToLogin();
  }
  if (!res.ok) {
    let errBody: unknown = null;
    try {
      errBody = await res.json();
    } catch {
      /* ignore */
    }
    const err = new Error(`account_mutate_failed:${res.status}`) as Error & {
      status: number;
      body: unknown;
    };
    err.status = res.status;
    err.body = errBody;
    throw err;
  }
  if (init.invalidate) invalidateKeys(init.invalidate);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("Content-Type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export function loadOverview(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<AccountOverview> {
  return accountGet("/api/account/overview", "overview", options);
}

export function loadSubscriptions(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<AccountSubscriptions> {
  return accountGet("/api/account/subscriptions", "subscriptions", options);
}

export function loadLtvCertificates(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<LtvCertificates> {
  return accountGet("/api/account/ltv-certificates", "ltv", options);
}

export function loadPayments(
  page = 1,
  perPage = 20,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<PaymentsPage> {
  const key: CacheKey = `payments:${page}:${perPage}`;
  return accountGet(
    `/api/account/payments?page=${page}&per_page=${perPage}`,
    key,
    options,
  );
}

export function loadCourses(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<CoursesPage> {
  return accountGet("/api/account/courses", "courses", options);
}

export function loadProfile(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<AccountProfile> {
  return accountGet("/api/account/profile", "profile", options);
}

export function loadFavorites(
  type: "all" | "articles" | "recipes" | "workouts" | "videos" = "all",
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<FavoritesPage> {
  const key: CacheKey = `favorites:${type}`;
  const q = type === "all" ? "" : `?type=${encodeURIComponent(type)}`;
  return accountGet(`/api/account/favorites${q}`, key, options);
}

export function loadReferrals(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<ReferralsPayload> {
  return accountGet("/api/account/referrals", "referrals", options);
}

export function loadCourseGifts(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<CourseGiftsPayload> {
  return accountGet("/api/account/course-gifts", "gifts", options);
}

export function loadNotifications(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<NotificationsPayload> {
  return accountGet("/api/account/notifications", "notifications", options);
}

export function loadPrivacy(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<PrivacyPayload> {
  return accountGet("/api/account/privacy", "privacy", options);
}

export function loadMember(
  memberId: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<MemberSummary> {
  return accountGet(`/api/members/${encodeURIComponent(memberId)}`, `member:${memberId}`, options);
}

export async function claimCertificate(courseId: string | number): Promise<unknown> {
  if (claimInflight) return claimInflight;
  const shared = accountMutate(`/api/account/courses/${courseId}/claim-certificate`, {
    method: "POST",
    body: { method: "ltv" },
    invalidate: ["ltv", "courses", "overview"],
  }).finally(() => {
    claimInflight = null;
  });
  claimInflight = shared;
  return shared;
}

export async function purchaseCourseCheckout(
  courseId: string | number,
): Promise<{ checkout_url?: string }> {
  return accountMutate(`/api/account/courses/${courseId}/purchase-checkout`, {
    method: "POST",
    body: {},
  });
}

export async function convertToWhop(body: {
  sub_ref?: string;
  target_tier: "metfix_pro" | "organization_owner";
}): Promise<{ purchase_url?: string; trial_period_days?: number; stripe_period_end?: string }> {
  return accountMutate("/api/account/subscriptions/convert-to-whop", {
    method: "POST",
    body,
    invalidate: ["subscriptions", "overview"],
  });
}

export async function cancelDuplicate(
  subRef: string,
  atPeriodEnd: boolean,
): Promise<unknown> {
  return accountMutate(
    `/api/account/subscriptions/${encodeURIComponent(subRef)}/cancel-duplicate`,
    {
      method: "POST",
      body: { at_period_end: atPeriodEnd },
      invalidate: ["subscriptions", "overview"],
    },
  );
}

export async function portalLink(body: {
  sub_ref?: string;
  tier?: "metfix_pro" | "organization_owner";
  intent: "manage" | "upgrade" | "cancel_duplicate";
}): Promise<{ url?: string }> {
  return accountMutate("/api/account/subscriptions/portal-link", {
    method: "POST",
    body,
  });
}

export async function updateProfile(patch: Record<string, unknown>): Promise<AccountProfile> {
  return accountMutate("/api/account/profile", {
    method: "PATCH",
    body: patch,
    invalidate: ["profile", "overview"],
  });
}

export async function updateProfileAttributes(
  attributes: Array<{ attr_id: number; value: string }>,
): Promise<unknown> {
  return accountMutate("/api/account/profile/attributes", {
    method: "POST",
    body: { attributes },
    invalidate: ["profile"],
  });
}

export async function uploadProfilePicture(file: File): Promise<unknown> {
  const buf = await file.arrayBuffer();
  return accountMutate("/api/account/profile/picture", {
    method: "POST",
    bodyInit: buf,
    contentType: file.type || "application/octet-stream",
    invalidate: ["profile", "overview"],
  });
}

export async function setFavorite(
  sourceType: string,
  sourceId: string,
  desired: boolean,
): Promise<unknown> {
  const path = `/api/account/favorites/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`;
  return accountMutate(path, {
    method: desired ? "PUT" : "DELETE",
    body: desired ? {} : undefined,
    invalidate: ["favorites", "favorites:all", "favorites:articles", "favorites:recipes", "favorites:workouts", "favorites:videos"],
  });
}

export async function referralCodeAction(
  action: "generate" | "rotate" | "revoke",
): Promise<ReferralsPayload> {
  return accountMutate("/api/account/referral-code", {
    method: "POST",
    body: { action },
    invalidate: ["referrals"],
  });
}

export async function updateNotifications(
  payload: Record<string, unknown>,
): Promise<NotificationsPayload> {
  return accountMutate("/api/account/notifications", {
    method: "PUT",
    body: payload,
    invalidate: ["notifications"],
  });
}

export async function updatePrivacy(payload: Record<string, unknown>): Promise<PrivacyPayload> {
  return accountMutate("/api/account/privacy", {
    method: "PUT",
    body: payload,
    invalidate: ["privacy"],
  });
}

export async function requestPasswordReset(): Promise<unknown> {
  return accountMutate("/api/account/password-reset", {
    method: "POST",
    body: {},
  });
}

export async function requestEmailChange(email: string): Promise<unknown> {
  return accountMutate("/api/account/email", {
    method: "PUT",
    body: { email },
  });
}

export async function confirmEmailChange(code: string): Promise<unknown> {
  return accountMutate("/api/account/email/confirm", {
    method: "POST",
    body: { code },
  });
}

/** Safe assign for Whop/Stripe billing URLs. */
export function assignBillingUrl(
  raw: unknown,
  mode: "whop_only" | "billing_portal" = "billing_portal",
): boolean {
  const url = sanitizeClientBillingUrl(raw, mode);
  if (!url) return false;
  window.location.assign(url);
  return true;
}

export function safeBillingHref(
  raw: unknown,
  mode: "whop_only" | "billing_portal" = "billing_portal",
): string | null {
  return sanitizeClientBillingUrl(raw, mode);
}

export type MembershipStatusLabel =
  | "Active"
  | "Trialing"
  | "Past Due"
  | "Canceling at Period End"
  | "Free";

export function deriveMembershipStatus(
  subs: AccountSubscriptions | null | undefined,
): MembershipStatusLabel {
  if (!subs || subs.canonical_tier === "free" || subs.items.length === 0) return "Free";
  const primary =
    subs.items.find((i) => !i.is_duplicate_stripe) ?? subs.items[0];
  if (!primary) return "Free";
  if (primary.cancel_at_period_end) return "Canceling at Period End";
  const s = primary.status.toLowerCase();
  if (s === "trialing" || s === "trial") return "Trialing";
  if (s === "past_due" || s === "past due") return "Past Due";
  if (s === "active" || s === "paid") return "Active";
  if (s.includes("cancel")) return "Canceling at Period End";
  return "Active";
}

export function formatNextPayment(
  subs: AccountSubscriptions | null | undefined,
  status: MembershipStatusLabel,
): string {
  if (status === "Free") return "Free Tier";
  const primary =
    subs?.items.find((i) => !i.is_duplicate_stripe) ?? subs?.items[0];
  if (!primary) return "Free Tier";
  const iso =
    status === "Canceling at Period End"
      ? primary.current_period_end ?? primary.paid_through
      : primary.paid_through ?? primary.current_period_end;
  if (!iso) return status === "Canceling at Period End" ? "Cancels soon" : "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const formatted = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return status === "Canceling at Period End" ? `Cancels ${formatted}` : formatted;
}
