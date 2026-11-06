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
} from "../../../test/account/testFixtures";

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
      if (url.includes("/api/account/calendar/surface")) {
        return jsonResponse({
          meal_counts: {},
          workout_counts: {},
          brain_counts: {},
          event_counts: {},
          meta: { start_date: "2026-11-01", end_date: "2026-11-30", total_dates: 30 },
        });
      }
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
  it("renders 4-metric strip with LTV300+A+C copy and tabular-nums mono", async () => {
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
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/\$300\.00 total · \$200\.00 claimed/)).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /How Certificate Credit works/i }).length,
    ).toBeGreaterThan(0);

    const mono = document.querySelectorAll(".account-metric, .account-mono");
    expect(mono.length).toBeGreaterThan(0);
    expect(document.querySelector(".account-mono")).toBeTruthy();
    const css = readFileSync(path.join(import.meta.dirname, "account.css"), "utf8");
    expect(css).toMatch(/\.account-mono[\s\S]*?font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/Plus Jakarta Sans/);
    expect(css).not.toMatch(/JetBrains/);
    Array.from(document.querySelectorAll(".account-mono")).forEach((el) => {
      expect((el as HTMLElement).style.fontFamily).not.toMatch(/JetBrains/);
    });
  });

  it("shows Foundations Coach card with grant path and expires_at in mono", async () => {
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Foundations Coach/i })).toBeTruthy(),
    );
    expect(screen.getByText(/in-person seminar check-in/i)).toBeTruthy();
    expect(screen.getByText(/Expires/i)).toBeTruthy();
  });

  it("DP-T-COACH3: none state shows checklist; Path B partial tick only first box", async () => {
    const { COACH_NONE, OVERVIEW_FIXTURE, LTV300_AC, SUBS_ACTIVE, jsonResponse } = await import(
      "../../../test/account/testFixtures"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/account/overview")) {
          return jsonResponse({
            ...OVERVIEW_FIXTURE,
            foundations_coach: {
              ...COACH_NONE,
              metfix_essentials_completed: true,
              metfix_essentials_certificate_claimed: false,
            },
            badges: { ...OVERVIEW_FIXTURE.badges, foundations_coach: false },
          });
        }
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
        if (url.includes("/api/account/ltv-certificates") || url.includes("/api/account/spend")) {
          return jsonResponse({
            ...LTV300_AC,
            foundations_coach: {
              ...COACH_NONE,
              metfix_essentials_completed: true,
              metfix_essentials_certificate_claimed: false,
            },
          });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Attend an in-person seminar \(checked in\)/i)).toBeTruthy(),
    );
    expect(screen.getByText(/Complete MetFix Essentials online/i)).toBeTruthy();
    expect(screen.getByText(/Claim MetFix Essentials certificate/i)).toBeTruthy();
    const done = document.querySelectorAll('.account-checklist li[data-done="true"]');
    expect(done.length).toBe(1);
    expect(done[0]!.textContent).toMatch(/Complete MetFix Essentials online/);
    expect(document.body.textContent).not.toMatch(/Foundations Coach · Active/);
  });

  it("DP-T-UI2: CSS shows sidebar at ≥1024 and mobile nav below", () => {
    const css = readFileSync(path.join(import.meta.dirname, "account.css"), "utf8");
    expect(css).toMatch(/@media \(min-width:\s*1024px\)/);
    expect(css).toMatch(/\.account-sidebar\s*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/\.account-mobile-nav\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/min-width:\s*1024px[\s\S]*?\.account-sidebar[\s\S]*?display:\s*flex/);
    expect(css).toMatch(/min-width:\s*1024px[\s\S]*?\.account-mobile-nav[\s\S]*?display:\s*none/);
  });

  it("mounting /account fires ≤4 account GETs (overview, subscriptions, ltv, calendar surface)", async () => {
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getAllByText("Active").length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(document.querySelector(".account-calendar")).toBeTruthy(),
    );
    const gets = accountGets(fetchImpl);
    const paths = gets.map((c) => String(c[0]).replace(/\?.*$/, ""));
    expect(paths.filter((p) => p.endsWith("/overview")).length).toBeLessThanOrEqual(1);
    expect(paths.filter((p) => p.endsWith("/subscriptions")).length).toBeLessThanOrEqual(1);
    expect(
      paths.filter((p) => p.endsWith("/ltv-certificates") || p.endsWith("/spend")).length,
    ).toBeLessThanOrEqual(1);
    expect(paths.filter((p) => p.endsWith("/calendar/surface")).length).toBeLessThanOrEqual(1);
    expect(gets.length).toBeLessThanOrEqual(4);
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
    // Exact F1 shared-palette values (no loose alternation).
    expect(css).toMatch(/--color-cream:\s*#f3eee4\b/);
    expect(css).toMatch(/--color-paper:\s*#faf7f1\b/);
    expect(css).toMatch(/--color-ink:\s*#171512\b/);
    expect(css).toMatch(/--color-muted:\s*#686158\b/);
    expect(css).toMatch(/--color-accent:\s*#c4a46c\b/);
    expect(css).toMatch(/--color-line:\s*rgba\(23,\s*21,\s*18,\s*0\.1\)/);
    expect(css).toMatch(/Playfair Display/);
    expect(css).toMatch(/Plus Jakarta Sans/);
    expect(css).not.toMatch(/Instrument Serif/);
    expect(css).not.toMatch(/\bInter\b/);
    expect(css).not.toMatch(/JetBrains/);
    expect(css).not.toMatch(/emilydesigns/i);
  });

  it("shows next payment and usable tools for MetFix Pro", async () => {
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Next Payment")).toBeTruthy());
    const dailyFix = screen.getByRole("link", { name: /Daily Fix Archive/i });
    expect(dailyFix.getAttribute("href")).toBe("/the-daily-fix");
    expect(screen.getByRole("link", { name: /^Meal Plans$/i }).getAttribute("href")).toBe(
      "/account/meal-plans",
    );
    expect(screen.getByRole("link", { name: /^Shopping Cart$/i }).getAttribute("href")).toBe(
      "/account/shopping-cart",
    );
    expect(screen.getByRole("link", { name: /^My Meals$/i }).getAttribute("href")).toBe(
      "/account/my-meals",
    );
    expect(screen.getByRole("link", { name: /PR tracking/i }).getAttribute("href")).toBe(
      "/account/benchmarks",
    );
    expect(screen.getByRole("link", { name: /Workout feed/i }).getAttribute("href")).toBe(
      "/account/workouts",
    );
    expect(screen.getByRole("link", { name: /Coaching/i }).getAttribute("href")).toBe(
      "/account/coaching",
    );
    expect(document.querySelector('[data-tool="body"] .account-body-watermark')).toBeTruthy();
    expect(screen.getByRole("link", { name: /My Data \/ Spark/i }).getAttribute("href")).toBe(
      "/account/spark",
    );
    expect(screen.getByRole("link", { name: /Inbox/i }).getAttribute("href")).toBe(
      "/account/inbox",
    );
    expect(screen.queryByText("No web page yet")).toBeNull();
    expect(screen.queryByText("MetFix Admin")).toBeNull();
    expect(document.querySelector('[data-tool="workout-feed"]')?.getAttribute("data-state")).toBe(
      "open",
    );
    expect(document.querySelector('[data-tool="coaching"]')?.getAttribute("data-state")).toBe(
      "open",
    );
    expect(document.querySelector('[data-tool="belly"]')).toBeTruthy();
    expect(document.querySelector('[data-tool="body"]')).toBeTruthy();
    expect(document.querySelector('[data-tool="brain"]')).toBeTruthy();
  });

  it("hides next payment and locks tools when the account has no payments", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/account/overview")) {
          return jsonResponse({
            ...OVERVIEW_FIXTURE,
            canonical_tier: "free",
            badges: { ...OVERVIEW_FIXTURE.badges, affiliate: false, foundations_coach: false },
            foundations_coach: {
              active: false,
              grant_reason: null,
              granted_at: null,
              expires_at: null,
              seminar_checked_in: false,
              metfix_essentials_completed: false,
              metfix_essentials_certificate_claimed: false,
            },
          });
        }
        if (url.includes("/api/account/subscriptions")) {
          return jsonResponse({ canonical_tier: "free", items: [] });
        }
        if (url.includes("/api/account/ltv-certificates") || url.includes("/api/account/spend")) {
          return jsonResponse({ ...LTV300_AC, canonical_tier: "free" });
        }
        if (url.includes("/api/account/calendar/surface")) {
          return jsonResponse({
            meal_counts: {},
            workout_counts: {},
            brain_counts: {},
            event_counts: {},
            meta: { start_date: "2026-11-01", end_date: "2026-11-30", total_dates: 30 },
          });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Meal Plans")).toBeTruthy());
    expect(screen.getByText("Shopping Cart")).toBeTruthy();
    expect(screen.getByText("My Meals")).toBeTruthy();
    expect(screen.queryByText("Next Payment")).toBeNull();
    // Locked tools upgrade via /join — Daily Fix Archive is not opened for free accounts.
    expect(
      Array.from(document.querySelectorAll('[data-tool="daily-fix-archive"]')).every(
        (el) => el.getAttribute("href") === "/join",
      ),
    ).toBe(true);
    // Belly/Body/Brain + Daily Fix + Spark locked; Inbox stays open for free.
    expect(document.querySelectorAll('.account-tool[data-state="locked"]').length).toBe(5);
    expect(document.querySelector('[data-tool="inbox"]')?.getAttribute("data-state")).toBe(
      "open",
    );
  });

  it("shows Admin and MetFix Admin when the account has those roles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/account/overview")) {
          return jsonResponse({
            ...OVERVIEW_FIXTURE,
            roles: ["administrator", "metfix_admin"],
          });
        }
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
        if (url.includes("/api/account/ltv-certificates") || url.includes("/api/account/spend")) {
          return jsonResponse(LTV300_AC);
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );
    render(
      <Router>
        <AccountOverview />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("MetFix Admin")).toBeTruthy());
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("nav lists account routes including organization (DP-T-UI2)", async () => {
    const { ACCOUNT_NAV } = await import("./DashboardLayout");
    expect(ACCOUNT_NAV.map((n) => n.href)).toEqual([
      "/account",
      "/account/billing",
      "/account/profile",
      "/account/courses",
      "/account/favorites",
      "/account/organization",
      "/account/referrals",
      "/account/notifications",
      "/account/privacy",
    ]);
  });
});
