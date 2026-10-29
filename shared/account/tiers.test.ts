import { describe, expect, it } from "vitest";
import {
  CANONICAL_SUBSCRIPTION_TIERS,
  hasMetFixPro,
  normalizeCanonicalTier,
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
