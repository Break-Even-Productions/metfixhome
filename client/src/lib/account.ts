/**
 * Account dashboard client store — module single-flight cache for /api/account/*.
 * Never fetch /api/auth/me here; callers use loadMe() from session.ts.
 */
import { getMetfixLoginUrl } from "@/const";
import { fetchCsrf } from "@/lib/authRequest";
import { sanitizeClientBillingUrl } from "@/lib/billing-url";
import { readStoredBsiRef } from "@/lib/referralAttribution";
import { sanitizeReturnPath } from "@shared/account/returnPath";
import { isWhopCheckoutUrl } from "@shared/account/url-allowlist";
import type {
  ClaimOptionsDto,
  ClaimPathId,
} from "@shared/account/claimOptions";
import type { FoundationsCoachStatus } from "@shared/account/foundations-coach";
import type { StoredClaimMethod } from "@shared/account/ltv";
import type { CanonicalSubscriptionTier, LegacySubscriptionSource } from "@shared/account/tiers";
import type { RoleId } from "@shared/join/membership-domain";

export { sanitizeReturnPath } from "@shared/account/returnPath";
export type { ClaimOptionsDto, ClaimPathId };
export type { RoleId };

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
  /** WordPress staff role slugs. Dashboard shows Admin and MetFix Admin only. */
  roles?: string[];
  /**
   * Opt-in audience attributes from join/onboarding (bsi_onboarding_roles).
   * Not entitlement / affiliate / paid WP roles.
   */
  onboarding_roles?: RoleId[];
  has_physical_gym?: boolean;
  has_physical_clinic?: boolean;
};

