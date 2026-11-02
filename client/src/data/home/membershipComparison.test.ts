import { describe, expect, it } from "vitest";
import {
  audienceShowsAffiliateColumn,
  FALLBACK_MEMBERSHIP_COMPARISON,
  resolveMembershipComparisonRows,
} from "./membershipComparison";

describe("membershipComparison", () => {
  it("shows affiliate column only for gym owners, clinicians, organizations", () => {
    expect(audienceShowsAffiliateColumn("#for-individuals")).toBe(false);
    expect(audienceShowsAffiliateColumn("#for-athletes")).toBe(false);
    expect(audienceShowsAffiliateColumn("#for-coaches")).toBe(false);
    expect(audienceShowsAffiliateColumn("#for-first-responders")).toBe(false);
    expect(audienceShowsAffiliateColumn("#for-gym-owners")).toBe(true);
    expect(audienceShowsAffiliateColumn("#for-clinicians")).toBe(true);
    expect(audienceShowsAffiliateColumn("#for-organizations")).toBe(true);
  });

  it("appends affiliate extra rows only for affiliate audiences", () => {
    const base = resolveMembershipComparisonRows(
      FALLBACK_MEMBERSHIP_COMPARISON,
      "#for-individuals",
    );
    expect(base).toEqual(FALLBACK_MEMBERSHIP_COMPARISON.rows);

    const affiliate = resolveMembershipComparisonRows(
      FALLBACK_MEMBERSHIP_COMPARISON,
      "#for-gym-owners",
    );
    expect(affiliate).toHaveLength(
      FALLBACK_MEMBERSHIP_COMPARISON.rows.length +
        FALLBACK_MEMBERSHIP_COMPARISON.affiliateExtraRows.length,
    );
    expect(affiliate.at(-1)?.feature).toMatch(/Affiliate resource library/i);
  });

  it("supports number cells in fallback (courses / month)", () => {
    const row = FALLBACK_MEMBERSHIP_COMPARISON.rows.find((r) =>
      /courses toward certificates/i.test(r.feature),
    );
    expect(row?.pro).toEqual({ kind: "number", value: 4, suffix: "/mo" });
  });
});
