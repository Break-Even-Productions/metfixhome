/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountRewards from "./AccountRewards";

vi.mock("./DashboardLayout", () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1 data-testid="layout-title">{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("./LtvVisualizer", () => ({
  LtvVisualizer: () => <div data-testid="ltv-visualizer" />,
}));

vi.mock("@/lib/account", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account")>("@/lib/account");
  return {
    ...actual,
    loadRewards: vi.fn(),
  };
});

import { loadRewards } from "@/lib/account";

describe("AccountRewards", () => {
  beforeEach(() => {
    vi.mocked(loadRewards).mockReset();
  });

  it("renders available LTV and soft-gated offers copy", async () => {
    vi.mocked(loadRewards).mockResolvedValue({
      currency: "USD",
      dashboard_enabled: true,
      offers_live: false,
      tier: {
        canonical_tier: "metfix_pro",
        personas: { metfix_pro: true, free: false },
        audience_keys: ["metfix_pro"],
      },
      ltv: {
        total_cents: 30000,
        available_cents: 10000,
        claimed_certificate_cents: 20000,
        claimed_certificates: [],
        foundations_coach: null,
      },
      class_claims: {
        enabled: false,
        mode: "windowed",
        used: 0,
        cap_n: 1,
        window_start: null,
        resets_at: null,
        calendar_month: { used: 0, start: null, end: null },
        active: [],
      },
      offers: [],
      referrals: { href: "/bsi/v1/me/referrals" },
      links: { spend: "/bsi/v1/me/spend" },
    });

    render(<AccountRewards />);

    await waitFor(() => {
      expect(screen.getByText(/\$100\.00/)).toBeTruthy();
    });
    expect(screen.getByText(/MetFix Pro/)).toBeTruthy();
    expect(screen.getByText(/once Rewards offers go live/i)).toBeTruthy();
    expect(screen.getByTestId("ltv-visualizer")).toBeTruthy();
  });
});
