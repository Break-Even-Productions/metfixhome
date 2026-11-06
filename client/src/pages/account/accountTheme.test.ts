import { describe, expect, it } from "vitest";
import type { AccountOverview } from "@/lib/account";
import { resolveAccountAccentTheme } from "./accountTheme";

function overview(
  partial: Partial<AccountOverview> & {
    onboarding_roles?: AccountOverview["onboarding_roles"];
    badges?: Partial<AccountOverview["badges"]>;
    foundations_coach?: Partial<AccountOverview["foundations_coach"]>;
  } = {},
): AccountOverview {
  return {
    user_id: 1,
    member_id: 1,
    display_name: "Test",
    email: null,
    member_since: null,
    badges: {
      medical: false,
      affiliate: false,
      subscription: false,
      foundations_coach: false,
      ...partial.badges,
    },
    canonical_tier: "free",
    foundations_coach: {
      active: false,
      grant_reason: null,
      granted_at: null,
      expires_at: null,
      seminar_checked_in: false,
      metfix_essentials_completed: false,
      metfix_essentials_certificate_claimed: false,
      ...partial.foundations_coach,
    },
    tabs: [],
    links: {},
    onboarding_roles: partial.onboarding_roles ?? [],
    ...partial,
  };
}

describe("resolveAccountAccentTheme", () => {
  it("maps onboarding roles to home accent themes", () => {
    expect(resolveAccountAccentTheme(overview({ onboarding_roles: ["individual"] }))).toBe(
      "individual",
    );
    expect(resolveAccountAccentTheme(overview({ onboarding_roles: ["coach"] }))).toBe("coach");
    expect(resolveAccountAccentTheme(overview({ onboarding_roles: ["gym_owner"] }))).toBe("gym");
    expect(resolveAccountAccentTheme(overview({ onboarding_roles: ["clinician"] }))).toBe(
      "clinician",
    );
    expect(resolveAccountAccentTheme(overview({ onboarding_roles: ["first_responder"] }))).toBe(
      "responder",
    );
  });

  it("prefers clinician/responder/gym/coach over individual when multiple selected", () => {
    expect(
      resolveAccountAccentTheme(
        overview({ onboarding_roles: ["individual", "coach", "clinician"] }),
      ),
    ).toBe("clinician");
    expect(
      resolveAccountAccentTheme(overview({ onboarding_roles: ["individual", "gym_owner"] })),
    ).toBe("gym");
    expect(
      resolveAccountAccentTheme(
        overview({ onboarding_roles: ["coach", "first_responder"] }),
      ),
    ).toBe("responder");
  });

  it("falls back to blue coach theme for foundations coach or affiliate entitlements", () => {
    expect(
      resolveAccountAccentTheme(
        overview({ foundations_coach: { active: true }, onboarding_roles: [] }),
      ),
    ).toBe("coach");
    expect(
      resolveAccountAccentTheme(
        overview({ badges: { foundations_coach: true }, onboarding_roles: [] }),
      ),
    ).toBe("coach");
    expect(
      resolveAccountAccentTheme(overview({ badges: { affiliate: true }, onboarding_roles: [] })),
    ).toBe("coach");
  });

  it("keeps onboarding role over entitlement fallback", () => {
    expect(
      resolveAccountAccentTheme(
        overview({
          onboarding_roles: ["individual"],
          foundations_coach: { active: true },
          badges: { affiliate: true },
        }),
      ),
    ).toBe("individual");
  });

  it("defaults to individual when no roles or entitlements", () => {
    expect(resolveAccountAccentTheme(overview())).toBe("individual");
    expect(resolveAccountAccentTheme(null)).toBe("individual");
  });
});
