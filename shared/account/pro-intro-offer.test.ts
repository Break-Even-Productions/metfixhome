import { describe, expect, it } from "vitest";
import {
  isProIntroOfferEligible,
  proMembershipCta,
  proMembershipPriceLine,
} from "./pro-intro-offer";

describe("pro intro offer helpers", () => {
  it("defaults to eligible when source is missing", () => {
    expect(isProIntroOfferEligible(null)).toBe(true);
    expect(isProIntroOfferEligible(undefined)).toBe(true);
    expect(isProIntroOfferEligible({})).toBe(true);
  });

  it("honors explicit server flag", () => {
    expect(isProIntroOfferEligible({ pro_intro_offer_eligible: true })).toBe(true);
    expect(isProIntroOfferEligible({ pro_intro_offer_eligible: false })).toBe(false);
  });

  it("swaps CTA and price for returning buyers", () => {
    expect(proMembershipCta(true)).toMatch(/free month/i);
    expect(proMembershipCta(false)).toBe("Start MetFix Pro");
    expect(proMembershipPriceLine(false)).toBe("$30/month · Cancel anytime");
  });
});
