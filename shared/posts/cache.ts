import { CACHE_ORIGIN } from "./constants";

/** Synthetic Cache API key for a list page (A11). Never the raw request URL. */
export function postsListCacheKey(page: number): Request {
  return new Request(`${CACHE_ORIGIN}/__cache/posts/list?page=${page}`, {
    method: "GET",
  });
}

/** Synthetic Cache API key for a detail id (A11). */
export function postsDetailCacheKey(id: number | string): Request {
  return new Request(`${CACHE_ORIGIN}/__cache/posts/${id}`, {
    method: "GET",
  });
}
