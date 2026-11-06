/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import { jsonResponse } from "../../../test/account/testFixtures";
import AccountExclusive from "./AccountExclusive";

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

const ACCESS = {
  access: "full" as const,
  has_content_access: true,
  user_has_access: true,
  has_preview: false,
  is_exclusive: true,
  show_same: 0,
  show_video_in_preview: false,
  access_group_labels: [] as string[],
};

function shell(url: string): Response | null {
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

describe("AccountExclusive", () => {
  it("shows exclusive posts and never links them to Daily Fix", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const account = shell(url);
        if (account) return account;
        if (url.includes("/api/library/exclusive/levels")) {
          return jsonResponse({
            access_levels: [{ id: 5, name: "MetFix Pro", slug: "metfix" }],
          });
        }
        if (url.includes("/api/library/exclusive")) {
          return jsonResponse({
            resources: [
              {
                id: 7,
                type: "exclusive_resource",
                title: "Member briefing",
                excerpt: "Members",
                date: "2026-02-01T00:00:00.000Z",
                image: null,
                permalink: null,
                author: null,
                categories: [],
                topics: [],
                content_types: [],
                access: ACCESS,
              },
              {
                id: 8,
                type: "daily_fix",
                title: "Wednesday Fix",
                excerpt: "day",
                date: "2026-02-02T00:00:00.000Z",
                image: null,
                permalink: "https://brokenscience.org/the-daily-fix",
                author: null,
                categories: [],
                topics: [],
                content_types: [],
                daily_fix_date: "2026-02-02",
                access: { ...ACCESS, is_exclusive: false },
              },
            ],
            meta: { total: 2, count: 2, limit: 12, offset: 0, has_more: false },
          });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );

    render(
      <Router>
        <AccountExclusive />
      </Router>,
    );

    const title = await screen.findByText("Member briefing");
    expect(screen.queryByText("Wednesday Fix")).toBeNull();
    const link = title.closest("a");
    expect(link?.getAttribute("href")).toBe("/library/exclusive_resource/7");
    expect(document.querySelector(".account-exclusive-grid")?.innerHTML ?? "").not.toContain(
      "/the-daily-fix",
    );
    expect(calls.some((url) => url.includes("/the-daily-fix"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "MetFix Pro" }));
    await waitFor(() =>
      expect(calls.some((url) => url.includes("content_access"))).toBe(true),
    );
  });
});
