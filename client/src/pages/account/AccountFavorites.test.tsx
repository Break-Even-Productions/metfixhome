/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountFavorites from "./AccountFavorites";
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
      if (url.includes("/api/account/favorites") && method === "GET") {
        if (url.includes("type=recipes")) {
          return jsonResponse({
            items: [{ source_type: "recipes", source_id: "r1", title: "Soup" }],
          });
        }
        return jsonResponse({
          items: [
            { source_type: "articles", source_id: "a1", title: "Article One" },
            { source_type: "recipes", source_id: "r1", title: "Soup" },
          ],
        });
      }
      if (url.includes("/api/account/favorites/") && (method === "PUT" || method === "DELETE")) {
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

describe("AccountFavorites (P-DB-10)", () => {
  it("filters favorites and toggles remove idempotently", async () => {
    render(
      <Router>
        <AccountFavorites />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Article One")).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: /^recipes$/i }));
    await waitFor(() => expect(screen.getByText("Soup")).toBeTruthy());
    expect(screen.queryByText("Article One")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Remove/i }));
    await waitFor(() => expect(screen.queryByText("Soup")).toBeNull());
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const dels = fetchImpl.mock.calls.filter(
      (c) => ((c[1] as RequestInit | undefined)?.method ?? "").toUpperCase() === "DELETE",
    );
    expect(dels.length).toBeGreaterThanOrEqual(1);
  });
});
