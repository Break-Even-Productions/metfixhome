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

let claimCalls = 0;

beforeEach(() => {
  clearAccountCache();
  claimCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
      if (url.includes("/api/account/courses") && method === "GET") return jsonResponse(COURSES_LTV300);
      if (url.includes("/claim-certificate") && method === "POST") {
        claimCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return jsonResponse({ ok: true });
      }
      if (url.includes("/purchase-checkout") && method === "POST") {
        return jsonResponse({ checkout_url: "https://whop.com/checkout/course-20" });
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

describe("AccountCourses (P-DB-7, P-DB-8, CERT)", () => {
  it("LTV300 A+C claimed / B shortfall $100 with dual CTAs", async () => {
    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Course B")).toBeTruthy());
    expect(screen.getByText("$300.00")).toBeTruthy();
    expect(screen.getAllByText(/Claimed/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Needs \$100\.00 more LTV/).length).toBeGreaterThan(0);

    const claimB = screen.getByRole("button", {
      name: /Claim Certificate with LTV \(-\$200\.00\)/,
    });
    expect((claimB as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: /^Buy Course for Certificate \(\$200\)$/ }),
    ).toBeTruthy();
  });

  it("claim lock disables all LTV buttons while a claim is in flight", async () => {
    const eligibleCourses = {
      ...COURSES_LTV300,
      items: COURSES_LTV300.items.map((c) =>
        c.id === 20
          ? { ...c, course_price_cents: 10000, certificate_claimed: false }
          : c.id === 10
            ? { ...c, certificate_claimed: false, course_price_cents: 5000 }
            : c,
      ),
    };
    const ltvEligible = {
      ...LTV300_AC,
      claimed_courses_value_cents: 0,
      available_certificate_ltv_cents: 30000,
      claimed_certificates: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(ltvEligible);
        if (url.includes("/api/account/courses") && method === "GET") {
          return jsonResponse(eligibleCourses);
        }
        if (url.includes("/claim-certificate") && method === "POST") {
          claimCalls += 1;
          await new Promise((r) => setTimeout(r, 80));
          return jsonResponse({ ok: true, foundations_coach: OVERVIEW_FIXTURE.foundations_coach });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountCourses />
      </Router>,
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Claim Certificate with LTV/ }).length,
      ).toBeGreaterThan(1),
    );
    const buttons = screen.getAllByRole("button", { name: /Claim Certificate with LTV/ });
    fireEvent.click(buttons[0]!);
    await waitFor(() => {
      const locked = screen.getAllByRole("button", { name: /Claim Certificate with LTV/ });
      expect(locked.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    });
    await waitFor(() => expect(claimCalls).toBe(1));
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
});
