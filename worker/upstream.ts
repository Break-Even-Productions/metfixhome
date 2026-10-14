import {
  isIsoDate,
  mapDailyFixDay,
  type DailyFixDay,
  type UpstreamOutcome,
} from "../shared/daily-fix";

export const BSI_DAILY_FIX_URL = "https://brokenscience.org/wp-json/metfix/v1/daily-fix";
export const BSI_HOST = "brokenscience.org";
/** brokenscience.org's Cloudflare bot rules challenge requests with no User-Agent. */
export const UPSTREAM_USER_AGENT = "metfixhome-worker/1.0";

/**
 * Hard cap on sitemap Cloudflare subrequests (CQ2).
 * Includes Cache API match (+1) and reserves one slot for put; upstream
 * fetches stop at MAX-1.
 */
export const SITEMAP_MAX_SUBREQUESTS = 40;

export type Env = {
  ASSETS: Fetcher;
  DAILY_FIX_API_KEY?: string;
};

export function assertBsiHost(url: string): void {
  const host = new URL(url).hostname;
  if (host !== BSI_HOST) {
    throw new Error(`X-API-Key only allowed for ${BSI_HOST}, got ${host}`);
  }
}

export async function fetchDailyFixDay(
  iso: string,
  env: Env,
  fetchImpl: typeof fetch = fetch,
  opts?: { baseUrl?: string },
): Promise<UpstreamOutcome> {
  if (!env.DAILY_FIX_API_KEY) {
    return { kind: "nokey" };
  }

  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}?date=${encodeURIComponent(iso)}`;
  try {
    assertBsiHost(url);
  } catch {
    return { kind: "throw" };
  }

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": env.DAILY_FIX_API_KEY,
        "User-Agent": UPSTREAM_USER_AGENT,
      },
      signal: AbortSignal.timeout(3000),
    });

    if (response.status === 404) {
      return { kind: "not_found", status: 404 };
    }
    if (response.status >= 500) {
      return { kind: "upstream_error", status: response.status };
    }
    if (!response.ok) {
      return { kind: "upstream_error", status: response.status };
    }

    const bodyText = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      return { kind: "unmappable", status: 200, json: null, bodyText };
    }

    const mapped = mapDailyFixDay(json, iso);
    if (!mapped) {
      return { kind: "unmappable", status: 200, json, bodyText };
    }
    if (mapped.date !== iso) {
      return { kind: "mismatch", status: 200, json, mapped, bodyText };
    }
    return { kind: "ok", status: 200, json, mapped, bodyText };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { kind: "timeout" };
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { kind: "timeout" };
    }
    return { kind: "throw" };
  }
}

export type ListItem = {
  date: string;
  /** Present when upstream includes it; filter to published when set. */
  status?: string;
  /** Full mapped day when the row carries a complete day payload. */
  day: DailyFixDay | null;
};

export type ListPage = {
  items: ListItem[];
  total: number;
};

export const LIST_PAGE_SIZE = 100;

/** True for list rows that may be shown publicly: no status, published, or scheduled, and not in the future. */
export function isPublicListItem(item: ListItem, todayIso: string): boolean {
  if (item.status != null && item.status !== "published" && item.status !== "scheduled") {
    return false;
  }
  return isIsoDate(item.date) && item.date <= todayIso;
}

export async function fetchDailyFixListPage(
  offset: number,
  env: Env,
  fetchImpl: typeof fetch = fetch,
  opts?: { baseUrl?: string; timeoutMs?: number },
): Promise<{ ok: true; page: ListPage } | { ok: false; reason: "nokey" | "fail" }> {
  if (!env.DAILY_FIX_API_KEY) return { ok: false, reason: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}?limit=${LIST_PAGE_SIZE}&offset=${offset}`;
  try {
    assertBsiHost(url);
  } catch {
    return { ok: false, reason: "fail" };
  }
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": env.DAILY_FIX_API_KEY,
        "User-Agent": UPSTREAM_USER_AGENT,
      },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 3000),
    });
    if (!response.ok) return { ok: false, reason: "fail" };
    const json = (await response.json()) as {
      days?: unknown;
      items?: unknown;
      meta?: { total?: unknown };
    };
    const total = typeof json.meta?.total === "number" ? json.meta.total : 0;
    const rows = Array.isArray(json.days) ? json.days : json.items;
    const items: ListItem[] = [];
    if (Array.isArray(rows)) {
      for (const item of rows) {
        if (item && typeof item === "object" && typeof (item as { date?: unknown }).date === "string") {
          const row = item as { date: string; status?: unknown };
          const entry: ListItem = { date: row.date, day: mapDailyFixDay(item, row.date) };
          if (typeof row.status === "string") entry.status = row.status;
          items.push(entry);
        }
      }
    }
    return { ok: true, page: { items, total } };
  } catch {
    return { ok: false, reason: "fail" };
  }
}

export function outcomeForCache(outcome: UpstreamOutcome): DailyFixDay | null {
  return outcome.kind === "ok" ? outcome.mapped : null;
}
