/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountPrivacy from "./AccountPrivacy";
import { jsonResponse } from "../../../test/account/testFixtures";

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
      if (url.includes("/api/account/notifications") && method === "GET") {
        return jsonResponse({
          account: {
            types: [
              {
                slug: "comment_reply",
                label: "Replies",
                group: "content",
                allowed_channels: ["email", "push", "in_feed"],
                channels: { email: 1, push: 0, in_feed: 1 },
              },
            ],
          },
          newsletter: { subscribed: false },
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

describe("AccountPrivacy (P-DB-13)", () => {
  it("skips the missing privacy settings route and still changes email and password", async () => {
    render(
      <Router>
        <AccountPrivacy />
      </Router>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^Your account/ })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^Privacy/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Coaching/i })).toBeTruthy();
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
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/api/account/privacy"))).toBe(
      false,
    );
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

  it("saves notification preferences from the settings pane", async () => {
    render(
      <Router>
        <AccountPrivacy />
      </Router>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Notifications/ }));
    await waitFor(() => expect(screen.getByLabelText("Replies Email")).toBeTruthy());
    expect(screen.queryByLabelText("Newsletter")).toBeNull();
    fireEvent.click(screen.getByLabelText("Replies Push"));
    fireEvent.click(screen.getByRole("button", { name: /Save preferences/i }));
    await waitFor(() => {
      const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const put = fetchImpl.mock.calls.find(
        (c) =>
          String(c[0]).includes("/api/account/notifications") &&
          ((c[1] as RequestInit)?.method ?? "").toUpperCase() === "PUT",
      );
      expect(put).toBeTruthy();
      const body = JSON.parse(String((put![1] as RequestInit).body)) as {
        newsletter?: boolean;
        account: { types: Array<{ slug: string; channels: Record<string, number> }> };
      };
      expect(body.newsletter).toBeUndefined();
      expect(body.account.types[0]?.channels.push).toBe(1);
    });
  });
});
