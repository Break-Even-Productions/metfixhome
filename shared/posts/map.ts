import { decodeHtmlEntitiesOnce, stripTags } from "../daily-fix/text";
import {
  BSI_ORIGIN,
  EXCERPT_MAX,
  IMAGE_HOST,
  MAX_PAGE,
  PAGE_SIZE,
  TITLE_MAX,
} from "./constants";
import { isUnlockedPost } from "./locked";
import { sanitizeHtml } from "./sanitize";
import type { DetailPost, Post, PostDetailBody, PostListBody } from "./types";

function truncateCodePoints(input: string, max: number): string {
  const chars = Array.from(input);
  if (chars.length <= max) return input;
  return chars.slice(0, max).join("");
}

function mapTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (Array.from(trimmed).length > TITLE_MAX) return null;
  return trimmed;
}

/** Strip tags, decode entities exactly once, truncate to EXCERPT_MAX code points. */
function mapExcerpt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const plain = decodeHtmlEntitiesOnce(stripTags(raw));
  return truncateCodePoints(plain, EXCERPT_MAX);
}

function mapDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function mapAuthor(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const name = (raw as Record<string, unknown>).name;
  if (typeof name !== "string") return null;
  return name;
}

function mapCategory(raw: unknown): { name: string; slug: string } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const rec = first as Record<string, unknown>;
  if (typeof rec.name !== "string" || typeof rec.slug !== "string") return null;
  return { name: rec.name, slug: rec.slug };
}

/**
 * DR6 / A10: https, no credentials, no port (raw-string check), host exactly IMAGE_HOST.
 * Relative URLs resolve against BSI_ORIGIN. Emits normalized `URL.href`.
 */
export function mapImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return allowlistedHttpsUrl(raw, { resolveRelative: true });
}

/**
 * A6a permalink: https, host exactly brokenscience.org, no port/userinfo/www.
 * Explicit port decided on the raw string (Q7). Emits normalized `URL.href`.
 */
export function mapPermalink(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return allowlistedHttpsUrl(raw, { resolveRelative: false });
}

function hasExplicitPort(raw: string): boolean {
  // protocol://[userinfo@]host:port/... — reject any explicit :digits after host
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^/@]+@)?[^/:]+:\d+/.test(raw);
}

function allowlistedHttpsUrl(
  raw: string,
  opts: { resolveRelative: boolean },
): string | null {
  if (hasExplicitPort(raw)) return null;
  // Protocol-relative `//host/...` must not resolve to https via the base (PW35 / DR6).
  if (raw.startsWith("//")) return null;
  // Relative resolve only for path-absolute refs (`/wp-content/...`); bare words like
  // "not a url" must not become `https://brokenscience.org/not%20a%20url` (PW35).
  if (opts.resolveRelative && !raw.startsWith("/") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    return null;
  }
  try {
    const url = opts.resolveRelative ? new URL(raw, `${BSI_ORIGIN}/`) : new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    if (url.port !== "") return null;
    if (url.hostname !== IMAGE_HOST) return null;
    return url.href;
  } catch {
    return null;
  }
}

function mapId(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) return null;
  return raw;
}

/**
 * Whitelist re-serialize one list item. D8 failures and unmappable fields → null.
 * No object spread of upstream.
 */
export function mapListItem(raw: unknown): Post | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!isUnlockedPost(raw)) return null;
  const item = raw as Record<string, unknown>;

  const id = mapId(item.id);
  if (id == null) return null;
  const title = mapTitle(item.title);
  if (title == null) return null;
  const excerpt = mapExcerpt(item.excerpt);
  if (excerpt == null) return null;
  const date = mapDate(item.date);
  if (date == null) return null;

  return {
    id,
    title,
    excerpt,
    date,
    image: mapImageUrl(item.featured_image),
    author: mapAuthor(item.author),
    category: mapCategory(item.categories),
  };
}

/**
 * Whitelist re-serialize a detail post (A7). D8 failure → null.
 * `content` is sanitized; empty after sanitize is still valid.
 */
export function mapDetailPost(raw: unknown): DetailPost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!isUnlockedPost(raw)) return null;
  const item = raw as Record<string, unknown>;

  const id = mapId(item.id);
  if (id == null) return null;
  const title = mapTitle(item.title);
  if (title == null) return null;
  const excerpt = mapExcerpt(item.excerpt);
  if (excerpt == null) return null;
  const date = mapDate(item.date);
  if (date == null) return null;

  const contentRaw = typeof item.content === "string" ? item.content : "";
  const content = sanitizeHtml(contentRaw);

  return {
    id,
    title,
    excerpt,
    date,
    image: mapImageUrl(item.featured_image),
    author: mapAuthor(item.author),
    category: mapCategory(item.categories),
    content,
    permalink: mapPermalink(item.permalink),
  };
}

function computeHasMore(page: number, total: number): boolean {
  return (
    Number.isInteger(total) &&
    total >= 0 &&
    page * PAGE_SIZE < total &&
    page < MAX_PAGE
  );
}

/**
 * Map upstream list JSON → PostListBody.
 * Invalid / missing non-negative integer `meta.total` → null (unmappable).
 * Dedupe by id keep-first; preserve upstream order of survivors.
 */
export function mapListResponse(raw: unknown, page: number): PostListBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.posts)) return null;
  if (!body.meta || typeof body.meta !== "object" || Array.isArray(body.meta)) return null;

  const meta = body.meta as Record<string, unknown>;
  const total = meta.total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) return null;
  if (!Number.isFinite(total)) return null;

  const seen = new Set<number>();
  const posts: Post[] = [];
  for (const item of body.posts) {
    const mapped = mapListItem(item);
    if (!mapped) continue;
    if (seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    posts.push(mapped);
  }

  return {
    posts,
    page,
    per_page: PAGE_SIZE,
    has_more: computeHasMore(page, total),
  };
}

/** Map upstream detail JSON → PostDetailBody. Missing/unmappable post → null. */
export function mapDetailResponse(raw: unknown): PostDetailBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const mapped = mapDetailPost(body.post);
  if (!mapped) return null;
  return { post: mapped };
}
