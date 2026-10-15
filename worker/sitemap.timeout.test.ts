/**
 * QA acceptance tests for sitemap timeout / stale-ok (spec rev 1.1.1).
 * Resets module state with vi.resetModules() + dynamic import(); no test-only production exports.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installHtmlRewriterPolyfill } from "./test/htmlrewriter-polyfill";
import type { Env } from "./index";

installHtmlRewriterPolyfill();

const INDEX_HTML = `<!doctype html><html><head><title>MetFix</title></head><body></body></html>`;

const DAY = {
  date: "2026-10-04",
  belly: {
    title: "Belly dish",
    body: "<p>Ingredients</p>",
    steps: "<p>Steps</p>",
    macros: { fat: 1, carb: 2, protein: 3 },
    photo_url: "https://cdn.example.com/belly.jpg",
    has_structured_ingredients: false,
    has_structured_steps: false,
    recipe_ingredients: [],
    recipe_steps: [],
  },
  body: { title: "Body work", body: "<p>Workout</p>", photo_url: "https://cdn.example.com/body.jpg" },
  brain: { title: "Brain read", body: "<p>Article</p>", photo_url: "https://cdn.example.com/brain.jpg" },
};

type CacheStore = Map<string, Response>;

function makeCache(): Cache & { store: CacheStore; puts: Array<{ key: string; res: Response }> } {
  const store: CacheStore = new Map();
  const puts: Array<{ key: string; res: Response }> = [];
  return {
    store,
    puts,
    async match(request: RequestInfo) {
      const key = typeof request === "string" ? request : request.url;
      const hit = store.get(key);
      if (!hit) return undefined;
      const body = await hit.clone().text();
      return new Response(body, { status: hit.status, headers: new Headers(hit.headers) });
    },
    async put(request: RequestInfo, response: Response) {
      const key = typeof request === "string" ? request : (request as Request).url;
      puts.push({ key, res: response.clone() });
      store.set(key, response.clone());
    },
    async delete() {
      return false;
    },
    async keys() {
      return [];
    },
    async matchAll() {
      return [];
    },
  } as unknown as Cache & { store: CacheStore; puts: Array<{ key: string; res: Response }> };
}

function makeEnv(assetsFetch: ReturnType<typeof vi.fn>, key = "test-secret-key"): Env {
  return {
    ASSETS: { fetch: assetsFetch } as unknown as Fetcher,
    DAILY_FIX_API_KEY: key || undefined,
  };
}

function makeCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil(p: Promise<unknown>) {
      pending.push(p);
    },
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext & { pending: Promise<unknown>[] };
}

async function flush(ctx: { pending: Promise<unknown>[] }) {
  await Promise.all(ctx.pending);
  ctx.pending.length = 0;
}

function headersObject(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of res.headers) {
    if (k === "content-length" || k === "date") continue;
    out[k] = v;
  }
  return out;
}

function listPayload(total: number, offset: number) {
  const remaining = Math.max(0, total - offset);
  const count = Math.min(100, remaining);
  const items = Array.from({ length: count }, (_, i) => {
    const n = offset + i;
    const d = new Date(Date.UTC(2026, 9, 12));
    d.setUTCDate(d.getUTCDate() - n);
    return { date: d.toISOString().slice(0, 10), status: "published" };
  });
  return { items, meta: { total } };
}

function hangUntilAbort(_url: string, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      const err = new Error("TimeoutError");
      err.name = "TimeoutError";
      reject(err);
    });
  });
}

describe("sitemap timeout + stale-ok (rev 1.1.1 QA list)", () => {
  let assetsFetch: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cache: ReturnType<typeof makeCache>;
  let ctx: ReturnType<typeof makeCtx>;
  let handleRequest: typeof import("./index").handleRequest;
  let fetchDailyFixListPage: typeof import("./upstream").fetchDailyFixListPage;
  let nextDfxMidnight: typeof import("../shared/daily-fix").nextDfxMidnight;

  async function loadModules() {
    vi.resetModules();
    installHtmlRewriterPolyfill();
    const index = await import("./index");
    const upstream = await import("./upstream");
    const shared = await import("../shared/daily-fix");
    handleRequest = index.handleRequest;
    fetchDailyFixListPage = upstream.fetchDailyFixListPage;
    nextDfxMidnight = shared.nextDfxMidnight;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));
    assetsFetch = vi.fn(async () => new Response(INDEX_HTML, { headers: { "Content-Type": "text/html" } }));
    fetchMock = vi.fn();
    cache = makeCache();
    ctx = makeCtx();
    await loadModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function call(path: string, init: RequestInit = {}, key = "test-secret-key") {
    const req = new Request(`https://metfix.org${path}`, init);
    return handleRequest(req, makeEnv(assetsFetch, key), ctx, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      cachesDefault: cache,
    });
  }

  async function seedSitemapCache(body: string, freshUntil: string | null) {
    const headers = new Headers({
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=604800",
    });
    if (freshUntil !== null) headers.set("X-Sitemap-Fresh-Until", freshUntil);
    await cache.put(
      new Request("https://metfix.org/__dfcache/sitemap"),
      new Response(body, { status: 200, headers }),
    );
    cache.puts.length = 0;
  }

  it(
    "T1 slow upstream succeeds with 8s page timeout and 7 calls for total 613",
    async () => {
      let calls = 0;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        calls++;
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), 4300);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            const err = new Error("TimeoutError");
            err.name = "TimeoutError";
            reject(err);
          });
        });
        return new Response(JSON.stringify(listPayload(613, offset)), { status: 200 });
      });
      const pending = call("/sitemap-daily-fix.xml");
      await vi.advanceTimersByTimeAsync(9000);
      const res = await pending;
      expect(res.status).toBe(200);
      const xml = await res.text();
      expect(xml.match(/<lastmod>/g)?.length).toBe(613);
      expect(xml).toContain("https://metfix.org/the-daily-fix</loc>");
      expect(calls).toBe(7);

      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
      await loadModules();
      cache.store.clear();
      cache.puts.length = 0;
      fetchMock.mockImplementation(async (url: string) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
      });
      await call("/sitemap-daily-fix.xml");
      expect(timeoutSpy.mock.calls.some((c) => c[0] === 8000)).toBe(true);
      timeoutSpy.mockRestore();

      await loadModules();
      const listEnv = makeEnv(assetsFetch);
      fetchMock.mockReset();
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), 7900);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            const err = new Error("TimeoutError");
            err.name = "TimeoutError";
            reject(err);
          });
        });
        return new Response(JSON.stringify(listPayload(1, 0)), { status: 200 });
      });
      const okPending = fetchDailyFixListPage(0, listEnv, fetchMock as unknown as typeof fetch, {
        timeoutMs: 8000,
      });
      await vi.advanceTimersByTimeAsync(8000);
      expect(await okPending).toMatchObject({ ok: true });

      fetchMock.mockReset();
      fetchMock.mockImplementation(hangUntilAbort);
      const failPending = fetchDailyFixListPage(0, listEnv, fetchMock as unknown as typeof fetch, {
        timeoutMs: 8000,
      });
      await vi.advanceTimersByTimeAsync(8001);
      expect(await failPending).toEqual({ ok: false, reason: "fail" });
    },
    30_000,
  );

  it(
    "T2 other routes time out at 3s; list default 3000; archive 20s by behavior",
    async () => {
      fetchMock.mockImplementation(hangUntilAbort);
      const apiPending = call("/api/daily-fix?date=2026-10-04");
      await vi.advanceTimersByTimeAsync(3100);
      expect((await apiPending).status).toBe(503);

      fetchMock.mockReset();
      fetchMock.mockImplementation(hangUntilAbort);
      const htmlPending = call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
      await vi.advanceTimersByTimeAsync(3100);
      expect((await htmlPending).status).toBe(503);

      fetchMock.mockReset();
      fetchMock.mockImplementation(hangUntilAbort);
      const listPending = fetchDailyFixListPage(0, makeEnv(assetsFetch), fetchMock as unknown as typeof fetch);
      await vi.advanceTimersByTimeAsync(3100);
      expect(await listPending).toEqual({ ok: false, reason: "fail" });

      // Archive uses 20000 by behavior: 19.9s succeeds, 20.1s fails
      cache.store.clear();
      await loadModules();
      fetchMock.mockReset();
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), 19_900);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            const err = new Error("TimeoutError");
            err.name = "TimeoutError";
            reject(err);
          });
        });
        return new Response(
          JSON.stringify({
            days: [{ ...DAY, date: "2026-10-04", status: "published" }],
            meta: { total: 1 },
          }),
          { status: 200 },
        );
      });
      const archOkPending = call("/api/daily-fix/archive");
      await vi.advanceTimersByTimeAsync(20_000);
      expect((await archOkPending).status).toBe(200);

      cache.store.clear();
      await loadModules();
      fetchMock.mockReset();
      // Hang until AbortSignal.timeout(20000) aborts (no late resolve that can race).
      fetchMock.mockImplementation(hangUntilAbort);
      const archFailPending = call("/api/daily-fix/archive");
      await vi.advanceTimersByTimeAsync(20_100);
      expect((await archFailPending).status).toBe(503);
    },
    60_000,
  );

  it("T3 cache hit makes no upstream call", async () => {
    const body = `<?xml version="1.0"?>\n<urlset><url><loc>https://metfix.org/the-daily-fix</loc></url></urlset>\n`;
    await seedSitemapCache(body, nextDfxMidnight().toISOString());
    fetchMock.mockClear();
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(body);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(cache.puts.length).toBe(0);
    expect(ctx.pending.length).toBe(0);
  });

  it("T4 stale served while rebuilding + == / -1ms boundary", async () => {
    const staleBody = `<?xml version="1.0"?>\n<urlset><url><loc>stale</loc></url></urlset>\n`;
    await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
    let calls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      calls++;
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
    });
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(staleBody);
    expect(ctx.pending.length).toBe(1);
    await flush(ctx);
    expect(calls).toBe(1);
    const put = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap");
    expect(put).toBeTruthy();
    expect(await put!.res.clone().text()).not.toBe(staleBody);

    // Boundary: now === fresh-until → stale (1 rebuild)
    await loadModules();
    cache.store.clear();
    cache.puts.length = 0;
    ctx = makeCtx();
    const boundary = new Date("2026-10-12T22:00:00.000Z");
    vi.setSystemTime(boundary);
    await seedSitemapCache(staleBody, boundary.toISOString());
    fetchMock.mockClear();
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
    });
    await call("/sitemap-daily-fix.xml");
    expect(ctx.pending.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await flush(ctx);

    // fresh-until − 1 ms → fresh (0 rebuilds)
    await loadModules();
    cache.store.clear();
    ctx = makeCtx();
    const freshUntil = new Date("2026-10-12T22:00:00.000Z");
    vi.setSystemTime(new Date(freshUntil.getTime() - 1));
    await seedSitemapCache(staleBody, freshUntil.toISOString());
    fetchMock.mockClear();
    await call("/sitemap-daily-fix.xml");
    expect(ctx.pending.length).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it(
    "T5 stale kept on failure (500, timeout, thrown, 429)",
    async () => {
      for (const mode of ["500", "timeout", "thrown", "429"] as const) {
        await loadModules();
        cache = makeCache();
        ctx = makeCtx();
        const staleBody = `<?xml version="1.0"?>\n<urlset><url><loc>stale-${mode}</loc></url></urlset>\n`;
        await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
        if (mode === "500") {
          fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
        } else if (mode === "429") {
          fetchMock.mockResolvedValue(new Response("rate", { status: 429 }));
        } else if (mode === "thrown") {
          fetchMock.mockRejectedValue(new Error("boom"));
        } else {
          fetchMock.mockImplementation(hangUntilAbort);
        }
        const res = await call("/sitemap-daily-fix.xml");
        expect(await res.text()).toBe(staleBody);
        expect(ctx.pending.length).toBe(1);
        if (mode === "timeout") await vi.advanceTimersByTimeAsync(9000);
        await flush(ctx);
        expect(cache.puts.length).toBe(0);
        const kept = await cache.match(new Request("https://metfix.org/__dfcache/sitemap"));
        expect(await kept!.text()).toBe(staleBody);
      }
    },
    40_000,
  );

  it(
    "T6 partial never cached (page fail modes, nokey, budget)",
    async () => {
      for (const mode of ["500", "timeout", "thrown"] as const) {
        await loadModules();
        cache = makeCache();
        ctx = makeCtx();
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
          const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
          if (offset === 200) {
            if (mode === "500") return new Response("nope", { status: 500 });
            if (mode === "thrown") throw new Error("boom");
            return hangUntilAbort(url, init);
          }
          return new Response(JSON.stringify(listPayload(613, offset)), { status: 200 });
        });
        const pending = call("/sitemap-daily-fix.xml");
        if (mode === "timeout") await vi.advanceTimersByTimeAsync(9000);
        const fail = await pending;
        expect(fail.status).toBe(503);
        expect(fail.headers.get("Retry-After")).toBe("300");
        expect(fail.headers.get("Cache-Control")).toBe("no-store");
        expect(cache.puts.length).toBe(0);
        expect(await fail.text()).not.toContain("<url>");
      }

      // missing key → 0 fetches
      await loadModules();
      cache = makeCache();
      ctx = makeCtx();
      fetchMock.mockClear();
      const nokey = await call("/sitemap-daily-fix.xml", {}, "");
      expect(nokey.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(0);
      expect(cache.puts.length).toBe(0);

      // Budget: page 0 at 12.5s, parallel would need 8s → deadline trips
      await loadModules();
      cache = makeCache();
      ctx = makeCtx();
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        const delay = offset === 0 ? 12_500 : 8_000;
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), delay);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            const err = new Error("TimeoutError");
            err.name = "TimeoutError";
            reject(err);
          });
        });
        return new Response(JSON.stringify(listPayload(200, offset)), { status: 200 });
      });
      const budgetPending = call("/sitemap-daily-fix.xml");
      await vi.advanceTimersByTimeAsync(21_000);
      const budget = await budgetPending;
      expect(budget.status).toBe(503);
      expect(cache.puts.length).toBe(0);
      expect(await budget.text()).not.toContain("<url>");
    },
    60_000,
  );

  it("T7 503 never cached; backoff does not apply to cold misses", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    expect((await call("/sitemap-daily-fix.xml")).status).toBe(503);
    expect(cache.puts.length).toBe(0);
    // Establish backoff via a failed stale rebuild is irrelevant for cold
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    expect((await call("/sitemap-daily-fix.xml")).status).toBe(503);
    expect(fetchMock).toHaveBeenCalled();
  });

  it(
    "T8 single-flight + 60s failure backoff",
    async () => {
      const staleBody = `<?xml version="1.0"?>\n<urlset><url><loc>stale</loc></url></urlset>\n`;
      await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
      let calls = 0;
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      fetchMock.mockImplementation(async (url: string) => {
        calls++;
        await gate;
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        return new Response(JSON.stringify(listPayload(613, offset)), { status: 200 });
      });
      const a = call("/sitemap-daily-fix.xml");
      const b = call("/sitemap-daily-fix.xml");
      expect(await (await a).text()).toBe(staleBody);
      expect(await (await b).text()).toBe(staleBody);
      expect(ctx.pending.length).toBe(2);
      release();
      await flush(ctx);
      expect(calls).toBe(7);

      // concurrent cold misses
      cache.store.clear();
      await loadModules();
      cache = makeCache();
      ctx = makeCtx();
      calls = 0;
      let release2!: () => void;
      const gate2 = new Promise<void>((r) => {
        release2 = r;
      });
      fetchMock.mockImplementation(async (url: string) => {
        calls++;
        await gate2;
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        return new Response(JSON.stringify(listPayload(613, offset)), { status: 200 });
      });
      const cPending = call("/sitemap-daily-fix.xml");
      const dPending = call("/sitemap-daily-fix.xml");
      release2();
      const [c, d] = await Promise.all([cPending, dPending]);
      expect(c.status).toBe(200);
      expect(d.status).toBe(200);
      expect(await c.text()).toBe(await d.text());
      expect(calls).toBe(7);

      // Backoff after failed stale rebuild
      await loadModules();
      cache = makeCache();
      ctx = makeCtx();
      await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
      fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
      await call("/sitemap-daily-fix.xml");
      await flush(ctx);
      expect(cache.puts.length).toBe(0);

      fetchMock.mockClear();
      ctx = makeCtx();
      vi.setSystemTime(new Date(Date.now() + 59_000));
      await call("/sitemap-daily-fix.xml");
      expect(fetchMock).toHaveBeenCalledTimes(0);
      expect(ctx.pending.length).toBe(0);

      vi.setSystemTime(new Date(Date.now() + 1_000)); // +60s from failure
      ctx = makeCtx();
      fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
      await call("/sitemap-daily-fix.xml");
      expect(ctx.pending.length).toBe(1);
      await flush(ctx);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
    30_000,
  );

  it("T9 parallel shape: page 0 first, then 100-600 started before any resolves", async () => {
    const started: number[] = [];
    const order: string[] = [];
    const resolvers = new Map<number, () => void>();
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      started.push(offset);
      order.push(`start:${offset}`);
      await new Promise<void>((resolve) => {
        resolvers.set(offset, resolve);
      });
      order.push(`end:${offset}`);
      return new Response(JSON.stringify(listPayload(613, offset)), { status: 200 });
    });
    const pending = call("/sitemap-daily-fix.xml");
    await vi.waitFor(() => expect(started).toContain(0));
    expect(started).toEqual([0]);
    resolvers.get(0)!();
    await vi.waitFor(() => expect(started.length).toBe(7));
    expect(started.slice(1).sort((a, b) => a - b)).toEqual([100, 200, 300, 400, 500, 600]);
    expect(order.filter((x) => x.startsWith("end:")).length).toBe(1);
    for (const off of [100, 200, 300, 400, 500, 600]) resolvers.get(off)!();
    expect((await pending).status).toBe(200);
  });

  it("T10 no row mapping via vi.mock; archive still maps", async () => {
    const mapSpy = vi.fn();
    vi.resetModules();
    installHtmlRewriterPolyfill();
    vi.doMock("../shared/daily-fix", async () => {
      const actual = await vi.importActual<typeof import("../shared/daily-fix")>("../shared/daily-fix");
      return {
        ...actual,
        mapDailyFixDay: (...args: Parameters<typeof actual.mapDailyFixDay>) => {
          mapSpy(...args);
          return actual.mapDailyFixDay(...args);
        },
      };
    });
    const index = await import("./index");
    handleRequest = index.handleRequest;
    cache = makeCache();
    ctx = makeCtx();
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      const base = listPayload(1, offset);
      return new Response(
        JSON.stringify({
          days: base.items.map((item) => ({ ...DAY, ...item })),
          meta: base.meta,
        }),
        { status: 200 },
      );
    });
    mapSpy.mockClear();
    await call("/sitemap-daily-fix.xml");
    expect(mapSpy).toHaveBeenCalledTimes(0);

    cache.store.clear();
    ctx = makeCtx();
    mapSpy.mockClear();
    await call("/api/daily-fix/archive");
    expect(mapSpy.mock.calls.length).toBeGreaterThan(0);
    vi.doUnmock("../shared/daily-fix");
    await loadModules();
  });

  it("T11 headers, format, midnight crossing, exactly 22:00, HEAD", async () => {
    vi.setSystemTime(new Date("2026-10-12T21:59:30.000Z"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const get = await call("/sitemap-daily-fix.xml");
    expect(get.headers.get("Content-Type")).toBe("application/xml");
    expect(get.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(get.headers.get("X-Sitemap-Fresh-Until")).toBeNull();
    await flush(ctx);
    const put = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap")!;
    expect(put.res.headers.get("Cache-Control")).toBe("s-maxage=604800");
    const freshUntil = put.res.headers.get("X-Sitemap-Fresh-Until")!;
    expect(freshUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(freshUntil).toBe("2026-10-12T22:00:00.000Z");

    // Midnight crossing: start 21:59:55Z, finish 22:00:05Z → fresh-until of start day
    await loadModules();
    cache = makeCache();
    ctx = makeCtx();
    vi.setSystemTime(new Date("2026-10-12T21:59:55.000Z"));
    fetchMock.mockImplementation(async (url: string) => {
      vi.setSystemTime(new Date("2026-10-12T22:00:05.000Z"));
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
    });
    await call("/sitemap-daily-fix.xml");
    await flush(ctx);
    const crossPut = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap")!;
    expect(crossPut.res.headers.get("X-Sitemap-Fresh-Until")).toBe("2026-10-12T22:00:00.000Z");
    // next request is stale and rebuilds
    fetchMock.mockClear();
    ctx = makeCtx();
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
    });
    await call("/sitemap-daily-fix.xml");
    expect(ctx.pending.length).toBe(1);
    await flush(ctx);

    // Exactly 22:00:00.000Z at start rolls to next day
    await loadModules();
    cache = makeCache();
    ctx = makeCtx();
    vi.setSystemTime(new Date("2026-10-12T22:00:00.000Z"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    await call("/sitemap-daily-fix.xml");
    await flush(ctx);
    const rollPut = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap")!;
    expect(rollPut.res.headers.get("X-Sitemap-Fresh-Until")).toBe("2026-10-13T22:00:00.000Z");

    // HEAD equals GET
    cache.store.clear();
    await loadModules();
    vi.setSystemTime(new Date("2026-10-12T10:00:00.000Z"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const get2 = await call("/sitemap-daily-fix.xml");
    cache.store.clear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const head = await call("/sitemap-daily-fix.xml", { method: "HEAD" });
    expect(headersObject(head)).toEqual(headersObject(get2));
    expect(await head.text()).toBe("");
  });

  it("T12 cap exactly 1 call; W48 store headers; no legacy one-day s-maxage in tests", async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      calls++;
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(listPayload(10000, offset)), { status: 200 });
    });
    const cap = await call("/sitemap-daily-fix.xml");
    expect(cap.status).toBe(503);
    expect(cache.puts.length).toBe(0);
    expect(calls).toBe(1);

    await loadModules();
    cache = makeCache();
    ctx = makeCtx();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const client = await call("/sitemap-daily-fix.xml");
    expect(client.headers.get("Cache-Control")).toBe("public, max-age=3600");
    await flush(ctx);
    const put = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap")!;
    expect(put.res.headers.get("Cache-Control")).toBe("s-maxage=604800");
    expect(put.res.headers.get("X-Sitemap-Fresh-Until")).toBeTruthy();

    const testsRoot = fileURLToPath(new URL(".", import.meta.url));
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (/\.(ts|tsx|js)$/.test(name)) out.push(p);
      }
      return out;
    };
    const forbidden = ["s-maxage=", "86400"].join("");
    for (const file of walk(testsRoot)) {
      if (!file.includes(".test.")) continue;
      const src = readFileSync(file, "utf8");
      expect(src.includes(forbidden), file).toBe(false);
    }
  });

  it("T14 parallel timeout clamp; exactly 20000ms is budget failure", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    // After page 0, remaining < 8000 → clamp
    const startedAt = Date.now();
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      if (offset === 0) {
        vi.setSystemTime(startedAt + 15_000);
        return new Response(JSON.stringify(listPayload(200, 0)), { status: 200 });
      }
      return new Response(JSON.stringify(listPayload(200, offset)), { status: 200 });
    });
    await call("/sitemap-daily-fix.xml");
    const parallelCalls = timeoutSpy.mock.calls.filter((c) => c[0] === 5_000);
    expect(parallelCalls.length).toBeGreaterThan(0);
    timeoutSpy.mockRestore();

    // Exactly 20000ms from start → budget failure (S9)
    await loadModules();
    cache = makeCache();
    ctx = makeCtx();
    const t0 = Date.now();
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      if (offset === 0) {
        vi.setSystemTime(t0 + 20_000);
        return new Response(JSON.stringify(listPayload(200, 0)), { status: 200 });
      }
      throw new Error("should not fetch rest");
    });
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(503);
    expect(cache.puts.length).toBe(0);
  });

  it("T16 stale response resolves with no timer advance", async () => {
    const staleBody = `<?xml version="1.0"?>\n<urlset><url><loc>stale</loc></url></urlset>\n`;
    await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
    fetchMock.mockImplementation(async () => {
      await new Promise(() => {});
      return new Response("{}");
    });
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(staleBody);
  });

  it("T17 X-API-Key only to brokenscience.org; never in response or store", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const res = await call("/sitemap-daily-fix.xml");
    for (const c of fetchMock.mock.calls) {
      const url = new URL(String(c[0]));
      const headers = c[1]?.headers as Record<string, string>;
      if (headers?.["X-API-Key"]) expect(url.hostname).toBe("brokenscience.org");
    }
    expect(await res.text()).not.toContain("test-secret-key");
    await flush(ctx);
    const put = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap")!;
    expect(await put.res.clone().text()).not.toContain("test-secret-key");
    for (const [k, v] of put.res.headers) {
      expect(v).not.toContain("test-secret-key");
      expect(k.toLowerCase()).not.toBe("x-api-key");
    }
  });

  it("T18 ?x=1 on fresh hit gives 0 fetches", async () => {
    const body = `<?xml version="1.0"?>\n<urlset><url><loc>fresh</loc></url></urlset>\n`;
    await seedSitemapCache(body, nextDfxMidnight().toISOString());
    fetchMock.mockClear();
    const res = await call("/sitemap-daily-fix.xml?x=1");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(body);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("T19 missing/empty/garbage fresh-until is stale, never 503", async () => {
    for (const until of [null, "", "garbage"] as const) {
      await loadModules();
      cache = makeCache();
      ctx = makeCtx();
      const body = `<?xml version="1.0"?>\n<urlset><url><loc>body-${String(until)}</loc></url></urlset>\n`;
      await seedSitemapCache(body, until);
      fetchMock.mockImplementation(async (url: string) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
        return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
      });
      const res = await call("/sitemap-daily-fix.xml");
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(body);
      expect(ctx.pending.length).toBe(1);
      await flush(ctx);
    }
  });

  it("T20 no test-only production exports (static)", () => {
    const roots = [
      fileURLToPath(new URL(".", import.meta.url)),
      fileURLToPath(new URL("../shared", import.meta.url)),
    ];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === "test" || name === "node_modules") continue;
          out.push(...walk(p));
        } else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(p);
      }
      return out;
    };
    for (const root of roots) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        expect(src.includes("ForTests"), file).toBe(false);
        expect(src.includes("import * as SharedDailyFix"), file).toBe(false);
        expect(/export\s+(const|let|function|async function)\s+ARCHIVE_PAGE_TIMEOUT_MS/.test(src), file).toBe(
          false,
        );
      }
    }
    // Production code races waiters with Promise.race (CQ2)
    const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(indexSrc.includes("Promise.race")).toBe(true);
  });

  it(
    "T21 waiter time-box: joining cold miss races remaining budget then 503",
    async () => {
      // Hang the upstream list forever so the build stays pending past the 20s budget;
      // waiters must Promise.race and resolve with 503 (CQ2).
      vi.resetModules();
      installHtmlRewriterPolyfill();
      vi.doMock("./upstream", async () => {
        const actual = await vi.importActual<typeof import("./upstream")>("./upstream");
        return {
          ...actual,
          fetchDailyFixListPage: async () => new Promise(() => {}),
        };
      });
      const index = await import("./index");
      handleRequest = index.handleRequest;
      cache = makeCache();
      ctx = makeCtx();

      const firstPending = call("/sitemap-daily-fix.xml");
      const secondPending = call("/sitemap-daily-fix.xml");
      await vi.advanceTimersByTimeAsync(20_000);
      const second = await secondPending;
      expect(second.status).toBe(503);
      expect(second.headers.get("Retry-After")).toBe("300");
      expect(second.headers.get("Cache-Control")).toBe("no-store");
      const first = await firstPending;
      expect(first.status).toBe(503);
      vi.doUnmock("./upstream");
      await loadModules();
    },
    30_000,
  );

  it("T21b waiter with stale entry: serves stale when race times out is N/A for hit path; stale served immediately", async () => {
    // Spec: stale entry → serve stale immediately (not a waiter). Covered by T4/T16.
    // Cold miss waiter timeout without stale → 503 covered by T21 above.
    // When stale exists, request never awaits the build as a waiter.
    const staleBody = `<?xml version="1.0"?>\n<urlset><url><loc>stale</loc></url></urlset>\n`;
    await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
    fetchMock.mockImplementation(async () => new Promise(() => {}));
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(staleBody);
  });

  it("T22 HEAD on stale/fresh hit does not read stored body", async () => {
    const staleBody = `<?xml version="1.0"?>\n<urlset><url><loc>stale</loc></url></urlset>\n`;
    await seedSitemapCache(staleBody, new Date("2020-01-01T00:00:00.000Z").toISOString());
    const stored = cache.store.get("https://metfix.org/__dfcache/sitemap")!;
    const textSpy = vi.spyOn(stored, "text");
    const abSpy = vi.spyOn(stored, "arrayBuffer");
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(String(url)).searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(listPayload(1, offset)), { status: 200 });
    });
    const head = await call("/sitemap-daily-fix.xml", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Type")).toBe("application/xml");
    expect(head.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(await head.text()).toBe("");
    expect(textSpy).toHaveBeenCalledTimes(0);
    expect(abSpy).toHaveBeenCalledTimes(0);
    expect(ctx.pending.length).toBe(1);
    await flush(ctx);

    // Fresh HEAD: 0 body reads, 0 rebuild
    await loadModules();
    cache = makeCache();
    ctx = makeCtx();
    const freshBody = `<?xml version="1.0"?>\n<urlset><url><loc>fresh</loc></url></urlset>\n`;
    await seedSitemapCache(freshBody, nextDfxMidnight().toISOString());
    const storedFresh = cache.store.get("https://metfix.org/__dfcache/sitemap")!;
    const textSpy2 = vi.spyOn(storedFresh, "text");
    const abSpy2 = vi.spyOn(storedFresh, "arrayBuffer");
    const headFresh = await call("/sitemap-daily-fix.xml", { method: "HEAD" });
    expect(headFresh.status).toBe(200);
    expect(await headFresh.text()).toBe("");
    expect(textSpy2).toHaveBeenCalledTimes(0);
    expect(abSpy2).toHaveBeenCalledTimes(0);
    expect(ctx.pending.length).toBe(0);
  });
});
