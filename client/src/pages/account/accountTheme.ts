import type { AccountOverview } from "@/lib/account";
import type { RoleId } from "@shared/join/membership-domain";

/** Home audience theme keys used for dashboard accent tokens. */
export type AccountAccentTheme =
  | "individual"
  | "coach"
  | "gym"
  | "clinician"
  | "responder";

const ROLE_TO_THEME: Record<RoleId, AccountAccentTheme> = {
  individual: "individual",
  coach: "coach",
  gym_owner: "gym",
  clinician: "clinician",
  first_responder: "responder",
};

/**
 * When several onboarding roles are selected, prefer distinctive accents over
 * the default individual gold (clinician → responder → gym → coach → individual).
 */
const ROLE_PRIORITY: readonly RoleId[] = [
  "clinician",
  "first_responder",
  "gym_owner",
  "coach",
  "individual",
] as const;

function hasCoachLikeEntitlement(overview: AccountOverview | null | undefined): boolean {
  if (!overview) return false;
  if (overview.foundations_coach?.active) return true;
  if (overview.badges?.foundations_coach) return true;
  if (overview.badges?.affiliate) return true;
  return false;
}

/**
 * Resolve dashboard accent theme:
 * 1. Self-selected onboarding roles (home palette mapping)
 * 2. Else coach-like entitlements → blue (`coach`)
 * 3. Else default individual gold
 */
export function resolveAccountAccentTheme(
  overview: AccountOverview | null | undefined,
): AccountAccentTheme {
  const roles = overview?.onboarding_roles ?? [];
  for (const id of ROLE_PRIORITY) {
    if (roles.includes(id)) return ROLE_TO_THEME[id];
  }
  if (hasCoachLikeEntitlement(overview)) return "coach";
  return "individual";
}
