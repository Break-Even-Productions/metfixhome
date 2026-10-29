/**
 * Single source of truth for JoinFlow roles, tiers, certificate/coach rules,
 * and the Membership comparison table (WJ5, WJ17, WJ-CERT-1, WJ-COACH-*, WJ-TIER-1).
 */

export const ONBOARDING_ROLE_IDS = [
  "individual",
  "coach",
  "gym_owner",
  "first_responder",
  "clinician",
] as const;

export type RoleId = (typeof ONBOARDING_ROLE_IDS)[number];

export const ONBOARDING_ROLES: ReadonlyArray<{
  id: RoleId;
  title: string;
  description: string;
}> = [
  {
    id: "individual",
    title: "Learning for myself",
    description: "Understand metabolism, nutrition, and chronic disease for your own health.",
  },
  {
    id: "coach",
    title: "Coach",
    description: "Apply metabolic health principles with your athletes and clients.",
  },
  {
    id: "gym_owner",
    title: "Gym owner",
    description: "Bring MetFix programming and education into your facility.",
  },
  {
    id: "first_responder",
    title: "First responder",
    description: "Metabolic readiness and resilience for tactical and emergency personnel.",
  },
  {
    id: "clinician",
    title: "Clinician",
    description: "Connect with peers and evidence-based metabolic medicine resources.",
  },
];

export function needsConditionalStep(roles: readonly RoleId[]): boolean {
  return roles.includes("gym_owner") || roles.includes("clinician");
}

export function isOnboardingRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && (ONBOARDING_ROLE_IDS as readonly string[]).includes(value);
}

/** Strictly 4 canonical subscription tiers (WJ-TIER-1 / [t432u]). */
export const CANONICAL_SUBSCRIPTION_TIERS = [
  "free",
  "member",
  "metfix_pro",
  "organization_owner",
] as const;

export type CanonicalSubscriptionTier = (typeof CANONICAL_SUBSCRIPTION_TIERS)[number];

/** Whop checkout plan aliases → canonical tiers (Break Even Productions only). */
export const WHOP_CHECKOUT_PLANS = ["pro", "org"] as const;
export type WhopCheckoutPlan = (typeof WHOP_CHECKOUT_PLANS)[number];

export function isWhopCheckoutPlan(value: unknown): value is WhopCheckoutPlan {
  return value === "pro" || value === "org";
}

export const WHOP_PLAN_TO_TIER: Record<WhopCheckoutPlan, CanonicalSubscriptionTier> = {
  pro: "metfix_pro",
  org: "organization_owner",
};

/** Break Even Productions Whop company id — never Curie & Co (WJ-WHOP-1). */
export const BEP_WHOP_COMPANY_ID = "biz_u15G8d34g9c0B0";

/** Allowed Whop company ids for scanners and allowlists (N10). */
export const WHOP_ALLOWED_COMPANY_IDS = [BEP_WHOP_COMPANY_ID] as const;

export const MEMBERSHIP_COMPARISON_ROWS: ReadonlyArray<{
  feature: string;
  metfix: string;
  free: string;
}> = [
  {
    feature: "Public Articles, Podcast & Directory Search",
    metfix: "Included",
    free: "Included",
  },
  {
    feature: "The Daily Fix (Daily Workouts, Recipes & Coaching Notes)",
    metfix: "Full Archive + Daily Playback",
    free: "Public Previews Only",
  },
  {
    feature: "Online Courses (including MetFix Essentials)",
    metfix: "Full Course Access Included",
    free: "Purchase Individually",
  },
  {
    feature: "Course Completion Certificates",
    metfix: "Claim via Cumulative LTV Budget or Buy Course Directly",
    free: "Buy Course Directly",
  },
  {
    feature: "Foundations Coach Qualification (3-Year Credential)",
    metfix:
      "Complete MetFix Essentials + Claim Certificate, or Attend In-Person Seminar (valid 3 years)",
    free: "Attend In-Person Seminar or Buy MetFix Essentials + Claim Certificate (valid 3 years)",
  },
  {
    feature: "Article & Daily Fix Community Discussions",
    metfix: "Full Posting & Replies",
    free: "Read-Only",
  },
  {
    feature: "Organization Owner Tier — Gym Affiliate & Doctor Practice ($170/mo)",
    metfix: "$170/mo Organization Owner tier (includes MetFix Pro)",
    free: "—",
  },
];

export const MEMBERSHIP_HERO = {
  headline: "Everything You Need in One Membership",
  subcopy:
    "Full course library including MetFix Essentials, The Daily Fix, and cumulative LTV toward official course certificates — plus your first month free. Cancel anytime.",
  cta: "Start my free month →",
} as const;

export const PRO_CARD_HEADER = "First month free · Then $30/month · Cancel anytime";
export const ORG_CARD_HEADER = "First month free · Then $170/month";
export const ORG_AFFILIATE_NOTE =
  "Affiliate membership includes full MetFix Membership access and course library, so you do not also pay $30/month.";

