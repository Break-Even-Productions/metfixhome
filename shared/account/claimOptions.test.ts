import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  buildClaimOptionsDto,
  buyOutrightTitle,
  CLAIM_REASON_BY_UPSTREAM,
  mapClaimIneligible,
  mapRedeemLtvSuccess,
  isValidIdempotencyKey,
  type ClaimIneligibleReason,
  type UpstreamClaimCode,
} from "./claimOptions";
import { formatUsdFromCents } from "./ltv";

function path(
  id: "redeem_ltv" | "prepay_credit" | "buy_outright",
  eligible: boolean,
  shortfall: number,
  price: number,
  reason: string | null,
) {
  return {
    path: id,
    eligible,
    shortfall_cents: shortfall,
    price_cents: price,
    reason_code: reason,
  };
}

describe("buildClaimOptionsDto", () => {
  it("CL-T17: prepay no_shortfall when available covers price", () => {
    const raw = {
      currency: "usd",
      ltv: { total_ltv_cents: 25000, claimed_value_cents: 0, available_cents: 25000 },
      courses: [
        {
          course_id: 1,
          slug: "essentials",
          title: "Essentials",
          completion_status: "completed",
          completed_at: "2026-01-01T00:00:00Z",
          price_cents: 20000,
          already_claimed: false,
          claimed_at: null,
          claimed_via: null,
          access_expires_at: null,
          paths: [
            path("redeem_ltv", true, 0, 20000, null),
            path("prepay_credit", false, 0, 20000, "no_shortfall"),
            path("buy_outright", true, 20000, 20000, null),
          ],
        },
      ],
    };
    const built = buildClaimOptionsDto(raw);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.courses[0]!.paths[1]).toMatchObject({
      path: "prepay_credit",
      eligible: false,
      reason_code: "no_shortfall",
      shortfall_cents: 0,
    });
  });

  it("accepts claimed_at with +00:00 and normalizes to Z", () => {
    const raw = {
      currency: "usd",
      ltv: { total_ltv_cents: 0, claimed_value_cents: 0, available_cents: 0 },
      courses: [
        {
          course_id: 1,
          slug: "x",
          title: "X",
          completion_status: "completed",
          completed_at: "2026-01-01T00:00:00+00:00",
          price_cents: 100,
          already_claimed: true,
          claimed_at: "2026-06-01T12:00:00+00:00",
          claimed_via: "redeem_ltv",
          access_expires_at: null,
          paths: [
            path("redeem_ltv", false, 0, 100, "already_claimed"),
            path("prepay_credit", false, 0, 100, "already_claimed"),
            path("buy_outright", false, 0, 100, "already_claimed"),
          ],
        },
      ],
    };
    const built = buildClaimOptionsDto(raw);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.courses[0]!.claimed_at).toBe("2026-06-01T12:00:00Z");
    expect(built.dto.courses[0]!.completed_at).toBe("2026-01-01T00:00:00Z");
  });
});

describe("mapRedeemLtvSuccess (LR-7 / rev1.22 / 1.2.8)", () => {
  it("accepts redeem_ltv; rejects ltv/direct_purchase/prepay_credit/buy_outright", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = mapRedeemLtvSuccess({
      course_id: 1,
      already_claimed: false,
      allocated_cents: 20000,
      claim_method: "redeem_ltv",
      claimed_at: "2026-06-01T12:00:00+00:00",
      available_certificate_ltv_cents: 0,
      available_ltv_cents: 0,
      claimed_courses_value_cents: 20000,
      foundations_coach: null,
    });
    expect(ok).toEqual({
      ok: true,
      dto: { already_claimed: false },
      logs: [{ event: "claim_success_shape_drift" }],
    });
    expect(mapRedeemLtvSuccess({ already_claimed: false, claim_method: "ltv" }).ok).toBe(false);
    expect(
      mapRedeemLtvSuccess({ already_claimed: false, claim_method: "direct_purchase" }).ok,
    ).toBe(false);
    expect(
      mapRedeemLtvSuccess({ already_claimed: false, claim_method: "prepay_credit" }).ok,
    ).toBe(false);
    expect(
      mapRedeemLtvSuccess({ already_claimed: false, claim_method: "buy_outright" }).ok,
    ).toBe(false);
    warn.mockRestore();
  });
});

