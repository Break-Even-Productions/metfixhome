/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountProfile from "./AccountProfile";
import { jsonResponse } from "./testFixtures";

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

beforeEach(() => {
  clearAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/profile") && method === "GET") {
        return jsonResponse({
          first_name: "Ada",
          last_name: "Lovelace",
          display_name: "Ada Lovelace",
          bio: "Math",
          location: "London",
          credentials: "Analyst",
          community_opt_in: true,
        });
      }
      if (url.includes("/api/account/profile") && method === "PATCH") {
        return jsonResponse(JSON.parse(String(init?.body ?? "{}")));
      }
      if (url.includes("/profile/attributes") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        const val = body.attributes?.[0]?.value ?? "";
        if (/@/.test(val) || /email/i.test(val)) {
          return jsonResponse({ error: "invalid_attribute" }, 400);
        }
        return jsonResponse({ ok: true });
      }
      if (url.includes("/profile/picture") && method === "POST") {
        return jsonResponse({ ok: true });
      }
      if (url.includes("/api/account/overview")) {
        return jsonResponse({
          display_name: "Ada Lovelace",
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
          canonical_tier: "member",
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

describe("AccountProfile (P-DB-9)", () => {
  it("loads and saves profile fields with CSRF", async () => {
    render(
      <Router>
        <AccountProfile />
      </Router>,
    );
    await waitFor(() => expect(screen.getByDisplayValue("Ada Lovelace")).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue("Math"), { target: { value: "Poet" } });
    fireEvent.click(screen.getByRole("button", { name: /Save profile/i }));
    await waitFor(() => {
      const statuses = screen.getAllByRole("status");
      expect(statuses.some((el) => /^Saved\.?$/.test(el.textContent ?? ""))).toBe(true);
    });
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const patch = fetchImpl.mock.calls.find(
      (c) =>
        String(c[0]).includes("/api/account/profile") &&
        ((c[1] as RequestInit)?.method ?? "").toUpperCase() === "PATCH",
    );
    expect(patch).toBeTruthy();
    expect((patch![1] as RequestInit).headers).toMatchObject({ "X-CSRF-Token": "test-csrf" });
    expect(JSON.parse(String((patch![1] as RequestInit).body)).bio).toBe("Poet");
  });

  it("blocks email-like attribute values client-side", async () => {
    render(
      <Router>
        <AccountProfile />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText(/Attributes/i)).toBeTruthy());
    const inputs = screen.getAllByRole("textbox");
    const valueInput = inputs[inputs.length - 1]!;
    fireEvent.change(valueInput, { target: { value: "x@y.co" } });
    fireEvent.click(screen.getByRole("button", { name: /Save attribute/i }));
    await waitFor(() =>
      expect(screen.getByText(/Email-like attributes are not allowed/i)).toBeTruthy(),
    );
  });
});
