import type { DetailPost, Post, PostDetailBody, PostListBody } from "./types";

const POST_KEYS = ["id", "title", "excerpt", "date", "image", "author", "category"] as const;
const DETAIL_POST_KEYS = [
  "id",
  "title",
  "excerpt",
  "date",
  "image",
  "author",
  "category",
  "content",
  "permalink",
] as const;
const LIST_BODY_KEYS = ["posts", "page", "per_page", "has_more"] as const;
const DETAIL_BODY_KEYS = ["post"] as const;

function exactKeySet(obj: object, keys: readonly string[]): boolean {
  const actual = Object.keys(obj);
  if (actual.length !== keys.length) return false;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) return false;
  }
  return true;
}

function isCategory(value: unknown): value is { name: string; slug: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!exactKeySet(value, ["name", "slug"])) return false;
  const c = value as { name: unknown; slug: unknown };
  return typeof c.name === "string" && typeof c.slug === "string";
}

function isPost(value: unknown): value is Post {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!exactKeySet(value, POST_KEYS)) return false;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "number" || !Number.isInteger(p.id) || p.id <= 0) return false;
  if (typeof p.title !== "string") return false;
  if (typeof p.excerpt !== "string") return false;
  if (typeof p.date !== "string") return false;
  if (!(p.image === null || typeof p.image === "string")) return false;
  if (!(p.author === null || typeof p.author === "string")) return false;
  if (!(p.category === null || isCategory(p.category))) return false;
  return true;
}

function isDetailPost(value: unknown): value is DetailPost {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!exactKeySet(value, DETAIL_POST_KEYS)) return false;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "number" || !Number.isInteger(p.id) || p.id <= 0) return false;
  if (typeof p.title !== "string") return false;
  if (typeof p.excerpt !== "string") return false;
  if (typeof p.date !== "string") return false;
  if (!(p.image === null || typeof p.image === "string")) return false;
  if (!(p.author === null || typeof p.author === "string")) return false;
  if (!(p.category === null || isCategory(p.category))) return false;
  if (typeof p.content !== "string") return false;
  if (!(p.permalink === null || typeof p.permalink === "string")) return false;
  return true;
}

/** A6 mapped list body: exact key set + typed fields. */
export function isPostListBody(value: unknown): value is PostListBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!exactKeySet(value, LIST_BODY_KEYS)) return false;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.posts)) return false;
  if (!body.posts.every(isPost)) return false;
  if (typeof body.page !== "number" || !Number.isInteger(body.page) || body.page < 1) return false;
  if (typeof body.per_page !== "number" || !Number.isInteger(body.per_page) || body.per_page < 1) {
    return false;
  }
  if (typeof body.has_more !== "boolean") return false;
  return true;
}

/** A7 mapped detail body: exact key set + typed fields. */
export function isPostDetailBody(value: unknown): value is PostDetailBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!exactKeySet(value, DETAIL_BODY_KEYS)) return false;
  const body = value as Record<string, unknown>;
  return isDetailPost(body.post);
}
