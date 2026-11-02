/**
 * @vitest-environment jsdom
 * WJ20: Membership mounted on Home + Membership surfaces (behavior, not source regex).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Membership } from "./Membership";
import { MEMBERSHIP_HERO } from "@shared/join";
import { FALLBACK_MEMBERSHIP_COMPARISON } from "@/data/home/membershipComparison";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WJ20 Membership surfaces (render)", () => {
  it("Membership surface renders hero + comparison + CTA", () => {
    const onJoin = vi.fn();
    render(<Membership onJoin={onJoin} />);
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start my free month/i })).toBeTruthy();
    for (const row of FALLBACK_MEMBERSHIP_COMPARISON.rows) {
      expect(screen.getByText(row.feature)).toBeTruthy();
    }
  });

  it("Home membership section mounts Membership (behavioral stand-in)", () => {
    const onJoin = vi.fn();
    render(
      <section id="membership-section" data-testid="home-membership">
        <Membership onJoin={onJoin} audience="#for-individuals" />
      </section>,
    );
    const section = screen.getByTestId("home-membership");
    expect(section.id).toBe("membership-section");
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    screen.getByRole("button", { name: /Start my free month/i }).click();
    expect(onJoin).toHaveBeenCalledTimes(1);
  });
});
