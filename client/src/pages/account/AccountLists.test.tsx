/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import { jsonResponse } from "../../../test/account/testFixtures";
import AccountListDetail from "./AccountListDetail";
import AccountLists from "./AccountLists";

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

const LIST = {
  id: 4,
  title: "Race week",
  description: "Prep",
  excerpt: null,
  visibility: "public",
  cover_image_url: null,
  item_count: 1,
  share_token: "ab".repeat(16),
  created_at: null,
  updated_at: null,
  list_relationship: "owner",
  owner_display_name: null,
  owner_user_id: 1,
  subscribed_at: null,
  access_mode: "free",
  price: null,
  currency: null,
  marketplace_listing_id: null,
  web_url: null,
  access_status: "owner",
};

function accountShell(url: string, method: string): Response | null {
  if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
  if (url.includes("/api/account/overview")) {
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
      canonical_tier: "metfix_pro",
      tabs: [],
      links: {},
    });
  }
  if (url.includes("/api/account/subscriptions")) {
    return jsonResponse({ canonical_tier: "metfix_pro", items: [] });
  }
  if (url.includes("/api/account/lists/public")) {
    return jsonResponse({ lists: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } });
  }
  if (url.includes("/api/account/lists/4/items") && method === "GET") {
    return jsonResponse({
      list_id: 4,
      count: 1,
      items: [
        {
          id: 9,
          list_id: 4,
          note: null,
          sort_order: 0,
          content: {
            source_type: "post",
            source_id: 88,
            title: "Briefing",
            excerpt: null,
            photo_url: null,
            article_url: "https://brokenscience.org/briefing",
            video_url: null,
            recipe_url: null,
            url: null,
          },
        },
      ],
    });
  }
  if (url.includes("/api/account/lists/4") && method === "GET") {
    return jsonResponse({ list: LIST });
  }
  if (url.includes("/api/account/lists") && method === "GET" && !url.includes("/lists/")) {
    return jsonResponse({
      lists: [LIST],
      meta: { count: 1, total: 1, limit: 50, offset: 0 },
    });
  }
  return null;
}

beforeEach(() => {
  clearAccountCache();
});

