/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountBilling from "./AccountBilling";
import {
  LTV300_AC,
  OVERVIEW_FIXTURE,
  PAYMENTS_PAGE1,
  SUBS_ACTIVE,
  jsonResponse,
} from "../../../test/account/testFixtures";
import type { AccountSubscriptions } from "@/lib/account";

vi.mock("@/lib/session", () => ({
  loadMe: vi.fn(async () => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

const GRANDFATHERED: AccountSubscriptions = {
  canonical_tier: "metfix_pro",
  items: [
    {
      sub_ref: "ref_med_1",
      provider: "stripe",
      tier: "metfix_pro",
      legacy_source: "medical_society_stripe",
      can_convert_to_whop: true,
      status: "active",
      current_period_end: "2026-12-01T00:00:00.000Z",
      paid_through: "2026-12-01T00:00:00.000Z",
      cancel_at_period_end: false,
      card: { brand: "visa", last4: "1111" },
    },
  ],
};

const ORG_DUP: AccountSubscriptions = {
  canonical_tier: "organization_owner",
  items: [
    {
      sub_ref: "ref_org_1",
      provider: "stripe",
      tier: "organization_owner",
      legacy_source: "affiliate_stripe",
      can_convert_to_whop: true,
      status: "active",
      current_period_end: "2026-12-01T00:00:00.000Z",
      paid_through: "2026-12-01T00:00:00.000Z",
      cancel_at_period_end: false,
      card: null,
    },
    {
      sub_ref: "ref_dup_1",
      provider: "stripe",
      tier: "metfix_pro",
      legacy_source: "medical_society_stripe",
      is_duplicate_stripe: true,
      status: "active",
      current_period_end: "2026-11-01T00:00:00.000Z",
      paid_through: "2026-11-01T00:00:00.000Z",
      cancel_at_period_end: false,
      card: null,
    },
  ],
};

const AWAITING: AccountSubscriptions = {
  ...SUBS_ACTIVE,
  conversion: {
    state: "awaiting_checkout",
    target_tier: "metfix_pro",
    purchase_url: "https://whop.com/checkout/plan_be_test",
    trial_period_days: 12,
  },
};

function installFetch(subs: AccountSubscriptions, payments = PAYMENTS_PAGE1) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions") && method === "GET") return jsonResponse(subs);
      if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
      if (url.includes("/api/account/payments")) {
        const u = new URL(url, "https://metfix.org");
        const page = Number(u.searchParams.get("page") ?? "1");
        if (page === 2) {
          return jsonResponse({
            ...payments,
            page: 2,
            items: [
              {
                id: 2,
                created_at: "2026-02-01T12:00:00.000Z",
                description: "Earlier charge",
                amount_cents: 3000,
                currency: "usd",
                provider: "stripe",
                status: "paid",
              },
            ],
          });
        }
        return jsonResponse(payments);
      }
      if (url.includes("/convert-to-whop") && method === "POST") {
        return jsonResponse({
          purchase_url: "https://whop.com/checkout/converted",
          trial_period_days: 5,
        });
      }
      if (url.includes("/cancel-duplicate") && method === "POST") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ error: "not_found" }, 404);
    }),
  );
}

beforeEach(() => {
  clearAccountCache();
});

afterEach(() => {
  cleanup();
  clearAccountCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccountBilling (P-DB-4, P-DB-5, P-DB-6)", () => {
  it("shows conversion banner for awaiting_checkout Whop URL and hides for evil URLs", async () => {
    installFetch(AWAITING);
    render(
      <Router>
        <AccountBilling />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText(/Finish switching to Whop/i)).toBeTruthy());
    expect(screen.getByText(/12 more day/i)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Continue to Whop checkout/i });
    expect(cta.getAttribute("href")).toBe("https://whop.com/checkout/plan_be_test");

    cleanup();
    clearAccountCache();
    installFetch({
      ...SUBS_ACTIVE,
      conversion: {
        state: "awaiting_checkout",
        purchase_url: "https://evil.example/x",
        trial_period_days: 3,
      },
    });
    render(
      <Router>
        <AccountBilling />
      </Router>,
    );
    await waitFor(() => expect(screen.getAllByText(/Payment History/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Finish switching to Whop/i)).toBeNull();
  });

  it("grandfathered Med Society shows Keep / Switch and Switch posts convert-to-whop", async () => {
    installFetch(GRANDFATHERED);
    render(
      <Router>
        <AccountBilling />
      </Router>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Keep Current Legacy Stripe Rate/i })).toBeTruthy(),
    );
    expect(screen.getByText(/MetFix Pro · Grandfathered Med Society/)).toBeTruthy();
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const before = fetchImpl.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Keep Current Legacy Stripe Rate/i }));
    expect(fetchImpl.mock.calls.length).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: /Switch to Whop MetFix Pro/i }));
    await waitFor(() => {
      const posts = fetchImpl.mock.calls.filter(
        (c) =>
          String(c[0]).includes("/convert-to-whop") &&
          ((c[1] as RequestInit | undefined)?.method ?? "").toUpperCase() === "POST",
      );
      expect(posts).toHaveLength(1);
      const headers = (posts[0]![1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-CSRF-Token"]).toBe("test-csrf");
      expect(JSON.parse(String((posts[0]![1] as RequestInit).body))).toEqual({
        sub_ref: "ref_med_1",
        target_tier: "metfix_pro",
      });
    });
  });

  it("org owner convert + duplicate cancel", async () => {
    installFetch(ORG_DUP);
    render(
      <Router>
        <AccountBilling />
      </Router>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Switch to Whop Organization Owner/i })).toBeTruthy(),
    );
    expect(screen.getAllByText(/duplicate Stripe/i).length).toBeGreaterThan(0);
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole("button", { name: /Switch to Whop Organization Owner/i }));
    await waitFor(() => {
      const posts = fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/convert-to-whop"));
      expect(JSON.parse(String((posts[0]![1] as RequestInit).body)).target_tier).toBe(
        "organization_owner",
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancel duplicate Stripe subscription/i }));
    await waitFor(() => {
      const posts = fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/cancel-duplicate"));
      expect(posts).toHaveLength(1);
      expect(JSON.parse(String((posts[0]![1] as RequestInit).body))).toEqual({
        at_period_end: true,
      });
    });
  });

  it("payment history shows amount, provider, and Prev/Next pagination", async () => {
    installFetch(SUBS_ACTIVE);
    render(
      <Router>
        <AccountBilling />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("$12.34")).toBeTruthy());
    expect(screen.getByText("MetFix Pro")).toBeTruthy();
    expect(screen.getByText("whop")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Receipt/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
    await waitFor(() => expect(screen.getByText("Earlier charge")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /^Prev$/i }));
    await waitFor(() => expect(screen.getByText("$12.34")).toBeTruthy());
  });

  it("canonical tier labels only use the 4 tiers", async () => {
    installFetch({
      canonical_tier: "organization_owner",
      items: [
        {
          sub_ref: "ref_o",
          provider: "whop",
          tier: "organization_owner",
          status: "active",
          current_period_end: "2026-12-01T00:00:00.000Z",
          paid_through: "2026-12-01T00:00:00.000Z",
          cancel_at_period_end: false,
          card: null,
        },
      ],
    });
    render(
      <Router>
        <AccountBilling />
      </Router>,
    );
    await waitFor(() =>
      expect(screen.getByText(/Organization Owner \(\$170\/mo\)/)).toBeTruthy(),
    );
    expect(document.body.textContent).not.toMatch(/Medical Society \(\$/);
  });
});
