/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountNotifications from "./AccountNotifications";
import { jsonResponse } from "./testFixtures";

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

beforeEach(() => {
  clearAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/notifications") && method === "GET") {
        return jsonResponse({
          preferences: { email_digest: true, product_updates: false },
          newsletter: false,
        });
      }
      if (url.includes("/api/account/notifications") && method === "PUT") {
        return jsonResponse(JSON.parse(String(init?.body ?? "{}")));
      }
      if (url.includes("/api/account/overview") || url.includes("/subscriptions")) {
        return jsonResponse({
          display_name: "Ada",
          badges: {},
          foundations_coach: {
            active: false,
            grant_reason: null,
            granted_at: null,
            expires_at: null,
            seminar_checked_in: false,
            metfix_essentials_completed: false,
            metfix_essentials_certificate_claimed: false,
          },
          canonical_tier: "free",
          items: [],
          tabs: [],
          links: {},
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

describe("AccountNotifications (P-DB-12)", () => {
  it("toggles notification + newsletter preferences with CSRF", async () => {
    render(
      <Router>
        <AccountNotifications />
      </Router>,
    );
    await waitFor(() => expect(screen.getByLabelText("newsletter")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("newsletter"));
    fireEvent.click(screen.getByRole("button", { name: /Save preferences/i }));
    await waitFor(() => {
      const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const put = fetchImpl.mock.calls.find(
        (c) =>
          String(c[0]).includes("/api/account/notifications") &&
          ((c[1] as RequestInit)?.method ?? "").toUpperCase() === "PUT",
      );
      expect(put).toBeTruthy();
      expect((put![1] as RequestInit).headers).toMatchObject({ "X-CSRF-Token": "test-csrf" });
      expect(JSON.parse(String((put![1] as RequestInit).body)).newsletter).toBe(true);
    });
  });
});
