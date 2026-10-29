/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache, openWhopCheckout } from "@/lib/account";
import AccountCourses from "./AccountCourses";
import {
  COURSES_LTV300,
  LTV300_AC,
  OVERVIEW_FIXTURE,
  jsonResponse,
} from "../../../test/account/testFixtures";

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

vi.mock("@/lib/account", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account")>("@/lib/account");
  return {
    ...actual,
    openWhopCheckout: vi.fn(() => true),
  };
});

const CHECKOUT_URL = "https://whop.com/checkout/plan_test_checkout";

const CLAIM_OPTIONS = {
  currency: "usd",
  ltv: { total_ltv_cents: 30000, claimed_value_cents: 20000, available_cents: 10000 },
  credit: {
    balance_cents: 0,
    days_granted: 0,
    pending_promo_cents: 0,
    promo_state: "none",
  },
  courses: [
    {
      course_id: 20,
      slug: "course-b",
      title: "Course B",
      completion_status: "completed",
      completed_at: "2026-01-01T00:00:00Z",
      price_cents: 20000,
      already_claimed: false,
      claimed_at: null,
      claimed_via: null,
      access_expires_at: null,
      paths: [
        {
          path: "redeem_ltv",
          eligible: false,
          shortfall_cents: 10000,
          price_cents: 20000,
          reason_code: "insufficient_ltv",
        },
        {
          path: "prepay_credit",
          eligible: true,
          shortfall_cents: 10000,
          price_cents: 20000,
          reason_code: null,
        },
        {
          path: "buy_outright",
          eligible: true,
          shortfall_cents: 20000,
          price_cents: 20000,
          reason_code: null,
        },
      ],
    },
  ],
};

function claimCertificateButton() {
  return screen.getByRole("button", { name: "Claim Certificate" });
}

function buyOutrightButton() {
  return screen.getByRole("button", { name: /^Buy$/i });
}

function redeemButton() {
  return screen.getByRole("button", { name: /^Redeem$/i });
}

const CLAIM_OPTIONS_REDEEM_OK = {
  ...CLAIM_OPTIONS,
  ltv: { total_ltv_cents: 30000, claimed_value_cents: 0, available_cents: 30000 },
  courses: [
    {
      ...CLAIM_OPTIONS.courses[0]!,
      price_cents: 20000,
      paths: [
        {
          path: "redeem_ltv",
          eligible: true,
          shortfall_cents: 0,
          price_cents: 20000,
          reason_code: null,
        },
        {
          path: "prepay_credit",
          eligible: false,
          shortfall_cents: 0,
          price_cents: 20000,
          reason_code: "no_shortfall",
        },
        {
          path: "buy_outright",
          eligible: true,
          shortfall_cents: 20000,
          price_cents: 20000,
          reason_code: null,
        },
      ],
    },
  ],
};

