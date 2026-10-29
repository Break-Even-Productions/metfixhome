/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountPrivacy from "./AccountPrivacy";
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
      if (url.includes("/api/account/privacy") && method === "GET") {
        return jsonResponse({ directory_visible: false, profile_public: true });
      }
      if (url.includes("/api/account/privacy") && method === "PUT") {
        return jsonResponse(JSON.parse(String(init?.body ?? "{}")));
      }
      if (url.includes("/password-reset") && method === "POST") {
        return jsonResponse({ ok: true });
      }
      if (url.includes("/api/account/email") && method === "PUT") {
        return jsonResponse({ ok: true });
      }
      if (url.includes("/email/confirm") && method === "POST") {
        return jsonResponse({ ok: true });
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

describe("AccountPrivacy (P-DB-13)", () => {
  it("saves privacy toggles, password reset, and 2-step email change", async () => {
    render(
      <Router>
        <AccountPrivacy />
      </Router>,
    );
    await waitFor(() => expect(screen.getByLabelText("directory_visible")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("directory_visible"));
    fireEvent.click(screen.getByRole("button", { name: /Save privacy/i }));
    await waitFor(() => expect(screen.getByText(/Privacy settings saved/i)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Send password reset email/i }));
    await waitFor(() => expect(screen.getByText(/Password reset email sent/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/New email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send confirmation code/i }));
    await waitFor(() => expect(screen.getByLabelText(/Confirmation code/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Confirmation code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm email/i }));
    await waitFor(() => expect(screen.getByText(/Email updated/i)).toBeTruthy());

    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(
      fetchImpl.mock.calls.some(
        (c) =>
          String(c[0]).includes("/privacy") &&
          ((c[1] as RequestInit)?.method ?? "").toUpperCase() === "PUT",
      ),
    ).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/password-reset"))).toBe(true);
    expect(
      fetchImpl.mock.calls.some(
        (c) =>
          String(c[0]).endsWith("/api/account/email") &&
          ((c[1] as RequestInit)?.method ?? "").toUpperCase() === "PUT",
      ),
    ).toBe(true);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/email/confirm"))).toBe(true);
  });
});
