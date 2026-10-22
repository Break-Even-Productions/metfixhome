import { describe, expect, it } from "vitest";
import { PAGE_SIZE } from "./constants";
import { isPostListBody } from "./guards";
import {
  mapDetailPost,
  mapDetailResponse,
  mapImageUrl,
  mapListItem,
  mapListResponse,
  mapPermalink,
} from "./map";

function unlockedItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 5,
    title: " Hello ",
    excerpt: "<p>Hi <b>x</b></p>",
    date: "2026-10-19T10:00:00+02:00",
    featured_image: "https://brokenscience.org/wp-content/uploads/a.jpg",
    author: { id: 9, name: "A" },
    categories: [{ id: 1, name: "News", slug: "news" }],
    access_levels: [],
    content_access_display: {
      has_content_access: false,
      is_exclusive: false,
      access: "full",
    },
    video: "LOCKED-VID-7f3",
    content: "<p>body</p>",
    permalink: "https://brokenscience.org/hello",
    ...overrides,
  };
}

describe("mapListItem / field transforms (PW25)", () => {
  it("maps a happy-path item with exact key set", () => {
    const mapped = mapListItem(unlockedItem());
    expect(mapped).toEqual({
      id: 5,
      title: "Hello",
      excerpt: "Hi x",
      date: "2026-10-19T08:00:00.000Z",
      image: "https://brokenscience.org/wp-content/uploads/a.jpg",
      author: "A",
      category: { name: "News", slug: "news" },
    });
    expect(Object.keys(mapped!).sort()).toEqual(
      ["author", "category", "date", "excerpt", "id", "image", "title"].sort(),
    );
  });

  it("decodes HTML entities in excerpt exactly once after tag strip (CQ17)", () => {
    expect(mapListItem(unlockedItem({ excerpt: "&lt;script&gt;" }))!.excerpt).toBe(
      "<script>",
    );
    expect(mapListItem(unlockedItem({ excerpt: "&amp;lt;" }))!.excerpt).toBe("&lt;");
    expect(mapListItem(unlockedItem({ excerpt: "&amp;amp;" }))!.excerpt).toBe("&amp;");
  });

  it("truncates excerpt to 500 code points with astral at boundary (Q5)", () => {
    const astral = "😀";
    const chars = Array.from({ length: 499 }, () => "a");
    chars.push(astral);
    chars.push("Z");
    const excerpt = chars.join("");
    const mapped = mapListItem(unlockedItem({ excerpt }));
    expect(Array.from(mapped!.excerpt).length).toBe(500);
    expect(Array.from(mapped!.excerpt)[499]).toBe(astral);
    expect(mapped!.excerpt.includes("Z")).toBe(false);
  });

  it("drops overlong title, unparseable date, bad id", () => {
    expect(mapListItem(unlockedItem({ title: "x".repeat(201) }))).toBeNull();
    expect(mapListItem(unlockedItem({ title: "x".repeat(200) }))).not.toBeNull();
    expect(mapListItem(unlockedItem({ date: "not-a-date" }))).toBeNull();
    expect(mapListItem(unlockedItem({ id: 0 }))).toBeNull();
    expect(mapListItem(unlockedItem({ id: "5" }))).toBeNull();
  });

  it("author missing → null; empty categories → null", () => {
    expect(mapListItem(unlockedItem({ author: undefined }))!.author).toBeNull();
    expect(mapListItem(unlockedItem({ categories: [] }))!.category).toBeNull();
  });

  it("never forwards upstream-only fields (no spread)", () => {
    const mapped = mapListItem(unlockedItem());
    expect(mapped).not.toHaveProperty("video");
    expect(mapped).not.toHaveProperty("content");
    expect(mapped).not.toHaveProperty("access_levels");
    expect(mapped).not.toHaveProperty("permalink");
  });
});

describe("mapPermalink (A6a / PW29)", () => {
  it("keeps exact-host https and normalizes", () => {
    expect(mapPermalink("https://brokenscience.org/x")).toBe(
      "https://brokenscience.org/x",
    );
    expect(mapPermalink("https://brokenscience.org")).toBe(
      "https://brokenscience.org/",
    );
    expect(mapPermalink("https://BROKENSCIENCE.ORG/x")).toBe(
      "https://brokenscience.org/x",
    );
  });

  it("rejects lookalikes, port, userinfo, http, relative", () => {
    const bad = [
      "http://brokenscience.org/x",
      "https://www.brokenscience.org/x",
      "https://a.brokenscience.org/x",
      "https://brokenscience.org:443/x",
      "https://brokenscience.org:8443/x",
      "https://u:p@brokenscience.org/x",
      "https://brokenscience.org.evil.com/x",
      "https://evil.com/?brokenscience.org",
      "https://brokenscience.org./x",
      "javascript:alert(1)",
      "data:text/html,x",
      "//brokenscience.org/x",
      "/x",
      "",
    ];
    for (const u of bad) {
      expect(mapPermalink(u)).toBeNull();
    }
    expect(mapPermalink(undefined)).toBeNull();
    expect(mapPermalink(1)).toBeNull();
  });
});

