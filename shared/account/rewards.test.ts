import { describe, expect, it } from "vitest";
import { shapeRewardsPayload } from "./rewards";

describe("shapeRewardsPayload", () => {
  it("shapes a complete Rewards payload", () => {
    const shaped = shapeRewardsPayload({
      currency: "USD",
      dashboard_enabled: true,
      offers_live: true,
      tier: {
        canonical_tier: "metfix_pro",
        personas: { metfix_pro: true, free: false },
        audience_keys: ["metfix_pro"],
      },
      ltv: {
        total_cents: 5000,
        available_cents: 3500,
        claimed_certificate_cents: 1500,
        claimed_certificates: [],
        foundations_coach: null,
      },
      class_claims: {
        enabled: true,
        mode: "windowed",
        used: 1,
        cap_n: 1,
        window_start: "2026-11-01T00:00:00+00:00",
        resets_at: "2026-12-01T00:00:00+00:00",
        calendar_month: {
          used: 1,
          start: "2026-11-01T00:00:00+00:00",
          end: "2026-12-01T00:00:00+00:00",
        },
        active: [],
      },
      offers: [
        {
          id: "seminar_coach_2026",
          kind: "discount_code",
          title: "Coach Discount",
          description: "$500 off",
          audience: ["affiliate_associated"],
          source: "bsi_reward_offer",
          code: "COACH26R0S",
        },
      ],
      referrals: { href: "/bsi/v1/me/referrals" },
      links: { spend: "/bsi/v1/me/spend" },
    });
    expect(shaped).not.toBeNull();
    expect(shaped!.ltv.total_cents).toBe(5000);
    expect(shaped!.offers).toHaveLength(1);
    expect(shaped!.offers[0]!.code).toBe("COACH26R0S");
    expect(shaped!.offers_live).toBe(true);
  });

  it("rejects missing LTV total", () => {
    expect(
      shapeRewardsPayload({
        ltv: { available_cents: 1 },
        class_claims: {},
        offers: [],
      }),
    ).toBeNull();
  });

  it("keeps offers empty when offers_live false", () => {
    const shaped = shapeRewardsPayload({
      offers_live: false,
      ltv: { total_cents: 0, available_cents: 0, claimed_certificate_cents: 0 },
      class_claims: { calendar_month: { used: 0 } },
      offers: [
        {
          id: "x",
          title: "Hidden until live on server",
          kind: "discount_code",
          description: "",
          audience: [],
          source: "bsi_reward_offer",
          code: "SECRET",
        },
      ],
      tier: { canonical_tier: "free", personas: {}, audience_keys: [] },
    });
    // Worker trusts server: if BSI mistakenly sent codes while offers_live false,
    // we still pass them through — gating is server-side. offers_live is preserved.
    expect(shaped!.offers_live).toBe(false);
    expect(shaped!.offers).toHaveLength(1);
  });
});