describe("legacy claimed_via mapping (N17)", () => {
  it("maps direct_purchase → buy_outright once per response", () => {
    const course = (via: string | null) => ({
      course_id: 1,
      slug: "x",
      title: "X",
      completion_status: "completed",
      completed_at: "2026-01-01T00:00:00Z",
      price_cents: 100,
      already_claimed: true,
      claimed_at: "2026-06-01T12:00:00Z",
      claimed_via: via,
      access_expires_at: null,
      paths: [
        path("redeem_ltv", false, 0, 100, "already_claimed"),
        path("prepay_credit", false, 0, 100, "already_claimed"),
        path("buy_outright", false, 0, 100, "already_claimed"),
      ],
    });
    const raw = {
      currency: "usd",
      ltv: { total_ltv_cents: 0, claimed_value_cents: 0, available_cents: 0 },
      courses: [course("direct_purchase"), { ...course("direct_purchase"), course_id: 2 }],
    };
    const built = buildClaimOptionsDto(raw);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.courses[0]!.claimed_via).toBe("buy_outright");
    expect(built.dto.courses[1]!.claimed_via).toBe("buy_outright");
    expect(built.logs.filter((l) => l.event === "legacy_claimed_via_mapped")).toHaveLength(1);
  });
});

describe("buyOutrightTitle (LR-6 / 1.2.5)", () => {
  it("uses formatUsdFromCents including cents", () => {
    expect(buyOutrightTitle(20000)).toBe(
      `Option 1 direct purchase (${formatUsdFromCents(20000)})`,
    );
    expect(buyOutrightTitle(20000)).toBe("Option 1 direct purchase ($200.00)");
    expect(buyOutrightTitle(34900)).toBe("Option 1 direct purchase ($349.00)");
  });
});

describe("isValidIdempotencyKey", () => {
  it("requires lowercase UUID v4", () => {
    expect(isValidIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidIdempotencyKey("550E8400-E29B-41D4-A716-446655440000")).toBe(false);
    expect(isValidIdempotencyKey("abcdefgh")).toBe(false);
  });
});

describe("CL-ERR-1 CLAIM_REASON_BY_UPSTREAM", () => {
  it("maps only known upstream codes to the 8 §PD-enum reasons", () => {
    const eight = [
      "legacy_stripe_member",
      "not_completed",
      "insufficient_ltv",
      "already_claimed",
      "not_subscriber",
      "no_shortfall",
      "membership_not_renewing",
      "course_not_purchasable",
    ] as const satisfies readonly ClaimIneligibleReason[];
    expectTypeOf<ClaimIneligibleReason>().toEqualTypeOf<(typeof eight)[number]>();
    // @ts-expect-error claim_in_progress is not a ClaimIneligibleReason
    const bad: ClaimIneligibleReason = "claim_in_progress";
    void bad;

    expect(Object.values(CLAIM_REASON_BY_UPSTREAM).every((r) => eight.includes(r))).toBe(true);
    expect(mapClaimIneligible("bsi_insufficient_certificate_ltv")).toEqual({
      error: "claim_ineligible",
      reason_code: "insufficient_ltv",
    });
    expect(mapClaimIneligible("bsi_prepay_legacy_stripe_member")).toEqual({
      error: "claim_ineligible",
      reason_code: "legacy_stripe_member",
    });
    expect(mapClaimIneligible("bsi_course_not_completed")).toEqual({
      error: "claim_ineligible",
      reason_code: "not_completed",
    });
    expect(mapClaimIneligible("bsi_unknown_code")).toBeNull();
    expect(mapClaimIneligible(null)).toBeNull();

    const codes = Object.keys(CLAIM_REASON_BY_UPSTREAM) as UpstreamClaimCode[];
    expect(codes.sort()).toEqual([
      "bsi_course_not_completed",
      "bsi_insufficient_certificate_ltv",
      "bsi_prepay_legacy_stripe_member",
    ]);
  });
});

describe("CL-T13 claim-options DTO maps (errata d6)", () => {
  it("CL-T13: CLF redeem shortfall 8000; no credit object / no combine", () => {
    const raw = {
      currency: "usd",
      ltv: { total_ltv_cents: 30000, claimed_value_cents: 8000, available_cents: 22000 },
      courses: [
        {
          course_id: 1,
          slug: "essentials",
          title: "Essentials",
          completion_status: "completed",
          completed_at: "2026-01-01T00:00:00Z",
          price_cents: 30000,
          already_claimed: false,
          claimed_at: null,
          claimed_via: null,
          access_expires_at: null,
          paths: [
            path("redeem_ltv", false, 8000, 30000, "insufficient_ltv"),
            path("prepay_credit", true, 8000, 30000, null),
            path("buy_outright", true, 30000, 30000, null),
          ],
        },
      ],
    };
    const built = buildClaimOptionsDto(raw);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.courses[0]!.paths[0]).toMatchObject({
      path: "redeem_ltv",
      reason_code: "insufficient_ltv",
      shortfall_cents: 8000,
    });
    const json = JSON.stringify(built.dto);
    expect(json).not.toContain("23300");
    expect(json).not.toContain("$233");
  });

});
