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
            items: [
              {
                source_type: "custom_recipe",
                source_id: "r1",
                title: "Soup",
                url: "/account/my-meals/recipes/r1/edit",
                photo_url: "https://cdn.example/soup.jpg",
                protein_g: 30,
                fat_g: 12,
                carb_g: 8,
                protein_name: "Chicken",
              },
            ],
          });
        }
        return jsonResponse({
          items: [
            {
              source_type: "daily_article",
              source_id: "a1",
              title: "Article One",
              url: "/posts/a1",
            },
            {
              source_type: "custom_recipe",
              source_id: "r1",
              title: "Soup",
              url: "/account/my-meals/recipes/r1/edit",
              photo_url: "https://cdn.example/soup.jpg",
              protein_g: 30,
              fat_g: 12,
              carb_g: 8,
            },
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
  it("loads via GET /api/account/favorites, filters, and toggles remove", async () => {
    render(
      <Router>
        <AccountFavorites />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Article One")).toBeTruthy());
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const favGets = fetchImpl.mock.calls.filter((c) =>
      String(c[0]).includes("/api/account/favorites"),
    );
    expect(favGets.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("tab", { name: /^Recipes$/i }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Soup" })).toBeTruthy());
    expect(screen.queryByText("Article One")).toBeNull();
    expect(screen.getByText("Recipe")).toBeTruthy();
    expect(screen.getByText(/P 30g/i)).toBeTruthy();
    expect(document.querySelector("img.account-fav-card__img")?.getAttribute("src")).toBe(
      "https://cdn.example/soup.jpg",
    );
    expect(screen.getByRole("link", { name: "Soup" }).getAttribute("href")).toBe(
      "/account/my-meals/recipes/r1/edit",
    );

    fireEvent.click(screen.getByRole("button", { name: /Remove Soup from saved/i }));
    await waitFor(() => expect(screen.queryByText("Soup")).toBeNull());
    const dels = fetchImpl.mock.calls.filter(
      (c) => ((c[1] as RequestInit | undefined)?.method ?? "").toUpperCase() === "DELETE",
    );
    expect(dels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows article date without time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/favorites")) {
          return jsonResponse({
            items: [
              {
                source_type: "post",
                source_id: "42",
                title: "Sleep Science",
                url: "/posts/42",
                date: "2026-09-30 07:00:13",
              },
            ],
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
    render(
      <Router>
        <AccountFavorites />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Sleep Science")).toBeTruthy());
    expect(screen.getByText("Sep 30, 2026")).toBeTruthy();
    expect(screen.queryByText(/07:00/)).toBeNull();
  });

  it("strips HTML from scale and uses bookmark control", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/favorites") && method === "GET") {
          return jsonResponse({
            items: [
              {
                source_type: "daily_workout",
                source_id: "3",
                title: "Hero WOD",
                scale:
                  "<p>In honor of veteran Chad Wilkinson. Learn more at the <a href=\"https://example.com\">foundation</a>.</p>",
              },
            ],
          });
        }
        if (url.includes("/api/account/favorites/") && method === "DELETE") {
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
    render(
      <Router>
        <AccountFavorites />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Hero WOD")).toBeTruthy());
    expect(screen.getByText(/In honor of veteran Chad Wilkinson/i)).toBeTruthy();
    expect(screen.queryByText(/<p>/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Remove Hero WOD from saved/i })).toBeTruthy();
  });

  it("empty state shows clear message and browse CTA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
        if (url.includes("/api/account/favorites")) return jsonResponse({ items: [] });
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
    render(
      <Router>
        <AccountFavorites />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText(/Nothing saved yet/i)).toBeTruthy());
    expect(screen.getByRole("link", { name: /Browse the library/i })).toBeTruthy();
    expect(screen.queryByText(/^No saved items\.$/)).toBeNull();
  });
});
