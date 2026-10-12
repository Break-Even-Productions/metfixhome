import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type Env } from "./index";
import { cacheTtlSeconds } from "../shared/daily-fix";

const INDEX_HTML = `<!doctype html><html><head>
<title>MetFix</title>
<meta name="description" content="site">
<link rel="canonical" href="https://metfix.org/">
<meta property="og:type" content="website">
<meta property="og:title" content="MetFix">
<meta property="og:description" content="site">
<meta property="og:url" content="https://metfix.org/">
<meta property="og:image" content="https://metfix.org/social-preview.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="MetFix">
<meta name="twitter:description" content="site">
<meta name="twitter:image" content="https://metfix.org/social-preview.jpg">
<script type="application/ld+json">{"@type":"WebSite"}</script>
</head><body><div id="root"></div></body></html>`;

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
  body: {
    title: "Body work",
    body: "<p>Workout</p>",
    photo_url: "https://cdn.example.com/body.jpg",
  },
  brain: {
    title: "Brain read",
    body: "<p>Article</p>",
    photo_url: "https://cdn.example.com/brain.jpg",
  },
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
      return hit ? hit.clone() : undefined;
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

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-12T10:00:00.000Z")); // 12:00 DFX
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("W1 wrangler.jsonc", () => {
  it("matches Spec assets config", () => {
    const raw = readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    expect(json.main).toBe("worker/index.ts");
    expect(json.assets.directory).toBe("./dist/public");
    expect(json.assets.binding).toBe("ASSETS");
    expect(json.assets.not_found_handling).toBe("single-page-application");
    expect(json.assets.run_worker_first).toEqual([
      "/the-daily-fix",
      "/the-daily-fix/*",
      "/api/*",
      "/sitemap-daily-fix.xml",
    ]);
  });
});

