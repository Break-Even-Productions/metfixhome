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

  it("tierDisplayLabel covers org/pro/grandfathered/member/free", () => {
    expect(tierDisplayLabel("organization_owner")).toBe("Organization Owner ($170/mo)");
    expect(tierDisplayLabel("metfix_pro")).toBe("MetFix Pro ($30/mo)");
    expect(
      tierDisplayLabel("metfix_pro", { legacy_source: "medical_society_stripe" }),
    ).toBe("MetFix Pro · Grandfathered Med Society");
    expect(tierDisplayLabel("member")).toBe("Member");
    expect(tierDisplayLabel("free")).toBe("Free");
  });
});

describe("resolveAccountCanonicalTier (CQ B2)", () => {
  const medSocItem = {
    tier: "member",
    legacy_source: "medical_society_stripe",
    status: "active",
  };

  it("grandfathers Stripe Med Society → metfix_pro for active|trialing|past_due", () => {
    for (const status of ["active", "trialing", "past_due"] as const) {
      expect(
        resolveAccountCanonicalTier({
          canonical_tier: "member",
          items: [{ ...medSocItem, status }],
        }),
      ).toBe("metfix_pro");
    }
  });

  it("does not grandfather canceled / unpaid Med Society", () => {
    expect(
      resolveAccountCanonicalTier({
        canonical_tier: "member",
        items: [{ ...medSocItem, status: "canceled" }],
      }),
    ).toBe("member");
  });

  it("same fixture yields same tier (overview/subs/LTV lockstep)", () => {
    const fixture = {
      canonical_tier: "member" as const,
      items: [{ ...medSocItem, status: "trialing" }],
    };
    const a = resolveAccountCanonicalTier(fixture);
    const b = resolveAccountCanonicalTier(fixture);
    const c = resolveAccountCanonicalTier(fixture);
    expect(a).toBe("metfix_pro");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("organization_owner wins over Med Society grandfather", () => {
    expect(
      resolveAccountCanonicalTier({
        canonical_tier: "organization_owner",
        items: [
          { tier: "organization_owner", status: "active" },
          { ...medSocItem, status: "active" },
        ],
      }),
    ).toBe("organization_owner");
  });
});
