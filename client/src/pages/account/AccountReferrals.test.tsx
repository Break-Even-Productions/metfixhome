/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountReferrals from "./AccountReferrals";
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
      if (url.includes("/api/account/referrals") && method === "GET") {
        return jsonResponse({
          referral_code: "MFXADA",
          earnings: { total_cents: 5000 },
        });
      }
      if (url.includes("/api/account/course-gifts")) {
        return jsonResponse({
          items: [{ code: "GIFT1", course_title: "Essentials", status: "unused" }],
        });
      }
      if (url.includes("/api/account/referral-code") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return jsonResponse({
          referral_code: body.action === "revoke" ? null : "MFXNEW",
          earnings: { total_cents: 5000 },
        });
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

describe("AccountReferrals (P-DB-11)", () => {
  it("shows referral code, earnings, gifts, and generate/rotate/revoke", async () => {
    render(
      <Router>
        <AccountReferrals />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("MFXADA")).toBeTruthy());
    expect(screen.getByText(/GIFT1/)).toBeTruthy();
    expect(screen.getByText(/Essentials/)).toBeTruthy();
    expect(screen.getByText(/total_cents/)).toBeTruthy();

    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole("button", { name: /^Generate$/i }));
    await waitFor(() => {
      const posts = fetchImpl.mock.calls.filter((c) =>
        String(c[0]).includes("/referral-code"),
      );
      expect(posts.length).toBeGreaterThanOrEqual(1);
      expect(JSON.parse(String((posts[0]![1] as RequestInit).body)).action).toBe("generate");
      expect((screen.getByRole("button", { name: /^Rotate$/i }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /^Rotate$/i }));
    await waitFor(() => {
      const actions = fetchImpl.mock.calls
        .filter((c) => String(c[0]).includes("/referral-code"))
        .map((c) => JSON.parse(String((c[1] as RequestInit).body)).action);
      expect(actions).toContain("rotate");
      expect((screen.getByRole("button", { name: /^Revoke$/i }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /^Revoke$/i }));
    await waitFor(() => {
      const actions = fetchImpl.mock.calls
        .filter((c) => String(c[0]).includes("/referral-code"))
        .map((c) => JSON.parse(String((c[1] as RequestInit).body)).action);
      expect(actions).toEqual(expect.arrayContaining(["generate", "rotate", "revoke"]));
    });
  });
});
