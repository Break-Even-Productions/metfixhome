import { PILLARS, type Pillar } from "./model";

/**
 * Captured at module load so day-load fetch spies (cloudflare-client C2/C5/C6)
 * do not attribute comment traffic (CC1). No test-only hooks.
 *
 * If `globalThis.fetch` was replaced after load, do not start I/O on the stale
 * bind — under fake timers that hang and are never the live client.
 */
const moduleFetchRef: typeof fetch = globalThis.fetch;
const moduleFetch: typeof fetch = moduleFetchRef.bind(globalThis);

function commentsHttp(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (globalThis.fetch !== moduleFetchRef) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return moduleFetch(input, init);
}

/** Same-origin comments proxy. No key, no VITE_ override, no metfix-bff host. */
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

async function fetchCommentsNetwork(
  isoDate: string,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<Exclude<CommentsLoadState, { status: "loading" }>> {
  try {
    const response = await fetchImpl(dailyFixCommentsRequestUrl(isoDate), {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
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
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
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
  const fetchImpl = options?.fetchImpl ?? commentsHttp;
  if (!options?.bypassCache) {
    const hit = commentsCache.get(isoDate);
    if (hit?.kind === "loaded") return { status: "loaded", comments: hit.comments };
    if (hit?.kind === "unavailable") return { status: "unavailable" };
    if (hit?.kind === "inflight") return hit.promise;
  } else {
    commentsCache.delete(isoDate);
  }

  const promise = fetchCommentsNetwork(isoDate, signal, fetchImpl).then((result) => {
    if (result.status === "loaded") {
      commentsCache.set(isoDate, { kind: "loaded", comments: result.comments });
    } else {
      commentsCache.set(isoDate, { kind: "unavailable" });
    }
    return result;
  });
  commentsCache.set(isoDate, { kind: "inflight", promise });
  return promise;
}

/** Drop one date (or all) after a successful write/like. */
export function invalidateCommentsCache(isoDate?: string): void {
  if (isoDate) commentsCache.delete(isoDate);
  else commentsCache.clear();
}

/** Client Retry-After clamp (CW13.1 / 1.23): all-digit → 1..600; else 60. */
export function clampClientRetryAfter(raw: string | null): number {
  if (raw == null || raw === "") return 60;
  if (!/^[0-9]+$/.test(raw)) return 60;
  if (raw.length > 3) return 600;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 600;
  if (n < 1) return 1;
  if (n > 600) return 600;
  return n;
}