describe("mapImageUrl (DR6 / PW35)", () => {
  it("keeps allowlisted https image", () => {
    expect(mapImageUrl("https://brokenscience.org/wp-content/uploads/a.jpg")).toBe(
      "https://brokenscience.org/wp-content/uploads/a.jpg",
    );
    expect(mapImageUrl("https://BrokenScience.ORG/a.jpg")).toBe(
      "https://brokenscience.org/a.jpg",
    );
  });

  it("nulls CDN and other bad hosts", () => {
    expect(mapImageUrl("https://cdn.brokenscience.org/a.jpg")).toBeNull();
    expect(mapImageUrl("http://brokenscience.org/a.jpg")).toBeNull();
    expect(mapImageUrl("https://u:p@brokenscience.org/a.jpg")).toBeNull();
    expect(mapImageUrl("https://brokenscience.org:443/a.jpg")).toBeNull();
    expect(mapImageUrl("javascript:alert(1)")).toBeNull();
    expect(mapImageUrl("//brokenscience.org/a.jpg")).toBeNull();
  });
});

describe("mapListResponse (A6 has_more / dedupe / order)", () => {
  it("computes has_more from meta.total and PAGE_SIZE", () => {
    expect(PAGE_SIZE).toBe(12);
    const mk = (total: number, page: number) =>
      mapListResponse(
        {
          posts: [unlockedItem({ id: 1 })],
          meta: { total, per_page: 10, has_more: true },
        },
        page,
      );

    expect(mk(24, 1)!.has_more).toBe(true);
    expect(mk(24, 2)!.has_more).toBe(false);
    expect(mk(25, 2)!.has_more).toBe(true);
    expect(mk(12, 1)!.has_more).toBe(false);
    expect(mk(13, 1)!.has_more).toBe(true);
    expect(mk(11, 1)!.has_more).toBe(false);
    expect(mk(0, 1)!.has_more).toBe(false);
    expect(mk(10000, 49)!.has_more).toBe(true);
    expect(mk(10000, 50)!.has_more).toBe(false);
    // BSI has_more ignored
    expect(
      mapListResponse(
        {
          posts: [],
          meta: { total: 12, per_page: 10, has_more: true },
        },
        1,
      )!.has_more,
    ).toBe(false);
  });

  it("returns null for invalid meta.total (incl. NaN/Infinity)", () => {
    expect(
      mapListResponse({ posts: [], meta: { per_page: 10 } }, 1),
    ).toBeNull();
    expect(
      mapListResponse({ posts: [], meta: { total: "24", per_page: 10 } }, 1),
    ).toBeNull();
    expect(
      mapListResponse({ posts: [], meta: { total: -1, per_page: 10 } }, 1),
    ).toBeNull();
    expect(
      mapListResponse({ posts: [], meta: { total: 1.5, per_page: 10 } }, 1),
    ).toBeNull();
    expect(
      mapListResponse({ posts: [], meta: { total: NaN, per_page: 10 } }, 1),
    ).toBeNull();
    expect(
      mapListResponse({ posts: [], meta: { total: Infinity, per_page: 10 } }, 1),
    ).toBeNull();
  });

  it("dedupes keep-first and preserves order (PW27 / PW44)", () => {
    const posts = [5, 7, 5, 9, 7].map((id, i) =>
      unlockedItem({ id, title: `T${id}-${i}` }),
    );
    const body = mapListResponse(
      { posts, meta: { total: 5, per_page: 10 } },
      1,
    )!;
    expect(body.posts.map((p) => p.id)).toEqual([5, 7, 9]);
    expect(body.posts.map((p) => p.title)).toEqual(["T5-0", "T7-1", "T9-3"]);
    expect(body.per_page).toBe(PAGE_SIZE);
    expect(isPostListBody(body)).toBe(true);
  });

  it("drops locked items and keeps order of survivors", () => {
    const posts = [
      unlockedItem({ id: 9 }),
      unlockedItem({
        id: 3,
        access_levels: ["x"],
        title: "LOCKED",
        excerpt: "LOCKED-EXC-7f3",
      }),
      unlockedItem({ id: 1 }),
    ];
    const body = mapListResponse(
      { posts, meta: { total: 13, per_page: 10 } },
      1,
    )!;
    expect(body.posts.map((p) => p.id)).toEqual([9, 1]);
    expect(body.has_more).toBe(true);
  });
});

describe("mapDetailPost / mapDetailResponse", () => {
  it("maps detail with sanitized content and permalink", () => {
    const mapped = mapDetailPost(
      unlockedItem({ content: '<p>Hi</p><script>alert(1)</script>' }),
    )!;
    expect(mapped.content).toContain("<p>");
    expect(mapped.content).not.toContain("alert");
    expect(mapped.permalink).toBe("https://brokenscience.org/hello");
    expect(Object.keys(mapped).sort()).toEqual(
      [
        "author",
        "category",
        "content",
        "date",
        "excerpt",
        "id",
        "image",
        "permalink",
        "title",
      ].sort(),
    );
  });

  it("empty content after sanitize → still mapped", () => {
    const mapped = mapDetailPost(unlockedItem({ content: "<script>x</script>" }))!;
    expect(mapped.content).toBe("");
  });

  it("D8 failure → null; missing post → null", () => {
    expect(
      mapDetailPost(unlockedItem({ access_levels: ["members"] })),
    ).toBeNull();
    expect(mapDetailResponse({})).toBeNull();
    expect(mapDetailResponse({ post: null })).toBeNull();
    expect(mapDetailResponse({ post: [] })).toBeNull();
  });
});