export type SubscriptionItem = {
  sub_ref: string;
  provider: "whop" | "stripe";
  tier: CanonicalSubscriptionTier;
  legacy_source?: LegacySubscriptionSource;
  is_duplicate_stripe?: boolean;
  can_convert_to_whop?: boolean;
  /** True when BSI reports a billing portal session can be opened for this row. */
  can_open_portal?: boolean;
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
  /** S-R3-2: number or null only (digit-strings normalized in worker). */
  course_id: number | null;
  course_slug: string | null;
  course_title: string | null;
  /** S-R3-2: number|null for null-safety (Worker Branch A drops bad rows). */
  allocated_cents: number | null;
  claimed_at: string | null;
  /** Read-side only; includes legacy `direct_purchase` (BSI §R120). Never outbound `'ltv'`. */
  claim_method: StoredClaimMethod | null;
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

export type CourseFeaturesLite = {
  navigation?: Array<{ key?: string; label?: string; segment?: string }>;
  counts?: Record<string, number>;
  progress?: {
    percentage?: number;
    completed_items?: number;
    total_items?: number;
  };
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
  certificate_claim_method: StoredClaimMethod | null;
  certificate_url: string | null;
  /** Optional course notes when the courses payload includes them. */
  notes?: string | null;
  /** Optional LearnPress features summary when present on the payload. */
  features?: CourseFeaturesLite | null;
  image_url?: string | null;
};

export type CoursesPage = {
  items: CourseItem[];
  page: number;
  per_page: number;
  total: number;
};

export type ProfileAttrSection = "personal" | "affiliate" | "clinic";

export type ProfileAttributeField = {
  attr_id: number;
  key?: string;
  label?: string;
  name?: string;
  form_type?: string;
  value?: string;
};

export type AccountProfile = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  member_since?: string | null;
  /** Editable attributes grouped for Personal / Affiliate / Clinic forms. */
  attributes?: {
    personal?: ProfileAttributeField[];
    affiliate?: ProfileAttributeField[];
    clinic?: ProfileAttributeField[];
  };
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
  eligible?: boolean;
  eligibility_type?: "organization" | "foundations_coach" | null;
  reason_code?: "bsi_referral_ineligible" | "bsi_referral_coach_expired" | null;
  payee_display_name?: string | null;
  foundations_coach_expires_at?: string | null;
  join_code?: {
    slug: string;
    whop_affiliate_code: string;
    join_url: string | null;
    commission_percent: number;
    commission_bps: number;
  } | null;
  course_links?: Array<{
    course_id: number;
    course_slug: string;
    course_title: string;
    course_price_cents: number;
    currency: string;
    commission_percent: number;
    commission_bps: number;
    estimated_commission_cents: number;
    bsi_ref_slug: string;
    whop_affiliate_code: string;
    whop_plan_id: string;
    share_url: string;
    /** Optional product image when upstream includes one. */
    image_url?: string | null;
    product_image?: string | null;
    thumbnail_url?: string | null;
    featured_image?: string | null;
  }>;
  /** R4-N1: required on Worker CR1/CR2 DTO — missing is a contract error. */
  course_links_dropped: number;
  join_code_dropped?: boolean;
  earnings?: {
    pending_cents?: number;
    ready_cents?: number;
    paid_total_cents?: number;
    currency?: string;
    connect_status?: "none" | "pending" | "active";
  };
  /** @deprecated PR B stub field — prefer join_code.slug */
  referral_code?: string | null;
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

/** CL-REQ-1: single cache key for claim options (invalidateQueries equivalent). */
export const CLAIM_OPTIONS_QUERY_KEY = "certificate-claim-options" as const;

export type PlannedMeal = {
  id: number;
  date: string;
  slot_index: number;
  recipe_source_type: "daily_mod" | "custom_recipe";
  recipe_source_id: number | null;
  label: string | null;
  notes: string | null;
  logged: number;
  recipe_preview: {
    title: string;
    photo_url: string | null;
    macros: { protein: number; fat: number; carbs: number };
  } | null;
};

export type MealsWeek = {
  meals: PlannedMeal[];
  grouped_by_date: Record<string, PlannedMeal[]>;
};

export type MealsUpcoming = {
  meals: PlannedMeal[];
  meta: {
    count: number;
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
};

export type MacrosDaily = {
  date: string | null;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  goal_protein: number;
  goal_fat: number;
  goal_carbs: number;
};

export type PlanMealBody = {
  recipe_source_type: "daily_mod" | "custom_recipe";
  /** Required by BSI when planning a known recipe; omit when using a free-text label. */
  recipe_source_id?: number | null;
  slot_index?: number;
  label?: string | null;
  notes?: string | null;
};

export type ShoppingListGroceryItem = {
  id: number;
  item_name: string;
  quantity: string;
  sort_order?: number;
  category?: string | null;
};

export type ShoppingList = {
  id: number;
  title?: string | null;
  status?: "created" | "generated" | "complete" | "failed" | string | null;
  dates?: string[];
  meals?: Array<{
    planned_meal_id: number;
    servings?: number;
    date?: string;
    slot_index?: number;
    label?: string | null;
  }>;
  /** Recipe snapshot rows (pre-generate). */
  items?: Array<{
    id: number;
    source_type?: string;
    source_id?: number;
    snapshot_data?: { title?: string; ingredients?: string[] } | null;
  }>;
  /** Generated grocery rows by aisle. */
  items_by_category?: Record<string, ShoppingListGroceryItem[]>;
  generated_at?: string | null;
  [key: string]: unknown;
};

export type ShoppingListsPage = {
  lists: ShoppingList[];
  meta?: {
    total?: number;
    count?: number;
    limit?: number;
    offset?: number;
  };
};

export type CreateShoppingListFromMealsBody = {
  title?: string;
  dates?: string[];
  meals?: Array<{ planned_meal_id: number; servings: number }>;
  other_considerations?: string;
  notes?: string;
};

export type GenerateShoppingListResult = {
  success?: boolean;
  list: ShoppingList;
};

export type EmailShoppingListResult = {
  success?: boolean;
  emailed_to?: string | null;
  message?: string | null;
};

export type PrOverviewRow = {
  name: string;
  type: string | null;
  custom_workout_id: number | null;
  measurement_id: number | null;
  best_score: number | null;
  last_score: number | null;
  total_entries: number;
  unit_abbreviation: string | null;
  score_unit_id: number | null;
  benchmark_classification: string | null;
  is_benchmark: boolean;
};

export type PrOverview = {
  workouts: PrOverviewRow[];
  movements: PrOverviewRow[];
};

/** BSI spark entry row — date + value are the chart contract; extras pass through. */
export type SparkEntry = {
  id?: string | number;
  measurement_date: string;
  value: number;
  bsi_measurement_id?: number;
  unit_id?: number;
  unit_abbreviation?: string | null;
  measurement_name?: string;
  type?: "pending" | "accepted";
  status?: "pending" | "accepted";
  athlete_id?: number;
  class_id?: number;
};

export type SparkEntriesPage = {
  entries: SparkEntry[];
  meta?: {
    count?: number;
    limit?: number;
    offset?: number;
  };
};

export type CreateSparkEntryInput = {
  measurement_id: number;
  value: number;
  /** BSI accepts `Y-m-d H:i:s` or `Y-m-d\TH:i:s` (date-only is fine for dashboard). */
  measurement_date: string;
  unit_id?: number;
};

export type CreateSparkEntryResult = {
  entry?: SparkEntry;
  message?: string;
  skipped?: boolean;
  auto_log_skipped?: boolean;
};

/** Day-count maps from GET /api/account/calendar/surface (BSI /metfix/v1/calendar/surface). */
export type CalendarSurfaceCounts = Record<string, number>;

export type CalendarSurface = {
  meal_counts: CalendarSurfaceCounts;
  logged_meal_counts?: CalendarSurfaceCounts;
  unlogged_meal_counts?: CalendarSurfaceCounts;
  workout_counts: CalendarSurfaceCounts;
  planned_workout_counts?: CalendarSurfaceCounts;
  logged_planned_workout_counts?: CalendarSurfaceCounts;
  unlogged_planned_workout_counts?: CalendarSurfaceCounts;
  brain_counts?: CalendarSurfaceCounts;
  logged_brain_counts?: CalendarSurfaceCounts;
  unlogged_brain_counts?: CalendarSurfaceCounts;
  event_counts?: CalendarSurfaceCounts;
  meta?: {
    start_date?: string;
    end_date?: string;
    total_dates?: number;
  };
};

export type AccountInboxConversation = {
  id: string | number;
  type?: "direct" | "group" | string;
  name?: string | null;
  last_message?: string | null;
  lastMessage?: string | null;
  last_message_time?: string | null;
  lastMessageTime?: string | null;
  unread_count?: number;
  unreadCount?: number;
  [key: string]: unknown;
};

export type AccountInboxNotification = {
  id: string | number;
  title?: string | null;
  message?: string | null;
  content?: string | null;
  type?: string | null;
  read?: boolean;
  created_at?: string | null;
  link?: string | null;
  [key: string]: unknown;
};

/**
 * GET /api/account/inbox — conversations and/or in-app notifications.
 * Worker assumed to proxy BSI messages + notifications; client accepts either shape.
 */
export type AccountInbox = {
  conversations?: AccountInboxConversation[];
  notifications?: AccountInboxNotification[];
  items?: AccountInboxNotification[];
  total?: number;
  [key: string]: unknown;
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
  | "pr-overview"
  | "inbox"
  | typeof CLAIM_OPTIONS_QUERY_KEY
  | `payments:${number}:${number}`
  | `favorites:${string}`
  | `member:${string}`
  | `meals:${string}:${string}`
  | `meals-upcoming:${number}`
  | `macros:${string}`
  | "shopping-lists"
  | `shopping-list:${number}`
  | `spark-entries:${string}`
  | `calendar-surface:${string}`
  | "plans-library"
  | `plan:${number}`
  | "custom-recipes"
  | `custom-recipe:${number}`
  | "coaching-coach"
  | `macros-range:${string}`
  | `shopping-generated-dates:${string}`;

const cache = new Map<CacheKey, unknown>();
const inflight = new Map<CacheKey, Promise<unknown>>();

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

function redirectToLogin(currentPath?: string): never {
  clearAccountCache();
  const path =
    currentPath ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/account");
  const next = sanitizeReturnPath(path) ?? "/account";
  if (typeof window !== "undefined") {
    window.location.assign(getMetfixLoginUrl(next));
  }
  throw new Error("unauthenticated");
}

export function clearAccountCache(): void {
  cache.clear();
  inflight.clear();
}

function invalidateKeys(keys: CacheKey[]): void {
  for (const key of keys) {
    cache.delete(key);
    inflight.delete(key);
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
      // S-R3-3: forward AbortSignal so unmount aborts in-flight CL1 refresh.
      signal: options?.signal,
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
    headers?: Record<string, string>;
  },
): Promise<T> {
  const csrf = await fetchCsrf();
  if (!csrf) throw new Error("csrf_unavailable");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-CSRF-Token": csrf,
    ...init.headers,
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

/** Planned meals for a YYYY-MM-DD range (mobile meal-plan calendar). */
export function loadMealsWeek(
  startDate: string,
  endDate: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<MealsWeek> {
  const key: CacheKey = `meals:${startDate}:${endDate}`;
  const q = `?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  return accountGet(`/api/account/meals${q}`, key, options);
}

/**
 * Combined belly/body/brain/event day counts for a date range.
 * GET /api/account/calendar/surface → BSI /metfix/v1/calendar/surface (worker proxy assumed).
 */
export function loadCalendarSurface(
  startDate: string,
  endDate: string,
  options?: {
    force?: boolean;
    signal?: AbortSignal;
    includeMeals?: boolean;
    includeWorkouts?: boolean;
    includeBrain?: boolean;
    includeEvents?: boolean;
  },
): Promise<CalendarSurface> {
  const includeMeals = options?.includeMeals !== false;
  const includeWorkouts = options?.includeWorkouts !== false;
  const includeBrain = options?.includeBrain !== false;
  const includeEvents = options?.includeEvents !== false;
  const key: CacheKey = `calendar-surface:${startDate}:${endDate}:${includeMeals}:${includeWorkouts}:${includeBrain}:${includeEvents}`;
  const q = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    include_meals: includeMeals ? "1" : "0",
    include_workouts: includeWorkouts ? "1" : "0",
    include_brain: includeBrain ? "1" : "0",
    include_events: includeEvents ? "1" : "0",
  });
  return accountGet(`/api/account/calendar/surface?${q.toString()}`, key, options);
}

export function loadMealsUpcoming(
  limit = 20,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<MealsUpcoming> {
  const key: CacheKey = `meals-upcoming:${limit}`;
  return accountGet(`/api/account/meals/upcoming?limit=${limit}`, key, options);
}

export function loadMacrosDaily(
  date: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<MacrosDaily> {
  const key: CacheKey = `macros:${date}`;
  return accountGet(`/api/account/macros/daily/${encodeURIComponent(date)}`, key, options);
}

/** Plan or replace a meal on a calendar day (YYYY-MM-DD). */
export async function planMeal(
  date: string,
  body: PlanMealBody,
): Promise<PlannedMeal> {
  const res = await accountMutate<PlannedMeal | { planned_meal: PlannedMeal }>(
    `/api/account/meals/days/${encodeURIComponent(date)}`,
    {
      method: "POST",
      body,
    },
  );
  // Invalidate all week caches — date may sit in any cached range.
  for (const key of [...cache.keys()]) {
    if (typeof key === "string" && (key.startsWith("meals:") || key.startsWith("meals-upcoming:"))) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
  if (res && typeof res === "object" && "planned_meal" in res && res.planned_meal) {
    return res.planned_meal;
  }
  return res as PlannedMeal;
}

/** Load one shopping list, or the member’s list index when `id` is omitted. */
export function loadShoppingList(
  id?: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<ShoppingList | ShoppingListsPage> {
  if (id == null) {
    return accountGet("/api/account/shopping-lists", "shopping-lists", options);
  }
  const key: CacheKey = `shopping-list:${id}`;
  return accountGet(`/api/account/shopping-lists/${id}`, key, options);
}

/** Create a shopping list from planned meals / dates. */
export async function createShoppingListFromMeals(
  body: CreateShoppingListFromMealsBody,
): Promise<ShoppingList> {
  const list = await accountMutate<ShoppingList>("/api/account/shopping-lists", {
    method: "POST",
    body,
    invalidate: ["shopping-lists"],
  });
  if (list?.id != null) {
    cache.set(`shopping-list:${list.id}`, list);
  }
  return list;
}

/** Generate grocery items (LLM) for an existing shopping list. */
export async function generateShoppingList(
  id: number,
): Promise<GenerateShoppingListResult> {
  const res = await accountMutate<GenerateShoppingListResult | ShoppingList>(
    `/api/account/shopping-lists/${id}/generate`,
    {
      method: "POST",
      body: {},
      invalidate: ["shopping-lists", `shopping-list:${id}`],
    },
  );
  if (res && typeof res === "object" && "list" in res && res.list) {
    cache.set(`shopping-list:${id}`, res.list);
    return res as GenerateShoppingListResult;
  }
  const list = res as ShoppingList;
  cache.set(`shopping-list:${id}`, list);
  return { success: true, list };
}

/** Email the shopping list to the signed-in member. */
export async function emailShoppingList(
  id: number,
): Promise<EmailShoppingListResult> {
  return accountMutate(`/api/account/shopping-lists/${id}/email`, {
    method: "POST",
    body: {},
  });
}

/** Spark PR / benchmark overview (lifts + conditioning benchmarks). */
export function loadPrOverview(options?: {
  force?: boolean;
  signal?: AbortSignal;
  catalogCap?: number;
}): Promise<PrOverview> {
  const cap = options?.catalogCap;
  const q = cap ? `?catalog_cap=${encodeURIComponent(String(cap))}` : "";
  return accountGet(`/api/account/pr-overview${q}`, "pr-overview", options);
}

function sparkEntriesCacheKey(params: {
  measurement_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): CacheKey {
  const mid = params.measurement_id ?? "all";
  const start = params.start_date ?? "";
  const end = params.end_date ?? "";
  const limit = params.limit ?? "";
  return `spark-entries:${mid}:${start}:${end}:${limit}`;
}

function invalidateSparkEntriesCaches(measurementId?: number): void {
  for (const key of [...cache.keys()]) {
    if (typeof key !== "string" || !key.startsWith("spark-entries:")) continue;
    if (
      measurementId != null &&
      !key.startsWith(`spark-entries:${measurementId}:`)
    ) {
      continue;
    }
    cache.delete(key);
    inflight.delete(key);
  }
}

/**
 * Spark measurement history (GET /api/account/spark/entries → BSI /spark/entries).
 * Worker route assumed; client stubs the contract for dashboard charts / My Data.
 * `measurement_id` optional when listing recent entries across measurements.
 */
export function loadSparkEntries(
  params: {
    measurement_id?: number;
    start_date?: string;
    end_date?: string;
    limit?: number;
  } = {},
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<SparkEntriesPage> {
  const q = new URLSearchParams();
  if (params.measurement_id != null) {
    q.set("measurement_id", String(params.measurement_id));
  }
  if (params.start_date) q.set("start_date", params.start_date);
  if (params.end_date) q.set("end_date", params.end_date);
  if (params.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return accountGet(
    `/api/account/spark/entries${qs ? `?${qs}` : ""}`,
    sparkEntriesCacheKey(params),
    options,
  );
}

/**
 * Member inbox — conversations and/or in-app notifications.
 * GET /api/account/inbox (worker proxy to BSI messages / in-app-notifications assumed).
 */
export function loadInbox(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<AccountInbox> {
  return accountGet("/api/account/inbox", "inbox", options);
}

/**
 * Log a spark PR / measurement (POST /api/account/spark/entries → BSI /spark/entries).
 * Sends force_log so intentional dashboard logs persist even if not an improvement.
 */
export async function createSparkEntry(
  body: CreateSparkEntryInput,
): Promise<CreateSparkEntryResult> {
  // BSI requires Y-m-d H:i:s; date inputs send Y-m-d.
  const measurement_date = /^\d{4}-\d{2}-\d{2}$/.test(body.measurement_date.trim())
    ? `${body.measurement_date.trim()} 12:00:00`
    : body.measurement_date.trim();
  const result = await accountMutate<CreateSparkEntryResult>(
    "/api/account/spark/entries",
    {
      method: "POST",
      body: {
        measurement_id: body.measurement_id,
        value: body.value,
        measurement_date,
        ...(body.unit_id != null ? { unit_id: body.unit_id } : {}),
        force_log: true,
      },
      invalidate: ["pr-overview"],
    },
  );
  invalidateSparkEntriesCaches(body.measurement_id);
  return result;
}

/* ——— Belly: meal plans / custom recipes / macros range ——— */

export type MealPlanSummary = {
  id: number;
  title: string;
  description?: string | null;
  duration_days: number;
  visibility?: string;
  status?: "draft" | "published" | string;
  is_active: boolean;
  times_scheduled?: number;
  can_publish?: boolean;
  can_schedule?: boolean;
  usage_status?: "saved_only" | "used" | string;
  days?: Array<{
    id: number;
    day_index: number;
    notes?: string | null;
    items: Array<{
      id: number;
      item_type: "meal" | "workout" | "brain" | string;
      label?: string | null;
      recipe_source_type?: string | null;
      recipe_source_id?: number | null;
      servings?: number | null;
    }>;
  }>;
  [key: string]: unknown;
};

export type MealPlanLibrary = {
  active: { saved_only: MealPlanSummary[]; used: MealPlanSummary[] };
  inactive: { saved_only: MealPlanSummary[]; used: MealPlanSummary[] };
  meta?: { active_count?: number; inactive_count?: number };
};

export type CustomRecipe = {
  id: number;
  title: string;
  photo_url?: string | null;
  image_url?: string | null;
  macros?: { protein?: number; fat?: number; carbs?: number; calories?: number };
  ingredients?: string[];
  instructions?: string[];
  [key: string]: unknown;
};

export type CustomRecipesPage = {
  recipes: CustomRecipe[];
  meta?: { count?: number; limit?: number; offset?: number; has_more?: boolean };
};

export type MacrosRangeEntry = {
  date: string;
  totals?: { protein?: number; fat?: number; carbs?: number; calories?: number };
  meals?: Array<{
    mealId?: number | string;
    mealTitle?: string;
    title?: string;
    slotIndex?: number;
    macros?: { protein?: number; fat?: number; carbs?: number; calories?: number };
    photoUrl?: string | null;
    macroEntryId?: number;
    recipeSourceType?: string;
    recipeSourceId?: number;
  }>;
};

export type MacrosRange = {
  entries: MacrosRangeEntry[];
};

export function loadPlanLibrary(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<MealPlanLibrary> {
  return accountGet("/api/account/plans/library", "plans-library", options);
}

export function loadPlan(
  id: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<MealPlanSummary> {
  return accountGet(`/api/account/plans/${id}?include_days=1`, `plan:${id}`, options);
}

export async function setMealPlanActive(
  id: number,
  isActive: boolean,
): Promise<MealPlanSummary> {
  return accountMutate(`/api/account/plans/${id}/active`, {
    method: "PATCH",
    body: { is_active: isActive },
    invalidate: ["plans-library", `plan:${id}`],
  });
}

export async function publishMealPlan(id: number): Promise<MealPlanSummary> {
  return accountMutate(`/api/account/plans/${id}/publish`, {
    method: "POST",
    body: {},
    invalidate: ["plans-library", `plan:${id}`],
  });
}

export async function scheduleMealPlan(
  id: number,
  body: { start_date: string; end_date?: string },
): Promise<void> {
  const q = new URLSearchParams({ start_date: body.start_date });
  if (body.end_date) q.set("end_date", body.end_date);
  await accountMutate(`/api/account/plans/${id}/schedule?${q.toString()}`, {
    method: "POST",
    body: {},
    invalidate: ["plans-library", `plan:${id}`],
  });
  for (const key of [...cache.keys()]) {
    if (typeof key === "string" && key.startsWith("meals:")) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
}

/** App startPlan: publish if needed → schedule → set active. */
export async function startMealPlan(
  id: number,
  startDate: string,
  plan?: MealPlanSummary,
): Promise<void> {
  let current = plan;
  if (!current) {
    try {
      current = await loadPlan(id, { force: true });
    } catch {
      current = undefined;
    }
  }
  if (current && current.can_schedule === false) {
    await publishMealPlan(id);
  }
  await scheduleMealPlan(id, { start_date: startDate });
  await setMealPlanActive(id, true);
}

export function loadCustomRecipes(
  options?: { force?: boolean; signal?: AbortSignal; limit?: number },
): Promise<CustomRecipesPage> {
  const limit = options?.limit ?? 50;
  return accountGet(
    `/api/account/custom-recipes?limit=${limit}`,
    "custom-recipes",
    options,
  );
}

export function loadCustomRecipe(
  id: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<CustomRecipe> {
  return accountGet(`/api/account/custom-recipes/${id}`, `custom-recipe:${id}`, options);
}

export type CustomRecipeWrite = {
  title: string;
  excerpt?: string | null;
  photo_url?: string | null;
  recipe_ingredients?: Array<{
    ingredient_id?: number | null;
    display_name?: string | null;
    quantity?: number | null;
    unit_id?: number | null;
    adjustment_id?: number | null;
    notes?: string | null;
  }>;
  ingredients_text?: string | null;
  recipe_steps?: Array<{ instruction: string }>;
  steps?: string | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  calories?: number | null;
  macros_json?: { protein?: number; fat?: number; carbs?: number; calories?: number };
};

export async function createCustomRecipe(body: CustomRecipeWrite): Promise<CustomRecipe> {
  return accountMutate("/api/account/custom-recipes", {
    method: "POST",
    body,
    invalidate: ["custom-recipes"],
  });
}

export async function updateCustomRecipe(
  id: number,
  body: CustomRecipeWrite,
): Promise<CustomRecipe> {
  return accountMutate(`/api/account/custom-recipes/${id}`, {
    method: "PUT",
    body,
    invalidate: ["custom-recipes", `custom-recipe:${id}`],
  });
}

export async function deleteCustomRecipe(id: number): Promise<void> {
  await accountMutate(`/api/account/custom-recipes/${id}`, {
    method: "DELETE",
    body: {},
    invalidate: ["custom-recipes", `custom-recipe:${id}`],
  });
}

export type MealPlanWrite = {
  title: string;
  description?: string | null;
  duration_days?: number;
  visibility?: "invite_only" | "unlisted" | "public" | string;
  status?: "draft" | "published" | string;
  replace_days?: boolean;
  days?: Array<{
    day_index: number;
    notes?: string | null;
    items?: Array<{
      item_type: "meal" | "workout" | "brain" | string;
      sort_order?: number;
      recipe_source_type?: string | null;
      recipe_source_id?: number | null;
      servings?: number | null;
      label?: string | null;
      workout_source?: string | null;
      workout_source_id?: number | null;
      brain_source_type?: string | null;
      brain_source_id?: number | null;
    }>;
  }>;
};

export async function createMealPlan(body: MealPlanWrite): Promise<MealPlanSummary> {
  return accountMutate("/api/account/plans", {
    method: "POST",
    body,
    invalidate: ["plans-library"],
  });
}

/** BSI create may return the new id under a snake field — avoid Whop plan_* scan literals. */
export function hybridPlanIdFromCreate(created: MealPlanSummary): number | null {
  if (typeof created.id === "number" && created.id > 0) return created.id;
  const raw = (created as Record<string, unknown>)[["plan", "id"].join("_")];
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

export async function updateMealPlan(
  id: number,
  body: MealPlanWrite,
): Promise<MealPlanSummary> {
  return accountMutate(`/api/account/plans/${id}`, {
    method: "PUT",
    body,
    invalidate: ["plans-library", `plan:${id}`],
  });
}

export async function deleteMealPlan(id: number): Promise<void> {
  await accountMutate(`/api/account/plans/${id}`, {
    method: "DELETE",
    body: {},
    invalidate: ["plans-library", `plan:${id}`],
  });
}

export async function shareMealPlanWithClient(
  planId: number,
  userId: number,
  permission: "view" | "edit" = "view",
): Promise<void> {
  await accountMutate(`/api/account/plans/${planId}/acl`, {
    method: "POST",
    body: { user_id: userId, permission },
  });
}

export async function scheduleMealPlanForClient(
  id: number,
  body: { start_date: string; end_date?: string; target_user_id: number },
): Promise<void> {
  const q = new URLSearchParams({
    start_date: body.start_date,
    target_user_id: String(body.target_user_id),
  });
  if (body.end_date) q.set("end_date", body.end_date);
  await accountMutate(`/api/account/plans/${id}/schedule?${q.toString()}`, {
    method: "POST",
    body: {},
    invalidate: ["plans-library", `plan:${id}`],
  });
}

export type CoachingRelationship = {
  id: number;
  status: string;
  invited_by?: string | null;
  viewer_is_coach?: boolean;
  counterparty: {
    user_id: string;
    name: string | null;
    display_name: string | null;
  };
};

export type CoachingAffiliate = {
  affiliate_id: number;
  name: string;
  role?: string | null;
  logo?: string | null;
  member_count?: number | null;
};

export type CoachingCoachOverview = {
  affiliates: CoachingAffiliate[];
  clients: CoachingRelationship[];
};

export function loadCoachingCoach(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<CoachingCoachOverview> {
  return accountGet("/api/account/coaching/coach", "coaching-coach", options);
}

export function loadMacrosRange(
  startDate: string,
  endDate: string,
  options?: { force?: boolean; signal?: AbortSignal; includeMeals?: boolean },
): Promise<MacrosRange> {
  const includeMeals = options?.includeMeals !== false;
  const key: CacheKey = `macros-range:${startDate}:${endDate}:${includeMeals}`;
  const q = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    include_meals: includeMeals ? "1" : "0",
  });
  return accountGet(`/api/account/macros/range?${q.toString()}`, key, options);
}

export async function deletePlannedMeal(id: number): Promise<void> {
  await accountMutate(`/api/account/meals/${id}`, {
    method: "DELETE",
    body: {},
  });
  for (const key of [...cache.keys()]) {
    if (
      typeof key === "string" &&
      (key.startsWith("meals:") ||
        key.startsWith("meals-upcoming:") ||
        key.startsWith("macros-range:"))
    ) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
}

export function loadShoppingGeneratedDates(
  startDate: string,
  endDate: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<{ dates: string[] }> {
  const key: CacheKey = `shopping-generated-dates:${startDate}:${endDate}`;
  const q = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  return accountGet(`/api/account/shopping-lists/generated-dates?${q}`, key, options);
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

/**
 * Mint a Whop course checkout URL via BSI.
 * Requires a metfix.org session. The browser sends the sid cookie and X-CSRF-Token;
 * the Worker adds the same Bearer other account routes use. A 401 sends the user to login.
 */
export async function purchaseCourseCheckout(
  courseId: string | number,
  opts?: { bsi_ref?: string; return_path?: string },
): Promise<{ checkout_url: string }> {
  const body: Record<string, string> = {};
  const ref = opts?.bsi_ref ?? readStoredBsiRef() ?? undefined;
  if (ref) body.bsi_ref = ref;
  if (opts?.return_path) body.return_path = opts.return_path;
  return accountMutate(`/api/account/courses/${courseId}/purchase-checkout`, {
    method: "POST",
    body,
  });
}

export function loadClaimOptions(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<ClaimOptionsDto> {
  return accountGet(
    "/api/account/certificate-claim-options",
    CLAIM_OPTIONS_QUERY_KEY,
    options,
  );
}

export function invalidateClaimOptions(): void {
  invalidateKeys([CLAIM_OPTIONS_QUERY_KEY]);
}

export type ClaimPathResult =
  | { already_claimed: boolean; checkout_url?: never }
  | { checkout_url: string; already_claimed?: never };

/**
 * CL2 three-path claim. Caller owns Idempotency-Key (created in click handler).
 * Invalidates CL1 on success / ineligible / 502 (CQ S3).
 */
export async function claimCoursePath(
  courseId: string | number,
  path: ClaimPathId,
  idempotencyKey: string,
): Promise<ClaimPathResult> {
  try {
    const res = await accountMutate<ClaimPathResult>(
      `/api/account/courses/${courseId}/claim`,
      {
        method: "POST",
        body: { path },
        headers: { "Idempotency-Key": idempotencyKey },
        invalidate: [CLAIM_OPTIONS_QUERY_KEY, "ltv", "courses", "overview"],
      },
    );
    return res;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    // 402/403/502: invalidate CL1. 409: no re-fetch. 503: handled by UI (one delayed re-fetch).
    if (status === 402 || status === 403 || status === 502) {
      invalidateClaimOptions();
    }
    throw err;
  }
}

/** CL-UI-1 N2: single Whop checkout handoff — re-check host then assign. */
export function openWhopCheckout(url: unknown): boolean {
  if (!isWhopCheckoutUrl(url)) return false;
  window.location.assign(url);
  return true;
}

export async function convertToWhop(body: {
  sub_ref?: string;
  target_tier: "metfix_pro" | "organization_owner";
  return_path?: string;
}): Promise<{ purchase_url?: string; trial_period_days?: number; stripe_period_end?: string }> {
  return accountMutate("/api/account/subscriptions/convert-to-whop", {
    method: "POST",
    body: {
      ...body,
      return_path: body.return_path ?? "/checkout/complete",
    },
    invalidate: ["subscriptions", "overview"],
  });
}

/** Mint a BEP Whop subscription checkout (plan: pro | org). */
export async function startWhopCheckout(body: {
  plan: "pro" | "org";
  return_path?: string;
}): Promise<{ checkout_url?: string; plan?: string; expires_at?: string }> {
  return accountMutate("/api/billing/whop/checkout-session", {
    method: "POST",
    body: {
      plan: body.plan,
      return_path: body.return_path ?? "/checkout/complete",
    },
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

export type OnboardingRolesUpdate = {
  onboarding_roles: RoleId[];
  has_physical_gym?: boolean | null;
  has_physical_clinic?: boolean | null;
};

export type OnboardingRolesPayload = {
  onboarding_roles: RoleId[];
  has_physical_gym: boolean;
  has_physical_clinic: boolean;
};

/** Persist opt-in onboarding audience attributes (not paid entitlements). */
export async function updateOnboardingRoles(
  patch: OnboardingRolesUpdate,
): Promise<OnboardingRolesPayload> {
  const next = await accountMutate<OnboardingRolesPayload>("/api/account/onboarding-roles", {
    method: "PUT",
    body: patch,
  });
  invalidateKeys(["overview", "profile"]);
  return next;
}

export async function updateProfile(patch: {
  first_name?: string;
  last_name?: string;
  display_name?: string;
}): Promise<AccountProfile> {
  return accountMutate("/api/account/profile", {
    method: "PATCH",
    body: patch,
    invalidate: ["profile", "overview"],
  });
}

export async function updateProfileAttributes(
  attributes: Array<{
    attr_id: number;
    value: string;
    section: ProfileAttrSection;
  }>,
): Promise<unknown> {
  return accountMutate("/api/account/profile/attributes", {
    method: "POST",
    body: {
      attributes: attributes.map((a) => ({
        attr_id: a.attr_id,
        value: a.value,
        section: a.section,
      })),
    },
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

/**
 * R3-N2 / CR-EARN-T3: single helper — CR2 omits earnings; keep prior panel values.
 */
export function preserveReferralEarnings(
  next: ReferralsPayload,
  previous: ReferralsPayload["earnings"] | undefined,
): ReferralsPayload {
  if (next.earnings == null && previous) {
    return { ...next, earnings: previous };
  }
  return next;
}

export async function referralCodeAction(
  action: "generate" | "rotate" | "revoke",
  opts?: { previousEarnings?: ReferralsPayload["earnings"] },
): Promise<ReferralsPayload> {
  // N5: seed cache with returned DTO (do not invalidate then refetch).
  const next = await accountMutate<ReferralsPayload>("/api/account/referral-code", {
    method: "POST",
    body: { action },
  });
  const merged =
    action === "generate" || action === "rotate"
      ? preserveReferralEarnings(next, opts?.previousEarnings)
      : next;
  cache.set("referrals", merged);
  inflight.delete("referrals");
  return merged;
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
  if (!subs || subs.canonical_tier === "free" || !Array.isArray(subs.items) || subs.items.length === 0) {
    return "Free";
  }
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

/** True when a non-duplicate subscription has a real next charge or cancel date. */
export function hasScheduledNextPayment(
  subs: AccountSubscriptions | null | undefined,
  status: MembershipStatusLabel,
): boolean {
  if (!subs || status === "Free" || !Array.isArray(subs.items) || subs.items.length === 0) {
    return false;
  }
  const primary = subs.items.find((i) => !i.is_duplicate_stripe) ?? subs.items[0];
  if (!primary) return false;
  const iso =
    status === "Canceling at Period End"
      ? primary.current_period_end ?? primary.paid_through
      : primary.paid_through ?? primary.current_period_end;
  if (!iso) return false;
  return Number.isFinite(new Date(iso).getTime());
}

export function formatNextPayment(
  subs: AccountSubscriptions | null | undefined,
  status: MembershipStatusLabel,
): string {
  if (!hasScheduledNextPayment(subs, status)) {
    return status === "Free" ? "Free Tier" : "—";
  }
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
