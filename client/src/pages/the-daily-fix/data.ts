import { mapDailyFixDay, type DailyFixDay } from "@shared/daily-fix/mapper";
import { addCalendarDays, bsiTodayIso } from "./model";

/** Same-origin Daily Fix API (Cloudflare Worker). */
export const DAILY_FIX_BFF_URL = "/api/daily-fix";

export type DailyFixLoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "loaded"; day: DailyFixDay };

type DailyFixSettled = Exclude<DailyFixLoadState, { status: "invalid" | "loading" }>;

export type LoadDailyFixOptions = {
  /**
   * Bare `/the-daily-fix` allows BSI closest-day when `date` ≠ requested ISO.
   * Dated `/the-daily-fix/YYMMDD` requires an exact date match.
   */
  allowCloser?: boolean;
};

type CacheLoaded = {
  kind: "loaded";
  day: DailyFixDay;
  /** Epoch ms of next Etc/GMT-2 midnight when this entry was stored. */
  expiresAt: number;
};

type CacheInflight = {
  kind: "inflight";
  promise: Promise<DailyFixSettled>;
};

type CacheEntry = CacheLoaded | CacheInflight;

/** Module-level day cache. Keys are ISO dates (returned date and/or requested alias). */
const dayCache = new Map<string, CacheEntry>();

export function dailyFixRequestUrl(isoDate: string): string {
  return `${DAILY_FIX_BFF_URL}?date=${encodeURIComponent(isoDate)}`;
}

/** Re-export shared mapper (identity with worker). */
export { mapDailyFixDay };

/** Next Etc/GMT-2 midnight after `now`, as UTC epoch ms. Checked on read — no timers. */
export function nextBsiMidnightMs(now = new Date()): number {
  const todayIso = bsiTodayIso(now);
  const [y, m, d] = todayIso.split("-").map(Number);
  const midnightThisLocalDayUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - 2 * 60 * 60 * 1000;
  return midnightThisLocalDayUtc + 24 * 60 * 60 * 1000;
}

function isOlderThanSevenDays(iso: string, todayIso: string): boolean {
  return iso < addCalendarDays(todayIso, -7);
}

/**
 * Long-lived only when both the cache key and the returned day.date are older than 7 days.
 * A recent requested alias pointing at an old returned day still expires at midnight.
 */
function isLoadedExpired(cacheKey: string, entry: CacheLoaded, now: Date, todayIso: string): boolean {
  if (isOlderThanSevenDays(cacheKey, todayIso) && isOlderThanSevenDays(entry.day.date, todayIso)) {
    return false;
  }
  return now.getTime() >= entry.expiresAt;
}

function deleteTwinKeys(cacheKey: string, entry: CacheLoaded): void {
  dayCache.delete(cacheKey);
  if (entry.day.date !== cacheKey) {
    dayCache.delete(entry.day.date);
  }
  for (const [key, value] of Array.from(dayCache.entries())) {
    if (value === entry) dayCache.delete(key);
  }
}

function purgeExpired(cacheKey: string, now = new Date()): void {
  const entry = dayCache.get(cacheKey);
  if (!entry || entry.kind !== "loaded") return;
  const todayIso = bsiTodayIso(now);
  if (isLoadedExpired(cacheKey, entry, now, todayIso)) {
    deleteTwinKeys(cacheKey, entry);
  }
}

/** Synchronous peek of a successfully mapped day for a cache key, or null. */
export function peekLoadedDailyFixDay(isoDate: string, now = new Date()): DailyFixDay | null {
  purgeExpired(isoDate, now);
  const entry = dayCache.get(isoDate);
  if (!entry || entry.kind !== "loaded") return null;
  return entry.day;
}

/**
 * Store under the returned `date`, and alias the requested ISO to the same entry.
 * Does not issue a GET for the returned date.
 */
function storeLoaded(requestedIso: string, day: DailyFixDay, now = new Date()): void {
  const entry: CacheLoaded = {
    kind: "loaded",
    day,
    expiresAt: nextBsiMidnightMs(now),
  };
  dayCache.set(day.date, entry);
  dayCache.set(requestedIso, entry);
}

function dayForConsumer(day: DailyFixDay, requestedIso: string, allowCloser: boolean): DailyFixDay | null {
  if (day.date === requestedIso) {
    return {
      date: day.date,
      belly: day.belly,
      body: day.body,
      brain: day.brain,
    };
  }
  if (!allowCloser) return null;
  return {
    date: day.date,
    requested_date: requestedIso,
    belly: day.belly,
    body: day.body,
    brain: day.brain,
  };
}

