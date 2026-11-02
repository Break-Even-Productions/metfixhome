import { isPostListBody, type PostListBody } from "@shared/posts";

export type PostsPageCache = {
  resolved: Map<number, PostListBody>;
  inflight: Map<number, Promise<PostListBody>>;
};

const defaultCache: PostsPageCache = {
  resolved: new Map(),
  inflight: new Map(),
};

/**
 * Shared `/api/posts?page=N` fetcher for PostsPage + HomeResources (B4).
 * Passes `AbortSignal` through to `fetch` (Lead / PC* mount gates).
 * Abort clears the in-flight + resolved entry so a remount/page-return refetches (PC6).
 * Optional `cache` injects maps for tests (Rule 4 — no test-only reset export).
 */
export async function fetchPostsPage(
  page: number,
  signal?: AbortSignal,
  cache: PostsPageCache = defaultCache,
): Promise<PostListBody> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const cached = cache.resolved.get(page);
  if (cached) return cached;

  let pending = cache.inflight.get(page);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(`/api/posts?page=${page}`, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (!res.ok) {
        throw new Error(`posts fetch failed: ${res.status}`);
      }
      const json: unknown = await res.json();
      if (!isPostListBody(json)) {
        throw new Error("posts fetch: invalid body");
      }
      cache.resolved.set(page, json);
      return json;
    })().finally(() => {
      if (cache.inflight.get(page) === pending) {
        cache.inflight.delete(page);
      }
    });
    cache.inflight.set(page, pending);

    if (signal) {
      const clearOnAbort = () => {
        if (cache.inflight.get(page) === pending) {
          cache.inflight.delete(page);
        }
        cache.resolved.delete(page);
      };
      signal.addEventListener("abort", clearOnAbort, { once: true });
    }
  }

  if (!signal) return pending;

  return new Promise<PostListBody>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    pending!.then(
      (body) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) onAbort();
        else resolve(body);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}
