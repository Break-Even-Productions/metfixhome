import {
  mapDailyFixDay,
  type DailyFixDay,
  type UpstreamOutcome,
} from "../shared/daily-fix";

export const BSI_DAILY_FIX_URL = "https://brokenscience.org/wp-json/metfix/v1/daily-fix";
export const BSI_HOST = "brokenscience.org";

/** Hard cap on sitemap upstream subrequests (CQ). */
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
};

export type ListPage = {
  items: ListItem[];
  total: number;
};

export async function fetchDailyFixListPage(
  offset: number,
  env: Env,
  fetchImpl: typeof fetch = fetch,
  opts?: { baseUrl?: string },
): Promise<{ ok: true; page: ListPage } | { ok: false; reason: "nokey" | "fail" }> {
  if (!env.DAILY_FIX_API_KEY) return { ok: false, reason: "nokey" };
  const base = opts?.baseUrl ?? BSI_DAILY_FIX_URL;
  const url = `${base}?limit=100&offset=${offset}`;
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
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { ok: false, reason: "fail" };
    const json = (await response.json()) as {
      items?: unknown;
      meta?: { total?: unknown };
    };
    const total = typeof json.meta?.total === "number" ? json.meta.total : 0;
    const items: ListItem[] = [];
    if (Array.isArray(json.items)) {
      for (const item of json.items) {
        if (item && typeof item === "object" && typeof (item as { date?: unknown }).date === "string") {
          const row = item as { date: string; status?: unknown };
          const entry: ListItem = { date: row.date };
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
