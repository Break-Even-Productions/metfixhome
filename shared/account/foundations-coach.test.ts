import { describe, expect, it } from "vitest";
import {
  computeThreeYearExpiryIso,
  normalizeFoundationsCoachStatus,
} from "./foundations-coach";

describe("computeThreeYearExpiryIso (DP-T-COACH4 / CQ Feb28)", () => {
  it("adds three UTC years", () => {
    expect(computeThreeYearExpiryIso("2026-01-15T00:00:00.000Z")).toBe(
      "2029-01-15T00:00:00.000Z",
    );
  });

  it("leap-day 2024-02-29 → 2027-02-28 (clamp, not March 1)", () => {
    expect(computeThreeYearExpiryIso("2024-02-29T00:00:00.000Z")).toBe(
      "2027-02-28T00:00:00.000Z",
    );
  });

  it("returns null for invalid granted_at", () => {
    expect(computeThreeYearExpiryIso("not-a-date")).toBeNull();
  });
});

describe("normalizeFoundationsCoachStatus (CQ B1)", () => {
  const expiresAt = "2029-01-15T00:00:00.000Z";
  const grantedAt = "2026-01-15T00:00:00.000Z";
  const expiresMs = Date.parse(expiresAt);

  it("missing granted_at → INACTIVE even with a qualifying path", () => {
    const status = normalizeFoundationsCoachStatus(
      {
        seminar_checked_in: true,
        // granted_at omitted
        expires_at: expiresAt,
      },
      expiresMs - 1,
    );
    expect(status.active).toBe(false);
    expect(status.grant_reason).toBe("in_person_seminar");
    expect(status.granted_at).toBeNull();
    expect(status.expires_at).toBeNull();
  });

  it("derives expires_at = granted_at + 3y when upstream omits it", () => {
    const status = normalizeFoundationsCoachStatus(
      {
        seminar_checked_in: true,
        granted_at: grantedAt,
      },
      expiresMs - 1,
    );
    expect(status.expires_at).toBe(expiresAt);
    expect(status.active).toBe(true);
    expect(status.grant_reason).toBe("in_person_seminar");
  });

  it("takes earlier of computed vs BSI expires_at", () => {
    const earlierBsi = "2028-06-01T00:00:00.000Z"; // before computed 2029-01-15
    const status = normalizeFoundationsCoachStatus(
      {
        seminar_checked_in: true,
        granted_at: grantedAt,
        expires_at: earlierBsi,
      },
      Date.parse(earlierBsi) - 1,
    );
    expect(status.expires_at).toBe(earlierBsi);
    expect(status.active).toBe(true);

    const laterBsi = "2030-01-01T00:00:00.000Z"; // after computed
    const status2 = normalizeFoundationsCoachStatus(
      {
        seminar_checked_in: true,
        granted_at: grantedAt,
        expires_at: laterBsi,
      },
      expiresMs - 1,
    );
    expect(status2.expires_at).toBe(expiresAt); // computed wins (earlier)
  });

  it("now === expires_at → active false; grant_reason retained", () => {
    const status = normalizeFoundationsCoachStatus(
      {
        seminar_checked_in: true,
        granted_at: grantedAt,
        expires_at: expiresAt,
      },
      expiresMs,
    );
    expect(status.active).toBe(false);
    expect(status.grant_reason).toBe("in_person_seminar");
    expect(status.expires_at).toBe(expiresAt);
  });

  it("now = expires_at + 1 day → active false", () => {
    const status = normalizeFoundationsCoachStatus(
      {
        metfix_essentials_completed: true,
        metfix_essentials_certificate_claimed: true,
        granted_at: grantedAt,
        expires_at: expiresAt,
      },
      expiresMs + 86_400_000,
    );
    expect(status.active).toBe(false);
    expect(status.grant_reason).toBe("metfix_essentials_certificate");
  });

  it("ignores upstream active without a qualifying path; zero LTV input", () => {
    const status = normalizeFoundationsCoachStatus({
      active: true,
      total_ltv_cents: 500000,
      seminar_checked_in: false,
      metfix_essentials_completed: false,
      metfix_essentials_certificate_claimed: false,
    });
    expect(status.active).toBe(false);
    expect(status.grant_reason).toBeNull();
    expect(status.granted_at).toBeNull();
    expect(status.expires_at).toBeNull();
  });

  it("Path B requires both completed and certificate claimed", () => {
    const incomplete = normalizeFoundationsCoachStatus({
      metfix_essentials_completed: true,
      metfix_essentials_certificate_claimed: false,
      granted_at: grantedAt,
    });
    expect(incomplete.active).toBe(false);
    expect(incomplete.grant_reason).toBeNull();
  });
});
