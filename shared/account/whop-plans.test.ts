import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHOP_CHECKOUT_RETURN_PATH,
  isWhopCheckoutPlan,
  tierForWhopPlan,
  WHOP_CHECKOUT_PLANS,
  WHOP_PLAN_TO_TIER,
} from "./whop-plans";
import { sanitizeReturnPath } from "./returnPath";

describe("whop subscription plan map", () => {
  it("only allows pro and org aliases", () => {
    expect([...WHOP_CHECKOUT_PLANS]).toEqual(["pro", "org"]);
    expect(isWhopCheckoutPlan("pro")).toBe(true);
    expect(isWhopCheckoutPlan("org")).toBe(true);
    expect(isWhopCheckoutPlan("metfix_pro")).toBe(false);
    expect(isWhopCheckoutPlan("course")).toBe(false);
    expect(isWhopCheckoutPlan(null)).toBe(false);
  });

  it("maps plans to the 4 canonical tiers (subscriptions)", () => {
    expect(WHOP_PLAN_TO_TIER.pro).toBe("metfix_pro");
    expect(WHOP_PLAN_TO_TIER.org).toBe("organization_owner");
    expect(tierForWhopPlan("pro")).toBe("metfix_pro");
    expect(tierForWhopPlan("org")).toBe("organization_owner");
  });

  it("defaults checkout return to /checkout/complete", () => {
    expect(DEFAULT_WHOP_CHECKOUT_RETURN_PATH).toBe("/checkout/complete");
    expect(sanitizeReturnPath(DEFAULT_WHOP_CHECKOUT_RETURN_PATH)).toBe("/checkout/complete");
    expect(sanitizeReturnPath("/checkout/complete?status=succeeded")).toBe(
      "/checkout/complete?status=succeeded",
    );
    expect(sanitizeReturnPath("//evil.com")).toBeNull();
    expect(sanitizeReturnPath("https://evil.com")).toBeNull();
  });
});