async function fetchAndMapDay(isoDate: string): Promise<DailyFixSettled> {
  try {
    const response = await fetch(dailyFixRequestUrl(isoDate), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    // 400/404/405/503 → Not available (Rev 2.1)
    if (!response.ok) return { status: "unavailable" };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { status: "unavailable" };
    }
    const day = mapDailyFixDay(payload, isoDate);
    if (!day) return { status: "unavailable" };
    return { status: "loaded", day };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Load one Daily Fix day via the module cache.
 * One GET per requested ISO for the SPA lifetime; in-flight promises are shared.
 * Failures are not cached. Route changes must not abort the shared fetch.
 *
 * Dated routes pass `allowCloser: false` so a closer-day payload is unmappable.
 * Bare today passes `allowCloser: true`.
 */
export function loadDailyFixDay(
  isoDate: string,
  options: LoadDailyFixOptions = {},
  now = new Date(),
): Promise<DailyFixSettled> {
  const allowCloser = options.allowCloser === true;
  purgeExpired(isoDate, now);

  const existing = dayCache.get(isoDate);
  if (existing?.kind === "loaded") {
    const day = dayForConsumer(existing.day, isoDate, allowCloser);
    if (!day) return Promise.resolve({ status: "unavailable" });
    return Promise.resolve({ status: "loaded", day });
  }
  if (existing?.kind === "inflight") {
    return existing.promise.then((result) => {
      if (result.status !== "loaded") return result;
      const day = dayForConsumer(result.day, isoDate, allowCloser);
      if (!day) return { status: "unavailable" };
      return { status: "loaded", day };
    });
  }

  const promise = fetchAndMapDay(isoDate).then((result) => {
    const current = dayCache.get(isoDate);
    if (current?.kind === "inflight" && current.promise === promise) {
      dayCache.delete(isoDate);
    }
    if (result.status === "loaded") {
      storeLoaded(isoDate, result.day, now);
    }
    return result;
  });

  dayCache.set(isoDate, { kind: "inflight", promise });
  return promise.then((result) => {
    if (result.status !== "loaded") return result;
    const day = dayForConsumer(result.day, isoDate, allowCloser);
    if (!day) return { status: "unavailable" };
    return { status: "loaded", day };
  });
}

/**
 * Prefetch today−1 and today−2 only (Q1). Fire-and-forget for strip cache.
 * Today is seeded from df-initial on bare first view.
 */
export function prefetchDailyFixWindow(todayIso: string): void {
  const isos = [addCalendarDays(todayIso, -1), addCalendarDays(todayIso, -2)];
  for (const iso of isos) {
    void loadDailyFixDay(iso, { allowCloser: true });
  }
}

/** ISO date to fetch for a resolved route. Invalid routes never fetch. */
export function fetchIsoForRoute(
  kind: "today" | "day" | "invalid",
  routeIso: string | null,
  todayIso: string,
): string | null {
  if (kind === "today") return todayIso;
  if (kind === "day" && routeIso) return routeIso;
  return null;
}

/** Sync initial/route-change state from cache without a skeleton flash when possible. */
export function syncLoadFromCache(
  kind: "today" | "day" | "invalid",
  fetchIso: string | null,
): DailyFixLoadState {
  if (kind === "invalid" || !fetchIso) return { status: "invalid" };
  const allowCloser = kind === "today";
  const cached = peekLoadedDailyFixDay(fetchIso);
  if (!cached) return { status: "loading" };
  const day = dayForConsumer(cached, fetchIso, allowCloser);
  if (!day) return { status: "unavailable" };
  return { status: "loaded", day };
}

let dfInitialRead = false;
let dfInitialPayload: unknown | undefined;

/**
 * Read `#df-initial` raw upstream JSON once, map with the shared mapper, seed the day cache.
 * Returns the mapped day when the ISO matches (or allowCloser), else null.
 */
export function seedFromDfInitial(
  requestedIso: string,
  allowCloser: boolean,
  doc: Document = document,
): DailyFixDay | null {
  if (!dfInitialRead) {
    dfInitialRead = true;
    const el = doc.getElementById("df-initial");
    if (!el) {
      dfInitialPayload = undefined;
      return null;
    }
    try {
      dfInitialPayload = JSON.parse(el.textContent || "");
    } catch {
      dfInitialPayload = undefined;
      return null;
    }
  }
  if (dfInitialPayload === undefined) return null;
  const day = mapDailyFixDay(dfInitialPayload, requestedIso);
  if (!day) return null;
  const forConsumer = dayForConsumer(day, requestedIso, allowCloser);
  if (!forConsumer) return null;
  storeLoaded(requestedIso, day);
  return forConsumer;
}

/** Reset module cache between tests so entries do not leak. */
export function resetDailyFixDayCache(): void {
  dayCache.clear();
  dfInitialRead = false;
  dfInitialPayload = undefined;
}
