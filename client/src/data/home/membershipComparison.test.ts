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

  it("inserts affiliate extra rows after The Daily Fix", () => {
    const base = resolveMembershipComparisonRows(
      FALLBACK_MEMBERSHIP_COMPARISON,
      "#for-individuals",
    );
    expect(base).toEqual(FALLBACK_MEMBERSHIP_COMPARISON.rows);
    expect(base.some((r) => /Daily Fix Embed/i.test(r.feature))).toBe(false);

    const affiliate = resolveMembershipComparisonRows(
      FALLBACK_MEMBERSHIP_COMPARISON,
      "#for-gym-owners",
    );
    expect(affiliate).toHaveLength(
      FALLBACK_MEMBERSHIP_COMPARISON.rows.length +
        FALLBACK_MEMBERSHIP_COMPARISON.affiliateExtraRows.length,
    );
    const embedIdx = affiliate.findIndex((r) => /Daily Fix Embed/i.test(r.feature));
    const dailyFixIdx = affiliate.findIndex(
      (r) => /The Daily Fix/i.test(r.feature) && !/Embed/i.test(r.feature),
    );
    expect(embedIdx).toBe(dailyFixIdx + 1);
  });

  it("supports text cells for Free Online Courses", () => {
    const row = FALLBACK_MEMBERSHIP_COMPARISON.rows.find((r) =>
      /Free Online Courses/i.test(r.feature),
    );
    expect(row?.pro).toEqual({ kind: "text", value: "1/mo" });
    expect(row?.free).toEqual({ kind: "cross" });
    expect(row?.affiliate).toEqual({ kind: "text", value: "Unlimited" });
  });

  it("marks Exclusive Resource Library Pro check with hover note", () => {
    const row = FALLBACK_MEMBERSHIP_COMPARISON.rows.find((r) =>
      /Exclusive Resource Library/i.test(r.feature),
    );
    expect(row?.pro).toEqual({ kind: "check", note: "Access to most resources" });
    expect(row?.affiliate).toEqual({ kind: "check" });
    expect(row?.free).toEqual({ kind: "cross" });
  });
});
