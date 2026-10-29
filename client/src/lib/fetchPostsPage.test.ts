/**
 * B4 — shared posts fetcher caches one network call per page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPostsPage, type PostsPageCache } from "./fetchPostsPage";

const body = {
  posts: [
    {
      id: 1,
      title: "Hello",
      excerpt: "",
      date: "2026-01-01T00:00:00.000Z",
      image: null,
      author: "MetFix",
      category: { name: "News", slug: "news" },
    },
  ],
  page: 1,
  per_page: 12,
  has_more: false,
};

function freshCache(): PostsPageCache {
  return { resolved: new Map(), inflight: new Map() };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(body, { status: 200, headers: { "Content-Type": "application/json" } }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("B4 fetchPostsPage cache", () => {
  it("issues one network fetch for concurrent page=1 callers", async () => {
    const cache = freshCache();
    const [a, b] = await Promise.all([
      fetchPostsPage(1, undefined, cache),
      fetchPostsPage(1, undefined, cache),
    ]);
    expect(a).toEqual(body);
    expect(b).toEqual(body);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/posts?page=1");
  });

  it("does not refetch after resolve", async () => {
    const cache = freshCache();
    await fetchPostsPage(1, undefined, cache);
    await fetchPostsPage(1, undefined, cache);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
