/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshMeAfterAuthChange } from "@/lib/session";
import { PostCommentsSection } from "./PostCommentsSection";

describe("PostCommentsSection (TC13)", () => {
  beforeEach(() => {
    void refreshMeAfterAuthChange();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches post comments once per postId mount", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return new Response(JSON.stringify({ signed_in: false }), { status: 200 });
      }
      if (url === "/api/posts/42/comments") {
        return new Response(JSON.stringify({ comments: [] }), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PostCommentsSection postId={42} locked={false} />);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]) === "/api/posts/42/comments"),
      ).toHaveLength(1),
    );
  });

  it("locked resource performs zero network requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PostCommentsSection postId={99} locked={true} />);
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
