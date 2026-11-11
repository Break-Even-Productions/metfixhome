/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import AccountNotifications from "./AccountNotifications";
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
      if (url.includes("/api/account/inbox/read") || url.includes("/api/account/inbox/dismiss")) {
        return jsonResponse({ success: true });
      }
      if (url.includes("/api/account/inbox")) {
        const page = new URL(url, "http://localhost").searchParams;
        return jsonResponse({
          view: page.get("view") ?? "all",
          limit: Number(page.get("limit") ?? 50),
          offset: Number(page.get("offset") ?? 0),
          total_count: 51,
          conversations: [],
          notifications: [
            {
              id: 1,
              source: "personal",
              type: "messaging",
              title: "New message",
              content: "Hey there",
              created_at: "2026-11-06 10:00:00",
              read_at: null,
              link: "/messages/42",
              post_id: 42,
              href: "/account/messages/42",
            },
            {
              id: 2,
              type: "dfx_daily",
              title: "Daily Fix",
              content: "New Daily Fix is available",
              created_at: "2026-11-06 08:00:00",
              read_at: "2026-11-06 09:00:00",
              link: "/fix/25/11/06",
              href: "/the-daily-fix/25/11/06",
            },
            {
              id: 3,
              type: "new_post",
              title: "New post",
              content: "A new essay",
              created_at: "2026-11-05 12:00:00",
              read_at: null,
              post_id: 88,
              href: "/posts/88",
            },
            {
              id: 4,
              type: "new_newsletter",
              title: "March letter",
              content: "New newsletter is available.",
              created_at: "2026-11-04 12:00:00",
              read_at: null,
              link: "https://mailchi.mp/metfix/march",
            },
          ],
          unread_count: 2,
        });
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

describe("AccountNotifications", () => {
  it("renders clickable notification deep links by type", async () => {
    render(
      <Router>
        <AccountNotifications />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("New message")).toBeTruthy());
    const links = screen.getAllByRole("link").map((el) => el.getAttribute("href"));
    expect(links).toContain("/account/messages/42");
    expect(links).toContain("/the-daily-fix/25/11/06");
    expect(links).toContain("/posts/88");
    const letter = screen.getByRole("link", { name: /March letter/i });
    expect(letter.getAttribute("href")).toBe("https://mailchi.mp/metfix/march");
    expect(letter.getAttribute("target")).toBe("_blank");
    expect(screen.getByText("3+")).toBeTruthy();
    const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(
      fetchImpl.mock.calls.some((c) => String(c[0]).includes("view=focused")),
    ).toBe(true);
  });

  it("marks a notification read on open and deletes it from More", async () => {
    render(
      <Router>
        <AccountNotifications />
      </Router>,
    );
    const message = await screen.findByRole("link", { name: /New message/i });
    fireEvent.click(message);
    await waitFor(() => {
      const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const post = fetchImpl.mock.calls.find((c) => String(c[0]).includes("/api/account/inbox/read"));
      expect(post).toBeTruthy();
      expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({ notification_id: 1 });
    });

    fireEvent.click(screen.getAllByRole("button", { name: "More" })[0]!);
    expect(screen.queryByRole("menuitem", { name: "Mark as read" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Dismiss" }));
    expect(screen.getByRole("dialog", { name: "Dismiss this notification?" })).toBeTruthy();
    const fetchBefore = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchBefore.mock.calls.some((c) => String(c[0]).includes("/api/account/inbox/dismiss"))).toBe(
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => {
      const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const post = fetchImpl.mock.calls.find((c) =>
        String(c[0]).includes("/api/account/inbox/dismiss"),
      );
      expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({
        notification_id: 1,
        type: "personal",
      });
    });
    expect(screen.queryByRole("link", { name: /New message/i })).toBeNull();
  });

  it("loads the next inbox page", async () => {
    render(
      <Router>
        <AccountNotifications />
      </Router>,
    );
    const more = await screen.findByRole("button", { name: "Load more" });
    fireEvent.click(more);
    await waitFor(() => {
      const fetchImpl = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      expect(
        fetchImpl.mock.calls.some((c) => String(c[0]).includes("offset=4")),
      ).toBe(true);
    });
  });

});
