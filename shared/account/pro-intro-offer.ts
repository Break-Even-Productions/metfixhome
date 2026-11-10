/**
 * MetFix Pro first-month intro offer copy + eligibility helpers.
 * Server (`pro_intro_offer_eligible`) is the source of truth; UI must not invent eligibility.
 */

export type ProIntroOfferSource = {
  pro_intro_offer_eligible?: boolean | null;
};

/** Missing/unknown (signed-out marketing) defaults to showing the intro. */
export function isProIntroOfferEligible(
  source: ProIntroOfferSource | null | undefined,
): boolean {
  if (!source || source.pro_intro_offer_eligible == null) return true;
  return source.pro_intro_offer_eligible === true;
}

export function proMembershipPriceLine(eligible: boolean): string {
  return eligible
    ? "First month free · Then $30/month"
    : "$30/month · Cancel anytime";
}

export function proMembershipPriceHeader(eligible: boolean): string {
  return eligible
    ? "First month free · Then $30/month · Cancel anytime"
    : "$30/month · Cancel anytime";
}

export function proMembershipCta(eligible: boolean): string {
  return eligible ? "Start my free month" : "Start MetFix Pro";
}

export function proMembershipCtaArrow(eligible: boolean): string {
  return eligible ? "Start my free month →" : "Start MetFix Pro →";
}

export function proMembershipSubcopy(eligible: boolean): string {
  return eligible
    ? "Full course library including MetFix Essentials, The Daily Fix, and cumulative LTV toward official course certificates — plus your first month free. Cancel anytime."
    : "Full course library including MetFix Essentials, The Daily Fix, and cumulative LTV toward official course certificates. Cancel anytime.";
}

export function proMembershipShortPitch(eligible: boolean): string {
  return eligible
    ? "MetFix Membership includes a free first month, then $30/month."
    : "MetFix Membership is $30/month.";
}

export function proUnlockTitle(eligible: boolean): string {
  return eligible ? "Unlock the tools. First month free." : "Unlock the tools with MetFix Pro.";
}

export function proSidebarUnlockCopy(eligible: boolean): string {
  return eligible
    ? "Tools, tracking & classes. First month free."
    : "Tools, tracking & classes. $30/month.";
}

export function proUpgradeBody(eligible: boolean): string {
  return eligible
    ? "This content is part of MetFix Membership. Start your free month or manage billing."
    : "This content is part of MetFix Membership. Start MetFix Pro or manage billing.";
}
