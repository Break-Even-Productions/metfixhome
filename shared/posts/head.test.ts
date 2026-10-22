import { describe, expect, it } from "vitest";
import { DESC_MAX } from "./constants";
import { buildPostsHead, cutDescription, LIST_DESC, OG_FALLBACK } from "./head";
import { postsDetailCacheKey, postsListCacheKey } from "./cache";

describe("buildPostsHead (CQ6 / PH3 / PH5 / PH6 / PH15)", () => {
  it("list head is fixed for every page", () => {
    const h1 = buildPostsHead({ kind: "list" });
    const h2 = buildPostsHead({ kind: "list", page: 2 });
    expect(h1).toEqual(h2);
    expect(h1.title).toBe("Posts — MetFix");
    expect(h1.description).toBe(LIST_DESC);
    expect(h1.description).toBe("Articles from Broken Science.");
    expect(h1.robots).toBe("noindex, follow");
    expect(h1.canonical).toBeNull();
    expect(h1.ogType).toBe("website");
    expect(h1.ogImage).toBe(OG_FALLBACK);
    expect(h1.ogImage).toBe("https://metfix.org/social-preview.jpg");
    expect(h1.ogUrl).toBe("https://metfix.org/posts");
  });

  it("detail with permalink → index + canonical", () => {
    const permalink = "https://brokenscience.org/post/1";
    const h = buildPostsHead({
      kind: "detail",
      id: 1,
      title: "Hello",
      excerpt: "  one   two  ",
      permalink,
      image: "https://brokenscience.org/a.jpg",
    });
    expect(h.title).toBe("Hello — MetFix");
    expect(h.description).toBe("one two");
    expect(h.robots).toBe("index, follow");
    expect(h.canonical).toBe(permalink);
    expect(h.ogType).toBe("article");
    expect(h.ogUrl).toBe(permalink);
    expect(h.ogImage).toBe("https://brokenscience.org/a.jpg");
  });

  it("detail without permalink → noindex, og:url = metfix path", () => {
    const h = buildPostsHead({
      kind: "detail",
      id: 42,
      title: "X",
      excerpt: "Y",
      permalink: null,
      image: null,
    });
    expect(h.robots).toBe("noindex, follow");
    expect(h.canonical).toBeNull();
    expect(h.ogUrl).toBe("https://metfix.org/posts/42");
    expect(h.ogImage).toBe(OG_FALLBACK);
  });

  it("cdn image falls back to OG_FALLBACK (PH8)", () => {
    const h = buildPostsHead({
      kind: "detail",
      id: 1,
      title: "X",
      excerpt: "Y",
      permalink: null,
      image: "https://cdn.brokenscience.org/a.jpg",
    });
    expect(h.ogImage).toBe(OG_FALLBACK);
  });

  it("cuts description to 160 code points through an astral character (PH15c)", () => {
    const chars: string[] = [];
    for (let i = 0; i < 159; i++) chars.push("a");
    chars.push("😀"); // code point 160
    chars.push("Z");
    const long = chars.join("");
    expect(Array.from(long).length).toBe(161);
    const cut = cutDescription(long);
    expect(Array.from(cut).length).toBe(DESC_MAX);
    expect(Array.from(cut).length).toBe(160);
    expect(Array.from(cut)[159]).toBe("😀");
    expect(cut.includes("Z")).toBe(false);
    expect(cut.endsWith("…")).toBe(false);

    const h = buildPostsHead({
      kind: "detail",
      id: 1,
      title: "T",
      excerpt: `  ${long}  `,
      permalink: null,
      image: null,
    });
    expect(Array.from(h.description).length).toBe(160);
  });
});

describe("cache keys (A11 / PW36)", () => {
  it("builds synthetic list and detail keys", () => {
    expect(postsListCacheKey(1).url).toBe(
      "https://metfix.org/__cache/posts/list?page=1",
    );
    expect(postsListCacheKey(2).url).toBe(
      "https://metfix.org/__cache/posts/list?page=2",
    );
    expect(postsDetailCacheKey(5).url).toBe(
      "https://metfix.org/__cache/posts/5",
    );
  });
});
