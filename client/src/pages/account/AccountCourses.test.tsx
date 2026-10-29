/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
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
    expect(screen.getByTestId("claim-certificate-20")).toBeTruthy();
    fireEvent.click(screen.getByTestId("claim-certificate-20"));
    await waitFor(() => expect(screen.getByTestId("claim-screen")).toBeTruthy());
    expect(screen.getByTestId("claim-path-redeem_ltv")).toBeTruthy();
    expect(screen.getByTestId("claim-path-prepay_credit")).toBeTruthy();
    expect(screen.getByTestId("claim-path-buy_outright")).toBeTruthy();
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
    await waitFor(() => expect(screen.getByTestId("claim-certificate-20")).toBeTruthy());
    fireEvent.click(screen.getByTestId("claim-certificate-20"));
    await waitFor(() => expect(screen.getByTestId("claim-path-buy_outright")).toBeTruthy());
    const buy = screen.getByTestId("claim-path-buy_outright").querySelector("button")!;
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
