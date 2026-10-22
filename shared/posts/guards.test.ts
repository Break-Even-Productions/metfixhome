import { describe, expect, it } from "vitest";
import { isPostDetailBody, isPostListBody } from "./guards";
import { PAGE_SIZE } from "./constants";

const post = {
  id: 1,
  title: "T",
  excerpt: "E",
  date: "2026-10-19T08:00:00.000Z",
  image: null,
  author: "A",
  category: { name: "News", slug: "news" },
};

const listBody = {
  posts: [post],
  page: 1,
  per_page: PAGE_SIZE,
  has_more: false,
};

const detailPost = {
  ...post,
  content: "<p>x</p>",
  permalink: "https://brokenscience.org/x",
};

describe("isPostListBody (A6 exact key set)", () => {
  it("accepts a valid body", () => {
    expect(isPostListBody(listBody)).toBe(true);
  });

  it("rejects missing / extra keys", () => {
    const { has_more: _, ...missing } = listBody;
    expect(isPostListBody(missing)).toBe(false);
    expect(isPostListBody({ ...listBody, extra: 1 })).toBe(false);
  });

  it("rejects wrong types", () => {
    expect(isPostListBody({ ...listBody, posts: null })).toBe(false);
    expect(isPostListBody({ ...listBody, page: "1" })).toBe(false);
    expect(isPostListBody({ ...listBody, has_more: 1 })).toBe(false);
    expect(isPostListBody({ ...listBody, posts: [{ ...post, id: "1" }] })).toBe(false);
  });

  it("rejects post with extra or missing keys", () => {
    expect(isPostListBody({ ...listBody, posts: [{ ...post, video: "x" }] })).toBe(false);
    const { author: _, ...noAuthor } = post;
    expect(isPostListBody({ ...listBody, posts: [noAuthor] })).toBe(false);
  });
});

describe("isPostDetailBody (A7 exact key set)", () => {
  it("accepts a valid body", () => {
    expect(isPostDetailBody({ post: detailPost })).toBe(true);
  });

  it("rejects missing / extra keys on body or post", () => {
    expect(isPostDetailBody({})).toBe(false);
    expect(isPostDetailBody({ post: detailPost, extra: 1 })).toBe(false);
    const { content: _, ...noContent } = detailPost;
    expect(isPostDetailBody({ post: noContent })).toBe(false);
    expect(isPostDetailBody({ post: { ...detailPost, video: "x" } })).toBe(false);
  });
});
