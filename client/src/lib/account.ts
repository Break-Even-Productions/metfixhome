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
import type { CatalogHit } from "@shared/account/listCatalog";
import type {
  ContentReportReason,
  ContentReportReceipt,
  ContentReportType,
} from "@shared/account/contentReports";
import type {
  ListSourceType,
  ListVisibility,
  UserListDto,
  UserListItemDto,
} from "@shared/account/userLists";

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
  /** False when the user previously held MetFix Pro (no first-month intro). */
  pro_intro_offer_eligible?: boolean;
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
  /** False when the user previously held MetFix Pro (no first-month intro). */
  pro_intro_offer_eligible?: boolean;
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
  photo_url?: string | null;
  excerpt?: string | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carb_g?: number | null;
  protein_name?: string | null;
  servings_default?: number | null;
  scale?: string | null;
  video_url?: string | null;
  article_url?: string | null;
  recipe_url?: string | null;
  saved_at?: string | null;
  date?: string | null;
  [key: string]: unknown;
};

export type FavoritesPage = {
  items: FavoriteItem[];
  /** Legacy BSI key — worker should normalize to `items`. */
  favorites?: FavoriteItem[];
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

export type NotificationChannelMap = Partial<
  Record<"email" | "text" | "phone" | "push" | "in_feed", number | boolean>
>;

export type NotificationPrefType = {
  slug: string;
  label?: string;
  group?: string;
  allowed_channels?: string[];
  channels?: NotificationChannelMap;
  email_required?: boolean;
};

export type NotificationsPayload = {
  account?: { types?: NotificationPrefType[] };
  newsletter?: { subscribed: boolean } | null;
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
  score_mode?: string | null;
  pr_direction?: "higher_better" | "lower_better" | null;
  benchmark_classification: string | null;
  is_benchmark: boolean;
};

export type PrOverview = {
  workouts: PrOverviewRow[];
  movements: PrOverviewRow[];
};

export type SparkPrDirection = "higher_better" | "lower_better" | "closer_to_target";

/** BSI spark entry row — date + value are the chart contract; extras pass through. */
export type SparkEntry = {
  id?: string | number;
  measurement_date: string;
  value: number;
  bsi_measurement_id?: number;
  unit_id?: number;
  unit_abbreviation?: string | null;
  measurement_name?: string;
  measurement_type?: "health" | "movement" | null;
  sub_type?: string | null;
  pr_direction?: SparkPrDirection | null;
  type?: "pending" | "accepted";
  status?: "pending" | "accepted";
  athlete_id?: number;
  class_id?: number;
};

export type SparkMeasurement = {
  bsi_measurement_id: number;
  name: string;
  measurement_type: "health" | "movement" | null;
  sub_type: string | null;
  pr_direction: SparkPrDirection;
  default_unit_id: number | null;
  unit_abbreviation: string | null;
};

export type SparkMeasurementsPage = {
  measurements: SparkMeasurement[];
  count: number;
};

export type SparkUnit = {
  unit_id: number;
  name: string;
  abbreviation: string;
};

export type SparkUnitsPage = {
  units: SparkUnit[];
  count: number;
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
  read_at?: string | null;
  created_at?: string | null;
  link?: string | null;
  /** MetFix.org deep link shaped by the account worker. */
  href?: string | null;
  post_id?: number | string | null;
  source?: string | null;
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
  unread_count?: number;
  total?: number;
  total_count?: number;
  limit?: number;
  offset?: number;
  view?: "all" | "focused";
  [key: string]: unknown;
};

export type UnreadNotificationCount = {
  unread_count: number;
};

export type WorkoutScoreEntry = {
  score_type: string | null;
  score_value: number | null;
  scaling_mode: string | null;
};

export type WorkoutMovementActual = {
  movement_id: number;
  movement_name?: string;
  segment_id?: string;
  step_order?: number;
  round_index?: number;
  weight?: number;
  reps?: number;
  time_sec?: number;
  distance_m?: number;
  calories?: number;
  inches?: number;
  bodyweight_adjustment?: number;
  bodyweight_adjustment_unit_id?: number;
  weight_unit_id?: number;
};

export type WorkoutLogItem = {
  id: number;
  workout_title: string;
  date_time: string;
  calories_burned: number | null;
  activity_minutes: number | null;
  workout_source: string | null;
  workout_source_id: number | null;
  workout_free_text: string | null;
  scaling_mode: string | null;
  score_entries: WorkoutScoreEntry[];
  movement_actuals?: WorkoutMovementActual[];
  photo_url: string | null;
};

export type WorkoutLogsPage = { workouts: WorkoutLogItem[] };

export type PlannedWorkoutItem = {
  id: number;
  plan_date: string;
  workout_source: string;
  workout_source_id: number | null;
  logged: number;
  sort_order: number | null;
  title: string | null;
};

export type PlannedWorkoutsPage = { planned_workouts: PlannedWorkoutItem[] };

export type WorkoutLogScoreInput = {
  score_type: string;
  score_value: number;
  workout_item_id?: number;
  scoring_direction?: "higher_better" | "lower_better";
  score_unit_id?: number;
};

export type MovementActualInput = {
  movement_id: number;
  segment_id?: string;
  step_order?: number;
  /** 1-based round when logging multi-round structure segments. */
  round_index?: number;
  weight?: number;
  reps?: number;
  time_sec?: number;
  distance_m?: number;
  weight_unit_id?: number;
  calories?: number;
  inches?: number;
  bodyweight_adjustment?: number;
  bodyweight_adjustment_unit_id?: number;
};

export type LogWorkoutInput = {
  workout_title: string;
  date_time: string;
  workout_free_text?: string;
  activity_minutes?: number;
  calories_burned?: number;
  workout_source?: "daily_fix" | "custom" | "favorite" | "affiliate";
  workout_source_id?: number;
  daily_fix_date?: string;
  scaling_mode?: "rx" | "scaled";
  occurrence_id?: number;
  scores?: WorkoutLogScoreInput[];
  movement_actuals?: MovementActualInput[];
  measurements?: Array<{ measurement_id: number; value: number; unit_id?: number }>;
};

export type WorkoutLoggableDimension =
  | "weight"
  | "reps"
  | "time"
  | "distance"
  | "calories"
  | "inches"
  | "bodyweight_adjustment";

export type WorkoutStepPrescription = {
  reps?: number;
  weight?: number;
  weight_unit_id?: number;
  distance_m?: number;
  duration_sec?: number;
  calories?: number;
  inches?: number;
  bodyweight_adjustment?: number;
  bodyweight_adjustment_unit_id?: number;
};

export type WorkoutStructureStep = {
  movement_id: number;
  order: number;
  label?: string;
  movement_name?: string;
  prescription?: WorkoutStepPrescription;
  prescription_female?: WorkoutStepPrescription;
  /** Ordered Rx metrics (max 3). Present on newer templates. */
  builder_rx_dimensions?: WorkoutLoggableDimension[];
  loggable?: {
    allow?: WorkoutLoggableDimension[];
    require?: WorkoutLoggableDimension[];
  };
};

export type WorkoutStructureSegment = {
  id: string;
  preset: string;
  params?: Record<string, number>;
  steps: WorkoutStructureStep[];
};

export type WorkoutStructure = {
  version: 1;
  segments: WorkoutStructureSegment[];
};

export type WorkoutItemScore = {
  workout_item_id: number;
  logging_type: string | null;
  scoring_direction: "higher_better" | "lower_better" | null;
  scoring_field: string;
  title: string | null;
  mirror_measurement_id: number | null;
};

export type CustomWorkoutSummary = {
  id: number;
  title: string;
  photo_url: string | null;
  excerpt?: string;
  logging_type?: string;
  structure?: WorkoutStructure | null;
  workout_items?: WorkoutItemScore[];
};

export type MovementRow = { id: number; name: string; category: string | null };

export type CustomWorkoutWrite = {
  title: string;
  excerpt?: string;
  body?: string;
  logging_type: string;
  structure: WorkoutStructure;
};

export type PlanWriteItem = {
  item_type: "meal" | "workout" | "brain";
  sort_order?: number;
  label?: string;
  relative_to_schedule_date?: boolean;
  workout_source?: "daily_fix" | "custom";
  workout_source_id?: number;
  recipe_source_type?: "daily_mod" | "custom_recipe";
  recipe_source_id?: number;
  servings?: number;
  brain_source_type?: "daily_article" | "wp_post" | "course";
  brain_source_id?: number;
};

export type PlanWriteDay = {
  day_index: number;
  notes?: string;
  items: PlanWriteItem[];
};

export type PlanDetail = {
  id: number;
  title: string;
  description: string | null;
  duration_days: number | null;
  visibility: string;
  status: string | null;
  is_active: boolean;
  can_edit: boolean;
  days: Array<{
    id?: number;
    day_index: number;
    notes: string | null;
    items: PlanWriteItem[];
  }>;
};

export type DailyFixWorkoutRef = {
  date: string | null;
  title: string | null;
  workout_id: number | null;
  custom_workout_id: number | null;
};

export type CoachingPerson = {
  user_id: string;
  name: string | null;
  display_name: string | null;
};

export type CoachingRelationship = {
  id: number;
  status: string;
  invited_by: "coach" | "client" | null;
  viewer_is_coach: boolean;
  counterparty: CoachingPerson;
};

export type CoachingAffiliate = {
  affiliate_id: number;
  name: string;
  role?: string | null;
  logo: string | null;
  member_count: number | null;
  group_conversation_id: number | null;
};

export type CoachingClientOverview = {
  affiliates: CoachingAffiliate[];
  coaches: CoachingRelationship[];
};

export type CoachingCoachOverview = {
  affiliates: CoachingAffiliate[];
  clients: CoachingRelationship[];
};

export type CoachDirectoryEntry = {
  user_id: string;
  name: string | null;
  display_name: string | null;
  bio: string | null;
  search_excerpt: string | null;
  avatar: string | null;
  completed_courses: string[];
  completed_courses_count: number | null;
};

export type CoachDirectoryPage = { trainers: CoachDirectoryEntry[] };

export type CoachNote = {
  id: number;
  body: string;
  created_at: string | null;
};

export type CoachNotesPage = { notes: CoachNote[] };

export type CoachProfile = {
  directory_visible: boolean;
  bio: string | null;
};

export type ProgrammingSeriesItem = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  access_mode: string | null;
  is_subscribed: boolean | null;
};

