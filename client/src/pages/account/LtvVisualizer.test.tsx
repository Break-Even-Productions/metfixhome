/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LtvVisualizer } from "./LtvVisualizer";
import type { LtvCertificates } from "@/lib/account";

describe("LtvVisualizer (S-R3-2 / errata d3)", () => {
  it("renders em dash for null allocated_cents (not $0.00)", () => {
    const ltv: LtvCertificates = {
      total_ltv_cents: 30000,
      claimed_courses_value_cents: 10000,
      available_certificate_ltv_cents: 20000,
      claimed_certificates: [
        {
          course_id: 1,
          course_slug: "a",
          course_title: "Course A",
          allocated_cents: null,
          claimed_at: "2026-01-01T00:00:00Z",
          claim_method: "redeem_ltv",
        },
        {
          course_id: 2,
          course_slug: "b",
          course_title: "Course B",
          allocated_cents: 10000,
          claimed_at: "2026-01-02T00:00:00Z",
          claim_method: "redeem_ltv",
        },
      ],
      foundations_coach: {
        active: false,
        grant_reason: null,
        granted_at: null,
        expires_at: null,
        seminar_checked_in: false,
        metfix_essentials_completed: false,
        metfix_essentials_certificate_claimed: false,
      },
      canonical_tier: "metfix_pro",
    };
    render(<LtvVisualizer ltv={ltv} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("$0.00")).toBeNull();
  });
});
