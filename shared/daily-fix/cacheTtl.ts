import { addCalendarDays, bsiTodayIso } from "./dates";

/**
 * Edge cache TTL (seconds) mirroring BSI.
 * - Today / bare / today−7…today: until next DFX midnight, capped at 300 for today+bare.
 * - Older than today−7: 86400.
 */
export function cacheTtlSeconds(iso: string, now = new Date(), opts?: { bare?: boolean }): number {
  const today = bsiTodayIso(now);
  const oldestShort = addCalendarDays(today, -7);

  if (iso < oldestShort) {
    return 86400;
  }

  const secondsUntilMidnight = secondsUntilNextDfxMidnight(now);
  const isTodayOrBare = iso === today || opts?.bare === true;
  if (isTodayOrBare) {
    return Math.min(300, Math.max(1, secondsUntilMidnight));
  }
  // today−1 … today−7: until midnight, no 300 cap
  return Math.max(1, secondsUntilMidnight);
}

/** Instant of the next 00:00 Etc/GMT-2 after `now`. */
export function nextDfxMidnight(now = new Date()): Date {
  const todayIso = bsiTodayIso(now);
  const [y, m, d] = todayIso.split("-").map(Number);
  // Midnight at start of this DFX day in UTC = local midnight − 2h
  const midnightThisDayUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - 2 * 60 * 60 * 1000;
  return new Date(midnightThisDayUtc + 24 * 60 * 60 * 1000);
}

/** Seconds until next 00:00 Etc/GMT-2 after `now`. */
export function secondsUntilNextDfxMidnight(now = new Date()): number {
  return Math.max(1, Math.floor((nextDfxMidnight(now).getTime() - now.getTime()) / 1000));
}

export function cacheKeyRequest(iso: string): Request {
  return new Request(`https://metfix.org/__dfcache/${iso}`, { method: "GET" });
}

export function sitemapCacheKeyRequest(): Request {
  return new Request("https://metfix.org/__dfcache/sitemap", { method: "GET" });
}
