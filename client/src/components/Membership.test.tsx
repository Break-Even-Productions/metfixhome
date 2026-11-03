/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { MEMBERSHIP_HERO } from "@shared/join";
import {
  FALLBACK_MEMBERSHIP_COMPARISON,
  resolveMembershipComparisonRows,
} from "@/data/home/membershipComparison";
import { Membership, type MembershipProps } from "./Membership";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderMembership(props: MembershipProps) {
  return render(
    <Router>
      <Membership {...props} />
    </Router>,
  );
}

describe("Membership comparison", () => {
  it("renders hero copy and check/X comparison for standard audiences", () => {
    const onJoin = vi.fn();
    renderMembership({ onJoin, audience: "#for-individuals" });
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    expect(screen.getByText(MEMBERSHIP_HERO.subcopy)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MEMBERSHIP_HERO.cta }));
    expect(onJoin).toHaveBeenCalledTimes(1);

    const table = screen.getByRole("table", { name: /MetFix Pro vs Free membership comparison/i });
    expect(table).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: /Affiliate/i })).toBeNull();
    expect(screen.queryByText(/\$30\/mo/i)).toBeNull();
    expect(screen.queryByText(/Daily Fix Embed/i)).toBeNull();

    for (const row of FALLBACK_MEMBERSHIP_COMPARISON.rows) {
      expect(screen.getByText(row.feature)).toBeTruthy();
    }
    expect(screen.getByText("1/mo")).toBeTruthy();
    expect(screen.getAllByLabelText(/^Included/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Not included").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(/Included — Access to most resources/i),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Join MetFix Pro/i }));
    expect(onJoin).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("link", { name: /Become an Affiliate/i })).toBeNull();
  });

  it("adds Affiliate column, Daily Fix Embed, and affiliate CTA for gym owners", () => {
    renderMembership({ onJoin: () => {}, audience: "#for-gym-owners" });
    expect(
      screen.getByRole("table", { name: /MetFix Pro vs Free vs Affiliate/i }),
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Affiliate/i })).toBeTruthy();
    expect(screen.getByText(/Daily Fix Embed/i)).toBeTruthy();
    expect(screen.getByText("Unlimited")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Become an Affiliate/i })).toBeTruthy();

    const expected = resolveMembershipComparisonRows(
      FALLBACK_MEMBERSHIP_COMPARISON,
      "#for-gym-owners",
    );
    expect(expected.length).toBe(
      FALLBACK_MEMBERSHIP_COMPARISON.rows.length +
        FALLBACK_MEMBERSHIP_COMPARISON.affiliateExtraRows.length,
    );
    for (const row of expected) {
      expect(screen.getByText(row.feature)).toBeTruthy();
    }
  });

  it("shows Affiliate for clinicians and organizations", () => {
    const { rerender } = renderMembership({
      onJoin: () => {},
      audience: "#for-clinicians",
    });
    expect(screen.getByRole("columnheader", { name: /Affiliate/i })).toBeTruthy();
    rerender(
      <Router>
        <Membership onJoin={() => {}} audience="#for-organizations" />
      </Router>,
    );
    expect(screen.getByRole("columnheader", { name: /Affiliate/i })).toBeTruthy();
  });

  it("does not use WebGL LiquidGlass or direct DOM node removal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "client/src/components/Membership.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/\.remove\s*\(/);
    expect(src).not.toMatch(/LiquidGlass|liquidglass|startLiquidGlass/);
    expect(src).toMatch(/membership-glass/);
  });
});
