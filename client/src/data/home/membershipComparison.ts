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
  /**
   * Clinician-only rows (e.g. CME / CE). Inserted after the tools & resources row
   * for `#for-clinicians`.
   */
  clinicianExtraRows?: MembershipComparisonRow[];
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
  proCtaLabel: "Join MetFix Pro · $30/mo",
  affiliateCtaLabel: "Become an Affiliate · $170/mo",
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
    {
      feature: "Expert-led instruction",
      pro: check,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Nutrition and Fitness tools & resources",
      pro: check,
      free: cross,
      affiliate: check,
    },
    {
      feature: "Certificate of completion",
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
  clinicianExtraRows: [
    {
      feature: "CME / CE opportunities",
      pro: check,
      free: cross,
      affiliate: check,
    },
  ],
};

const TOOLS_FEATURE_DEFAULT = "Nutrition and Fitness tools & resources";
const TOOLS_FEATURE_CLINICIANS = "Clinical tools & resources";
const TOOLS_FEATURE_COACHING = "Coaching tools";

const COACHING_TOOLS_AUDIENCES: ReadonlySet<AudienceHref> = new Set([
  "#for-coaches",
  "#for-gym-owners",
]);

function toolsFeatureForAudience(audience: AudienceHref | string | undefined): string {
  if (audience === "#for-clinicians") return TOOLS_FEATURE_CLINICIANS;
  if (typeof audience === "string" && COACHING_TOOLS_AUDIENCES.has(audience as AudienceHref)) {
    return TOOLS_FEATURE_COACHING;
  }
  return TOOLS_FEATURE_DEFAULT;
}

function insertIndexForAffiliateExtras(rows: MembershipComparisonRow[]): number {
  const dailyFixIdx = rows.findIndex(
    (r) => /the daily fix/i.test(r.feature) && !/embed/i.test(r.feature),
  );
  if (dailyFixIdx >= 0) return dailyFixIdx + 1;
  return Math.min(2, rows.length);
}

function insertIndexForClinicianExtras(rows: MembershipComparisonRow[]): number {
  const toolsIdx = rows.findIndex(
    (r) =>
      r.feature === TOOLS_FEATURE_CLINICIANS ||
      r.feature === TOOLS_FEATURE_DEFAULT ||
      r.feature === TOOLS_FEATURE_COACHING ||
      /tools/i.test(r.feature),
  );
  if (toolsIdx >= 0) return toolsIdx + 1;
  return rows.length;
}

function withAffiliateExtras(
  comparison: MembershipComparisonContent,
  audience: AudienceHref | string | undefined,
): MembershipComparisonRow[] {
  const showAffiliate = audienceShowsAffiliateColumn(audience);
  if (!showAffiliate || comparison.affiliateExtraRows.length === 0) {
    return comparison.rows;
  }

  const insertAt = insertIndexForAffiliateExtras(comparison.rows);
  return [
    ...comparison.rows.slice(0, insertAt),
    ...comparison.affiliateExtraRows,
    ...comparison.rows.slice(insertAt),
  ];
}

function withAudienceToolsLabel(
  rows: MembershipComparisonRow[],
  audience: AudienceHref | string | undefined,
): MembershipComparisonRow[] {
  const toolsFeature = toolsFeatureForAudience(audience);
  if (toolsFeature === TOOLS_FEATURE_DEFAULT) return rows;
  return rows.map((row) =>
    row.feature === TOOLS_FEATURE_DEFAULT ? { ...row, feature: toolsFeature } : row,
  );
}

export function resolveMembershipComparisonRows(
  comparison: MembershipComparisonContent,
  audience: AudienceHref | string | undefined,
): MembershipComparisonRow[] {
  let rows = withAudienceToolsLabel(withAffiliateExtras(comparison, audience), audience);

  if (audience !== "#for-clinicians") return rows;

  const clinicianExtras = comparison.clinicianExtraRows ?? [];
  if (clinicianExtras.length === 0) return rows;

  const insertAt = insertIndexForClinicianExtras(rows);
  return [...rows.slice(0, insertAt), ...clinicianExtras, ...rows.slice(insertAt)];
}