afterEach(() => {
  cleanup();
  clearAccountCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccountLists", () => {
  it("loads app lists and creates one without touching shopping lists", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        calls.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
        const shell = accountShell(url, method);
        if (shell) return shell;
        if (url.includes("/api/account/lists") && method === "POST") {
          return jsonResponse({ list: { ...LIST, id: 5, title: "Travel" } }, 201);
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountLists />
      </Router>,
    );

    expect(await screen.findByText("Race week")).toBeTruthy();
    expect(calls.some((c) => c.url.includes("shopping-lists"))).toBe(false);
    expect(calls.some((c) => c.url.includes("/api/account/favorites"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Create list" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Travel" } });
    fireEvent.click(screen.getByRole("button", { name: "Save list" }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url.includes("/api/account/lists") &&
            (c.body ?? "").includes("Travel"),
        ),
      ).toBe(true),
    );
    expect(calls.some((c) => c.url.includes("shopping-lists"))).toBe(false);
  });

  it("opens a list and removes an item", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        calls.push({ url, method });
        const shell = accountShell(url, method);
        if (shell) return shell;
        if (url.includes("/api/account/lists/4/items/9") && method === "DELETE") {
          return jsonResponse({ success: true });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    window.history.replaceState({}, "", "/account/lists/4");
    render(
      <Router>
        <Route path="/account/lists/:id">
          <AccountListDetail />
        </Route>
      </Router>,
    );

    expect(await screen.findByText("Briefing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "DELETE" && c.url.includes("/api/account/lists/4/items/9"),
        ),
      ).toBe(true),
    );
    expect(calls.some((c) => c.url.includes("shopping-lists"))).toBe(false);
  });

  it("adds Daily Fix, custom items, a report, and a subscriber", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        const body = typeof init?.body === "string" ? init.body : undefined;
        calls.push({ url, method, body });
        const shell = accountShell(url, method);
        if (shell) return shell;
        if (url.includes("/api/daily-fix?date=")) {
          return jsonResponse({
            date: "2026-11-06",
            belly: { id: 11, title: "Steak" },
            body: { id: 22, title: "Squat" },
            brain: { id: 33, title: "Sleep" },
          });
        }
        if (url.includes("/api/library/search")) {
          return jsonResponse({
            resources: [
              {
                id: 11,
                type: "daily_fix",
                title: "Steak",
                excerpt: "",
                date: "2026-11-06T00:00:00.000Z",
                image: null,
                permalink: null,
                author: null,
                categories: [],
                topics: [],
                content_types: [],
                access: {
                  access: "full",
                  has_content_access: true,
                  user_has_access: true,
                  has_preview: false,
                  is_exclusive: false,
                  show_same: 0,
                  show_video_in_preview: false,
                  access_group_labels: [],
                },
                daily_fix_pillar: "belly",
                daily_fix_date: "2026-11-06",
              },
            ],
            meta: { total: 1, count: 1, limit: 12, offset: 0, has_more: false },
          });
        }
        if (url.includes("/api/account/custom-recipes")) {
          return jsonResponse({ items: [{ id: 3, title: "My bowl" }] });
        }
        if (url.includes("/api/account/custom-workouts")) {
          return jsonResponse({ items: [{ id: 8, title: "Engine" }] });
        }
        if (url.includes("/api/account/lists/4/items") && method === "POST") {
          const sent = JSON.parse(body ?? "{}") as { source_type?: string };
          if (sent.source_type === "custom_workout") {
            return jsonResponse({ saved: true, listed: false }, 201);
          }
          return jsonResponse(
            {
              list_item: {
                id: 20,
                list_id: 4,
                note: null,
                sort_order: 1,
                content: {
                  source_type: sent.source_type,
                  source_id: 11,
                  title: "Added",
                  excerpt: null,
                  photo_url: null,
                  article_url: null,
                  video_url: null,
                  recipe_url: null,
                  url: null,
                },
              },
            },
            201,
          );
        }
        if (url.includes("/api/account/content-reports") && method === "POST") {
          return jsonResponse(
            { id: 9, content_type: "user_list", content_id: 4, status: "pending" },
            201,
          );
        }
        if (url.includes("/api/account/lists/4/subscribers/42") && method === "DELETE") {
          return jsonResponse({ success: true });
        }
        if (url.includes("/api/account/lists/4/subscribers") && method === "POST") {
          return jsonResponse({ list: LIST }, 201);
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    window.history.replaceState({}, "", "/account/lists/4");
    render(
      <Router>
        <Route path="/account/lists/:id">
          <AccountListDetail />
        </Route>
      </Router>,
    );

    expect(await screen.findByText("Briefing")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Daily Fix"), { target: { value: "steak" } });
    fireEvent.click(screen.getByRole("button", { name: "Search Daily Fix" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Steak (2026-11-06)" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url.includes("/api/account/lists/4/items") &&
            (c.body ?? "").includes("daily_mod"),
        ),
      ).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "My recipes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add My bowl" }));
    await waitFor(() =>
      expect(calls.some((c) => (c.body ?? "").includes("custom_recipe"))).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "My workouts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add Engine" }));
    expect(await screen.findByText("Saved. The list catalog did not return this item.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url.includes("/api/account/content-reports") &&
            (c.body ?? "").includes("user_list"),
        ),
      ).toBe(true),
    );
    expect(await screen.findByText("Report submitted. Thank you.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Invite user"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url.includes("/api/account/lists/4/subscribers") &&
            (c.body ?? "").includes("42"),
        ),
      ).toBe(true),
    );

    fireEvent.change(screen.getByLabelText("Remove subscriber"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove subscriber" }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "DELETE" && c.url.includes("/api/account/lists/4/subscribers/42"),
        ),
      ).toBe(true),
    );
  });
});
