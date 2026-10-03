import { DAILY_FIX_BFF_URL } from "./data";
import { PILLARS, type Pillar } from "./model";

/** Same Worker origin as the day fetch. No key, no VITE_ override. */
export function dailyFixCommentsRequestUrl(isoDate: string): string {
  const url = new URL("/daily-fix/comments", new URL(DAILY_FIX_BFF_URL).origin);
  url.searchParams.set("date", isoDate);
  url.searchParams.set("type", "all");
  return url.toString();
}

export type DailyFixComment = {
  id: number;
  pillar: Pillar;
  author: string;
  content: string;
  timestamp: string | null;
};

export type CommentsLoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; comments: DailyFixComment[] };

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
  return { id, pillar, author, content, timestamp };
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

/**
 * Load Daily Fix comments from the BFF for one ISO date.
 * 404 / 503 / non-200 / bad JSON / thrown fetch → unavailable (not an empty list).
 */
export async function fetchDailyFixComments(
  isoDate: string,
  signal?: AbortSignal,
): Promise<Exclude<CommentsLoadState, { status: "loading" }>> {
  try {
    const response = await fetch(dailyFixCommentsRequestUrl(isoDate), {
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
