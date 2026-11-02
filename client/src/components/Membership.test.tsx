/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_HERO } from "@shared/join";
import {
  FALLBACK_MEMBERSHIP_COMPARISON,
  resolveMembershipComparisonRows,
} from "@/data/home/membershipComparison";
import { Membership } from "./Membership";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Membership comparison", () => {
  it("renders hero copy and check/X comparison for standard audiences", () => {
    const onJoin = vi.fn();
    render(<Membership onJoin={onJoin} audience="#for-individuals" />);
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    expect(screen.getByText(MEMBERSHIP_HERO.subcopy)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MEMBERSHIP_HERO.cta }));
    expect(onJoin).toHaveBeenCalledTimes(1);

    const table = screen.getByRole("table", { name: /MetFix Pro vs Free membership comparison/i });
    expect(table).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: /Affiliate/i })).toBeNull();

    for (const row of FALLBACK_MEMBERSHIP_COMPARISON.rows) {
      expect(screen.getByText(row.feature)).toBeTruthy();
    }
    expect(screen.getByText("4/mo")).toBeTruthy();
    expect(screen.getAllByLabelText("Included").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Not included").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Revenue share on client/i)).toBeNull();
  });

  it("adds Affiliate column and extra rows for gym owners", () => {
    render(<Membership onJoin={() => {}} audience="#for-gym-owners" />);
    expect(
      screen.getByRole("table", { name: /MetFix Pro vs Free vs Affiliate/i }),
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Affiliate/i })).toBeTruthy();
    expect(screen.getByText(/Revenue share on client/i)).toBeTruthy();
    expect(screen.getByText("All included")).toBeTruthy();

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
    const { rerender } = render(
      <Membership onJoin={() => {}} audience="#for-clinicians" />,
    );
    expect(screen.getByRole("columnheader", { name: /Affiliate/i })).toBeTruthy();
    rerender(<Membership onJoin={() => {}} audience="#for-organizations" />);
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