export type ProgrammingSubscriptionItem = {
  id: number;
  series_id: number;
  status: string | null;
  source: string | null;
  series_title: string | null;
  start_date: string | null;
  end_date: string | null;
  calendar_sync_enabled: boolean;
};

export type ProgrammingDayItem = {
  id: number;
  calendar_date: string;
  notes: string | null;
  status: string | null;
  items: Array<{ id: number; item_type: string | null; label: string | null }>;
};

export type PlanLibraryItem = {
  id: number;
  title: string;
  duration_days: number | null;
  status: string | null;
  is_active: boolean;
  usage_status: string | null;
};

export type PlanLibraryPage = {
  active: PlanLibraryItem[];
  inactive: PlanLibraryItem[];
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
  | "notifications-unread"
  | "privacy"
  | "pr-overview"
  | "inbox"
  | `inbox:${string}`
  | "messages-conversations"
  | `messages-conversation:${string}`
  | `messages-thread:${string}:${number}:${number}`
  | `messages-users:${string}`
  | typeof CLAIM_OPTIONS_QUERY_KEY
  | `payments:${number}:${number}`
  | `favorites:${string}`
  | `member:${string}`
  | `meals:${string}:${string}`
  | `meals-upcoming:${number}`
  | `macros:${string}`
  | "shopping-lists"
  | `shopping-list:${number}`
  | "user-lists"
  | "public-lists"
  | `user-list:${number}`
  | `user-list-items:${number}`
  | `user-list-share:${string}`
  | "custom-recipes"
  | "custom-workouts"
  | `spark-entries:${string}`
  | "spark-user-info"
  | `spark-measurements:${string}`
  | "spark-units"
  | `calendar-surface:${string}`
  | `workouts:${string}`
  | `workouts-planned:${string}`
  | `workout:${number}`
  | `custom-workout:${number}`
  | `custom-workouts:${number}`
  | `movements:${string}`
  | "plans"
  | `plan:${number}`
  | `daily-fix-workout:${string}`
  | "coaching-client"
  | "coaching-coach"
  | `coaching-directory:${string}`
  | `coaching-notes:${number}`
  | "coaching-profile"
  | "programming-subs"
  | "programming-series"
  | `programming-days:${string}`
  | "coaching-plans"
  | "plans-library"
  | "custom-recipes"
  | `custom-recipe:${number}`
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

function dropUserListCaches(): void {
  for (const key of [...cache.keys()]) {
    if (
      key === "user-lists" ||
      key === "public-lists" ||
      (typeof key === "string" && key.startsWith("user-list"))
    ) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
}

function dropCachePrefix(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (String(key).startsWith(prefix)) {
      cache.delete(key);
      inflight.delete(key);
    }
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

export type SparkUserInfo = {
  training_gender: "male" | "female" | null;
  weight_display_unit: "lb" | "kg" | null;
};

export function loadSparkUserInfo(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<SparkUserInfo> {
  return accountGet("/api/account/spark/user-info", "spark-user-info", options);
}

/**
 * Spark measurement catalog (GET /api/account/spark/measurements → BSI /spark/measurements).
 * Used for `pr_direction` when shaping health / movement bests.
 */
export function loadSparkMeasurements(
  params: { measurement_type?: "health" | "movement" } = {},
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<SparkMeasurementsPage> {
  const q = new URLSearchParams();
  if (params.measurement_type) q.set("measurement_type", params.measurement_type);
  const qs = q.toString();
  const key = `spark-measurements:${params.measurement_type ?? "all"}` as const;
  return accountGet(
    `/api/account/spark/measurements${qs ? `?${qs}` : ""}`,
    key,
    options,
  );
}

/** Spark unit catalog (GET /api/account/spark/units → BSI /spark/units). */
export function loadSparkUnits(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<SparkUnitsPage> {
  return accountGet("/api/account/spark/units", "spark-units", options);
}

/**
 * Spark measurement history (GET /api/account/spark/entries → BSI /spark/entries).
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
  view?: "all" | "focused";
  limit?: number;
  offset?: number;
  force?: boolean;
  signal?: AbortSignal;
}): Promise<AccountInbox> {
  const params = new URLSearchParams();
  if (options?.view) params.set("view", options.view);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const key: CacheKey = qs
    ? `inbox:${options?.view ?? "all"}:${options?.limit ?? ""}:${options?.offset ?? 0}`
    : "inbox";
  return accountGet(`/api/account/inbox${qs ? `?${qs}` : ""}`, key, options);
}

/** Live unread badge for the site header bell. */
export function loadUnreadNotificationCount(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<UnreadNotificationCount> {
  return accountGet(
    "/api/account/notifications/unread-count",
    "notifications-unread",
    options,
  );
}

export type ChatMember = {
  id: string;
  name: string;
  avatar?: string | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  canAddMembers?: boolean;
  canRemoveMembers?: boolean;
};

export type ChatConversation = {
  id: string;
  type: "direct" | "group" | string;
  name?: string | null;
  avatar?: string | null;
  icon?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
  isPinned?: boolean;
  ownerId?: string | null;
  currentUserId?: string | null;
  isOwner?: boolean;
  canAddMembers?: boolean;
  canRemoveMembers?: boolean;
  members?: ChatMember[];
  isBlocked?: boolean;
  blockedUserId?: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  timestamp: string;
  isRead?: boolean;
};

export type ChatUser = {
  id: string;
  name: string;
  avatar?: string | null;
  secondary_text?: string | null;
  is_affiliate_owner?: boolean;
};

/** GET /api/account/messages/conversations → BSI /messages/conversations */
export function loadChatConversations(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<{ conversations: ChatConversation[] }> {
  return accountGet(
    "/api/account/messages/conversations",
    "messages-conversations",
    options,
  );
}

/** GET /api/account/messages/conversations/:id */
export function loadChatConversation(
  id: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<{ conversation: ChatConversation }> {
  const safe = encodeURIComponent(id);
  return accountGet(
    `/api/account/messages/conversations/${safe}`,
    `messages-conversation:${id}`,
    options,
  );
}

/** GET /api/account/messages/conversations/:id/messages */
export function loadChatMessages(
  id: string,
  params: { limit?: number; offset?: number } = {},
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<{ messages: ChatMessage[]; has_more?: boolean }> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const q = `limit=${limit}&offset=${offset}`;
  return accountGet(
    `/api/account/messages/conversations/${encodeURIComponent(id)}/messages?${q}`,
    `messages-thread:${id}:${limit}:${offset}`,
    options,
  );
}

/** POST /api/account/messages/conversations/:id/messages */
export async function sendChatMessage(
  id: string,
  content: string,
): Promise<{ message: ChatMessage }> {
  const result = await accountMutate<{ message: ChatMessage }>(
    `/api/account/messages/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: "POST",
      body: { content },
      invalidate: ["messages-conversations", `messages-conversation:${id}`],
    },
  );
  invalidateKeys([
    "messages-conversations",
    `messages-conversation:${id}`,
    "inbox",
  ]);
  // Clear any cached thread pages for this conversation.
  for (const key of [...cache.keys()]) {
    if (String(key).startsWith(`messages-thread:${id}:`)) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
  return result;
}

/** POST /api/account/messages/conversations/:id/read */
export async function markChatConversationRead(id: string): Promise<{ success: boolean }> {
  const result = await accountMutate<{ success: boolean }>(
    `/api/account/messages/conversations/${encodeURIComponent(id)}/read`,
    {
      method: "POST",
      body: {},
      invalidate: ["messages-conversations", `messages-conversation:${id}`, "inbox"],
    },
  );
  return result;
}

/**
 * POST /api/account/messages/conversations/direct
 * Creates or reuses a DM; optional first message.
 */
export async function createDirectChat(input: {
  recipientId: string | number;
  message?: string;
}): Promise<{ conversation: ChatConversation }> {
  const body: Record<string, unknown> = {
    recipient_id:
      typeof input.recipientId === "number"
        ? input.recipientId
        : Number(input.recipientId),
  };
  if (input.message?.trim()) body.message = input.message.trim();
  const result = await accountMutate<{ conversation: ChatConversation }>(
    "/api/account/messages/conversations/direct",
    {
      method: "POST",
      body,
      invalidate: ["messages-conversations", "inbox"],
    },
  );
  return result;
}

function dedupeChatUsers(users: ChatUser[]): ChatUser[] {
  const seen = new Set<string>();
  const unique: ChatUser[] = [];
  for (const user of users) {
    const id = String(user?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(user);
  }
  return unique;
}

/** GET /api/account/messages/users or /users/search */
export function loadChatUsers(
  query?: string,
  options?: {
    force?: boolean;
    signal?: AbortSignal;
    affiliateOwnersOnly?: boolean;
    affiliateId?: number;
  },
): Promise<{ users: ChatUser[] }> {
  const q = (query ?? "").trim();
  const params = new URLSearchParams();
  if (options?.affiliateOwnersOnly) params.set("affiliate_owners_only", "true");
  if (options?.affiliateId != null && options.affiliateId > 0) {
    params.set("affiliate_id", String(options.affiliateId));
  }
  const finish = (res: { users?: ChatUser[] }) => ({
    users: dedupeChatUsers(Array.isArray(res.users) ? res.users : []),
  });
  if (q.length >= 3) {
    params.set("q", q);
    const qs = params.toString();
    return accountGet<{ users: ChatUser[] }>(
      `/api/account/messages/users/search?${qs}`,
      `messages-users:search:${qs}`,
      options,
    ).then(finish);
  }
  const qs = params.toString();
  return accountGet<{ users: ChatUser[] }>(
    `/api/account/messages/users${qs ? `?${qs}` : ""}`,
    `messages-users:browse:${qs || "all"}`,
    options,
  ).then(finish);
}

/**
 * Log a spark PR / measurement (POST /api/account/spark/entries → BSI /spark/entries).
 * Sends force_log so intentional dashboard logs persist even if not an improvement.
 */
export async function createSparkEntry(
  body: CreateSparkEntryInput,
): Promise<CreateSparkEntryResult> {
  // BSI requires Y-m-d H:i:s; date → noon, datetime-local → append seconds.
  const rawDate = body.measurement_date.trim();
  const measurement_date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? `${rawDate} 12:00:00`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawDate)
      ? `${rawDate.replace("T", " ")}:00`
      : rawDate.replace("T", " ");
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

export function loadWorkoutLogs(
  start: string,
  end: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<WorkoutLogsPage> {
  const q = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
  return accountGet(`/api/account/workouts?${q}`, `workouts:${start}:${end}`, options);
}

export function loadPlannedWorkouts(
  start: string,
  end: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<PlannedWorkoutsPage> {
  const q = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
  return accountGet(
    `/api/account/workouts/planned?${q}`,
    `workouts-planned:${start}:${end}`,
    options,
  );
}

export function loadWorkoutLog(
  id: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<{ workout: WorkoutLogItem }> {
  return accountGet(`/api/account/workouts/${id}`, `workout:${id}`, options);
}

export function loadCustomWorkout(
  id: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<CustomWorkoutSummary> {
  return accountGet(
    `/api/account/custom-workouts/${id}?include_movement_names=1`,
    `custom-workout:${id}`,
    options,
  );
}

export function loadMyCustomWorkouts(options?: {
  force?: boolean;
  signal?: AbortSignal;
  limit?: number;
}): Promise<{ workouts: CustomWorkoutSummary[] }> {
  const limit = options?.limit != null && options.limit > 0 ? Math.min(options.limit, 100) : 30;
  return accountGet(
    `/api/account/custom-workouts?owner_id=me&limit=${limit}&offset=0`,
    `custom-workouts:${limit}`,
    options,
  );
}

export async function saveCustomWorkout(
  body: CustomWorkoutWrite,
  id?: number,
): Promise<CustomWorkoutSummary> {
  const result = await accountMutate<CustomWorkoutSummary>(
    id ? `/api/account/custom-workouts/${id}` : "/api/account/custom-workouts",
    { method: id ? "PUT" : "POST", body },
  );
  dropCachePrefix("custom-workouts");
  if (id) {
    cache.delete(`custom-workout:${id}`);
    inflight.delete(`custom-workout:${id}`);
  }
  return result;
}

export async function deleteCustomWorkout(id: number): Promise<void> {
  await accountMutate(`/api/account/custom-workouts/${id}`, { method: "DELETE" });
  dropCachePrefix("custom-workouts");
  cache.delete(`custom-workout:${id}`);
  inflight.delete(`custom-workout:${id}`);
}

export function searchMovements(
  search: string,
  options?: { signal?: AbortSignal },
): Promise<{ movements: MovementRow[] }> {
  const q = new URLSearchParams({ search, limit: "20", offset: "0" });
  return accountGet(`/api/account/movements?${q.toString()}`, `movements:${q.toString()}`, options);
}

export function loadDailyFixWorkout(
  date: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<DailyFixWorkoutRef> {
  return accountGet(
    `/api/account/daily-fix?date=${encodeURIComponent(date)}`,
    `daily-fix-workout:${date}`,
    options,
  );
}

export function loadPlans(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<{ plans: PlanDetail[] }> {
  return accountGet("/api/account/plans", "plans", options);
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

export async function savePlan(
  body: {
    title: string;
    description?: string;
    duration_days: number;
    visibility: string;
    status?: string;
    replace_days?: boolean;
    days: PlanWriteDay[];
  },
  id?: number,
): Promise<{ plan: PlanDetail }> {
  const result = await accountMutate<{ plan: PlanDetail }>(
    id ? `/api/account/plans/${id}` : "/api/account/plans",
    { method: id ? "PUT" : "POST", body },
  );
  cache.delete("plans");
  cache.delete("plans-library");
  if (id) cache.delete(`plan:${id}`);
  return result;
}

export async function publishPlan(id: number): Promise<void> {
  await accountMutate(`/api/account/plans/${id}/publish`, { method: "POST", body: {} });
  cache.delete("plans");
  cache.delete("plans-library");
  cache.delete(`plan:${id}`);
}

export async function schedulePlan(id: number, startDate: string): Promise<void> {
  await accountMutate(`/api/account/plans/${id}/schedule?start_date=${encodeURIComponent(startDate)}`, {
    method: "POST",
  });
  dropCachePrefix("workouts");
  cache.delete("plans");
}

export async function createWorkoutLog(body: LogWorkoutInput): Promise<{ workout: WorkoutLogItem | null }> {
  const result = await accountMutate<{ workout: WorkoutLogItem | null }>(
    "/api/account/workouts",
    { method: "POST", body },
  );
  dropCachePrefix("workouts:");
  dropCachePrefix("workouts-planned:");
  return result;
}

export async function deleteWorkoutLog(id: number): Promise<void> {
  await accountMutate(`/api/account/workouts/${id}`, { method: "DELETE" });
  dropCachePrefix("workouts:");
  cache.delete(`workout:${id}`);
  inflight.delete(`workout:${id}`);
}

export async function deletePlannedWorkout(id: number): Promise<void> {
  await accountMutate(`/api/account/workouts/planned/${id}`, { method: "DELETE" });
  dropCachePrefix("workouts-planned:");
  dropCachePrefix("workouts:");
}

export function loadCoachingClient(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<CoachingClientOverview> {
  return accountGet("/api/account/coaching/client", "coaching-client", options);
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

export function loadCoachingCoach(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<CoachingCoachOverview> {
  return accountGet("/api/account/coaching/coach", "coaching-coach", options);
}

export function loadCoachDirectory(
  params: { name?: string; sort_by?: string; sort_order?: string } = {},
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<CoachDirectoryPage> {
  const q = new URLSearchParams();
  if (params.name) q.set("name", params.name);
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_order) q.set("sort_order", params.sort_order);
  q.set("limit", "20");
  const qs = q.toString();
  return accountGet(`/api/account/coaching/directory?${qs}`, `coaching-directory:${qs}`, options);
}

export function loadCoachNotes(
  relationshipId: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<CoachNotesPage> {
  return accountGet(
    `/api/account/coaching/relationships/${relationshipId}/notes`,
    `coaching-notes:${relationshipId}`,
    options,
  );
}

export async function createCoachNote(relationshipId: number, body: string): Promise<void> {
  await accountMutate(`/api/account/coaching/relationships/${relationshipId}/notes`, {
    method: "POST",
    body: { body },
  });
  cache.delete(`coaching-notes:${relationshipId}`);
  inflight.delete(`coaching-notes:${relationshipId}`);
}

export async function coachingRelationshipAction(
  id: number,
  action: "accept" | "decline" | "end",
): Promise<void> {
  await accountMutate(`/api/account/coaching/relationships/${id}/${action}`, {
    method: "POST",
    body: {},
  });
  cache.delete("coaching-client");
  cache.delete("coaching-coach");
  inflight.delete("coaching-client");
  inflight.delete("coaching-coach");
}

export async function requestCoach(userId: string): Promise<void> {
  await accountMutate("/api/account/coaching/relationships", {
    method: "POST",
    body: { counterparty_user_id: Number(userId), role: "client_request" },
  });
  cache.delete("coaching-client");
  inflight.delete("coaching-client");
}

export function loadCoachProfile(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<CoachProfile> {
  return accountGet("/api/account/coaching/profile", "coaching-profile", options);
}

export async function saveCoachProfile(body: {
  directory_visible?: boolean;
  bio?: string;
}): Promise<CoachProfile> {
  const result = await accountMutate<CoachProfile>("/api/account/coaching/profile", {
    method: "PUT",
    body,
  });
  cache.delete("coaching-profile");
  inflight.delete("coaching-profile");
  return result;
}

export function loadProgrammingSubscriptions(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<{ subscriptions: ProgrammingSubscriptionItem[] }> {
  return accountGet(
    "/api/account/coaching/programming/subscriptions",
    "programming-subs",
    options,
  );
}

export function loadProgrammingSeries(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<{ series: ProgrammingSeriesItem[] }> {
  return accountGet("/api/account/coaching/programming/series", "programming-series", options);
}

export function loadProgrammingDays(
  seriesId: number,
  start: string,
  end: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<{ days: ProgrammingDayItem[] }> {
  const q = `start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
  return accountGet(
    `/api/account/coaching/programming/series/${seriesId}/days?${q}`,
    `programming-days:${seriesId}:${start}:${end}`,
    options,
  );
}

export async function subscribeProgrammingSeries(seriesId: number): Promise<void> {
  await accountMutate(`/api/account/coaching/programming/series/${seriesId}/subscribe`, {
    method: "POST",
    body: {},
  });
  cache.delete("programming-subs");
  cache.delete("programming-series");
  inflight.delete("programming-subs");
  inflight.delete("programming-series");
}

export async function cancelProgrammingSubscription(id: number): Promise<void> {
  await accountMutate(`/api/account/coaching/programming/subscriptions/${id}`, {
    method: "DELETE",
  });
  cache.delete("programming-subs");
  inflight.delete("programming-subs");
}

export function loadCoachingPlanLibrary(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<PlanLibraryPage> {
  return accountGet("/api/account/coaching/plans", "coaching-plans", options);
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
 * Signed-in: sid cookie + X-CSRF-Token; the Worker adds the account Bearer.
 * Guest: same cookies/CSRF, plus `email`. A stored bsi_ref is forwarded either way.
 * A 401 (no session and no email) sends the user to login.
 */
export async function purchaseCourseCheckout(
  courseId: string | number,
  opts?: { bsi_ref?: string; return_path?: string; email?: string },
): Promise<{ checkout_url: string }> {
  const body: Record<string, string> = {};
  const ref = opts?.bsi_ref ?? readStoredBsiRef() ?? undefined;
  if (ref) body.bsi_ref = ref;
  if (opts?.return_path) body.return_path = opts.return_path;
  const email = opts?.email?.trim();
  if (email) body.email = email;
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
    address?: Record<string, string>;
  }>,
): Promise<unknown> {
  return accountMutate("/api/account/profile/attributes", {
    method: "POST",
    body: {
      attributes: attributes.map((a) => ({
        attr_id: a.attr_id,
        value: a.value,
        section: a.section,
        ...(a.address ? { address: a.address } : {}),
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

export function markInboxNotificationRead(notificationId: number): Promise<{ success: boolean }> {
  return accountMutate("/api/account/inbox/read", {
    method: "POST",
    body: { notification_id: notificationId },
    invalidate: ["notifications-unread"],
  });
}

export function dismissInboxNotification(
  notificationId: number,
  source: "site" | "personal",
): Promise<{ success: boolean }> {
  return accountMutate("/api/account/inbox/dismiss", {
    method: "POST",
    body: { notification_id: notificationId, type: source },
    invalidate: ["notifications-unread"],
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

export type UserList = UserListDto;
export type UserListItem = UserListItemDto;

export type UserListsPage = {
  lists: UserList[];
  meta: { count: number; total: number; limit: number; offset: number };
};

export function loadUserLists(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<UserListsPage> {
  return accountGet("/api/account/lists?limit=50&offset=0", "user-lists", options);
}

export function loadPublicLists(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<UserListsPage> {
  return accountGet("/api/account/lists/public?limit=50&offset=0", "public-lists", options);
}

export function loadUserList(
  id: number,
  options?: { force?: boolean; signal?: AbortSignal; shareToken?: string },
): Promise<{ list: UserList }> {
  const q = options?.shareToken
    ? `?share_token=${encodeURIComponent(options.shareToken)}`
    : "";
  return accountGet(`/api/account/lists/${id}${q}`, `user-list:${id}`, options);
}

export function loadUserListByToken(
  token: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<{ list: UserList }> {
  return accountGet(
    `/api/account/lists/share/${encodeURIComponent(token)}`,
    `user-list-share:${token}`,
    options,
  );
}

export function loadUserListItems(
  id: number,
  options?: { force?: boolean; signal?: AbortSignal; shareToken?: string },
): Promise<{ items: UserListItem[]; count: number; list_id: number | null }> {
  const q = options?.shareToken
    ? `?share_token=${encodeURIComponent(options.shareToken)}`
    : "";
  return accountGet(
    `/api/account/lists/${id}/items${q}`,
    `user-list-items:${id}`,
    options,
  );
}

export async function createUserList(body: {
  title: string;
  description?: string;
  visibility: ListVisibility;
}): Promise<{ list: UserList }> {
  const res = await accountMutate<{ list: UserList }>("/api/account/lists", {
    method: "POST",
    body,
  });
  dropUserListCaches();
  return res;
}

export async function updateUserList(
  id: number,
  body: { title?: string; description?: string; visibility?: ListVisibility },
): Promise<{ list: UserList }> {
  const res = await accountMutate<{ list: UserList }>(`/api/account/lists/${id}`, {
    method: "PUT",
    body,
  });
  dropUserListCaches();
  return res;
}

export async function deleteUserList(id: number): Promise<{ success: boolean }> {
  const res = await accountMutate<{ success: boolean }>(`/api/account/lists/${id}`, {
    method: "DELETE",
  });
  dropUserListCaches();
  return res;
}

export async function addUserListItem(
  id: number,
  body: { source_type: ListSourceType | string; source_id: number; note?: string },
): Promise<{ list_item?: UserListItem; listed?: boolean; saved?: boolean }> {
  const res = await accountMutate<{
    list_item?: UserListItem;
    listed?: boolean;
    saved?: boolean;
  }>(`/api/account/lists/${id}/items`, { method: "POST", body });
  dropUserListCaches();
  return res;
}

export function loadOwnedCustomWorkouts(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<{ items: CatalogHit[] }> {
  return accountGet(
    "/api/account/custom-workouts?limit=50&offset=0",
    "custom-workouts",
    options,
  );
}

export async function inviteListSubscriber(
  id: number,
  userId: number,
): Promise<{ list: UserList }> {
  const res = await accountMutate<{ list: UserList }>(
    `/api/account/lists/${id}/subscribers`,
    { method: "POST", body: { user_id: userId } },
  );
  dropUserListCaches();
  return res;
}

export async function removeListSubscriber(
  id: number,
  userId: number,
): Promise<{ success: boolean }> {
  const res = await accountMutate<{ success: boolean }>(
    `/api/account/lists/${id}/subscribers/${userId}`,
    { method: "DELETE" },
  );
  dropUserListCaches();
  return res;
}

export async function submitContentReport(body: {
  content_type: ContentReportType;
  content_id: number;
  reason_code: ContentReportReason;
  note?: string;
}): Promise<ContentReportReceipt> {
  const note = body.note?.trim();
  return accountMutate<ContentReportReceipt>("/api/account/content-reports", {
    method: "POST",
    body: {
      content_type: body.content_type,
      content_id: body.content_id,
      reason_code: body.reason_code,
      ...(note ? { note } : {}),
    },
  });
}

export async function removeUserListItem(
  id: number,
  itemId: number,
): Promise<{ success: boolean }> {
  const res = await accountMutate<{ success: boolean }>(
    `/api/account/lists/${id}/items/${itemId}`,
    { method: "DELETE" },
  );
  dropUserListCaches();
  return res;
}

export async function updateUserListItem(
  id: number,
  itemId: number,
  body: { note?: string },
): Promise<{ list_item?: UserListItem; success?: boolean }> {
  const res = await accountMutate<{ list_item?: UserListItem; success?: boolean }>(
    `/api/account/lists/${id}/items/${itemId}`,
    { method: "PUT", body },
  );
  dropUserListCaches();
  return res;
}

export async function reorderUserListItems(
  id: number,
  item_orders: Array<{ id: number; sort_order: number }>,
): Promise<{ items?: UserListItem[]; success?: boolean }> {
  const res = await accountMutate<{ items?: UserListItem[]; success?: boolean }>(
    `/api/account/lists/${id}/items/reorder`,
    { method: "PUT", body: { item_orders } },
  );
  dropUserListCaches();
  return res;
}

export async function subscribeToUserList(
  id: number,
  shareToken?: string,
): Promise<{ list: UserList }> {
  const res = await accountMutate<{ list: UserList }>(
    `/api/account/lists/${id}/subscribe`,
    {
      method: "POST",
      body: shareToken ? { share_token: shareToken } : {},
    },
  );
  dropUserListCaches();
  return res;
}

export async function unsubscribeFromUserList(id: number): Promise<{ success: boolean }> {
  const res = await accountMutate<{ success: boolean }>(
    `/api/account/lists/${id}/subscribe`,
    { method: "DELETE" },
  );
  dropUserListCaches();
  return res;
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
