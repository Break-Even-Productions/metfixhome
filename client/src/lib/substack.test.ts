import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_SUBSTACK_POSTS, loadSubstackPosts, substackImageUrl } from "./substack";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadSubstackPosts", () => {
  it("returns mapped posts from the archive API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          {
            title: "Live",
            excerpt: "From API",
            url: "https://letsstartwiththetruth.substack.com/p/live",
            date: "2026-10-01T00:00:00.000Z",
            image: null,
          },
        ]),
      ),
    );
    const posts = await loadSubstackPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.title).toBe("Live");
  });

  it("falls back when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const posts = await loadSubstackPosts();
    expect(posts).toEqual(FALLBACK_SUBSTACK_POSTS);
  });
});

describe("substackImageUrl", () => {
  it("rewrites S3 cover URLs through substackcdn", () => {
    const src =
      "https://substack-post-media.s3.amazonaws.com/public/images/abc.png";
    expect(substackImageUrl(src)).toContain("substackcdn.com/image/fetch/");
    expect(substackImageUrl(src)).toContain(encodeURIComponent(src));
  });
});
