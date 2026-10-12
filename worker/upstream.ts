import {
  mapDailyFixDay,
  type DailyFixDay,
  type UpstreamOutcome,
} from "../shared/daily-fix";

export const BSI_DAILY_FIX_URL = "https://brokenscience.org/wp-json/metfix/v1/daily-fix";
export const BSI_HOST = "brokenscience.org";

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
): Promise<UpstreamOutcome> {
  if (!env.DAILY_FIX_API_KEY) {
    return { kind: "nokey" };
  }

  const url = `${BSI_DAILY_FIX_URL}?date=${encodeURIComponent(iso)}`;
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

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { kind: "unmappable", status: 200, json: null };
    }

    const mapped = mapDailyFixDay(json, iso);
    if (!mapped) {
      return { kind: "unmappable", status: 200, json };
    }
    if (mapped.date !== iso) {
      return { kind: "mismatch", status: 200, json, mapped };
    }
    return { kind: "ok", status: 200, json, mapped };
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

export type ListPage = {
  items: { date: string }[];
  total: number;
};

export async function fetchDailyFixListPage(
  offset: number,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; page: ListPage } | { ok: false; reason: "nokey" | "fail" }> {
  if (!env.DAILY_FIX_API_KEY) return { ok: false, reason: "nokey" };
  const url = `${BSI_DAILY_FIX_URL}?limit=100&offset=${offset}`;
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
    const items: { date: string }[] = [];
    if (Array.isArray(json.items)) {
      for (const item of json.items) {
        if (item && typeof item === "object" && typeof (item as { date?: unknown }).date === "string") {
          items.push({ date: (item as { date: string }).date });
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
