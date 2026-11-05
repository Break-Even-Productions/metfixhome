import type { AudienceHref } from "@/data/home/audience";

/** Cell value for the home Membership comparison table. */
export type MembershipComparisonCell =
  | { kind: "check"; note?: string }
  | { kind: "cross" }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number; suffix?: string };

export type MembershipComparisonRow = {
  feature: string;
  pro: MembershipComparisonCell;
  free: MembershipComparisonCell;
  /** Used when the Affiliate column is shown; defaults to cross if omitted. */
  affiliate?: MembershipComparisonCell;
};

export type MembershipComparisonContent = {
  featuresLabel: string;
  proLabel: string;
  /** Not rendered in the comparison header. */
  proSublabel?: string;
  freeLabel: string;
  affiliateLabel: string;
  /** Not rendered in the comparison header. */
  affiliateSublabel?: string;
  proCtaLabel: string;
  affiliateCtaLabel: string;
  affiliateCtaHref: string;
  /** Rows shown for every audience. */
  rows: MembershipComparisonRow[];
  /**
   * Affiliate-only rows (e.g. Daily Fix Embed). Inserted after "The Daily Fix"
   * when the Affiliate column is shown.
   */
  affiliateExtraRows: MembershipComparisonRow[];
};

export const AFFILIATE_COMPARISON_AUDIENCES: ReadonlySet<AudienceHref> = new Set([
  "#for-gym-owners",
  "#for-clinicians",
  "#for-organizations",
]);

export function audienceShowsAffiliateColumn(audience: AudienceHref | string | undefined): boolean {
  return typeof audience === "string" && AFFILIATE_COMPARISON_AUDIENCES.has(audience as AudienceHref);
}

const check = { kind: "check" as const };
const checkNote = (note: string): MembershipComparisonCell => ({ kind: "check", note });
const cross = { kind: "cross" as const };
const text = (value: string): MembershipComparisonCell => ({ kind: "text", value });

/** Local membership comparison table. */
export const FALLBACK_MEMBERSHIP_COMPARISON: MembershipComparisonContent = {
  featuresLabel: "Membership Features",
  proLabel: "MetFix Pro",
  proSublabel: "$30/mo · 1st month free",
  freeLabel: "Free",
  affiliateLabel: "Affiliate",
  affiliateSublabel: "$170/mo",
  proCtaLabel: "Join MetFix Pro",
  affiliateCtaLabel: "Become an Affiliate",
  affiliateCtaHref: "/become-an-affiliate",
  rows: [
    {
      feature: "Public Articles and Resources",
      pro: check,
      free: check,
      affiliate: check,
    },
    {
      feature: "The Daily Fix (workouts, recipes & coaching notes)",
      pro: check,
      free: check,
      affiliate: check,
    },
    {
      feature: "Free Online Courses",
      pro: text("1/mo"),
      free: cross,
      affiliate: text("Unlimited"),
    },
    {
      feature: "Exclusive Resource Library",
      pro: checkNote("Access to most resources"),
      free: cross,
      affiliate: check,
    },
    {
      feature: "Exclusive Deals and Discounts",
      pro: check,
      free: cross,
      affiliate: check,
    },
  ],
  affiliateExtraRows: [
    {
      feature: "The Daily Fix Embed",
      pro: cross,
      free: cross,
      affiliate: check,
    },
  ],
};

function insertIndexForAffiliateExtras(rows: MembershipComparisonRow[]): number {
  const dailyFixIdx = rows.findIndex(
    (r) => /the daily fix/i.test(r.feature) && !/embed/i.test(r.feature),
  );
  if (dailyFixIdx >= 0) return dailyFixIdx + 1;
  return Math.min(2, rows.length);
}

export function resolveMembershipComparisonRows(
  comparison: MembershipComparisonContent,
  audience: AudienceHref | string | undefined,
): MembershipComparisonRow[] {
  const showAffiliate = audienceShowsAffiliateColumn(audience);
  if (!showAffiliate) return comparison.rows;
  if (comparison.affiliateExtraRows.length === 0) return comparison.rows;

  const insertAt = insertIndexForAffiliateExtras(comparison.rows);
  return [
    ...comparison.rows.slice(0, insertAt),
    ...comparison.affiliateExtraRows,
    ...comparison.rows.slice(insertAt),
  ];
}