beforeEach(() => {
  clearAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
      if (url.includes("/api/account/courses") && method === "GET" && !url.includes("/claim")) {
        return jsonResponse(COURSES_LTV300);
      }
      if (url.includes("/certificate-claim-options")) return jsonResponse(CLAIM_OPTIONS);
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

describe("AccountCourses three-path claim (CL-UI-1 / P-CL-1)", () => {
  it("lists Claim Certificate CTA and opens three-path screen", async () => {
    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Course B")).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(screen.getByText("Back to courses")).toBeTruthy());
    expect(screen.getByRole("button", { name: /^Redeem$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Prepay$/i })).toBeTruthy();
    expect(buyOutrightButton()).toBeTruthy();
    expect(screen.getByText("Option 1 direct purchase ($200.00)")).toBeTruthy();
    expect(screen.getByText(/\$100\.00 available/)).toBeTruthy();
  });

  it("shows Foundations Coach card", async () => {
    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(screen.getAllByText(/Foundations Coach/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/in-person seminar check-in/i).length).toBeGreaterThan(0);
  });

  it("S2: open / back / open uses cached claim options (one GET)", async () => {
    let optionsGets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
        if (url.includes("/api/account/courses") && method === "GET" && !url.includes("/claim")) {
          return jsonResponse(COURSES_LTV300);
        }
        if (url.includes("/certificate-claim-options")) {
          optionsGets += 1;
          return jsonResponse(CLAIM_OPTIONS);
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(screen.getByText("Back to courses")).toBeTruthy());
    expect(optionsGets).toBe(1);
    fireEvent.click(screen.getByText("Back to courses"));
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(screen.getByText("Back to courses")).toBeTruthy());
    expect(optionsGets).toBe(1);
  });

  it("CL-T19: POST 200 + claim-options 502 → redirect immediately; one POST; ≤1 GET", async () => {
    let claimPosts = 0;
    let optionsGets = 0;
    vi.mocked(openWhopCheckout).mockClear();
    vi.mocked(openWhopCheckout).mockReturnValue(true);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
        if (url.includes("/api/account/courses") && method === "GET" && !url.includes("/claim")) {
          return jsonResponse(COURSES_LTV300);
        }
        if (url.includes("/certificate-claim-options")) {
          optionsGets += 1;
          if (optionsGets === 1) return jsonResponse(CLAIM_OPTIONS);
          return jsonResponse({ error: "unavailable" }, 502);
        }
        if (url.includes("/courses/20/claim") && method === "POST") {
          claimPosts += 1;
          return jsonResponse({ checkout_url: CHECKOUT_URL });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(buyOutrightButton()).toBeTruthy());
    expect(optionsGets).toBe(1);
    fireEvent.click(buyOutrightButton());
    await waitFor(() => expect(claimPosts).toBe(1));
    await waitFor(() =>
      expect(vi.mocked(openWhopCheckout)).toHaveBeenCalledWith(CHECKOUT_URL),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(claimPosts).toBe(1);
    expect(optionsGets).toBe(1);
  });

  it("CL-POSTGET-1 / S-R2-1: redeem POST 200 + options 502 → success, no failed, ≤1 GET, key kept", async () => {
    let claimPosts = 0;
    let optionsGets = 0;
    let optionsGetsAfterPost = 0;
    let posted = false;
    const idemKeys: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
        if (url.includes("/api/account/courses") && method === "GET" && !url.includes("/claim")) {
          return jsonResponse(COURSES_LTV300);
        }
        if (url.includes("/certificate-claim-options")) {
          optionsGets += 1;
          if (posted) optionsGetsAfterPost += 1;
          if (!posted) return jsonResponse(CLAIM_OPTIONS_REDEEM_OK);
          return jsonResponse({ error: "unavailable" }, 502);
        }
        if (url.includes("/courses/20/claim") && method === "POST") {
          claimPosts += 1;
          posted = true;
          const key = new Headers(init?.headers).get("Idempotency-Key");
          if (key) idemKeys.push(key);
          return jsonResponse({ already_claimed: false });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(redeemButton()).toBeTruthy());
    fireEvent.click(redeemButton());
    await waitFor(() => expect(claimPosts).toBe(1));
    await waitFor(() => expect(screen.getByText("Certificate claimed")).toBeTruthy());
    expect(screen.queryByText(/failed/i)).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(claimPosts).toBe(1);
    expect(optionsGetsAfterPost).toBeLessThanOrEqual(1);
    expect(idemKeys).toHaveLength(1);

    // Later click reuses the same Idempotency-Key (CL-POSTGET-1).
    fireEvent.click(redeemButton());
    await waitFor(() => expect(claimPosts).toBe(2));
    expect(idemKeys[1]).toBe(idemKeys[0]);
  });

  it("R2-N1: unmount during background claim-options refresh does not throw", async () => {
    let resolveRefresh: ((v: Response) => void) | null = null;
    let claimPosts = 0;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
        if (url.includes("/api/account/courses") && method === "GET" && !url.includes("/claim")) {
          return jsonResponse(COURSES_LTV300);
        }
        if (url.includes("/certificate-claim-options")) {
          if (method === "GET" && claimPosts === 0) return jsonResponse(CLAIM_OPTIONS_REDEEM_OK);
          return new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          });
        }
        if (url.includes("/courses/20/claim") && method === "POST") {
          claimPosts += 1;
          return jsonResponse({ already_claimed: true });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    const view = render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(redeemButton()).toBeTruthy());
    fireEvent.click(redeemButton());
    await waitFor(() => expect(claimPosts).toBe(1));
    await waitFor(() => expect(screen.getByText("Certificate claimed")).toBeTruthy());
    view.unmount();
    resolveRefresh?.(jsonResponse(CLAIM_OPTIONS_REDEEM_OK));
    await new Promise((r) => setTimeout(r, 30));
    const reactUnmountWarnings = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("unmounted"),
    );
    expect(reactUnmountWarnings).toHaveLength(0);
    consoleError.mockRestore();
  });

  it("CL-T19: double-click claim posts once; 502 re-fetches CL1 once, never retries POST", async () => {
    let claimPosts = 0;
    let optionsGets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
        if (url.includes("/api/account/courses") && method === "GET" && !url.includes("/claim")) {
          return jsonResponse(COURSES_LTV300);
        }
        if (url.includes("/certificate-claim-options")) {
          optionsGets += 1;
          return jsonResponse(CLAIM_OPTIONS);
        }
        if (url.includes("/courses/20/claim") && method === "POST") {
          claimPosts += 1;
          return jsonResponse({ error: "upstream_error" }, 502);
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(buyOutrightButton()).toBeTruthy());
    const buy = buyOutrightButton();
    fireEvent.click(buy);
    fireEvent.click(buy);
    await waitFor(() => expect(claimPosts).toBe(1));
    await waitFor(() => expect(optionsGets).toBeGreaterThanOrEqual(2));
    const getsAfterOpen = optionsGets;
    await new Promise((r) => setTimeout(r, 50));
    expect(claimPosts).toBe(1);
    expect(optionsGets).toBe(getsAfterOpen);
  });
});
