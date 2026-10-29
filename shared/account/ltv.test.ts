import { describe, expect, it } from "vitest";
import {
  computeLtvBudget,
  evaluateCourseCertificateEligibility,
  formatUsdFromCents,
  toNonNegativeSafeCents,
} from "./ltv";

describe("toNonNegativeSafeCents", () => {
  it("accepts non-negative safe integers", () => {
    expect(toNonNegativeSafeCents(0)).toBe(0);
    expect(toNonNegativeSafeCents(30000)).toBe(30000);
  });

  it("rejects floats, NaN, negatives, and non-numbers", () => {
    expect(() => toNonNegativeSafeCents(150.5)).toThrow("invalid_cents");
    expect(() => toNonNegativeSafeCents(NaN)).toThrow("invalid_cents");
    expect(() => toNonNegativeSafeCents(-100)).toThrow("invalid_cents");
    expect(() => toNonNegativeSafeCents("30000")).toThrow("invalid_cents");
    expect(() => toNonNegativeSafeCents(null)).toThrow("invalid_cents");
  });
});

describe("computeLtvBudget / evaluateCourseCertificateEligibility (DP-T-CERT3 LTV300)", () => {
  const TOTAL = 30000;
  const COURSE_A = 15000;
  const COURSE_B = 20000;
  const COURSE_C = 5000;

  it("after claiming A+C: claimed 20000, available 10000; B is insufficient_ltv", () => {
    const afterA = computeLtvBudget(TOTAL, COURSE_A);
    expect(afterA.available_certificate_ltv_cents).toBe(15000);

    const afterAC = computeLtvBudget(TOTAL, COURSE_A + COURSE_C);
    expect(afterAC.claimed_courses_value_cents).toBe(20000);
    expect(afterAC.available_certificate_ltv_cents).toBe(10000);
    expect(afterAC.utilization_percent).toBe(67);

    const evalB = evaluateCourseCertificateEligibility(
      {
        course_price_cents: COURSE_B,
        completed: true,
        certificate_claimed: false,
      },
      afterAC.available_certificate_ltv_cents,
    );
    expect(evalB).toEqual({
      status: "insufficient_ltv",
      required_cents: 20000,
      available_cents: 10000,
      shortfall_cents: 10000,
    });
  });

  it("price equal to available succeeds; one cent over fails with shortfall 1", () => {
    const available = 10000;
    expect(
      evaluateCourseCertificateEligibility(
        { course_price_cents: 10000, completed: true, certificate_claimed: false },
        available,
      ),
    ).toEqual({
      status: "eligible_ltv",
      required_cents: 10000,
      remaining_after_claim_cents: 0,
    });
    expect(
      evaluateCourseCertificateEligibility(
        { course_price_cents: 10001, completed: true, certificate_claimed: false },
        available,
      ),
    ).toEqual({
      status: "insufficient_ltv",
      required_cents: 10001,
      available_cents: 10000,
      shortfall_cents: 1,
    });
  });

  it("CERT3b: clamps available at 0 when claimed exceeds total; keeps claimed", () => {
    const budget = computeLtvBudget(30000, 50000);
    expect(budget.available_certificate_ltv_cents).toBe(0);
    expect(budget.claimed_courses_value_cents).toBe(50000);
    expect(budget.utilization_percent).toBe(100);
  });

  it("purchased_directly completed → eligible_direct_purchase; claimed returns method", () => {
    expect(
      evaluateCourseCertificateEligibility(
        {
          course_price_cents: COURSE_B,
          completed: true,
          certificate_claimed: false,
          purchased_directly: true,
        },
        0,
      ),
    ).toEqual({ status: "eligible_direct_purchase" });

    expect(
      evaluateCourseCertificateEligibility(
        {
          course_price_cents: COURSE_A,
          completed: true,
          certificate_claimed: true,
          claim_method: "ltv",
        },
        10000,
      ),
    ).toEqual({ status: "claimed", method: "ltv" });
  });

  it("incomplete courses return incomplete status", () => {
    expect(
      evaluateCourseCertificateEligibility(
        { course_price_cents: COURSE_B, completed: false, certificate_claimed: false },
        10000,
      ),
    ).toEqual({
      status: "incomplete",
      required_cents: 20000,
      shortfall_cents: 10000,
    });
  });
});

describe("formatUsdFromCents", () => {
  it("formats always with two decimal places (QA CERT4 $300.00 style)", () => {
    expect(formatUsdFromCents(30000)).toBe("$300.00");
    expect(formatUsdFromCents(15000)).toBe("$150.00");
    expect(formatUsdFromCents(10050)).toBe("$100.50");
    expect(formatUsdFromCents(0)).toBe("$0.00");
  });
});
