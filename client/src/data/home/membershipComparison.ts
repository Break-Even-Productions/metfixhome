import type { AudienceHref } from "@/data/home/audience";

/** Cell value for the home Membership comparison table. */
export type MembershipComparisonCell =
  | { kind: "check" }
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
  proSublabel?: string;
  freeLabel: string;
  affiliateLabel: string;
  affiliateSublabel?: string;
  /** Rows shown for every audience. */
  rows: MembershipComparisonRow[];
  /** Appended only for Gym Owners / Clinicians / Organizations. */
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
const cross = { kind: "cross" as const };
const text = (value: string): MembershipComparisonCell => ({ kind: "text", value });
const num = (value: number, suffix?: string): MembershipComparisonCell => ({
  kind: "number",
  value,
  suffix,
});

/** Code fallback when Sanity has no membershipComparison (or partial data). */
export const FALLBACK_MEMBERSHIP_COMPARISON: MembershipComparisonContent = {
  featuresLabel: "Membership Features",
  proLabel: "MetFix Pro",
  proSublabel: "$30/mo · 1st month free",
  freeLabel: "Free",
  affiliateLabel: "Affiliate",
  affiliateSublabel: "$170/mo",
  rows: [
    {
      feature: "Public Articles, Podcast & Directory Search",
      pro: check,
      free: check,
      affiliate: check,
    },
    {
      feature: "The Daily Fix (workouts, recipes & coaching notes)",
      pro: check,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Online Courses (including MetFix Essentials)",
      pro: check,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Courses toward certificates / month",
      pro: num(4, "/mo"),
      free: cross,
      affiliate: text("All included"),
    },
    {
      feature: "Course completion certificates via cumulative LTV",
      pro: check,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Article & Daily Fix community discussions",
      pro: check,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Foundations Coach qualification path",
      pro: check,
      free: check,
      affiliate: check,
    },
  ],
  affiliateExtraRows: [
    {
      feature: "All MetFix courses at no added cost",
      pro: cross,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Revenue share on client course purchases",
      pro: cross,
      free: cross,
      affiliate: check,
    },
    {
      feature: "MetFix brand license & gym finder listing",
      pro: cross,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Affiliate resource library & client tools",
      pro: cross,
      free: cross,
      affiliate: check,
    },
  ],
};

export function resolveMembershipComparisonRows(
  comparison: MembershipComparisonContent,
  audience: AudienceHref | string | undefined,
): MembershipComparisonRow[] {
  const showAffiliate = audienceShowsAffiliateColumn(audience);
  if (!showAffiliate) return comparison.rows;
  return [...comparison.rows, ...comparison.affiliateExtraRows];
}
