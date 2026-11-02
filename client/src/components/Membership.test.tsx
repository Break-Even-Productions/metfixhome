/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_HERO } from "@shared/join";
import { Membership } from "./Membership";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Membership P-WJ-9", () => {
  it("renders hero copy and 7-row comparison table (WJ16/WJ17)", () => {
    const onJoin = vi.fn();
    render(<Membership onJoin={onJoin} />);
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    expect(screen.getByText(MEMBERSHIP_HERO.subcopy)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MEMBERSHIP_HERO.cta }));
    expect(onJoin).toHaveBeenCalledTimes(1);

    const table = screen.getByRole("table", { name: /MetFix vs Free/i });
    expect(table).toBeTruthy();
    for (const row of MEMBERSHIP_COMPARISON_ROWS) {
      expect(screen.getByText(row.feature)).toBeTruthy();
      expect(screen.getAllByText(row.metfix).length).toBeGreaterThan(0);
      expect(screen.getAllByText(row.free).length).toBeGreaterThan(0);
    }
    expect(MEMBERSHIP_COMPARISON_ROWS).toHaveLength(7);
    expect(screen.getByText(/Cumulative LTV Budget/i)).toBeTruthy();
    expect(screen.getAllByText(/valid 3 years/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$170\/mo Organization Owner/i)).toBeTruthy();
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
