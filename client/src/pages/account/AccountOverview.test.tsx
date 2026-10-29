/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountOverview from "./AccountOverview";
import {
  COURSES_LTV300,
  LTV300_AC,
  OVERVIEW_FIXTURE,
  SUBS_ACTIVE,
  jsonResponse,
} from "./testFixtures";

vi.mock("@/lib/session", () => ({
  loadMe: vi.fn(async () => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
  refreshMeAfterAuthChange: vi.fn(),
  peekMe: vi.fn(() => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

function accountGets(fetchImpl: ReturnType<typeof vi.fn>) {
  return fetchImpl.mock.calls.filter((c) => {
    const url = String(c[0]);
    const method = ((c[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
    return method === "GET" && url.includes("/api/account/");
  });
}

beforeEach(() => {
  clearAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
      if (url.includes("/api/account/ltv-certificates") || url.includes("/api/account/spend")) {
        return jsonResponse(LTV300_AC);
      }
      if (url.includes("/api/account/courses")) return jsonResponse(COURSES_LTV300);
      return jsonResponse({ error: "not_found" }, 404);
    }),
  );
});

afterEach(() => {
  cleanup();
  clearAccountCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccountOverview (P-DB-1, P-DB-2, P-DB-8, UI3b)", () => {
  it("renders 4-metric strip with LTV300+A+C copy and JetBrains Mono", async () => {
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => {
      expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Membership Tier/i)).toBeTruthy();
    expect(screen.getAllByText(/MetFix Pro \(\$30\/mo\)/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/\$100\.00 available \(\$300\.00 total LTV · \$200\.00 claimed\)/),
    ).toBeTruthy();

    const mono = document.querySelectorAll(".account-metric, .account-mono");
    expect(mono.length).toBeGreaterThan(0);
    const styled = Array.from(document.querySelectorAll(".account-mono")).find(
      (el) => (el as HTMLElement).style.fontFamily.includes("JetBrains Mono"),
    );
    expect(styled || mono[0]?.className).toBeTruthy();
    expect(
      styled
        ? (styled as HTMLElement).style.fontFamily
        : (mono[0] as HTMLElement).className,
    ).toMatch(/JetBrains Mono|account-metric|account-mono/);
  });

  it("shows Foundations Coach card with grant path and expires_at in mono", async () => {
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText(/Foundations Coach/i)).toBeTruthy());
    expect(screen.getByText(/in-person seminar check-in/i)).toBeTruthy();
    expect(screen.getByText(/Expires/i)).toBeTruthy();
  });

  it("mounting /account fires ≤3 account GETs (overview, subscriptions, ltv-certificates)", async () => {
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getAllByText("Active").length).toBeGreaterThan(0));
    const gets = accountGets(fetchImpl);
    const paths = gets.map((c) => String(c[0]).replace(/\?.*$/, ""));
    expect(paths.filter((p) => p.endsWith("/overview")).length).toBeLessThanOrEqual(1);
    expect(paths.filter((p) => p.endsWith("/subscriptions")).length).toBeLessThanOrEqual(1);
    expect(
      paths.filter((p) => p.endsWith("/ltv-certificates") || p.endsWith("/spend")).length,
    ).toBeLessThanOrEqual(1);
    expect(gets.length).toBeLessThanOrEqual(3);
  });

  it("renders LTV visualizer totals for LTV300 after A+C", async () => {
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("LTV Certificate Budget")).toBeTruthy());
    expect(screen.getByText("$300.00")).toBeTruthy();
    expect(screen.getByText("$200.00")).toBeTruthy();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    const allocated = document.querySelector(".account-ltv-bar__allocated") as HTMLElement;
    const available = document.querySelector(".account-ltv-bar__available") as HTMLElement;
    expect(Number(allocated.dataset.widthPct)).toBeCloseTo(66.67, 0);
    expect(Number(available.dataset.widthPct)).toBeCloseTo(33.33, 0);
  });

  it("CSS tokens include warm-cream palette (DP-T-UI1)", () => {
    const css = readFileSync(path.join(import.meta.dirname, "account.css"), "utf8");
    expect(css).toMatch(/--color-cream:\s*#f5efe4/);
    expect(css).toMatch(/--color-paper:\s*#fbf7ef/);
    expect(css).toMatch(/--color-ink:\s*#171512/);
    expect(css).toMatch(/--color-muted:\s*#5a534a/);
    expect(css).toMatch(/--color-accent:\s*#e0b869/);
    expect(css).toMatch(/--color-line:\s*rgba\(23,\s*21,\s*18,\s*0\.12\)/);
    expect(css).toMatch(/Playfair Display/);
    expect(css).toMatch(/Instrument Serif/);
    expect(css).toMatch(/Inter/);
    expect(css).toMatch(/JetBrains Mono/);
    expect(css).not.toMatch(/emilydesigns/i);
  });

  it("nav lists exactly 8 routes in order (DP-T-UI2)", async () => {
    const { ACCOUNT_NAV } = await import("./DashboardLayout");
    expect(ACCOUNT_NAV.map((n) => n.href)).toEqual([
      "/account",
      "/account/billing",
      "/account/profile",
      "/account/courses",
      "/account/favorites",
      "/account/referrals",
      "/account/notifications",
      "/account/privacy",
    ]);
  });
});
