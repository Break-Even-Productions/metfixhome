/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import CheckoutComplete from "./CheckoutComplete";
import {
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
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

describe("CheckoutComplete", () => {
  beforeEach(() => {
    clearAccountCache();
    window.history.pushState({}, "", "/checkout/complete?status=succeeded");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
        if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
        if (url.includes("/api/account/ltv-certificates")) return jsonResponse(LTV300_AC);
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    clearAccountCache();
  });

  it("shows success copy and refreshes membership tier", async () => {
    render(
      <Router>
        <CheckoutComplete />
      </Router>,
    );
    expect(screen.getByText("Welcome to MetFix")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/MetFix Pro/)).toBeTruthy());
    expect(screen.getByRole("link", { name: /Go to Billing/i })).toBeTruthy();
  });

  it("treats canceled status without claiming entitlement from the redirect", () => {
    window.history.pushState({}, "", "/checkout/complete?status=canceled");
    render(
      <Router>
        <CheckoutComplete />
      </Router>,
    );
    expect(screen.getByText("Checkout canceled")).toBeTruthy();
    expect(document.body.textContent).toMatch(/No charge was made/);
  });
});
