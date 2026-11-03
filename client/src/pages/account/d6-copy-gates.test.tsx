/**
 * @vitest-environment jsdom
 * errata d6 DP-T-BONUS-1 / DP-T-REFUND-1 / DP-T-COPY-1 / CL-CREDIT-1 absent.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { PATH_TITLES } from "@shared/account/claimOptions";
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

const CLAIM_OPTIONS = {
  currency: "usd",
  ltv: { total_ltv_cents: 30000, claimed_value_cents: 0, available_cents: 30000 },
  courses: [
    {
      course_id: 20,
      slug: "essentials",
      title: "Essentials",
      completion_status: "completed",
      completed_at: "2026-01-01T00:00:00Z",
      price_cents: 30000,
      already_claimed: false,
      claimed_at: null,
      claimed_via: null,
      access_expires_at: null,
      paths: [
        {
          path: "redeem_ltv",
          eligible: true,
          shortfall_cents: 0,
          price_cents: 30000,
          reason_code: null,
        },
        {
          path: "prepay_credit",
          eligible: true,
          shortfall_cents: 7000,
          price_cents: 30000,
          reason_code: null,
        },
        {
          path: "buy_outright",
          eligible: true,
          shortfall_cents: 30000,
          price_cents: 30000,
          reason_code: null,
        },
      ],
    },
  ],
};

function claimCertificateButton() {
  return screen.getByRole("button", { name: /Claim certificate/i });
}

describe("errata d6 copy / bonus / refund / credit-absent gates", () => {
  beforeEach(() => {
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("CL-CREDIT-1 / DP-T-BONUS-1: no credit line, no bonus number on prepay card", async () => {
    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(screen.getByText("Certificate prepay")).toBeTruthy());
    expect(screen.getByText(/\$70\.00/)).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bcredit\b/i);
    expect(text).not.toMatch(/\b\d+\s+bonus months\b/i);
    expect(text).not.toMatch(/days granted/i);
    expect(PATH_TITLES.prepay_credit).toBe("Certificate prepay");
    expect(PATH_TITLES.prepay_credit.toLowerCase()).not.toContain("credit");
  });

  it("DP-T-COPY-1: banned phrases absent; path id not in visible text", async () => {
    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(screen.getByText("Certificate prepay")).toBeTruthy());
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const banned of ["buy months", "prepay your subscription", "credit", "balance remaining"]) {
      expect(text, banned).not.toContain(banned);
    }
    expect(text).not.toContain("prepay_credit");
    expect(document.body.innerHTML).not.toMatch(
      /aria-[^=]*=["'][^"']*prepay_credit|title=["'][^"']*prepay_credit|alt=["'][^"']*prepay_credit/i,
    );
  });

  it("DP-T-REFUND-1: non-issuing prepay DTO shows no refunded label", async () => {
    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(claimCertificateButton()).toBeTruthy());
    fireEvent.click(claimCertificateButton());
    await waitFor(() => expect(screen.getByText("Certificate prepay")).toBeTruthy());
    expect((document.body.textContent ?? "").toLowerCase()).not.toContain("refunded");
  });
});
