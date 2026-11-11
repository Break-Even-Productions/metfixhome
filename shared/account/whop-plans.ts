/**
 * Break Even Productions Whop subscription plan aliases for metfix.org.
 * Courses are out of scope — subscriptions only (pro / org).
 */
import type { CanonicalSubscriptionTier } from "./tiers";
import {
  proMembershipCta,
  proMembershipPriceLine,
} from "./pro-intro-offer";

/** Default Whop `redirect_url` path after subscription checkout. */
export const DEFAULT_WHOP_CHECKOUT_RETURN_PATH = "/checkout/complete";

/** Checkout plan aliases accepted by POST /api/billing/whop/checkout-session. */
export const WHOP_CHECKOUT_PLANS = ["pro", "org"] as const;
export type WhopCheckoutPlan = (typeof WHOP_CHECKOUT_PLANS)[number];

export function isWhopCheckoutPlan(value: unknown): value is WhopCheckoutPlan {
  return value === "pro" || value === "org";
}

/** Map Whop checkout plan aliases → canonical account tiers. */
export const WHOP_PLAN_TO_TIER: Record<WhopCheckoutPlan, CanonicalSubscriptionTier> = {
  pro: "metfix_pro",
  org: "organization_owner",
};

export function tierForWhopPlan(plan: WhopCheckoutPlan): CanonicalSubscriptionTier {
  return WHOP_PLAN_TO_TIER[plan];
}

/** Display copy for billing upgrade CTAs (subscriptions only). */
export const WHOP_SUBSCRIPTION_PLAN_COPY: Record<
  WhopCheckoutPlan,
  { title: string; price: string; cta: string }
> = {
  pro: {
    title: "MetFix Pro",
    price: proMembershipPriceLine(true),
    cta: "Start MetFix Pro",
  },
  org: {
    title: "Organization Owner",
    price: "$170/month · Approval required",
    cta: "Start Organization Owner",
  },
};

/** Pro plan marketing copy gated by first-time intro eligibility. */
export function whopProPlanCopy(introEligible: boolean): {
  title: string;
  price: string;
  cta: string;
} {
  return {
    title: "MetFix Pro",
    price: proMembershipPriceLine(introEligible),
    cta: introEligible ? proMembershipCta(true) : "Start MetFix Pro",
  };
}
