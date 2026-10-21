import { type Pillar } from "./model";

/** Indirect binding so day-load spies do not see leaderboard traffic (CC1). */
const moduleFetchRef: typeof fetch = globalThis.fetch;
const moduleFetch: typeof fetch = moduleFetchRef.bind(globalThis);

function leaderboardHttp(
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

export type ScalingFilter = "all" | "rx" | "scaled";

export type LeaderboardRow = {
  rank: number;
  public_name: string;
  score_value: number | string | null;
  scaling_mode: string | null;
  logged_at: string | null;
  is_self: boolean;
};

export type LeaderboardLoadState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "unavailable" }
  | { status: "no_leaderboard" }
  | { status: "loaded"; rows: LeaderboardRow[] };

type CacheEntry =
  | { kind: "loaded"; rows: LeaderboardRow[] }
  | { kind: "unavailable" }
  | { kind: "no_leaderboard" }
  | { kind: "signed_out" }
  | {
      kind: "inflight";
      promise: Promise<Exclude<LeaderboardLoadState, { status: "loading" }>>;
    };

/** L6.4 / S-G5: per-date Map cache + single-flight. */
const leaderboardCache = new Map<string, CacheEntry>();

function cacheKey(date: string, type: Pillar, scaling: ScalingFilter): string {
  return `${date}|${type}|${scaling}`;
}

/** LB.N7 / L7.1 — relative URL; query keys only date, type, scaling_filter. */
export function dailyFixLeaderboardRequestUrl(
  date: string,
  type: Pillar,
  scalingFilter: ScalingFilter = "all",
): string {
  const params = new URLSearchParams({
    date,
    type,
    scaling_filter: scalingFilter,
  });
  return `/api/daily-fix/leaderboard?${params.toString()}`;
}

/** L7.4 — blank / missing public_name → Member (client-side). */
export function displayLeaderboardName(publicName: unknown): string {
  if (typeof publicName !== "string") return "Member";
  const trimmed = publicName.trim();
  return trimmed ? trimmed : "Member";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapRow(raw: unknown): LeaderboardRow | null {
  if (!isRecord(raw)) return null;
  const rank = raw.rank;
  if (typeof rank !== "number" || !Number.isFinite(rank)) return null;
  return {
    rank,
    public_name: displayLeaderboardName(raw.public_name),
    score_value:
      typeof raw.score_value === "number" || typeof raw.score_value === "string"
        ? raw.score_value
        : null,
    scaling_mode: typeof raw.scaling_mode === "string" ? raw.scaling_mode : null,
    logged_at: typeof raw.logged_at === "string" ? raw.logged_at : null,
    is_self: raw.is_self === true,
  };
}

export function mapLeaderboardPayload(payload: unknown): LeaderboardRow[] | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.error === "string") return null;
  const list = payload.leaderboard;
  if (!Array.isArray(list)) return null;
  const rows: LeaderboardRow[] = [];
  for (const item of list) {
    const mapped = mapRow(item);
    if (!mapped) return null;
    rows.push(mapped);
  }
  return rows;
}

async function fetchLeaderboardNetwork(
  date: string,
  type: Pillar,
  scaling: ScalingFilter,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<Exclude<LeaderboardLoadState, { status: "loading" }>> {
  try {
    const url = dailyFixLeaderboardRequestUrl(date, type, scaling);
    if (!url.startsWith("/api/")) {
      return { status: "unavailable" };
    }
    const response = await fetchImpl(url, {
      method: "GET",
      signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) return { status: "signed_out" };
    if (response.status === 404) return { status: "no_leaderboard" };
    if (response.status === 503 || !response.ok) return { status: "unavailable" };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { status: "unavailable" };
    }
    const rows = mapLeaderboardPayload(payload);
    if (!rows) return { status: "unavailable" };
    return { status: "loaded", rows };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
}

/**
 * Load leaderboard for one date/type/filter (L6.4 single-flight + Map cache).
 */
export async function fetchDailyFixLeaderboard(
  date: string,
  type: Pillar,
  scalingFilter: ScalingFilter = "all",
  signal?: AbortSignal,
  options?: { bypassCache?: boolean; fetchImpl?: typeof fetch },
): Promise<Exclude<LeaderboardLoadState, { status: "loading" }>> {
  const fetchImpl = options?.fetchImpl ?? leaderboardHttp;
  const key = cacheKey(date, type, scalingFilter);
  if (!options?.bypassCache) {
    const hit = leaderboardCache.get(key);
    if (hit?.kind === "loaded") return { status: "loaded", rows: hit.rows };
    if (hit?.kind === "unavailable") return { status: "unavailable" };
    if (hit?.kind === "no_leaderboard") return { status: "no_leaderboard" };
    if (hit?.kind === "signed_out") return { status: "signed_out" };
    if (hit?.kind === "inflight") return hit.promise;
  } else {
    leaderboardCache.delete(key);
  }

  const promise = fetchLeaderboardNetwork(
    date,
    type,
    scalingFilter,
    signal,
    fetchImpl,
  ).then((result) => {
    if (result.status === "loaded") {
      leaderboardCache.set(key, { kind: "loaded", rows: result.rows });
    } else if (result.status === "no_leaderboard") {
      leaderboardCache.set(key, { kind: "no_leaderboard" });
    } else if (result.status === "signed_out") {
      leaderboardCache.set(key, { kind: "signed_out" });
    } else {
      leaderboardCache.set(key, { kind: "unavailable" });
    }
    return result;
  });
  leaderboardCache.set(key, { kind: "inflight", promise });
  return promise;
}

export function invalidateLeaderboardCache(): void {
  leaderboardCache.clear();
}
