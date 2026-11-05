import type { AccountOverview, AccountSubscriptions, SubscriptionItem } from "@/lib/account";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";

const CURRENT_STATUSES = new Set(["active", "paid", "trialing", "trial"]);

function isCurrentStatus(status: string): boolean {
  return CURRENT_STATUSES.has(status.trim().toLowerCase());
}

function tierAlreadyIncludesPro(tier: CanonicalSubscriptionTier | undefined): boolean {
  return tier === "member" || tier === "metfix_pro" || tier === "organization_owner";
}

function itemAlreadyIncludesPro(item: Pick<SubscriptionItem, "tier" | "status" | "legacy_source">): boolean {
  if (!isCurrentStatus(item.status)) return false;
  return (
    item.tier === "metfix_pro" ||
    item.tier === "organization_owner" ||
    item.legacy_source === "affiliate_stripe" ||
    item.legacy_source === "medical_society_stripe"
  );
}

/**
 * Active MetFix Pro, affiliate, and medical access already includes Pro.
 * Those accounts should not be shown the MetFix Pro recommendation.
 * Affiliate rows stay `canonical_tier: free` upstream, so item + badge checks are required.
 */
export function shouldSkipProRecommendation(
  subs: Pick<AccountSubscriptions, "canonical_tier" | "items"> | null,
  overview: Pick<AccountOverview, "canonical_tier" | "badges"> | null,
): boolean {
  if (overview?.badges.affiliate || overview?.badges.medical) return true;
  if (tierAlreadyIncludesPro(subs?.canonical_tier) || tierAlreadyIncludesPro(overview?.canonical_tier)) {
    return true;
  }
  return (subs?.items ?? []).some(itemAlreadyIncludesPro);
}
