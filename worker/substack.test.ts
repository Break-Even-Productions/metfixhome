import { describe, expect, it, vi } from "vitest";
import { fetchSubstackArchivePosts, handleSubstackArchive } from "./substack";

describe("substack archive proxy", () => {
  it("maps everyone posts and clips excerpts", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json([
        {
          title: "Public post",
          subtitle: "A short dek",
          canonical_url: "https://letsstartwiththetruth.substack.com/p/public-post",
          post_date: "2026-10-01T00:00:00.000Z",
          cover_image: "https://example.com/cover.jpg",
          audience: "everyone",
        },
        {
          title: "Paid only",
          canonical_url: "https://letsstartwiththetruth.substack.com/p/paid",
          audience: "only_paid",
        },
      ]),
    );

    const posts = await fetchSubstackArchivePosts(fetchImpl as unknown as typeof fetch);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      title: "Public post",
      excerpt: "A short dek",
      url: "https://letsstartwiththetruth.substack.com/p/public-post",
      date: "2026-10-01T00:00:00.000Z",
      image: "https://example.com/cover.jpg",
    });
  });

  it("GET /api/substack/archive returns JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json([
        {
          title: "Hello",
          description: "World",
          canonical_url: "https://letsstartwiththetruth.substack.com/p/hello",
          post_date: "2026-10-02T00:00:00.000Z",
          cover_image: null,
          audience: "everyone",
        },
      ]),
    );
    const res = await handleSubstackArchive(new Request("https://metfix.org/api/substack/archive"), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        title: "Hello",
        excerpt: "World",
        url: "https://letsstartwiththetruth.substack.com/p/hello",
        date: "2026-10-02T00:00:00.000Z",
        image: null,
      },
    ]);
  });

  it("returns 502 when upstream fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const res = await handleSubstackArchive(new Request("https://metfix.org/api/substack/archive"), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe(502);
  });
});
