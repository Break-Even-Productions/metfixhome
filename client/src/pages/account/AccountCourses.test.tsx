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

function prepayButton() {
  return screen.getByRole("button", { name: /^Prepay$/i });
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

  it("CL-POSTGET-1: prepay checkout — no failed; exactly 1 redirect; same Idempotency-Key within attempt", async () => {
    let claimPosts = 0;
    const idemKeys: string[] = [];
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
        if (url.includes("/certificate-claim-options")) return jsonResponse(CLAIM_OPTIONS);
        if (url.includes("/courses/20/claim") && method === "POST") {
          claimPosts += 1;
          const key = new Headers(init?.headers).get("Idempotency-Key");
          if (key) idemKeys.push(key);
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
    await waitFor(() => expect(prepayButton()).toBeTruthy());
    fireEvent.click(prepayButton());
    await waitFor(() => expect(claimPosts).toBe(1));
    await waitFor(() =>
      expect(vi.mocked(openWhopCheckout)).toHaveBeenCalledTimes(1),
    );
    expect(vi.mocked(openWhopCheckout)).toHaveBeenCalledWith(CHECKOUT_URL);
    expect(screen.queryByText(/failed/i)).toBeNull();
    expect(idemKeys).toHaveLength(1);

    // Same attempt: later click reuses the same Idempotency-Key (prepay does not clear on redirect).
    fireEvent.click(prepayButton());
    await waitFor(() => expect(claimPosts).toBe(2));
    expect(idemKeys[1]).toBe(idemKeys[0]);
    expect(vi.mocked(openWhopCheckout)).toHaveBeenCalledTimes(2);
  });

  it("CL-POSTGET-1 / S-R2-1 / S-R3-1: redeem POST 200 + options 502 → success; exactly 1 refresh GET; new key after success", async () => {
    let claimPosts = 0;
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
    expect(optionsGetsAfterPost).toBe(1);
    expect(idemKeys).toHaveLength(1);

    // S-R3-1: next claim after success gets a new Idempotency-Key.
    fireEvent.click(redeemButton());
    await waitFor(() => expect(claimPosts).toBe(2));
    expect(idemKeys[1]).toBeTruthy();
    expect(idemKeys[1]).not.toBe(idemKeys[0]);
  });

  it("R2-N1 / S-R3-3: unmount aborts background claim-options AbortSignal", async () => {
    let resolveRefresh: ((v: Response) => void) | null = null;
    let claimPosts = 0;
    let refreshSignal: AbortSignal | null = null;
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
          refreshSignal = init?.signal ?? null;
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
    await waitFor(() => expect(refreshSignal).toBeTruthy());
    view.unmount();
    expect(refreshSignal!.aborted).toBe(true);
    resolveRefresh?.(jsonResponse(CLAIM_OPTIONS_REDEEM_OK));
    await new Promise((r) => setTimeout(r, 30));
    const reactUnmountWarnings = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("unmounted"),
    );
    expect(reactUnmountWarnings).toHaveLength(0);
    consoleError.mockRestore();
  });

  it("B-R4-1 / errata d3 DR-7 / d5 DR-12: thrown fetch keeps Idempotency-Key; retry same key both requests", async () => {
    let claimPosts = 0;
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
        if (url.includes("/certificate-claim-options")) return jsonResponse(CLAIM_OPTIONS_REDEEM_OK);
        if (url.includes("/courses/20/claim") && method === "POST") {
          claimPosts += 1;
          const key = new Headers(init?.headers).get("Idempotency-Key");
          if (key) idemKeys.push(key);
          if (claimPosts === 1) throw new TypeError("network offline");
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
    await waitFor(() => expect(screen.getByText(/Claim failed/i)).toBeTruthy());
    fireEvent.click(redeemButton());
    await waitFor(() => expect(claimPosts).toBe(2));
    expect(idemKeys).toHaveLength(2);
    expect(idemKeys[1]).toBe(idemKeys[0]);
    await waitFor(() => expect(screen.getByText("Certificate claimed")).toBeTruthy());
  });

  it.each([418, 502] as const)(
    "errata d5 DR-12 / D7_502 / D7final: after %s final, same-option retry → NEW key",
    async (finalStatus) => {
      let claimPosts = 0;
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
          if (url.includes("/certificate-claim-options")) return jsonResponse(CLAIM_OPTIONS_REDEEM_OK);
          if (url.includes("/courses/20/claim") && method === "POST") {
            claimPosts += 1;
            const key = new Headers(init?.headers).get("Idempotency-Key");
            if (key) idemKeys.push(key);
            if (claimPosts === 1) {
              return jsonResponse({ error: "upstream_error" }, finalStatus);
            }
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
      fireEvent.click(redeemButton());
      await waitFor(() => expect(claimPosts).toBe(2));
      expect(idemKeys).toHaveLength(2);
      expect(idemKeys[1]).toBeTruthy();
      expect(idemKeys[1]).not.toBe(idemKeys[0]);
    },
  );

  it.each([
    { status: 409 as const, body: { error: "claim_in_progress" } },
    {
      status: 503 as const,
      body: { error: "claim_in_progress", reason_code: "claim_in_progress" },
    },
  ])(
    "errata d5 DR-12: after $status transient, same-option retry → KEEP key",
    async ({ status: transientStatus, body: transientBody }) => {
      let claimPosts = 0;
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
          if (url.includes("/certificate-claim-options")) return jsonResponse(CLAIM_OPTIONS_REDEEM_OK);
          if (url.includes("/courses/20/claim") && method === "POST") {
            claimPosts += 1;
            const key = new Headers(init?.headers).get("Idempotency-Key");
            if (key) idemKeys.push(key);
            if (claimPosts <= 2) {
              return jsonResponse(transientBody, transientStatus);
            }
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
      await waitFor(() => expect(screen.getByText(/Still working on it/i)).toBeTruthy());
      fireEvent.click(redeemButton());
      await waitFor(() => expect(claimPosts).toBe(2));
      expect(idemKeys).toHaveLength(2);
      expect(idemKeys[1]).toBe(idemKeys[0]);
    },
  );

  it.each([409, 503] as const)(
    "S-R4-1 / S-R5-2 / errata d5 DR-12: after %s, same option keeps key; different option → new key",
    async (inProgressStatus) => {
      let claimPosts = 0;
      const idemKeys: string[] = [];
      const paths: string[] = [];
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
          if (url.includes("/certificate-claim-options")) return jsonResponse(CLAIM_OPTIONS_REDEEM_OK);
          if (url.includes("/courses/20/claim") && method === "POST") {
            claimPosts += 1;
            const key = new Headers(init?.headers).get("Idempotency-Key");
            if (key) idemKeys.push(key);
            try {
              paths.push(JSON.parse(String(init?.body ?? "{}")).path);
            } catch {
              paths.push("?");
            }
            if (claimPosts <= 2) {
              return jsonResponse({ error: "claim_in_progress" }, inProgressStatus);
            }
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
      await waitFor(() => expect(redeemButton()).toBeTruthy());
      fireEvent.click(redeemButton());
      await waitFor(() => expect(claimPosts).toBe(1));
      await waitFor(() => expect(screen.getByText(/Still working on it/i)).toBeTruthy());
      // Same option retry → keep key.
      fireEvent.click(redeemButton());
      await waitFor(() => expect(claimPosts).toBe(2));
      expect(idemKeys[1]).toBe(idemKeys[0]);
      expect(paths[0]).toBe("redeem_ltv");
      expect(paths[1]).toBe("redeem_ltv");
      // Different option same course → new key.
      fireEvent.click(buyOutrightButton());
      await waitFor(() => expect(claimPosts).toBe(3));
      expect(paths[2]).toBe("buy_outright");
      expect(idemKeys[2]).toBeTruthy();
      expect(idemKeys[2]).not.toBe(idemKeys[0]);
    },
  );

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
