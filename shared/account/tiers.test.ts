import { describe, expect, it } from "vitest";
import {
  CANONICAL_SUBSCRIPTION_TIERS,
  hasMetFixPro,
  normalizeCanonicalTier,
  resolveAccountCanonicalTier,
  tierDisplayLabel,
  type CanonicalSubscriptionTier,
} from "./tiers";

describe("canonical subscription tier union (DP-TIER-1)", () => {
  it("exposes exactly four tiers", () => {
    expect([...CANONICAL_SUBSCRIPTION_TIERS]).toEqual([
      "free",
      "member",
      "metfix_pro",
      "organization_owner",
    ]);
  });

  it("normalizeCanonicalTier maps known values and medical_society → member", () => {
    expect(normalizeCanonicalTier("free")).toBe("free");
    expect(normalizeCanonicalTier("member")).toBe("member");
    expect(normalizeCanonicalTier("metfix_pro")).toBe("metfix_pro");
    expect(normalizeCanonicalTier("organization_owner")).toBe("organization_owner");
    expect(normalizeCanonicalTier("medical_society")).toBe("member");
    expect(normalizeCanonicalTier("Medical_Society")).toBe("member");
    expect(normalizeCanonicalTier("unknown_paid")).toBe("free");
    expect(normalizeCanonicalTier(null)).toBe("free");
  });

  it("never treats Medical Society as a paid tier", () => {
    const tier = normalizeCanonicalTier("medical_society");
    expect(tier).toBe("member");
    expect(hasMetFixPro(tier)).toBe(false);
    expect(tierDisplayLabel(tier)).toBe("Member");
  });

  it("hasMetFixPro is true for metfix_pro and organization_owner only", () => {
    const cases: Array<[CanonicalSubscriptionTier, boolean]> = [
      ["free", false],
      ["member", false],
      ["metfix_pro", true],
      ["organization_owner", true],
    ];
    for (const [tier, expected] of cases) {
      expect(hasMetFixPro(tier)).toBe(expected);
    }
  });

  it("tierDisplayLabel covers org/pro/grandfathered/member/free (TIER1b)", () => {
    expect(tierDisplayLabel("organization_owner")).toBe("Organization Owner ($170/mo)");
    expect(tierDisplayLabel("metfix_pro")).toBe("MetFix Pro ($30/mo)");
    expect(
      tierDisplayLabel("metfix_pro", { legacy_source: "medical_society_stripe" }),
    ).toBe("MetFix Pro · Grandfathered Med Society");
    expect(tierDisplayLabel("member")).toBe("Member");
    expect(tierDisplayLabel("free")).toBe("Free");
    expect(hasMetFixPro("organization_owner")).toBe(true);
  });
});

describe("resolveAccountCanonicalTier (CQ R2-N1 / DP-TIER-2)", () => {
  const medSocItem = {
    tier: "member",
    legacy_source: "medical_society_stripe",
    status: "active",
  };

  it("DP-T-TIER2b: stored free + Med Society active → metfix_pro; trialing/past_due/canceled stay free", () => {
    expect(
      resolveAccountCanonicalTier({
        canonical_tier: "free",
        items: [{ ...medSocItem, status: "active" }],
      }),
    ).toBe("metfix_pro");
    for (const status of ["trialing", "past_due", "canceled"] as const) {
      const tier = resolveAccountCanonicalTier({
        canonical_tier: "free",
        items: [{ ...medSocItem, status }],
      });
      expect(tier).toBe("free");
      expect(hasMetFixPro(tier)).toBe(false);
    }
  });

  it("same rows → same tier (overview/subs/LTV lockstep)", () => {
    const fixture = {
      canonical_tier: "free" as const,
      items: [{ ...medSocItem, status: "active" }],
    };
    const a = resolveAccountCanonicalTier(fixture);
    const b = resolveAccountCanonicalTier(fixture);
    const c = resolveAccountCanonicalTier(fixture);
    expect(a).toBe("metfix_pro");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("DP-T-TIER5b: stored organization_owner never downgraded by grandfathered item", () => {
    for (const status of ["active", "trialing", "canceled"] as const) {
      expect(
        resolveAccountCanonicalTier({
          canonical_tier: "organization_owner",
          items: [{ ...medSocItem, status }],
        }),
      ).toBe("organization_owner");
      expect(hasMetFixPro("organization_owner")).toBe(true);
    }
  });

  it("DP-T-TIER5: no item-level organization_owner upgrade of free/member", () => {
    expect(
      resolveAccountCanonicalTier({
        canonical_tier: "free",
        items: [{ tier: "organization_owner", legacy_source: "affiliate_stripe", status: "active" }],
      }),
    ).toBe("free");
    expect(
      resolveAccountCanonicalTier({
        canonical_tier: "member",
        items: [{ tier: "organization_owner", status: "active" }],
      }),
    ).toBe("member");
    expect(
      resolveAccountCanonicalTier({
        canonical_tier: "member",
        items: [{ ...medSocItem, status: "active" }],
      }),
    ).toBe("metfix_pro");
  });
});
