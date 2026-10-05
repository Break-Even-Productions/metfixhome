import {
  addCalendarDays,
  bsiTodayIso,
  isIsoDate,
  type DailyFixBelly,
  type DailyFixBody,
  type DailyFixBrain,
  type DailyFixDay,
  type RecipeIngredient,
  type RecipeStep,
} from "./model";

/** Deployed Daily Fix BFF. No key, no VITE_ override, no WordPress call. */
export const DAILY_FIX_BFF_URL = "https://metfix-bff.wispy-mode-982d.workers.dev/daily-fix";

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
  const url = new URL(DAILY_FIX_BFF_URL);
  url.searchParams.set("date", isoDate);
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapIngredients(value: unknown): RecipeIngredient[] {
  if (!Array.isArray(value)) return [];
  const items: RecipeIngredient[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const display = asString(entry.display);
    const sortOrder = entry.sort_order;
    if (display == null || typeof sortOrder !== "number") continue;
    items.push({ display, sort_order: sortOrder });
  }
  return items;
}

function mapSteps(value: unknown): RecipeStep[] {
  if (!Array.isArray(value)) return [];
  const items: RecipeStep[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const instruction = asString(entry.instruction);
    const sortOrder = entry.sort_order;
    if (instruction == null || typeof sortOrder !== "number") continue;
    items.push({ instruction, sort_order: sortOrder });
  }
  return items;
}

function mapBelly(value: unknown): DailyFixBelly | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  if (title == null) return null;
  const macros = isRecord(value.macros) ? value.macros : null;
  const hasStructuredIngredients = Boolean(value.has_structured_ingredients);
  const hasStructuredSteps = Boolean(value.has_structured_steps);
  return {
    title,
    body: asString(value.body),
    steps: asString(value.steps),
    fat: macros ? asNullableNumber(macros.fat) : null,
    carb: macros ? asNullableNumber(macros.carb) : null,
    protein: macros ? asNullableNumber(macros.protein) : null,
    has_structured_ingredients: hasStructuredIngredients,
    has_structured_steps: hasStructuredSteps,
    recipe_ingredients: hasStructuredIngredients ? mapIngredients(value.recipe_ingredients) : [],
    recipe_steps: hasStructuredSteps ? mapSteps(value.recipe_steps) : [],
  };
}

/**
 * Prefer non-empty body.body; if null or "", use body.excerpt.
 * Whitespace-only body.body is kept (no excerpt fallback).
 */
function mapBody(value: unknown): DailyFixBody | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  const bodyHtml = asString(value.body);
  const excerpt = asString(value.excerpt);
  const html = bodyHtml && bodyHtml.length > 0 ? bodyHtml : excerpt;
  if (title == null || html == null) return null;
  return { title, html };
}

function mapBrain(value: unknown): DailyFixBrain | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  const bodyHtml = asString(value.body);
  const excerpt = asString(value.excerpt);
  const html = bodyHtml && bodyHtml.length > 0 ? bodyHtml : excerpt;
  if (title == null || html == null) return null;
  return {
    title,
    html,
    article_url: asString(value.article_url),
    button_text: asString(value.button_text),
  };
}

/**
 * Map a Worker JSON body onto DailyFixDay, or null when unusable.
 * Requires a valid top-level ISO `date`. Does not set `requested_date` —
 * `dayForConsumer` stamps that for bare closer-day display.
 */
export function mapDailyFixDay(payload: unknown, _requestedIso?: string): DailyFixDay | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.error === "string") return null;
  const date = asString(payload.date);
  if (date == null || !isIsoDate(date)) return null;
  const belly = mapBelly(payload.belly);
  const body = mapBody(payload.body);
  const brain = mapBrain(payload.brain);
  if (!belly || !body || !brain) return null;
  return { date, belly, body, brain };
}

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
  // Also drop any other key that aliases this same entry object.
  for (const [key, value] of dayCache) {
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
 * Prefetch today, today−1, today−2. Fire-and-forget for strip cache only.
 * Uses allowCloser when settling so closer payloads are cached under returned date.
 */
export function prefetchDailyFixWindow(todayIso: string): void {
  const isos = [todayIso, addCalendarDays(todayIso, -1), addCalendarDays(todayIso, -2)];
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

/** Reset module cache between tests so entries do not leak. */
export function resetDailyFixDayCache(): void {
  dayCache.clear();
}
