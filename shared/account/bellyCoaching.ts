import type { CanonicalSubscriptionTier } from "./tiers";
import type { FoundationsCoachStatus } from "./foundations-coach";

/** Affiliate staff roles that unlock Belly coaching tools (matches app canManageAffiliate). */
export const BELLY_COACH_AFFILIATE_ROLES = new Set(["owner", "delegate", "coach"]);

export type BellyCoachingOverview = {
  canonical_tier?: CanonicalSubscriptionTier | string | null;
  badges?: { affiliate?: boolean } | null;
  foundations_coach?: FoundationsCoachStatus | null;
};

export type BellyCoachingAffiliate = {
  affiliate_id: number;
  role?: string | null;
};

export type BellyCoachingHub = {
  affiliates?: BellyCoachingAffiliate[];
  clients?: Array<{ status?: string | null }>;
};

/**
 * Ethan’s Belly coaching gate — same people Body #41 serves as coaches:
 * org owners, active Foundations coaches, and org staff with coach/delegate/owner role.
 * Also true when the coach hub already lists an active client (relationship present).
 */
export function canUseBellyCoachingTools(
  overview: BellyCoachingOverview | null | undefined,
  tier: CanonicalSubscriptionTier | string | null | undefined,
  hub?: BellyCoachingHub | null,
): boolean {
  const resolved = tier ?? overview?.canonical_tier ?? "free";
  if (resolved === "organization_owner") return true;
  if (overview?.foundations_coach?.active === true) return true;

  const affiliates = Array.isArray(hub?.affiliates) ? hub!.affiliates! : [];
  for (const a of affiliates) {
    const role = typeof a.role === "string" ? a.role.toLowerCase() : "";
    if (BELLY_COACH_AFFILIATE_ROLES.has(role)) return true;
  }

  const clients = Array.isArray(hub?.clients) ? hub!.clients! : [];
  if (clients.some((c) => c.status === "active" || c.status === "pending")) {
    return true;
  }

  return false;
}
