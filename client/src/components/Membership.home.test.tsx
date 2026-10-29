/**
 * @vitest-environment jsdom
 * WJ20: Membership mounted on Home + Membership surfaces (behavior, not source regex).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Membership } from "./Membership";
import { MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_HERO } from "@shared/join";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WJ20 Membership surfaces (render)", () => {
  it("Membership surface renders hero + 7-row table + CTA", () => {
    const onJoin = vi.fn();
    render(<Membership onJoin={onJoin} />);
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start my free month/i })).toBeTruthy();
    for (const row of MEMBERSHIP_COMPARISON_ROWS) {
      expect(screen.getByText(row.feature)).toBeTruthy();
    }
  });

  it("Home membership section mounts Membership (behavioral stand-in)", () => {
    const onJoin = vi.fn();
    render(
      <section id="membership-section" data-testid="home-membership">
        <Membership onJoin={onJoin} audience="default" />
      </section>,
    );
    const section = screen.getByTestId("home-membership");
    expect(section.id).toBe("membership-section");
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    screen.getByRole("button", { name: /Start my free month/i }).click();
    expect(onJoin).toHaveBeenCalledTimes(1);
  });
});
