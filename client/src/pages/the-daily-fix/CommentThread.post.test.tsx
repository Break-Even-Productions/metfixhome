/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";
import type { DailyFixComment } from "./comments";

describe("CommentThread post target (CT-P1)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not auto-retry POST on failure (one POST only)", async () => {
    const comments: DailyFixComment[] = [
      {
        id: 1,
        pillar: "body",
        author: "A",
        content: "Hi",
        timestamp: null,
        parent_id: null,
      },
    ];
    let postAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/csrf") {
        return new Response(JSON.stringify({ csrf: "csrf-token" }), { status: 200 });
      }
      if (url === "/api/posts/7/comments" && init?.method === "POST") {
        postAttempts += 1;
        return new Response(JSON.stringify({ error: "try_again" }), { status: 403 });
      }
      if (url === "/api/posts/7/comments") {
        return new Response(JSON.stringify({ comments: [] }), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CommentThread
        target={{ kind: "post", postId: 7, returnPath: "/library/post/7" }}
        load={{ status: "loaded", comments }}
        pillar="body"
        viewerDisplayName="Tester"
        showHeader={false}
      />,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "New comment" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));

    await waitFor(() => expect(postAttempts).toBe(1));
    expect(
      fetchMock.mock.calls.filter(
        (c) => String(c[0]) === "/api/posts/7/comments" && (c[1] as RequestInit)?.method === "POST",
      ),
    ).toHaveLength(1);
  });
});
