import { CACHE_ORIGIN } from "./constants";

/** v2: DetailPost gains video/categories/content_types/topics/locked/access (CQ-4.2). */
const VER = "v2";

/** Synthetic Cache API key for a list page (A11). Never the raw request URL. */
export function postsListCacheKey(page: number): Request {
  return new Request(`${CACHE_ORIGIN}/__cache/${VER}/posts/list?page=${page}`, {
    method: "GET",
  });
}

/** Synthetic Cache API key for a detail id (A11). */
export function postsDetailCacheKey(id: number | string): Request {
  return new Request(`${CACHE_ORIGIN}/__cache/${VER}/posts/${id}`, {
    method: "GET",
  });
}