describe("Worker HTML / API / sitemap", () => {
  let assetsFetch: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cache: ReturnType<typeof makeCache>;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    assetsFetch = vi.fn(async () => new Response(INDEX_HTML, { headers: { "Content-Type": "text/html" } }));
    fetchMock = vi.fn();
    cache = makeCache();
    ctx = makeCtx();
  });

  async function call(path: string, init: RequestInit = {}, key = "test-secret-key") {
    const req = new Request(`https://metfix.org${path}`, init);
    return handleRequest(req, makeEnv(assetsFetch, key), ctx, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      cachesDefault: cache,
    });
  }

  it("W2 non-HTML Accept → ASSETS, no upstream", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    assetsFetch.mockResolvedValue(new Response("ASSET", { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "application/json" } });
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(cache.puts.length).toBe(0);
    expect(await res.text()).toBe("ASSET");

    assetsFetch.mockClear();
    await call("/the-daily-fix/261004", { headers: {} });
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W3 POST → ASSETS", async () => {
    assetsFetch.mockResolvedValue(new Response("ASSET"));
    await call("/the-daily-fix/261004", { method: "POST", headers: { Accept: "text/html" } });
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W4 301-form with non-HTML Accept → ASSETS, no 301", async () => {
    assetsFetch.mockResolvedValue(new Response("ASSET"));
    const res = await call("/the-daily-fix/2026-10-04", { headers: { Accept: "*/*" } });
    expect(res.status).not.toBe(301);
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W5 API and sitemap handled by worker", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(DAY), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const api = await call("/api/daily-fix?date=2026-10-04", {
      headers: { Accept: "application/json" },
    });
    expect(api.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalledTimes(0);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const sm = await call("/sitemap-daily-fix.xml", { headers: { Accept: "application/xml" } });
    expect(sm.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalledTimes(0);
  });

  it("W6 __dfcache path → ASSETS, not cache body", async () => {
    await cache.put(
      new Request("https://metfix.org/__dfcache/2026-10-04"),
      new Response(JSON.stringify(DAY)),
    );
    assetsFetch.mockResolvedValue(new Response(INDEX_HTML));
    const res = await call("/__dfcache/2026-10-04", { headers: { Accept: "text/html" } });
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    const body = await res.text();
    expect(body).not.toContain('"belly"');
    const wrangler = JSON.parse(
      readFileSync(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)), "utf8").replace(
        /\/\/.*$/gm,
        "",
      ),
    );
    expect(wrangler.assets.run_worker_first).not.toContain("/__dfcache/*");
  });

  it("W7 date-form 301s", async () => {
    for (const path of [
      "/the-daily-fix/26/10/04?x=1",
      "/the-daily-fix/20261004?x=1",
      "/the-daily-fix/2026-10-04?x=1",
    ]) {
      const res = await call(path, { headers: { Accept: "text/html" } });
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("/the-daily-fix/261004?x=1");
      expect(await res.text()).toBe("");
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("W8 path pillars", async () => {
    let res = await call("/the-daily-fix/261004/brain?x=1", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/the-daily-fix/261004?x=1&tab=brain");
    res = await call("/the-daily-fix/261004/body", { headers: { Accept: "text/html" } });
    expect(res.headers.get("Location")).toBe("/the-daily-fix/261004?tab=body");
    res = await call("/the-daily-fix/261004/belly", { headers: { Accept: "text/html" } });
    expect(res.headers.get("Location")).toBe("/the-daily-fix/261004");
  });

  it("W9 tab redirects", async () => {
    for (const q of ["?tab=belly&x=1", "?tab=xyz&x=1", "?tab=&x=1", "?tab=body&tab=brain&x=1"]) {
      const res = await call(`/the-daily-fix/261004${q}`, { headers: { Accept: "text/html" } });
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("/the-daily-fix/261004?x=1");
    }
    const res = await call("/the-daily-fix/261004?a=%2F&tab=BRAIN&b=c+d", {
      headers: { Accept: "text/html" },
    });
    expect(res.headers.get("Location")).toBe("/the-daily-fix/261004?a=%2F&tab=brain&b=c+d");
  });

  it("W10 single hop", async () => {
    const locations = [
      "/the-daily-fix/261004?x=1",
      "/the-daily-fix/261004?x=1&tab=brain",
      "/the-daily-fix/261004?tab=body",
      "/the-daily-fix/261004",
      "/the-daily-fix/261004?a=%2F&tab=brain&b=c+d",
    ];
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    for (const loc of locations) {
      const res = await call(loc, { headers: { Accept: "text/html" } });
      expect(res.status).not.toBe(301);
      expect(res.status).toBe(200);
    }
  });

  it("W11 invalid dates 404 noindex", async () => {
    for (const path of [
      "/the-daily-fix/260231",
      "/the-daily-fix/261301",
      "/the-daily-fix/26/10/04/x",
      "/the-daily-fix/2026/1/04",
      "/the-daily-fix/19991004",
    ]) {
      fetchMock.mockClear();
      cache.puts.length = 0;
      const res = await call(path, { headers: { Accept: "text/html" } });
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).toContain('name="robots" content="noindex"');
      expect(body).not.toContain('rel="canonical"');
      expect(body).not.toContain("df-initial");
      expect(fetchMock).toHaveBeenCalledTimes(0);
      expect(cache.puts.length).toBe(0);
    }
  });

  it("W12 dated 200 full head + df-initial", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<title>The Daily Fix - 261004</title>");
    expect(body).toContain('id="df-initial"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://brokenscience.org/wp-json/metfix/v1/daily-fix?date=2026-10-04",
    );
  });

  it("W13 upstream 404", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("noindex");
    expect(body).not.toContain("df-initial");
    expect(cache.puts.length).toBe(0);
  });

  it("W14 date mismatch → 404, no cache", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...DAY, date: "2026-10-03" }), { status: 200 }),
    );
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    expect(cache.puts.length).toBe(0);
  });

  it("W15 bare uses today DFX and response date in title", async () => {
    vi.setSystemTime(new Date("2026-10-12T23:30:00.000Z")); // date=2026-10-13
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...DAY, date: "2026-10-13" }), { status: 200 }),
    );
    const res = await call("/the-daily-fix", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("date=2026-10-13");
    const body = await res.text();
    expect(body).toContain("The Daily Fix - 261013");
    expect(body).toContain('rel="canonical" href="https://metfix.org/the-daily-fix"');
  });

  it("W16 bare unusable → 200 generic", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const res = await call("/the-daily-fix", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("df-initial");
    expect(body).not.toContain("noindex");
    expect(cache.puts.length).toBe(0);
  });

  it("W17 503 cases", async () => {
    const triggers: Array<() => void> = [
      () => fetchMock.mockResolvedValue(new Response("x", { status: 500 })),
      () => fetchMock.mockResolvedValue(new Response("x", { status: 502 })),
      () => fetchMock.mockRejectedValue(new Error("boom")),
      () =>
        fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
          expect(init?.signal).toBeTruthy();
          const err = new Error("TimeoutError");
          err.name = "TimeoutError";
          return Promise.reject(err);
        }),
    ];
    for (const setup of triggers) {
      fetchMock.mockReset();
      cache.puts.length = 0;
      setup();
      const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("300");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(await res.text()).not.toContain("df-initial");
      expect(cache.puts.length).toBe(0);
    }
    fetchMock.mockReset();
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } }, "");
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W18 strips upstream headers", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(DAY), {
        status: 200,
        headers: {
          "Set-Cookie": "a=1",
          "X-WP-Total": "9",
          Server: "nginx",
          "Access-Control-Allow-Origin": "*",
        },
      }),
    );
    const html = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(html.headers.get("Set-Cookie")).toBeNull();
    expect(html.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const api = await call("/api/daily-fix?date=2026-10-04");
    expect(api.headers.get("Set-Cookie")).toBeNull();
    expect(api.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("W19 HEAD matches GET status/headers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const get = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const head = await call("/the-daily-fix/261004", {
      method: "HEAD",
      headers: { Accept: "text/html" },
    });
    expect(head.status).toBe(get.status);
    expect(await head.text()).toBe("");
  });

  it("W20 key only to brokenscience.org", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    for (const c of fetchMock.mock.calls) {
      const url = new URL(String(c[0]));
      const headers = c[1]?.headers as Record<string, string>;
      if (headers && headers["X-API-Key"]) {
        expect(url.hostname).toBe("brokenscience.org");
      }
    }
  });

  it("W21 key never in response", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    const body = await res.text();
    expect(body).not.toContain("test-secret-key");
    for (const [k, v] of res.headers) {
      expect(k + v).not.toContain("test-secret-key");
    }
  });

  it("W22–W25 head tags", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const res = await call("/the-daily-fix/261004?tab=brain", { headers: { Accept: "text/html" } });
    const body = await res.text();
    const titleIdx = body.indexOf("<title>The Daily Fix - 261004 | Brain</title>");
    const descIdx = body.indexOf('name="description"');
    const canonIdx = body.indexOf('rel="canonical" href="https://metfix.org/the-daily-fix/261004"');
    const ogType = body.indexOf('property="og:type" content="website"');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(descIdx).toBeGreaterThan(titleIdx);
    expect(canonIdx).toBeGreaterThan(descIdx);
    expect(ogType).toBeGreaterThan(canonIdx);
    expect(body).toContain('property="og:url" content="https://metfix.org/the-daily-fix/261004?tab=brain"');
    expect(body).toContain("cdn.example.com/brain.jpg");
    expect(body).toContain('"@type":"WebSite"');
    expect(body).not.toContain("CollectionPage");
  });

  it("W24 rest day tab=body", async () => {
    const rest = {
      ...DAY,
      body: { title: "Rest", body: null, excerpt: "<p>Rest day</p>" },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(rest), { status: 200 }));
    const res = await call("/the-daily-fix/261004?tab=body", { headers: { Accept: "text/html" } });
    const body = await res.text();
    expect(body).toContain("<title>The Daily Fix - 261004</title>");
    expect(body).not.toContain("| Body");
    expect(body).toContain('property="og:url" content="https://metfix.org/the-daily-fix/261004"');
    expect(body).toContain("belly.jpg");
  });

  it("W29 escaping", async () => {
    const hostile = {
      ...DAY,
      belly: {
        ...DAY.belly,
        title: `Tom "&" <b>Jerry</b> 's &amp;#8211; x`,
      },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(hostile), { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    const body = await res.text();
    // decoded once → &#8211; then attr-escaped → &amp;#8211;
    expect(body).toContain("Tom &quot;&amp;&quot; Jerry &#39;s &amp;#8211; x");
    expect(body).not.toMatch(/description[^>]*<b>/);
  });

  it("W30 df-initial escaping", async () => {
    const raw = {
      ...DAY,
      belly: {
        ...DAY.belly,
        body: `</script><\u2028&\u2029>`,
      },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    const body = await res.text();
    const match = body.match(
      /<script type="application\/json" id="df-initial">([\s\S]*?)<\/script>/,
    );
    expect(match).toBeTruthy();
    const text = match![1]!;
    expect(text).toContain("\\u003c");
    expect(text).toContain("\\u003e");
    expect(text).toContain("\\u0026");
    expect(text).toContain("\\u2028");
    expect(text).toContain("\\u2029");
    expect(JSON.parse(text)).toEqual(raw);
    // Hostile payload must not open/close extra scripts around df-initial.
    expect(body).toMatch(
      /<script type="application\/json" id="df-initial">[\s\S]*?<\/script>/,
    );
    expect(text).not.toContain("</script>");
  });

  it("W31–W36 cache behavior", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    await flush(ctx);
    expect(cache.puts.length).toBe(1);
    expect(cache.puts[0]!.key).toBe("https://metfix.org/__dfcache/2026-10-04");
    expect(cache.puts[0]!.res.headers.get("Cache-Control")).toContain("s-maxage=");
    expect(cache.puts[0]!.res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Cache-Control") || "").not.toMatch(/s-maxage/i);

    fetchMock.mockClear();
    await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(fetchMock).toHaveBeenCalledTimes(0);

    fetchMock.mockClear();
    await call("/api/daily-fix?date=2026-10-04");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W34 TTL boundaries", () => {
    // 12:00 DFX on 2026-10-12 → today capped 300
    expect(cacheTtlSeconds("2026-10-12", new Date("2026-10-12T10:00:00.000Z"))).toBe(300);
    // 23:58 DFX = 21:58 UTC
    expect(cacheTtlSeconds("2026-10-12", new Date("2026-10-12T21:58:00.000Z"))).toBe(120);
    expect(cacheTtlSeconds("2026-10-11", new Date("2026-10-12T10:00:00.000Z"))).toBe(43200);
    expect(cacheTtlSeconds("2026-10-05", new Date("2026-10-12T10:00:00.000Z"))).toBe(43200);
    expect(cacheTtlSeconds("2026-10-04", new Date("2026-10-12T10:00:00.000Z"))).toBe(86400);
  });

  it("W37 cached mismatch on dated → 404", async () => {
    await cache.put(
      new Request("https://metfix.org/__dfcache/2026-10-04"),
      new Response(JSON.stringify({ ...DAY, date: "2026-10-03" }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "s-maxage=60" },
      }),
    );
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W38–W44 API contract", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const ok = await call("/api/daily-fix?date=2026-10-04&x=1");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(DAY);
    expect(ok.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(ok.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(ok.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const head = await call("/api/daily-fix?date=2026-10-04", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");

    for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
      const res = await call("/api/daily-fix?date=2026-10-04", { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD");
    }

    for (const q of ["", "?date=2026-02-31", "?date=261004", "?date=2026-13-01"]) {
      const res = await call(`/api/daily-fix${q}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_date" });
    }

    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const nf = await call("/api/daily-fix?date=2026-10-04");
    // clear cache from earlier puts for this date — use a fresh date
    const nf2 = await call("/api/daily-fix?date=2026-09-01");
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const notFound = await call("/api/daily-fix?date=2026-08-01");
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: "not_found" });

    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    const u = await call("/api/daily-fix?date=2026-07-01");
    expect(u.status).toBe(503);
    expect(await u.json()).toEqual({ error: "unavailable" });
    expect(u.headers.get("Retry-After")).toBe("300");

    void ok;
    void head;
    void nf;
    void nf2;
  });

  it("W44 unmappable API 200 not cached", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ date: "nope" }), { status: 200 }));
    cache.puts.length = 0;
    const res = await call("/api/daily-fix?date=2026-06-01");
    expect(res.status).toBe(200);
    await flush(ctx);
    expect(cache.puts.length).toBe(0);
  });

  it("W45–W49 sitemap", async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      calls++;
      const u = new URL(String(url));
      expect(u.searchParams.get("limit")).toBe("100");
      expect(u.searchParams.has("date")).toBe(false);
      const offset = Number(u.searchParams.get("offset"));
      const items = Array.from({ length: Math.min(100, 250 - offset) }, (_, i) => ({
        date: `2026-01-${String((offset + i) % 28 || 1).padStart(2, "0")}`,
      }));
      return new Response(JSON.stringify({ items, meta: { total: 250 } }), { status: 200 });
    });
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
    expect(res.headers.get("Content-Type")).toBe("application/xml");
    const xml = await res.text();
    expect(xml).toContain("https://metfix.org/the-daily-fix</loc>");
    expect(xml).not.toContain("tab=");
    await flush(ctx);
    expect(cache.puts.some((p) => p.key === "https://metfix.org/__dfcache/sitemap")).toBe(true);

    calls = 0;
    await call("/sitemap-daily-fix.xml");
    expect(calls).toBe(0);

    // failure on page 2
    cache.store.clear();
    cache.puts.length = 0;
    let n = 0;
    fetchMock.mockImplementation(async () => {
      n++;
      if (n === 1) {
        return new Response(JSON.stringify({ items: [{ date: "2026-10-01" }], meta: { total: 200 } }), {
          status: 200,
        });
      }
      return new Response("nope", { status: 500 });
    });
    const fail = await call("/sitemap-daily-fix.xml");
    expect(fail.status).toBe(503);
    expect(await fail.text()).not.toContain("<urlset");
    expect(cache.puts.length).toBe(0);
  });
});
