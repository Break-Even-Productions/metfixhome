/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { clearAccountCache } from "@/lib/account";
import AccountMessages from "./AccountMessages";
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

const CONVERSATIONS = {
  conversations: [
    {
      id: "9",
      type: "direct",
      name: "Coach Ada",
      lastMessage: "See you at 6",
      lastMessageTime: "2026-11-06T18:00:00Z",
      unreadCount: 1,
      currentUserId: "42",
      members: [
        { id: "42", name: "Jane" },
        { id: "7", name: "Coach Ada" },
      ],
    },
  ],
};

beforeEach(() => {
  clearAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "test-csrf" });
      if (url.includes("/api/account/overview") || url.includes("/subscriptions")) {
        return jsonResponse({
          display_name: "Jane",
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
          items: [],
          tabs: [],
          links: {},
        });
      }
      if (url.includes("/api/account/messages/conversations/9/messages") && method === "GET") {
        return jsonResponse({
          messages: [
            {
              id: "100",
              conversationId: "9",
              senderId: "7",
              senderName: "Coach Ada",
              content: "See you at 6",
              timestamp: "2026-11-06T18:00:00Z",
            },
          ],
          has_more: false,
        });
      }
      if (url.includes("/api/account/messages/conversations/9/messages") && method === "POST") {
        return jsonResponse(
          {
            message: {
              id: "101",
              conversationId: "9",
              senderId: "42",
              senderName: "Jane",
              content: "On my way",
              timestamp: "2026-11-06T18:01:00Z",
            },
          },
          201,
        );
      }
      if (url.includes("/api/account/messages/conversations/9/read")) {
        return jsonResponse({ success: true });
      }
      if (url.includes("/api/account/messages/conversations/9") && method === "GET") {
        return jsonResponse({ conversation: CONVERSATIONS.conversations[0] });
      }
      if (url.includes("/api/account/messages/conversations") && method === "GET") {
        return jsonResponse(CONVERSATIONS);
      }
      if (url.includes("/api/account/messages/users")) {
        return jsonResponse({
          users: [{ id: "7", name: "Coach Ada", secondary_text: "Staff" }],
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

describe("AccountMessages", () => {
  it("lists conversations and opens a thread", async () => {
    const { hook } = memoryLocation({ path: "/account/messages" });
    render(
      <Router hook={hook}>
        <AccountMessages />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Coach Ada")).toBeTruthy());
    expect(screen.getByText("See you at 6")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: /Coach Ada/i }));
  });

  it("loads thread content for /account/messages/:id deep link", async () => {
    const { hook } = memoryLocation({ path: "/account/messages/9" });
    render(
      <Router hook={hook}>
        <AccountMessages />
      </Router>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Send/i })).toBeTruthy());
    expect(screen.getAllByText("See you at 6").length).toBeGreaterThan(0);
  });

  it("opens member search compose panel", async () => {
    const { hook } = memoryLocation({ path: "/account/messages" });
    render(
      <Router hook={hook}>
        <AccountMessages />
      </Router>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^New$/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /^New$/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/Search members/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Coach Ada")).toBeTruthy());
  });
});
