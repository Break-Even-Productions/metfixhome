export const CANONICAL_SUBSCRIPTION_TIERS = [
  "free",
  "member",
  "metfix_pro",
  "organization_owner",
] as const;

export type CanonicalSubscriptionTier = (typeof CANONICAL_SUBSCRIPTION_TIERS)[number];

export type LegacySubscriptionSource =
  | "medical_society_stripe"
  | "affiliate_stripe"
  | null;

const CANONICAL_SET = new Set<string>(CANONICAL_SUBSCRIPTION_TIERS);

/**
 * Map upstream tier strings onto the strict 4-tier union (DP-TIER-1).
 * Unknown `medical_society` is never a paid tier — maps to `member`.
 */
export function normalizeCanonicalTier(raw: unknown): CanonicalSubscriptionTier {
  if (typeof raw !== "string") return "free";
  const key = raw.trim().toLowerCase();
  if (CANONICAL_SET.has(key)) return key as CanonicalSubscriptionTier;
  if (key === "medical_society") return "member";
  return "free";
}

/** MetFix Pro access includes organization_owner (includes Pro). */
export function hasMetFixPro(tier: CanonicalSubscriptionTier): boolean {
  return tier === "metfix_pro" || tier === "organization_owner";
}

export type TierDisplayOpts = {
  legacy_source?: LegacySubscriptionSource;
};

export function tierDisplayLabel(
  tier: CanonicalSubscriptionTier,
  opts?: TierDisplayOpts,
): string {
  switch (tier) {
    case "organization_owner":
      return "Organization Owner ($170/mo)";
    case "metfix_pro":
      if (opts?.legacy_source === "medical_society_stripe") {
        return "MetFix Pro · Grandfathered Med Society";
      }
      return "MetFix Pro ($30/mo)";
    case "member":
      return "Member";
    case "free":
    default:
      return "Free";
  }
}
