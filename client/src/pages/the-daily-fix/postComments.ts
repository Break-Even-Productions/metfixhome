import type { DailyFixComment } from "./comments";
import type { CommentsLoadState } from "./comments";

function postCommentsUrl(postId: number): string {
  return `/api/posts/${postId}/comments`;
}

type CacheEntry =
  | { kind: "loaded"; comments: DailyFixComment[] }
  | { kind: "unavailable" }
  | { kind: "inflight"; promise: Promise<Exclude<CommentsLoadState, { status: "loading" }>> };

const postCommentsCache = new Map<number, CacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapPostThread(value: unknown): DailyFixComment | null {
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
  const timestamp =
    typeof value.timestamp === "string"
      ? value.timestamp
      : typeof value.date === "string"
        ? value.date
        : null;
  const repliesIn = Array.isArray(value.replies) ? value.replies : [];
  const replies: DailyFixComment[] = [];
  for (const child of repliesIn) {
    const mapped = mapPostThread(child);
    if (mapped) replies.push(mapped);
  }
  const flat: DailyFixComment = {
    id,
    pillar: "body",
    author,
    content,
    timestamp,
    own: value.own === true,
    parent_id: value.parent_id == null ? null : Number(value.parent_id),
    deleted: typeof value.deleted === "number" ? value.deleted : 0,
    edited: typeof value.edited === "number" ? value.edited : 0,
    replies,
  };
  return flat;
}

function flattenThreads(roots: DailyFixComment[]): DailyFixComment[] {
  const out: DailyFixComment[] = [];
  function walk(c: DailyFixComment) {
    out.push({ ...c, replies: [] });
    for (const r of c.replies ?? []) walk(r);
  }
  for (const root of roots) walk(root);
  return out;
}

function mapPostCommentsPayload(payload: unknown): DailyFixComment[] | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.error === "string") return null;
  const list = payload.comments;
  if (!Array.isArray(list)) return null;
  const roots: DailyFixComment[] = [];
  for (const item of list) {
    const mapped = mapPostThread(item);
    if (!mapped) return null;
    roots.push(mapped);
  }
  return flattenThreads(roots);
}

async function fetchPostCommentsNetwork(
  postId: number,
  opts?: { bypassHttpCache?: boolean },
): Promise<Exclude<CommentsLoadState, { status: "loading" }>> {
  try {
    const res = await globalThis.fetch(postCommentsUrl(postId), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      ...(opts?.bypassHttpCache ? { cache: "no-store" as RequestCache } : {}),
    });
    if (!res.ok) return { status: "unavailable" };
    const json: unknown = await res.json();
    const comments = mapPostCommentsPayload(json);
    if (comments == null) return { status: "unavailable" };
    return { status: "loaded", comments };
  } catch {
    return { status: "unavailable" };
  }
}

export function invalidatePostCommentsCache(postId: number): void {
  postCommentsCache.delete(postId);
}

export async function fetchPostComments(
  postId: number,
  opts?: { bypassCache?: boolean },
): Promise<Exclude<CommentsLoadState, { status: "loading" }>> {
  if (opts?.bypassCache) {
    postCommentsCache.delete(postId);
    return fetchPostCommentsNetwork(postId, { bypassHttpCache: true });
  }
  const existing = postCommentsCache.get(postId);
  if (existing?.kind === "loaded") return { status: "loaded", comments: existing.comments };
  if (existing?.kind === "unavailable") return { status: "unavailable" };
  if (existing?.kind === "inflight") return existing.promise;

  const promise = fetchPostCommentsNetwork(postId).then((result) => {
    if (result.status === "loaded") {
      postCommentsCache.set(postId, { kind: "loaded", comments: result.comments });
    } else {
      postCommentsCache.set(postId, { kind: "unavailable" });
    }
    return result;
  });
  postCommentsCache.set(postId, { kind: "inflight", promise });
  return promise;
}
