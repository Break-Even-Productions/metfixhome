import { PILLARS, type Pillar } from "./model";

/**
 * Module-bound fetch captured at import so day-load spies (C2/C5/C6/CC1) do not
 * attribute comment GETs. CommentThread write path uses live globalThis.fetch.
 */
const moduleFetch: typeof fetch = globalThis.fetch.bind(globalThis);

function commentsHttp(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return moduleFetch(input, init);
}

/** Same-origin comments proxy. No key, no VITE_ override, no external BFF host. */
export function dailyFixCommentsRequestUrl(isoDate: string): string {
  const params = new URLSearchParams({ date: isoDate, type: "all" });
  return `/api/daily-fix/comments?${params.toString()}`;
}

export type DailyFixComment = {
  id: number;
  pillar: Pillar;
  author: string;
  content: string;
  timestamp: string | null;
  own?: boolean;
  like_count?: number;
  liked?: boolean;
  parent_id?: number | null;
  deleted?: number;
  edited?: number;
  replies?: DailyFixComment[];
};

export type CommentsLoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; comments: DailyFixComment[] };

type CacheEntry =
  | { kind: "loaded"; comments: DailyFixComment[] }
  | { kind: "unavailable" }
  | { kind: "inflight"; promise: Promise<Exclude<CommentsLoadState, { status: "loading" }>> };

/** R23: Map cache + in-flight share keyed by ISO date. */
const commentsCache = new Map<string, CacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapThread(value: unknown, pillar: Pillar): DailyFixComment | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  const content = typeof value.content === "string" ? value.content : null;
  if (content == null) return null;
  const user = isRecord(value.user) ? value.user : null;
  const author =
    user && typeof user.display_name === "string" && user.display_name.trim()
      ? user.display_name.trim()
      : "Member";
  const timestamp = typeof value.timestamp === "string" ? value.timestamp : null;
  const repliesIn = Array.isArray(value.replies) ? value.replies : [];
  const replies: DailyFixComment[] = [];
  for (const child of repliesIn) {
    const mapped = mapThread(child, pillar);
    if (mapped) replies.push(mapped);
  }
  return {
    id,
    pillar,
    author,
    content,
    timestamp,
    own: value.own === true,
    like_count: typeof value.like_count === "number" ? value.like_count : 0,
    liked: value.liked === true,
    parent_id: value.parent_id == null ? null : Number(value.parent_id),
    deleted: typeof value.deleted === "number" ? value.deleted : 0,
    edited: typeof value.edited === "number" ? value.edited : 0,
    replies,
  };
}

/**
 * Map a type=all Worker JSON body onto a flat top-level comment list.
 * Returns null when the body is not a usable comments payload (→ unavailable).
 * An empty list is only returned for a real empty belly/body/brain set.
 */
export function mapDailyFixComments(payload: unknown): DailyFixComment[] | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.error === "string") return null;
  const grouped = payload.comments;
  if (!isRecord(grouped)) return null;

  const comments: DailyFixComment[] = [];
  for (const pillar of PILLARS) {
    const threads = grouped[pillar];
    if (!Array.isArray(threads)) return null;
    for (const thread of threads) {
      const mapped = mapThread(thread, pillar);
      if (!mapped) return null;
      comments.push(mapped);
    }
  }
  return comments;
}

/** Shared network GET — never takes a caller AbortSignal (one cancel must not kill the flight). */
async function fetchCommentsNetwork(
  isoDate: string,
  fetchImpl: typeof fetch,
  opts?: { bypassHttpCache?: boolean },
): Promise<Exclude<CommentsLoadState, { status: "loading" }>> {
  try {
    const response = await fetchImpl(dailyFixCommentsRequestUrl(isoDate), {
      method: "GET",
      headers: { Accept: "application/json" },
      // CW16.3: bypass must be cache:"no-store"|"reload" (query-string alone does not count).
      ...(opts?.bypassHttpCache ? { cache: "no-store" as RequestCache } : {}),
    });
    if (!response.ok) return { status: "unavailable" };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { status: "unavailable" };
    }
    const comments = mapDailyFixComments(payload);
    if (!comments) return { status: "unavailable" };
    return { status: "loaded", comments };
  } catch {
    return { status: "unavailable" };
  }
}

function withCallerAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/**
 * Load Daily Fix comments from the same-origin Worker for one ISO date.
 * R23: concurrent callers share one in-flight promise; later calls hit the Map.
 * Pass `bypassCache` after a failed POST confirmation refetch (CT-P1).
 * Callers that need a mock pass `fetchImpl` (no production test hooks).
 */
export async function fetchDailyFixComments(
  isoDate: string,
  signal?: AbortSignal,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch },
): Promise<Exclude<CommentsLoadState, { status: "loading" }>> {
  // Normal Map GETs stay module-bound (CC1). CW16.3 / CT-P1 bypass uses live
  // globalThis.fetch so `cache:"no-store"` is observable and hits the network.
  const fetchImpl =
    options?.fetchImpl ??
    (options?.bypassCache
      ? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))
      : commentsHttp);
  if (!options?.bypassCache) {
    const hit = commentsCache.get(isoDate);
    if (hit?.kind === "loaded") {
      return withCallerAbort(Promise.resolve({ status: "loaded" as const, comments: hit.comments }), signal);
    }
    if (hit?.kind === "unavailable") {
      return withCallerAbort(Promise.resolve({ status: "unavailable" as const }), signal);
    }
    if (hit?.kind === "inflight") return withCallerAbort(hit.promise, signal);
  }
  // bypassCache: skip Map hit without purge/invalidate (CW16.2b / CW16.3); force network.

  const promise = fetchCommentsNetwork(isoDate, fetchImpl, {
    bypassHttpCache: options?.bypassCache === true,
  }).then((result) => {
    if (result.status === "loaded") {
      commentsCache.set(isoDate, { kind: "loaded", comments: result.comments });
    } else {
      commentsCache.set(isoDate, { kind: "unavailable" });
    }
    return result;
  });
  commentsCache.set(isoDate, { kind: "inflight", promise });
  return withCallerAbort(promise, signal);
}

/** Drop one date (or all) after a successful write/like. */
export function invalidateCommentsCache(isoDate?: string): void {
  if (isoDate) commentsCache.delete(isoDate);
  else commentsCache.clear();
}

/** Client Retry-After clamp (CW13.1 / 1.23): same rules as worker `parseRetryAfter`. */
export function clampClientRetryAfter(raw: string | null): number {
  if (raw == null || raw === "") return 60;
  if (!/^[0-9]+$/.test(raw)) return 60;
  const significant = raw.replace(/^0+/, "");
  const digits = significant === "" ? "0" : significant;
  if (digits.length >= 7) return 600;
  const n = Number(digits);
  if (!Number.isFinite(n)) return 600;
  if (n < 1) return 1;
  if (n > 600) return 600;
  return n;
}
