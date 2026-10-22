/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";
import type { DailyFixComment } from "./comments";

beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: { ...window.location, hostname: "metfix.org" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SAMPLE: DailyFixComment = {
  id: 7,
  pillar: "belly",
  author: "Pat",
  content: "hello",
  timestamp: "2025-02-10T12:00:00Z",
  like_count: 2,
  liked: false,
  parent_id: null,
  deleted: 0,
  edited: 0,
  replies: [],
};

describe("CommentThread composer", () => {
  it("never shows a name field (R22 / C7.1)", () => {
    const { rerender } = render(
      <CommentThread load={{ status: "loaded", comments: [] }} pillar="belly" />,
    );
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();

    rerender(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        viewerDisplayName="Ada Lovelace"
      />,
    );
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    expect(screen.getByText(/Signed in as Ada Lovelace/i)).toBeTruthy();
  });

  it("lets the user change comment type from the current tab", async () => {
    render(<CommentThread load={{ status: "loaded", comments: [] }} pillar="body" />);
    const trigger = screen.getByRole("button", { name: /Comment type/i });
    expect(trigger.textContent).toMatch(/Body/i);

    fireEvent.keyDown(trigger, { key: "Enter" });
    const brain = await screen.findByRole("menuitemradio", { name: /Brain/i });
    fireEvent.click(brain);
    expect(screen.getByRole("button", { name: /Comment type/i }).textContent).toMatch(/Brain/i);
  });

  it("logged-out Reply and Like open the join modal with zero POSTs", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);
    render(
      <CommentThread
        load={{ status: "loaded", comments: [SAMPLE] }}
        pillar="belly"
        dateIso="2025-02-10"
      />,
    );
    expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Like \(2\)/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByRole("dialog", { name: /Sign in to MetFix/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Like \(2\)/ }));
    expect(await screen.findByRole("dialog", { name: /Sign in to MetFix/i })).toBeTruthy();

    const posts = fetchImpl.mock.calls.filter(
      (c) => ((c[1] as RequestInit | undefined)?.method ?? "GET") === "POST",
    );
    expect(posts).toHaveLength(0);
  });
});