/** WJ-CERT-1: available certificate LTV budget in cents. */
export function availableCertificateLtvCents(
  totalLtvCents: number,
  claimedCoursesValueCents: number,
): number {
  return totalLtvCents - claimedCoursesValueCents;
}

export type CoachCredentialStatus = "active" | "expired" | "none";

/**
 * Coach status from expires_at (WJ-COACH-2).
 * Leap-day `expires_at` math lives in #21 `computeThreeYearExpiryIso` after rebase
 * (R2-N1: unused `coachExpiresAtIso` removed from this module).
 */
export function coachCredentialStatus(
  expiresAtIso: string | null | undefined,
  nowIso: string,
): CoachCredentialStatus {
  if (!expiresAtIso) return "none";
  const exp = new Date(expiresAtIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return "none";
  if (now < exp) return "active";
  return "expired";
}

export type FoundationsCoachGrantInput =
  | { path: "seminar"; checkedIn: boolean }
  | {
      path: "essentials";
      courseCompleted: boolean;
      certificateClaimed: boolean;
    };

/** WJ-COACH-1: never a four-figure LTV auto-grant; both paths require the stated conditions. */
export function isFoundationsCoachGranted(input: FoundationsCoachGrantInput): boolean {
  if (input.path === "seminar") return input.checkedIn === true;
  return input.courseCompleted === true && input.certificateClaimed === true;
}

export type JoinStep = "name" | "auth" | "roles" | "conditional" | "path";

export type JoinStepTransitionContext = {
  isSignedIn: boolean;
  roles: readonly RoleId[];
};

/**
 * Pure step navigation (CQ Trap 3 fix): skip auth when signed in both ways;
 * skip conditional both ways when neither gym_owner nor clinician.
 */
export function resolveJoinStepTransition(
  step: JoinStep,
  direction: 1 | -1,
  ctx: JoinStepTransitionContext,
): JoinStep | null {
  const needsConditional = needsConditionalStep(ctx.roles);
  if (direction === 1) {
    if (step === "name") return ctx.isSignedIn ? "roles" : "auth";
    if (step === "auth") return "roles";
    if (step === "roles") return needsConditional ? "conditional" : "path";
    if (step === "conditional") return "path";
    return null;
  }
  if (step === "auth") return "name";
  if (step === "roles") return ctx.isSignedIn ? "name" : "auth";
  if (step === "conditional") return "roles";
  if (step === "path") return needsConditional ? "conditional" : "roles";
  return null;
}

const JOIN_STEPS: readonly JoinStep[] = ["name", "auth", "roles", "conditional", "path"];

export function parseJoinStepParam(raw: string | null | undefined): JoinStep | null {
  if (!raw) return null;
  return (JOIN_STEPS as readonly string[]).includes(raw) ? (raw as JoinStep) : null;
}

/**
 * Clamp deep-link `?step=` to a reachable step (CQ B4 / WJ3 / WJ8).
 * - signed-in + auth → roles
 * - path with no roles → name (signed out) or roles (signed in)
 * - conditional without gym/clinician roles → roles
 */
export function clampJoinDeepLink(
  requested: JoinStep | null | undefined,
  ctx: JoinStepTransitionContext,
): JoinStep {
  if (!requested || requested === "name") return "name";
  if (requested === "auth") return ctx.isSignedIn ? "roles" : "auth";
  if (requested === "roles") return "roles";
  if (requested === "conditional") {
    return needsConditionalStep(ctx.roles) ? "conditional" : "roles";
  }
  // path
  if (ctx.roles.length === 0) return ctx.isSignedIn ? "roles" : "name";
  if (needsConditionalStep(ctx.roles)) return "conditional";
  return "path";
}

/** Normalize facility flags when role is absent (CQ B3): never true without the role. */
export function facilityFlagsForRoles(
  roles: readonly RoleId[],
  hasPhysicalGym: boolean | null,
  hasPhysicalClinic: boolean | null,
): { has_physical_gym: boolean | null; has_physical_clinic: boolean | null } {
  return {
    has_physical_gym: roles.includes("gym_owner") ? hasPhysicalGym : null,
    has_physical_clinic: roles.includes("clinician") ? hasPhysicalClinic : null,
  };
}

export function showOrganizationOwnerCard(
  roles: readonly RoleId[],
  hasPhysicalGym: boolean | null,
  hasPhysicalClinic: boolean | null,
): boolean {
  const gymOk = roles.includes("gym_owner") && hasPhysicalGym === true;
  const clinicOk = roles.includes("clinician") && hasPhysicalClinic === true;
  return gymOk || clinicOk;
}

export function sanitizeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > 512) return null;
  if (!/^\/(?!\/)[A-Za-z0-9/_\-#?=&.]*$/.test(raw)) return null;
  return raw;
}

/**
 * Allowlist Whop checkout URLs (WT-J4). Fail closed on curie contamination.
 * Shared with PR B `sanitizeExternalBillingUrl(..., "whop_only")`.
 */
export function sanitizeWhopCheckoutUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (/curie/i.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (host !== "whop.com" && !host.endsWith(".whop.com")) return null;
  if (/curie/i.test(host)) return null;
  return u.toString();
}
