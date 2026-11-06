/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountProfile from "./AccountProfile";
import { jsonResponse } from "../../../test/account/testFixtures";

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
          email: "ada@example.com",
          member_since: "2026-01-15",
          attributes: {
            personal: [{ attr_id: 1, label: "Address", value: "London" }],
            affiliate: [{ attr_id: 10, label: "Website", value: "https://example.com" }],
            clinic: [],
          },
        });
      }
      if (url.includes("/api/account/profile") && method === "PATCH") {
        return jsonResponse(JSON.parse(String(init?.body ?? "{}")));
      }
      if (url.includes("/api/account/onboarding-roles") && method === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return jsonResponse({
          onboarding_roles: body.onboarding_roles ?? ["individual"],
          has_physical_gym: body.has_physical_gym === true,
          has_physical_clinic: body.has_physical_clinic === true,
        });
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
          email: "ada@example.com",
          member_since: "2026-01-15",
          onboarding_roles: ["individual"],
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
  it("loads Mia-style summary and saves personal names with CSRF", async () => {
    render(
      <Router>
        <AccountProfile />
      </Router>,
    );
    await waitFor(() => expect(screen.getByDisplayValue("Ada")).toBeTruthy());
    expect(screen.getByText("Personal attributes")).toBeTruthy();
    expect(screen.getByText("Affiliate attributes")).toBeTruthy();
    expect(screen.getByText("Clinic attributes")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("Ada"), { target: { value: "Augusta" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));
    await waitFor(() => {
      const statuses = screen.getAllByRole("status");
      expect(statuses.some((el) => /Personal profile saved/i.test(el.textContent ?? ""))).toBe(
        true,
      );
    });
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const patch = fetchImpl.mock.calls.find(
      (c) =>
        String(c[0]).includes("/api/account/profile") &&
        ((c[1] as RequestInit)?.method ?? "").toUpperCase() === "PATCH",
    );
    expect(patch).toBeTruthy();
    expect((patch![1] as RequestInit).headers).toMatchObject({ "X-CSRF-Token": "test-csrf" });
    const body = JSON.parse(String((patch![1] as RequestInit).body));
    expect(body.first_name).toBe("Augusta");
    expect(body.last_name).toBe("Lovelace");
    expect(body.bio).toBeUndefined();
  });

  it("blocks email-like attribute values client-side on personal section", async () => {
    render(
      <Router>
        <AccountProfile />
      </Router>,
    );
    await waitFor(() => expect(screen.getByLabelText("Address")).toBeTruthy());
    expect(screen.getByLabelText("Website")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\battr_id\b/);
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "x@y.co" } });
    fireEvent.click(screen.getByRole("button", { name: /Save personal attributes/i }));
    await waitFor(() =>
      expect(screen.getByText(/Email-like attributes are not allowed/i)).toBeTruthy(),
    );
  });
});
