import { describe, expect, it } from "vitest";
import { canUseBellyCoachingTools } from "./bellyCoaching";

describe("canUseBellyCoachingTools", () => {
  it("allows organization owners", () => {
    expect(
      canUseBellyCoachingTools({ canonical_tier: "free" }, "organization_owner"),
    ).toBe(true);
  });

  it("allows active Foundations coaches", () => {
    expect(
      canUseBellyCoachingTools(
        {
          foundations_coach: {
            active: true,
            grant_reason: "in_person_seminar",
            granted_at: "2026-01-01T00:00:00.000Z",
            expires_at: "2029-01-01T00:00:00.000Z",
            seminar_checked_in: true,
            metfix_essentials_completed: false,
            metfix_essentials_certificate_claimed: false,
          },
        },
        "metfix_pro",
      ),
    ).toBe(true);
  });

  it("allows coach/delegate/owner affiliate roles", () => {
    expect(
      canUseBellyCoachingTools({ canonical_tier: "metfix_pro" }, "metfix_pro", {
        affiliates: [{ affiliate_id: 1, role: "delegate" }],
        clients: [],
      }),
    ).toBe(true);
  });

  it("allows when an active client relationship exists", () => {
    expect(
      canUseBellyCoachingTools({ canonical_tier: "metfix_pro" }, "metfix_pro", {
        affiliates: [],
        clients: [{ status: "active" }],
      }),
    ).toBe(true);
  });

  it("denies free members without coach signals", () => {
    expect(
      canUseBellyCoachingTools(
        {
          foundations_coach: {
            active: false,
            grant_reason: null,
            granted_at: null,
            expires_at: null,
            seminar_checked_in: false,
            metfix_essentials_completed: false,
            metfix_essentials_certificate_claimed: false,
          },
        },
        "free",
        { affiliates: [{ affiliate_id: 1, role: "member" }], clients: [] },
      ),
    ).toBe(false);
  });
});
