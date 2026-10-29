import { describe, expect, it } from "vitest";
import {
  availableCertificateLtvCents,
  CANONICAL_SUBSCRIPTION_TIERS,
  clampJoinDeepLink,
  coachCredentialStatus,
  facilityFlagsForRoles,
  isFoundationsCoachGranted,
  MEMBERSHIP_COMPARISON_ROWS,
  needsConditionalStep,
  ONBOARDING_ROLES,
  ONBOARDING_ROLE_IDS,
  parseJoinStepParam,
  resolveJoinStepTransition,
  showOrganizationOwnerCard,
} from "./membership-domain";
import { BEP_WHOP_COMPANY_ID, WHOP_ALLOWED_COMPANY_IDS } from "../account/whop";
import { sanitizeExternalBillingUrl } from "../account/url-allowlist";
import { sanitizeReturnPath } from "../sanitize-return-path";
import { computeThreeYearExpiryIso } from "../account/foundations-coach";

describe("membership-domain (WJ-TIER-1 / WJ-CERT-1 / WJ-COACH-*)", () => {
  it("exports exactly 4 canonical tiers", () => {
    expect([...CANONICAL_SUBSCRIPTION_TIERS]).toEqual([
      "free",
      "member",
      "metfix_pro",
      "organization_owner",
    ]);
    expect(CANONICAL_SUBSCRIPTION_TIERS).toHaveLength(4);
  });

  it("ONBOARDING_ROLES matches WJ5 titles/descriptions", () => {
    expect(ONBOARDING_ROLE_IDS).toHaveLength(5);
    expect(ONBOARDING_ROLES.map((r) => r.id)).toEqual([...ONBOARDING_ROLE_IDS]);
    expect(ONBOARDING_ROLES.find((r) => r.id === "individual")?.description).toBe(
      "Understand metabolism, nutrition, and chronic disease for your own health.",
    );
  });

  it("MEMBERSHIP_COMPARISON_ROWS has exactly 7 WJ17 rows", () => {
    expect(MEMBERSHIP_COMPARISON_ROWS).toHaveLength(7);
    expect(MEMBERSHIP_COMPARISON_ROWS[3]?.metfix).toMatch(/Cumulative LTV/);
    expect(MEMBERSHIP_COMPARISON_ROWS[4]?.metfix).toMatch(/valid 3 years/);
    expect(MEMBERSHIP_COMPARISON_ROWS[6]?.metfix).toMatch(/\$170\/mo/);
  });

  it("availableCertificateLtvCents — $300 LTV, claim $150+$50 → $100 left", () => {
    const total = 30000;
    const claimed = 15000 + 5000;
    expect(availableCertificateLtvCents(total, claimed)).toBe(10000);
    expect(availableCertificateLtvCents(total, claimed) < 20000).toBe(true);
  });

  it("Foundations Coach grant requires both essentials completion AND claim", () => {
    expect(
      isFoundationsCoachGranted({
        path: "essentials",
        courseCompleted: true,
        certificateClaimed: false,
      }),
    ).toBe(false);
    expect(
      isFoundationsCoachGranted({
        path: "essentials",
        courseCompleted: false,
        certificateClaimed: true,
      }),
    ).toBe(false);
    expect(
      isFoundationsCoachGranted({
        path: "essentials",
        courseCompleted: true,
        certificateClaimed: true,
      }),
    ).toBe(true);
    expect(isFoundationsCoachGranted({ path: "seminar", checkedIn: true })).toBe(true);
    expect(isFoundationsCoachGranted({ path: "seminar", checkedIn: false })).toBe(false);
  });

  it("leap-day expiry clamp via #21 computeThreeYearExpiryIso (WJ-COACH-2)", () => {
    expect(computeThreeYearExpiryIso("2026-10-28T00:00:00.000Z")).toBe("2029-10-28T00:00:00.000Z");
    expect(computeThreeYearExpiryIso("2028-02-29T00:00:00.000Z")).toBe("2031-02-28T00:00:00.000Z");
    expect(computeThreeYearExpiryIso("2028-02-28T00:00:00.000Z")).toBe("2031-02-28T00:00:00.000Z");
    expect(computeThreeYearExpiryIso("2028-03-01T00:00:00.000Z")).toBe("2031-03-01T00:00:00.000Z");
  });

  it("coachCredentialStatus: active before expiry, expired at/after", () => {
    expect(coachCredentialStatus("2029-10-28", "2026-10-28")).toBe("active");
    expect(coachCredentialStatus("2029-10-28", "2029-10-28")).toBe("expired");
    expect(coachCredentialStatus("2029-10-28", "2029-10-29")).toBe("expired");
    expect(coachCredentialStatus(null, "2026-10-28")).toBe("none");
  });

  it("needsConditionalStep only for gym_owner or clinician", () => {
    expect(needsConditionalStep(["individual"])).toBe(false);
    expect(needsConditionalStep(["gym_owner"])).toBe(true);
    expect(needsConditionalStep(["clinician"])).toBe(true);
  });

  it("resolveJoinStepTransition skips auth and conditional bidirectionally", () => {
    // signed out, individual
    expect(
      resolveJoinStepTransition("name", 1, { isSignedIn: false, roles: ["individual"] }),
    ).toBe("auth");
    expect(
      resolveJoinStepTransition("roles", 1, { isSignedIn: false, roles: ["individual"] }),
    ).toBe("path");
    expect(
      resolveJoinStepTransition("path", -1, { isSignedIn: false, roles: ["individual"] }),
    ).toBe("roles");
    expect(
      resolveJoinStepTransition("roles", -1, { isSignedIn: false, roles: ["individual"] }),
    ).toBe("auth");

    // signed in, individual — skip auth both ways
    expect(
      resolveJoinStepTransition("name", 1, { isSignedIn: true, roles: ["individual"] }),
    ).toBe("roles");
    expect(
      resolveJoinStepTransition("roles", -1, { isSignedIn: true, roles: ["individual"] }),
    ).toBe("name");

    // signed in, gym_owner — conditional included
    expect(
      resolveJoinStepTransition("roles", 1, { isSignedIn: true, roles: ["gym_owner"] }),
    ).toBe("conditional");
    expect(
      resolveJoinStepTransition("path", -1, { isSignedIn: true, roles: ["gym_owner"] }),
    ).toBe("conditional");

    // signed out, clinician
    expect(
      resolveJoinStepTransition("roles", 1, { isSignedIn: false, roles: ["clinician"] }),
    ).toBe("conditional");
  });

  it("sanitizeReturnPath rejects open redirects", () => {
    expect(sanitizeReturnPath("/join?step=roles")).toBe("/join?step=roles");
    expect(sanitizeReturnPath("//evil.com")).toBeNull();
    expect(sanitizeReturnPath("https://evil.com")).toBeNull();
    expect(sanitizeReturnPath("javascript:alert(1)")).toBeNull();
  });

  it("Whop checkout URLs go through #21 sanitizeExternalBillingUrl(whop_only)", () => {
    expect(sanitizeExternalBillingUrl("https://whop.com/c/x", "whop_only")).toBe(
      "https://whop.com/c/x",
    );
    expect(sanitizeExternalBillingUrl("https://checkout.whop.com/x", "whop_only")).toBe(
      "https://checkout.whop.com/x",
    );
    expect(sanitizeExternalBillingUrl("http://whop.com/x", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("https://evilwhop.com", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("https://whop.com.evil.io", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("https://u:p@whop.com", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("https://curie.whop.com/x", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("javascript:alert(1)", "whop_only")).toBeNull();
  });

  it("clampJoinDeepLink (B4) + facilityFlags (B3)", () => {
    expect(parseJoinStepParam("auth")).toBe("auth");
    expect(parseJoinStepParam("nope")).toBeNull();
    expect(clampJoinDeepLink("auth", { isSignedIn: true, roles: [] })).toBe("roles");
    expect(clampJoinDeepLink("path", { isSignedIn: false, roles: [] })).toBe("name");
    expect(clampJoinDeepLink("conditional", { isSignedIn: true, roles: ["individual"] })).toBe(
      "roles",
    );
    expect(facilityFlagsForRoles(["coach"], true, true)).toEqual({
      has_physical_gym: null,
      has_physical_clinic: null,
    });
    expect(showOrganizationOwnerCard(["gym_owner"], true, null)).toBe(true);
    expect([...WHOP_ALLOWED_COMPANY_IDS]).toEqual([BEP_WHOP_COMPANY_ID]);
  });
});
