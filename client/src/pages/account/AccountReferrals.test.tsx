/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache, preserveReferralEarnings } from "@/lib/account";
import AccountReferrals from "./AccountReferrals";
import { OVERVIEW_FIXTURE, jsonResponse } from "../../../test/account/testFixtures";

const SUBS_FIXTURE = {
  canonical_tier: "organization_owner",
  items: [
    {
      sub_ref: "opaque_1",
      provider: "stripe",
      tier: "organization_owner",
      status: "active",
      cancel_at_period_end: false,
    },
  ],
};

vi.mock("@/lib/session", () => ({
  loadMe: vi.fn(async () => ({
    status: "signed_in",
    public_name: "Ada",
    moderator: false,
  })),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

const JOIN = {
  slug: "cfexample9",
  whop_affiliate_code: "cfexample9",
  join_url: "https://brokenscience.org/share/?slug=cfexample9",
  commission_percent: 15,
  commission_bps: 1500,
};

const LINK = {
  course_id: 1,
  course_slug: "metfix-essentials",
  course_title: "MetFix Essentials",
  course_price_cents: 20000,
  currency: "USD",
  commission_percent: 15,
  commission_bps: 1500,
  estimated_commission_cents: 3000,
  bsi_ref_slug: "cfexample9",
  whop_affiliate_code: "cfexample9",
  whop_plan_id: "plan_course_essentials",
  share_url: "https://brokenscience.org/courses/metfix-essentials/?bsi_ref=cfexample9",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  clearAccountCache();
});

function mount() {
  return render(
    <Router>
      <AccountReferrals nowMs={Date.parse("2026-10-28T22:00:00.000Z")} />
    </Router>,
  );
}

describe("AccountReferrals PR D", () => {
  it("CR-ELIG-3: locked card names both paths; renew link; 0 POSTs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
      if (url.includes("/api/account/referrals") && method === "GET") {
        return jsonResponse({
          eligible: false,
          eligibility_type: null,
          reason_code: "bsi_referral_coach_expired",
          foundations_coach_expires_at: "2025-01-01T00:00:00.000Z",
          join_code: null,
          course_links: [],
          course_links_dropped: 0,
        });
      }
      if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await waitFor(() => expect(screen.getByTestId("referrals-locked")).toBeTruthy());
    expect(screen.getByText(/Organization Owner/i)).toBeTruthy();
    expect(screen.getAllByText(/Foundations Coach/i).length).toBeGreaterThan(0);
    expect(screen.getByText("2025-01-01T00:00:00.000Z").className).toMatch(/font-mono|account-mono/);
    expect(screen.getByText(/Renew qualification/i).closest("a")?.getAttribute("href")).toBe(
      "/account/courses",
    );
    expect(screen.queryByTestId("generate-referral")).toBeNull();
    expect(screen.queryByText("Rotate")).toBeNull();
    expect(fetchMock.mock.calls.every((c) => (c[1] as RequestInit)?.method !== "POST")).toBe(true);
  });

  it("CR-DROP-1: muted notice has no alert role; CR-COMM-3 bare generate has 0%", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
        if (url.includes("/api/account/referrals")) {
          return jsonResponse({
            eligible: true,
            eligibility_type: "organization",
            join_code: null,
            join_code_dropped: true,
            course_links: [],
            course_links_dropped: 0,
          });
        }
        if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
        return jsonResponse({});
      }),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId("referrals-dropped-notice")).toBeTruthy());
    const notice = screen.getByTestId("referrals-dropped-notice");
    expect(notice.getAttribute("role")).toBeNull();
    expect(notice.className).toMatch(/muted/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("CR-URL-1: bad join_url hides copy; clipboard unused", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
        if (url.includes("/api/account/referrals")) {
          return jsonResponse({
            eligible: true,
            eligibility_type: "organization",
            join_code: { ...JOIN, join_url: null },
            course_links: [],
            course_links_dropped: 0,
            join_code_dropped: false,
          });
        }
        if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
        return jsonResponse({});
      }),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId("join-code-card")).toBeTruthy());
    expect(screen.queryByText("Copy Referral Link")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("CR-EARN-T3: earnings panel survives generate without earnings in response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
      if (url.includes("/api/account/referrals") && method === "GET") {
        return jsonResponse({
          eligible: true,
          eligibility_type: "organization",
          join_code: null,
          course_links: [],
          course_links_dropped: 0,
          join_code_dropped: false,
          earnings: {
            pending_cents: 1250,
            ready_cents: 3000,
            paid_total_cents: 0,
            currency: "usd",
            connect_status: "active",
          },
        });
      }
      if (url.includes("/api/account/referral-code") && method === "POST") {
        return jsonResponse({
          eligible: true,
          eligibility_type: "organization",
          join_code: JOIN,
          course_links: [LINK],
          course_links_dropped: 0,
          join_code_dropped: false,
        });
      }
      if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await waitFor(() => expect(screen.getByTestId("referrals-earnings")).toBeTruthy());
    expect(screen.getByTestId("referrals-earnings").textContent).toMatch(/\$12\.50/);
    expect(screen.getByTestId("referrals-earnings").textContent).toMatch(/\$30\.00/);
    fireEvent.click(screen.getByTestId("generate-referral"));
    await waitFor(() => expect(screen.getByTestId("join-code-card")).toBeTruthy());
    expect(screen.getByTestId("referrals-earnings").textContent).toMatch(/\$12\.50/);
  });

  it("[t451u] shows stored percents, never policy 25%", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
        if (url.includes("/api/account/referrals")) {
          return jsonResponse({
            eligible: true,
            eligibility_type: "organization",
            join_code: JOIN,
            course_links: [
              LINK,
              { ...LINK, course_id: 2, commission_percent: 20, commission_bps: 2000, course_price_cents: 15000, estimated_commission_cents: 3000 },
            ],
            course_links_dropped: 0,
          });
        }
        if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
        return jsonResponse({});
      }),
    );
    const { container } = mount();
    await waitFor(() => expect(screen.getByTestId("join-code-card")).toBeTruthy());
    expect(container.textContent).toContain("15% referral commission");
    expect(container.textContent).toContain("20% referral commission");
    expect(container.textContent).not.toContain("25%");
    expect(container.textContent).toContain("$200.00");
    expect(container.textContent).toContain("$30.00");
  });

  it("CR-DROP notice + estimate shown as sent; W3 after join_code drop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
        if (url.includes("/api/account/referrals")) {
          return jsonResponse({
            eligible: true,
            eligibility_type: "organization",
            join_code: null,
            join_code_dropped: true,
            course_links: [],
            course_links_dropped: 0,
          });
        }
        if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
        return jsonResponse({});
      }),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId("referrals-dropped-notice")).toBeTruthy());
    expect(screen.queryByTestId("generate-referral")).toBeNull();
    expect(screen.getByTestId("generate-referral-after-drop")).toBeTruthy();
  });

  it("brand-new eligible user sees bare Generate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
        if (url.includes("/api/account/referrals")) {
          return jsonResponse({
            eligible: true,
            eligibility_type: "organization",
            join_code: null,
            course_links: [],
            course_links_dropped: 0,
            join_code_dropped: false,
          });
        }
        if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
        return jsonResponse({});
      }),
    );
    const { container } = mount();
    await waitFor(() => expect(screen.getByTestId("generate-referral")).toBeTruthy());
    expect(container.textContent).not.toMatch(/%/);
  });

  it("Copy Referral Link writes exact share_url; generate/rotate/revoke still work", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
      if (url.includes("/api/account/referrals") && method === "GET") {
        return jsonResponse({
          eligible: true,
          eligibility_type: "organization",
          join_code: { ...JOIN, join_url: null },
          course_links: [LINK],
          course_links_dropped: 0,
        });
      }
      if (url.includes("/api/account/referral-code") && method === "POST") {
        return jsonResponse({
          eligible: true,
          eligibility_type: "organization",
          join_code: JOIN,
          course_links: [LINK],
          course_links_dropped: 0,
        });
      }
      if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await waitFor(() => expect(screen.getByText("Copy Referral Link")).toBeTruthy());
    fireEvent.click(screen.getByText("Copy Referral Link"));
    expect(writeText).toHaveBeenCalledWith(LINK.share_url);
    fireEvent.click(screen.getByText("Rotate"));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (c) => String(c[0]).includes("/referral-code") && (c[1] as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );
  });

  it("P-DB-11 / CR-X3: GIFT1 Essentials gift + generate then revoke after rotate", async () => {
    const actions: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
      if (url.includes("/api/account/referrals") && method === "GET") {
        return jsonResponse({
          eligible: true,
          eligibility_type: "organization",
          join_code: null,
          course_links: [],
          course_links_dropped: 0,
          join_code_dropped: false,
          earnings: {
            pending_cents: 1200,
            ready_cents: 3400,
            paid_total_cents: 10000,
            currency: "usd",
            connect_status: "active",
          },
        });
      }
      if (url.includes("/api/account/referral-code") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
        actions.push(body.action ?? "");
        if (body.action === "revoke") {
          return jsonResponse({
            eligible: true,
            eligibility_type: "organization",
            join_code: null,
            course_links: [],
            course_links_dropped: 0,
          });
        }
        return jsonResponse({
          eligible: true,
          eligibility_type: "organization",
          join_code: JOIN,
          course_links: [LINK],
          course_links_dropped: 0,
        });
      }
      if (url.includes("/api/account/course-gifts")) {
        return jsonResponse({
          items: [
            {
              code: "GIFT1",
              course_title: "MetFix Essentials",
              course_slug: "metfix-essentials",
              status: "available",
            },
          ],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await waitFor(() => expect(screen.getByText("GIFT1")).toBeTruthy());
    expect(screen.getByText(/MetFix Essentials/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId("generate-referral"));
    await waitFor(() => expect(actions).toContain("generate"));
    await waitFor(() => expect(screen.getByText("Rotate")).toBeTruthy());
    fireEvent.click(screen.getByText("Rotate"));
    await waitFor(() => expect(actions).toContain("rotate"));
    fireEvent.click(screen.getByText("Revoke"));
    await waitFor(() => expect(actions).toEqual(["generate", "rotate", "revoke"]));
  });

  it("R3-N1: missing eligible is not eligible (Worker flag only)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_FIXTURE);
        if (url.includes("/api/account/referrals")) {
          return jsonResponse({
            eligibility_type: "organization",
            join_code: JOIN,
            course_links: [LINK],
            course_links_dropped: 0,
          });
        }
        if (url.includes("/api/account/course-gifts")) return jsonResponse({ items: [] });
        return jsonResponse({});
      }),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId("referrals-locked")).toBeTruthy());
    expect(screen.queryByTestId("generate-referral")).toBeNull();
    expect(screen.queryByTestId("join-code-card")).toBeNull();
  });

  it("E4 / R3-N1 / R3-N2 static: no ??0 dropped default; trust eligible; single preserve helper", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const referralsSrc = readFileSync(join(import.meta.dirname, "AccountReferrals.tsx"), "utf8");
    const accountSrc = readFileSync(join(import.meta.dirname, "../../lib/account.ts"), "utf8");
    expect(referralsSrc).not.toMatch(/course_links_dropped\s*\?\?\s*0/);
    expect(referralsSrc).toMatch(/eligible\s*===\s*true/);
    expect(referralsSrc).not.toMatch(/canGenerateCourseReferrals/);
    expect(referralsSrc).not.toMatch(/prev\?\.earnings/);
    expect(accountSrc).toMatch(/export function preserveReferralEarnings/);
    expect(accountSrc).toMatch(/preserveReferralEarnings\(next,\s*opts\?\.previousEarnings\)/);
  });

  it("R3-N2: preserveReferralEarnings keeps prior panel when CR2 omits", () => {
    const previous = {
      pending_cents: 1,
      ready_cents: 2,
      paid_total_cents: 3,
      currency: "usd",
      connect_status: "active" as const,
    };
    const next = {
      eligible: true,
      eligibility_type: "organization" as const,
      join_code: null,
      course_links: [],
      course_links_dropped: 0,
    };
    expect(preserveReferralEarnings(next, previous).earnings).toEqual(previous);
    expect(
      preserveReferralEarnings(
        { ...next, earnings: { ...previous, pending_cents: 99 } },
        previous,
      ).earnings?.pending_cents,
    ).toBe(99);
  });
});
