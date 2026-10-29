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

export type SubscriptionTierItem = {
  tier?: unknown;
  legacy_source?: unknown;
  status?: unknown;
};

export type SubscriptionTierInput = {
  /** Upstream/self-reported canonical_tier when present. */
  canonical_tier?: unknown;
  items?: ReadonlyArray<SubscriptionTierItem>;
};

function itemStatus(item: SubscriptionTierItem): string {
  return typeof item.status === "string" ? item.status.toLowerCase() : "";
}

/**
 * Single shared resolver for overview / subscriptions / LTV (CQ B2 / R2-N1).
 *
 * DP-TIER-2: grandfathered Stripe Med Society (`legacy_source === medical_society_stripe`)
 * maps to `metfix_pro` **only** while status is exactly `active` (not trialing/past_due).
 * Never promotes a single subscription row to `organization_owner`.
 * A stored/upstream `organization_owner` is never downgraded by a grandfathered item.
 */
export function resolveAccountCanonicalTier(
  input: SubscriptionTierInput,
): CanonicalSubscriptionTier {
  const tier = normalizeCanonicalTier(input.canonical_tier);
  const items = input.items ?? [];

  for (const item of items) {
    if (
      item.legacy_source === "medical_society_stripe" &&
      itemStatus(item) === "active"
    ) {
      return tier === "organization_owner" ? "organization_owner" : "metfix_pro";
    }
  }

  return tier;
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
