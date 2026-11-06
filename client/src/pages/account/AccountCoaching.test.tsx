/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import { clearCsrfCache } from "@/lib/authRequest";
import { OVERVIEW_FIXTURE, SUBS_ACTIVE, jsonResponse } from "../../../test/account/testFixtures";
import AccountCoaching from "./AccountCoaching";

vi.mock("@/lib/session", () => ({
  loadMe: vi.fn(async () => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
  refreshMeAfterAuthChange: vi.fn(),
  peekMe: vi.fn(() => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

const CLIENT_HUB = {
  affiliates: [],
  coaches: [
    {
      id: 3,
      status: "pending",
      invited_by: "coach",
      viewer_is_coach: false,
      counterparty: { user_id: "12", name: "Ada Coach", display_name: "Ada Coach" },
    },
  ],
};

beforeEach(() => {
  clearAccountCache();
  clearCsrfCache();
});

afterEach(() => {
  cleanup();
  clearAccountCache();
  clearCsrfCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccountCoaching", () => {
  it("loads live coaches, accepts an invite, and browses programming", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "tok" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
      if (url.includes("/api/account/coaching/client")) return jsonResponse(CLIENT_HUB);
      if (url.includes("/api/account/coaching/coach")) {
        return jsonResponse({ affiliates: [], clients: [] });
      }
      if (url.includes("/api/account/coaching/profile") && method === "GET") {
        return jsonResponse({ error: "not_found" }, 404);
      }
      if (url.includes("/api/account/coaching/programming/subscriptions")) {
        return jsonResponse({ subscriptions: [] });
      }
      if (url.includes("/api/account/coaching/programming/series")) {
        return jsonResponse({
          series: [
            {
              id: 8,
              title: "Engine Builder",
              description: null,
              status: "published",
              start_date: null,
              end_date: null,
              access_mode: "free",
              is_subscribed: false,
            },
          ],
        });
      }
      if (url.includes("/api/account/coaching/plans")) {
        return jsonResponse({ active: [], inactive: [] });
      }
      if (url.includes("/api/account/coaching/directory")) {
        return jsonResponse({
          trainers: [
            {
              user_id: "12",
              name: "Ada Coach",
              display_name: "Ada Coach",
              bio: null,
              search_excerpt: null,
              avatar: null,
              completed_courses: [],
              completed_courses_count: 2,
            },
          ],
        });
      }
      if (method === "POST" && url.includes("/api/account/coaching/relationships/3/accept")) {
        return jsonResponse({ ok: true });
      }
      if (method === "POST" && url.endsWith("/api/account/coaching/relationships")) {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ error: "not_found" }, 404);
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(
      <Router>
        <AccountCoaching />
      </Router>,
    );

    await waitFor(() => expect(screen.getByText("Ada Coach")).toBeTruthy());
    expect(screen.queryByText("Fran")).toBeNull();
    expect(document.querySelector(".dash-panel--body .account-body-watermark")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "My clients" }));
    expect(
      screen.getByText("No 1:1 clients yet. Invite codes and QR join stay in the MetFix app."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "My coach" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.some((call) => {
          const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
          return (
            method === "POST" && String(call[0]).includes("/api/account/coaching/relationships/3/accept")
          );
        }),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Programming" }));
    await waitFor(() => expect(screen.getByText("Engine Builder")).toBeTruthy());
    expect(screen.getByText("No programming subscriptions yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Find a coach" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Request coach" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Request coach" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Request sent" })).toBeTruthy());
    const invite = fetchImpl.mock.calls.find((call) => {
      const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return method === "POST" && String(call[0]).endsWith("/api/account/coaching/relationships");
    });
    expect(invite).toBeTruthy();
    expect(JSON.parse(String((invite?.[1] as RequestInit).body))).toEqual({
      counterparty_user_id: 12,
      role: "client_request",
    });
  });
});
