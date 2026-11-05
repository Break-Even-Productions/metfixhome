import { describe, expect, it } from "vitest";
import { shouldSkipProRecommendation } from "./membership-access";

const freeOverview = {
  canonical_tier: "free" as const,
  badges: { medical: false, affiliate: false, subscription: false, foundations_coach: false },
};

describe("shouldSkipProRecommendation", () => {
  it("still offers Pro to a free account", () => {
    expect(
      shouldSkipProRecommendation({ canonical_tier: "free", items: [] }, freeOverview),
    ).toBe(false);
  });

  it("skips Pro for an active MetFix Pro subscription even when the stored tier is free", () => {
    expect(
      shouldSkipProRecommendation(
        {
          canonical_tier: "free",
          items: [
            {
              sub_ref: "pro",
              provider: "whop",
              tier: "metfix_pro",
              status: "active",
              current_period_end: null,
              paid_through: null,
              cancel_at_period_end: false,
              card: null,
            },
          ],
        },
        freeOverview,
      ),
    ).toBe(true);
  });

  it("skips Pro for an active affiliate whose canonical tier stays free", () => {
    expect(
      shouldSkipProRecommendation(
        {
          canonical_tier: "free",
          items: [
            {
              sub_ref: "aff",
              provider: "stripe",
              tier: "organization_owner",
              legacy_source: "affiliate_stripe",
              status: "active",
              current_period_end: null,
              paid_through: null,
              cancel_at_period_end: false,
              card: null,
            },
          ],
        },
        freeOverview,
      ),
    ).toBe(true);
    expect(
      shouldSkipProRecommendation(
        { canonical_tier: "free", items: [] },
        { ...freeOverview, badges: { ...freeOverview.badges, affiliate: true } },
      ),
    ).toBe(true);
  });

  it("skips Pro for an active medical member", () => {
    expect(
      shouldSkipProRecommendation(
        {
          canonical_tier: "free",
          items: [
            {
              sub_ref: "med",
              provider: "stripe",
              tier: "free",
              legacy_source: "medical_society_stripe",
              status: "active",
              current_period_end: null,
              paid_through: null,
              cancel_at_period_end: false,
              card: null,
            },
          ],
        },
        freeOverview,
      ),
    ).toBe(true);
    expect(
      shouldSkipProRecommendation(
        { canonical_tier: "free", items: [] },
        { ...freeOverview, badges: { ...freeOverview.badges, medical: true } },
      ),
    ).toBe(true);
  });

  it("still offers Pro when the MetFix Pro subscription is canceled", () => {
    expect(
      shouldSkipProRecommendation(
        {
          canonical_tier: "free",
          items: [
            {
              sub_ref: "pro",
              provider: "whop",
              tier: "metfix_pro",
              status: "canceled",
              current_period_end: null,
              paid_through: null,
              cancel_at_period_end: false,
              card: null,
            },
          ],
        },
        freeOverview,
      ),
    ).toBe(false);
  });
});
