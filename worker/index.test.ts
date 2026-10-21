import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installHtmlRewriterPolyfill } from "./test/htmlrewriter-polyfill";
import { handleRequest, type Env } from "./index";
import { assertBsiHost } from "./upstream";
import { cacheTtlSeconds, cutDescription } from "../shared/daily-fix";

installHtmlRewriterPolyfill();

const INDEX_HTML = `<!doctype html><html><head>
<meta name="robots" content="index, follow">
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

const SITE_TITLE = "MetFix";

const SEO_12 = [
  "title",
  "description",
  "canonical",
  "og:type",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
] as const;

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

function stubNamespace(): DurableObjectNamespace {
  return {
    idFromName: () => ({ toString: () => "stub" }),
    get: () => ({ fetch: async () => new Response(null, { status: 503 }) }),
  } as unknown as DurableObjectNamespace;
}

function makeEnv(assetsFetch: ReturnType<typeof vi.fn>, key = "test-secret-key"): Env {
  return {
    ASSETS: { fetch: assetsFetch } as unknown as Fetcher,
    DAILY_FIX_API_KEY: key || undefined,
    AUTH_SESSIONS: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    } as unknown as KVNamespace,
    SESSION: stubNamespace(),
    LOGIN_THROTTLE: stubNamespace(),
    OAUTH_STATE: stubNamespace(),
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

function countOccurrences(hay: string, needle: string): number {
  let n = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) {
    n++;
    i += needle.length;
  }
  return n;
}

function seoTagPositions(body: string): Record<(typeof SEO_12)[number], number> {
  return {
    title: body.search(/<title>/i),
    description: body.search(/<meta[^>]*name=["']description["']/i),
    canonical: body.search(/<link[^>]*rel=["']canonical["']/i),
    "og:type": body.search(/property=["']og:type["']/i),
    "og:title": body.search(/property=["']og:title["']/i),
    "og:description": body.search(/property=["']og:description["']/i),
    "og:url": body.search(/property=["']og:url["']/i),
    "og:image": body.search(/property=["']og:image["'](?!:)/i),
    "twitter:card": body.search(/name=["']twitter:card["']/i),
    "twitter:title": body.search(/name=["']twitter:title["']/i),
    "twitter:description": body.search(/name=["']twitter:description["']/i),
    "twitter:image": body.search(/name=["']twitter:image["'](?!:)/i),
  };
}

function assertTwelveTagsOnceInOrder(body: string) {
  const pos = seoTagPositions(body);
  let prev = -1;
  for (const name of SEO_12) {
    expect(pos[name], name).toBeGreaterThan(-1);
    expect(pos[name], name).toBeGreaterThan(prev);
    prev = pos[name];
  }
  expect(countOccurrences(body, "<title>")).toBe(1);
  expect(countOccurrences(body, 'name="description"')).toBe(1);
  expect(countOccurrences(body, 'rel="canonical"')).toBe(1);
  expect(countOccurrences(body, 'property="og:type"')).toBe(1);
  expect(countOccurrences(body, 'property="og:title"')).toBe(1);
  expect(countOccurrences(body, 'property="og:description"')).toBe(1);
  expect(countOccurrences(body, 'property="og:url"')).toBe(1);
  expect((body.match(/property="og:image(?!:)"/g) || []).length).toBe(1);
  expect(countOccurrences(body, 'name="twitter:card"')).toBe(1);
  expect(countOccurrences(body, 'name="twitter:title"')).toBe(1);
  expect(countOccurrences(body, 'name="twitter:description"')).toBe(1);
  expect((body.match(/name="twitter:image(?!:)"/g) || []).length).toBe(1);
}

function assertGenericHead(body: string) {
  expect(body).toContain(`<title>${SITE_TITLE}</title>`);
  expect(body).not.toContain('rel="canonical"');
  expect(body).not.toContain('property="og:url"');
  expect(body).not.toContain("df-initial");
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
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    const wrangler = pkg.devDependencies?.wrangler ?? pkg.dependencies?.wrangler;
    expect(wrangler).toMatch(/^\d/);
    expect(wrangler).not.toMatch(/^[~^]/);
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

  async function call(
    path: string,
    init: RequestInit = {},
    key = "test-secret-key",
    extra: { bsiBaseUrl?: string } = {},
  ) {
    // undici forbids TRACE; synthesize method for W2.1.
    let req: Request;
    try {
      req = new Request(`https://metfix.org${path}`, init);
    } catch {
      const method = String(init.method ?? "GET").toUpperCase();
      req = new Request(`https://metfix.org${path}`, { ...init, method: "GET" });
      Object.defineProperty(req, "method", { get: () => method });
    }
    return handleRequest(req, makeEnv(assetsFetch, key), ctx, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      cachesDefault: cache,
      bsiBaseUrl: extra.bsiBaseUrl,
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

  it("W7a out-of-range days 302 to today or the first fix, uncached, without upstream", async () => {
    let res = await call("/the-daily-fix/261017?tab=body", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/the-daily-fix?tab=body&missing=261017");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    res = await call("/the-daily-fix/241231", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/the-daily-fix/250210?missing=241231");

    res = await call("/the-daily-fix/2024-12-31", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/the-daily-fix/241231");

    expect(fetchMock).toHaveBeenCalledTimes(0);
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

  it("W11 invalid dates 404 noindex + generic head, no canonical", async () => {
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
      expect(body).toContain(`<title>${SITE_TITLE}</title>`);
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

  it("W13 upstream 404 → noindex generic head, no canonical", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain('name="robots" content="noindex"');
    expect(body).toContain(`<title>${SITE_TITLE}</title>`);
    expect(body).not.toContain('rel="canonical"');
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

  it("W16 bare unusable → 200 generic head, no canonical", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const res = await call("/the-daily-fix", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    const body = await res.text();
    assertGenericHead(body);
    expect(body).not.toContain("noindex");
    expect(cache.puts.length).toBe(0);
  });

  it("W17 503 cases with real timeout + generic head", async () => {
    const triggers: Array<() => void | Promise<void>> = [
      () => {
        fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
      },
      () => {
        fetchMock.mockResolvedValue(new Response("x", { status: 502 }));
      },
      () => {
        fetchMock.mockRejectedValue(new Error("boom"));
      },
      () => {
        fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
          expect(init?.signal).toBeTruthy();
          return new Promise((_resolve, reject) => {
            init!.signal!.addEventListener("abort", () => {
              const err = new Error("The operation was aborted due to timeout");
              err.name = "TimeoutError";
              reject(err);
            });
          });
        });
      },
    ];
    for (const setup of triggers) {
      fetchMock.mockReset();
      cache.puts.length = 0;
      setup();
      const pending = call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
      await vi.advanceTimersByTimeAsync(3500);
      const res = await pending;
      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("300");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = await res.text();
      assertGenericHead(body);
      expect(body).not.toContain("noindex");
      expect(cache.puts.length).toBe(0);
    }
    fetchMock.mockReset();
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } }, "");
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    assertGenericHead(await res.text());
  });

  it("W18 strips Set-Cookie, X-WP-Total, Server, Access-Control-*", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(DAY), {
        status: 200,
        headers: {
          "Set-Cookie": "a=1",
          "X-WP-Total": "9",
          Server: "nginx",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "X-API-Key",
        },
      }),
    );
    const html = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(html.headers.get("Set-Cookie")).toBeNull();
    expect(html.headers.get("X-WP-Total")).toBeNull();
    expect(html.headers.get("Server")).toBeNull();
    expect(html.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(html.headers.get("Access-Control-Allow-Headers")).toBeNull();
    const api = await call("/api/daily-fix?date=2026-10-04");
    expect(api.headers.get("Set-Cookie")).toBeNull();
    expect(api.headers.get("X-WP-Total")).toBeNull();
    expect(api.headers.get("Server")).toBeNull();
    expect(api.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("W19 HEAD matches GET status/headers for key statuses", async () => {
    const cases: Array<{ setup: () => void; path: string; status: number }> = [
      {
        path: "/the-daily-fix/261004",
        status: 200,
        setup: () => fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 })),
      },
      {
        path: "/the-daily-fix/261004",
        status: 404,
        setup: () => fetchMock.mockResolvedValue(new Response("{}", { status: 404 })),
      },
      {
        path: "/the-daily-fix",
        status: 200,
        setup: () =>
          fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ ...DAY, date: "2026-10-12" }), { status: 200 }),
          ),
      },
      {
        path: "/the-daily-fix/261004",
        status: 503,
        setup: () => fetchMock.mockResolvedValue(new Response("x", { status: 500 })),
      },
      {
        path: "/the-daily-fix/260231",
        status: 404,
        setup: () => {},
      },
    ];
    for (const c of cases) {
      cache.store.clear();
      cache.puts.length = 0;
      fetchMock.mockReset();
      c.setup();
      const get = await call(c.path, { headers: { Accept: "text/html" } });
      fetchMock.mockReset();
      c.setup();
      const head = await call(c.path, { method: "HEAD", headers: { Accept: "text/html" } });
      expect(get.status).toBe(c.status);
      expect(head.status).toBe(get.status);
      expect(headersObject(head)).toEqual(headersObject(get));
      expect(await head.text()).toBe("");
    }
  });

  it("W20 key only to brokenscience.org + evil host-guard", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    for (const c of fetchMock.mock.calls) {
      const url = new URL(String(c[0]));
      const headers = c[1]?.headers as Record<string, string>;
      if (headers && headers["X-API-Key"]) {
        expect(url.hostname).toBe("brokenscience.org");
      }
    }
    expect(() => assertBsiHost("https://evil.example/x")).toThrow();
    expect(() => assertBsiHost("https://brokenscience.org.evil.example/x")).toThrow();
    expect(() => assertBsiHost("https://brokenscience.org/x")).not.toThrow();

    fetchMock.mockReset();
    cache.store.clear();
    const evil = await call(
      "/the-daily-fix/261004",
      { headers: { Accept: "text/html" } },
      "test-secret-key",
      { bsiBaseUrl: "https://evil.example/wp-json/metfix/v1/daily-fix" },
    );
    expect(evil.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W21 key never in HTML or API response", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    for (const path of ["/the-daily-fix/261004", "/api/daily-fix?date=2026-10-04"]) {
      const res = await call(path, { headers: { Accept: "text/html" } });
      const body = await res.text();
      expect(body).not.toContain("test-secret-key");
      for (const [k, v] of res.headers) {
        expect(k + v).not.toContain("test-secret-key");
      }
    }
  });

  it("W22 all 12 tags exactly once in order", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const res = await call("/the-daily-fix/261004?tab=brain", { headers: { Accept: "text/html" } });
    const body = await res.text();
    assertTwelveTagsOnceInOrder(body);
    expect(body).toContain('"@type":"WebSite"');
    expect(body).not.toContain("CollectionPage");
  });

  it("W23 title in title/og/twitter; brain suffix ×3", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    let body = await (
      await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } })
    ).text();
    expect(body).toContain("<title>The Daily Fix - 261004</title>");
    expect(body).toContain('property="og:title" content="The Daily Fix - 261004"');
    expect(body).toContain('name="twitter:title" content="The Daily Fix - 261004"');

    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    body = await (
      await call("/the-daily-fix/261004?tab=brain", { headers: { Accept: "text/html" } })
    ).text();
    const titled = "The Daily Fix - 261004 | Brain";
    expect(body).toContain(`<title>${titled}</title>`);
    expect(body).toContain(`property="og:title" content="${titled}"`);
    expect(body).toContain(`name="twitter:title" content="${titled}"`);
  });

  it("W25 canonical tab-less; og:url carries ?tab=brain", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const body = await (
      await call("/the-daily-fix/261004?tab=brain", { headers: { Accept: "text/html" } })
    ).text();
    expect(body).toContain('rel="canonical" href="https://metfix.org/the-daily-fix/261004"');
    expect(body).not.toContain('rel="canonical" href="https://metfix.org/the-daily-fix/261004?tab=');
    expect(body).toContain(
      'property="og:url" content="https://metfix.org/the-daily-fix/261004?tab=brain"',
    );
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

  it("W28 image: tab photo, http→https, no dims; fallback dims", async () => {
    const withHttp = {
      ...DAY,
      brain: { ...DAY.brain, photo_url: "http://cdn.example.com/brain-http.jpg" },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(withHttp), { status: 200 }));
    let body = await (
      await call("/the-daily-fix/261004?tab=brain", { headers: { Accept: "text/html" } })
    ).text();
    expect(body).toContain('property="og:image" content="https://cdn.example.com/brain-http.jpg"');
    expect(body).not.toContain("og:image:width");
    expect(body).not.toContain("og:image:height");

    cache.store.clear();
    cache.puts.length = 0;
    const noPhotos = {
      ...DAY,
      belly: { ...DAY.belly, photo_url: null },
      body: { ...DAY.body, photo_url: null },
      brain: { ...DAY.brain, photo_url: null },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(noPhotos), { status: 200 }));
    body = await (
      await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } })
    ).text();
    expect(body).toContain("MetFix-logo-1x1-1.jpg");
    expect(body).toContain('property="og:image:width" content="1336"');
    expect(body).toContain('property="og:image:height" content="1336"');
  });

  it("W29 escaping in every title/description tag", async () => {
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
    const escaped = "Tom &quot;&amp;&quot; Jerry &#39;s &amp;#8211; x";
    expect(body).toContain(escaped);
    // Prepared title lands in all three description tags (attr-escaped).
    expect(body).toMatch(
      new RegExp(`name="description" content="[^"]*${escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(body).toMatch(
      new RegExp(`property="og:description" content="[^"]*${escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(body).toMatch(
      new RegExp(`name="twitter:description" content="[^"]*${escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(countOccurrences(body, escaped)).toBe(3);
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
    expect(text).not.toContain("</script>");
  });

  it("W31 exact s-maxage on cache put", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    const res = await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    await flush(ctx);
    const ttl = cacheTtlSeconds("2026-10-04", new Date("2026-10-12T10:00:00.000Z"));
    expect(ttl).toBe(86400);
    expect(cache.puts.length).toBe(1);
    expect(cache.puts[0]!.key).toBe("https://metfix.org/__dfcache/2026-10-04");
    expect(cache.puts[0]!.res.headers.get("Cache-Control")).toBe(`s-maxage=${ttl}`);
    expect(cache.puts[0]!.res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Cache-Control") || "").not.toMatch(/s-maxage/i);
  });

  it("W32–W33 HTML then API and reverse share cache", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    await flush(ctx);
    fetchMock.mockClear();
    await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(fetchMock).toHaveBeenCalledTimes(0);

    fetchMock.mockClear();
    await call("/api/daily-fix?date=2026-10-04");
    expect(fetchMock).toHaveBeenCalledTimes(0);

    // Reverse: API first, then HTML
    cache.store.clear();
    cache.puts.length = 0;
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DAY), { status: 200 }));
    await call("/api/daily-fix?date=2026-10-04");
    await flush(ctx);
    fetchMock.mockClear();
    await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W34 TTL boundaries including bare cap and DFX midnight", () => {
    expect(cacheTtlSeconds("2026-10-12", new Date("2026-10-12T10:00:00.000Z"))).toBe(300);
    expect(cacheTtlSeconds("2026-10-12", new Date("2026-10-12T10:00:00.000Z"), { bare: true })).toBe(
      300,
    );
    expect(cacheTtlSeconds("2026-10-12", new Date("2026-10-12T21:58:00.000Z"))).toBe(120);
    expect(cacheTtlSeconds("2026-10-11", new Date("2026-10-12T10:00:00.000Z"))).toBe(43200);
    expect(cacheTtlSeconds("2026-10-05", new Date("2026-10-12T10:00:00.000Z"))).toBe(43200);
    expect(cacheTtlSeconds("2026-10-04", new Date("2026-10-12T10:00:00.000Z"))).toBe(86400);
    // 23:59:59 DFX still today−7 short window; 00:00:00 DFX rolls the boundary
    expect(cacheTtlSeconds("2026-10-05", new Date("2026-10-12T21:59:59.000Z"))).toBe(1);
    expect(cacheTtlSeconds("2026-10-05", new Date("2026-10-12T22:00:00.000Z"))).toBe(86400);
  });

  it("W35 no cache.put for 404/5xx/timeout/throw/mismatch/unmappable (HTML+API)", async () => {
    const badHtml: Array<() => void> = [
      () => fetchMock.mockResolvedValue(new Response("{}", { status: 404 })),
      () => fetchMock.mockResolvedValue(new Response("x", { status: 500 })),
      () => fetchMock.mockRejectedValue(new Error("boom")),
      () =>
        fetchMock.mockResolvedValue(
          new Response(JSON.stringify({ ...DAY, date: "2026-10-03" }), { status: 200 }),
        ),
      () => fetchMock.mockResolvedValue(new Response(JSON.stringify({ date: "nope" }), { status: 200 })),
    ];
    for (const setup of badHtml) {
      cache.puts.length = 0;
      fetchMock.mockReset();
      setup();
      await call("/the-daily-fix/261004", { headers: { Accept: "text/html" } });
      await flush(ctx);
      expect(cache.puts.length).toBe(0);
    }
    for (const setup of [
      () => fetchMock.mockResolvedValue(new Response("{}", { status: 404 })),
      () => fetchMock.mockResolvedValue(new Response("x", { status: 500 })),
      () => fetchMock.mockRejectedValue(new Error("boom")),
      () => fetchMock.mockResolvedValue(new Response(JSON.stringify({ date: "nope" }), { status: 200 })),
    ]) {
      cache.puts.length = 0;
      fetchMock.mockReset();
      setup();
      await call("/api/daily-fix?date=2026-08-15");
      await flush(ctx);
      expect(cache.puts.length).toBe(0);
    }
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

  it("/api/foo returns JSON 404", async () => {
    const res = await call("/api/foo");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W38–W44 API contract", async () => {
    const raw = JSON.stringify(DAY);
    fetchMock.mockResolvedValue(new Response(raw, { status: 200 }));
    const ok = await call("/api/daily-fix?date=2026-10-04&x=1");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe(raw);
    expect(ok.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(ok.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(ok.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(ok.headers.get("Access-Control-Allow-Headers")).toBeNull();

    fetchMock.mockResolvedValue(new Response(raw, { status: 200 }));
    const get = await call("/api/daily-fix?date=2026-10-04");
    fetchMock.mockResolvedValue(new Response(raw, { status: 200 }));
    const head = await call("/api/daily-fix?date=2026-10-04", { method: "HEAD" });
    expect(head.status).toBe(get.status);
    expect(headersObject(head)).toEqual(headersObject(get));
    expect(await head.text()).toBe("");

    for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
      fetchMock.mockClear();
      const res = await call("/api/daily-fix?date=2026-10-04", { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD");
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }

    for (const q of ["", "?date=2026-02-31", "?date=261004", "?date=2026-13-01"]) {
      fetchMock.mockClear();
      const res = await call(`/api/daily-fix${q}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_date" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }

    cache.store.clear();
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const notFound = await call("/api/daily-fix?date=2026-08-01");
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: "not_found" });
    expect(notFound.headers.get("Cache-Control")).toBe("public, max-age=60");

    for (const setup of [
      () => fetchMock.mockResolvedValue(new Response("x", { status: 500 })),
      () => fetchMock.mockRejectedValue(new Error("boom")),
      () =>
        fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("TimeoutError");
              err.name = "TimeoutError";
              reject(err);
            });
          });
        }),
    ]) {
      cache.puts.length = 0;
      fetchMock.mockReset();
      setup();
      const pending = call("/api/daily-fix?date=2026-07-01");
      await vi.advanceTimersByTimeAsync(3500);
      const u = await pending;
      expect(u.status).toBe(503);
      expect(await u.json()).toEqual({ error: "unavailable" });
      expect(u.headers.get("Retry-After")).toBe("300");
      expect(u.headers.get("Cache-Control")).toBe("no-store");
      await flush(ctx);
      expect(cache.puts.length).toBe(0);
    }
    fetchMock.mockReset();
    const nokey = await call("/api/daily-fix?date=2026-07-02", {}, "");
    expect(nokey.status).toBe(503);
    expect(await nokey.json()).toEqual({ error: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W44 unmappable API 200 not cached", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ date: "nope" }), { status: 200 }));
    cache.puts.length = 0;
    const res = await call("/api/daily-fix?date=2026-06-01");
    expect(res.status).toBe(200);
    await flush(ctx);
    expect(cache.puts.length).toBe(0);
  });

  it("comments proxy returns W7-shaped body and caches type=all", async () => {
    const raw = JSON.stringify({
      comments: {
        belly: [
          {
            id: 1,
            user: { id: 9, display_name: "Jane", email: "a@b.co" },
            content: "hi",
            timestamp: "2026-10-04T12:00:00Z",
            like_count: 0,
            parent_id: null,
            deleted: 0,
            edited: 0,
            liked: true,
            replies: [],
          },
        ],
        body: [],
        brain: [],
      },
      meta: { date: "2026-10-04", type: "all" },
    });
    fetchMock.mockResolvedValue(new Response(raw, { status: 200 }));
    const res = await call("/api/daily-fix/comments?date=2026-10-04&type=all");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const body = await res.json();
    expect(body).toEqual({
      comments: {
        belly: [
          {
            id: 1,
            user: { display_name: "Member" },
            content: "hi",
            timestamp: "2026-10-04T12:00:00Z",
            like_count: 0,
            parent_id: null,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        ],
        body: [],
        brain: [],
      },
      meta: { date: "2026-10-04", type: "all" },
    });
    expect(JSON.stringify(body)).not.toContain("test-secret-key");
    expect(JSON.stringify(body)).not.toContain('"liked"');
    expect(JSON.stringify(body)).not.toContain('"id":9');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [upstream, init] = fetchMock.mock.calls[0];
    expect(String(upstream)).toBe(
      "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments?date=2026-10-04&type=all",
    );
    expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe("test-secret-key");
    expect(cache.puts.length).toBe(1);
    expect(cache.puts[0]?.key).toBe(
      "https://cache.metfix.internal/daily-fix/comments?date=2026-10-04",
    );

    fetchMock.mockClear();
    const head = await call("/api/daily-fix/comments?date=2026-10-04&type=all", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("comments proxy rejects bad input; Allow includes POST; trailing slash 404", async () => {
    for (const method of ["PUT", "DELETE", "OPTIONS", "PATCH", "TRACE"]) {
      fetchMock.mockClear();
      const res = await call("/api/daily-fix/comments?date=2026-10-04&type=all", { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD, POST");
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
    for (const q of ["", "?date=2026-02-31", "?date=261004", "?type=all", "?date=2026-10-04"]) {
      fetchMock.mockClear();
      const res = await call(`/api/daily-fix/comments${q}`);
      expect(res.status).toBe(400);
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
    const missingType = await call("/api/daily-fix/comments?date=2026-10-04");
    expect(await missingType.json()).toEqual({ error: "invalid_type" });
    const badDate = await call("/api/daily-fix/comments?date=261004&type=all");
    expect(await badDate.json()).toEqual({ error: "invalid_date" });
    const slash = await call("/api/daily-fix/comments/?date=2026-10-04&type=all");
    expect(slash.status).toBe(404);
    expect(await slash.json()).toEqual({ error: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("comments proxy maps upstream failures and refuses a non-BSI host", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const notFound = await call("/api/daily-fix/comments?date=2026-08-01&type=all");
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: "not_found" });
    expect(notFound.headers.get("Cache-Control")).toBe("no-store");

    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    const down = await call("/api/daily-fix/comments?date=2026-08-02&type=all");
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: "unavailable" });
    expect(down.headers.get("Retry-After")).toBe("300");
    expect(down.headers.get("Cache-Control")).toBe("no-store");

    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    const limited = await call("/api/daily-fix/comments?date=2026-08-05&type=all");
    expect(limited.status).toBe(503);
    expect(limited.headers.get("Retry-After")).toBe("60");

    fetchMock.mockReset();
    const nokey = await call("/api/daily-fix/comments?date=2026-08-03&type=all", {}, "");
    expect(nokey.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    const evil = await call(
      "/api/daily-fix/comments?date=2026-08-04&type=all",
      {},
      "test-secret-key",
      { bsiBaseUrl: "https://evil.example/wp-json/metfix/v1/daily-fix" },
    );
    expect(evil.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W45 sitemap paging total 250/200/0 + X-API-Key each page + Content-Type", async () => {
    async function runTotal(total: number, expectedCalls: number) {
      cache.store.clear();
      cache.puts.length = 0;
      let calls = 0;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        calls++;
        const u = new URL(String(url));
        expect(u.searchParams.get("limit")).toBe("100");
        expect(u.searchParams.has("date")).toBe(false);
        const headers = init?.headers as Record<string, string>;
        expect(headers["X-API-Key"]).toBe("test-secret-key");
        const offset = Number(u.searchParams.get("offset"));
        const items = Array.from({ length: Math.min(100, Math.max(0, total - offset)) }, (_, i) => ({
          date: `2026-01-${String(((offset + i) % 28) + 1).padStart(2, "0")}`,
        }));
        return new Response(JSON.stringify({ items, meta: { total } }), { status: 200 });
      });
      const res = await call("/sitemap-daily-fix.xml");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/xml");
      expect(calls).toBe(expectedCalls);
    }
    await runTotal(250, 3);
    await runTotal(200, 2);
    await runTotal(0, 1);
  });

  it("W46 sitemap lastmod, future exclusion, scheduled keep, draft drop", async () => {
    fetchMock.mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          items: [
            { date: "2026-10-04", ignored: true },
            { date: "2026-10-13" }, // tomorrow DFX at frozen 12:00 on 10-12
            { date: "2026-10-11", status: "scheduled" },
            { date: "2026-10-10", status: "draft" },
            { date: "2026-10-09", status: "published" },
            { date: "2026-10-08", status: null },
          ],
          meta: { total: 6 },
        }),
        { status: 200 },
      );
    });
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.headers.get("Content-Type")).toBe("application/xml");
    const xml = await res.text();
    expect(xml).toContain("https://metfix.org/the-daily-fix</loc>");
    expect(xml).toContain("<loc>https://metfix.org/the-daily-fix/261004</loc><lastmod>2026-10-04</lastmod>");
    expect(xml).toContain("<loc>https://metfix.org/the-daily-fix/261011</loc><lastmod>2026-10-11</lastmod>");
    expect(xml).toContain("<loc>https://metfix.org/the-daily-fix/261009</loc><lastmod>2026-10-09</lastmod>");
    expect(xml).toContain("<loc>https://metfix.org/the-daily-fix/261008</loc><lastmod>2026-10-08</lastmod>");
    expect(xml).not.toContain("261013");
    expect(xml).not.toContain("261010"); // draft excluded
    expect(xml).not.toContain("tab=");
  });

  it("sitemap subrequest cap: total 10000 → 503, no put, ≤40 upstream", async () => {
    cache.store.clear();
    cache.puts.length = 0;
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls++;
      const items = Array.from({ length: 100 }, (_, i) => ({
        date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      }));
      return new Response(JSON.stringify({ items, meta: { total: 10000 } }), { status: 200 });
    });
    const res = await call("/sitemap-daily-fix.xml");
    expect(res.status).toBe(503);
    expect(cache.puts.length).toBe(0);
    // match=1 + reserve put; upstream stops at MAX-1 → at most 38 fetches, never >40
    expect(calls).toBeLessThanOrEqual(40);
    expect(calls).toBe(38);
  });

  it("W47 page-2 failure → 503, no cache", async () => {
    cache.store.clear();
    cache.puts.length = 0;
    let n = 0;
    fetchMock.mockImplementation(async () => {
      n++;
      if (n === 1) {
        // Full page of 100 so the worker advances to page 2.
        const items = Array.from({ length: 100 }, (_, i) => ({
          date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
        }));
        return new Response(JSON.stringify({ items, meta: { total: 200 } }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    });
    const fail = await call("/sitemap-daily-fix.xml");
    expect(fail.status).toBe(503);
    expect(await fail.text()).not.toContain("<urlset");
    expect(cache.puts.length).toBe(0);
  });

  it("W48 sitemap cache s-maxage=86400", async () => {
    cache.store.clear();
    cache.puts.length = 0;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    await call("/sitemap-daily-fix.xml");
    await flush(ctx);
    const put = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/sitemap");
    expect(put).toBeTruthy();
    expect(put!.res.headers.get("Cache-Control")).toBe("s-maxage=86400");
    fetchMock.mockClear();
    await call("/sitemap-daily-fix.xml");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W49 HEAD sitemap matches GET headers, empty body", async () => {
    cache.store.clear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const get = await call("/sitemap-daily-fix.xml");
    cache.store.clear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const head = await call("/sitemap-daily-fix.xml", { method: "HEAD" });
    expect(head.status).toBe(get.status);
    expect(headersObject(head)).toEqual(headersObject(get));
    expect(await head.text()).toBe("");
  });

  it("sitemap reads BSI's live `days` list key", async () => {
    cache.store.clear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ days: [{ ...DAY, status: "scheduled" }], meta: { total: 1 } }), {
        status: 200,
      }),
    );
    const res = await call("/sitemap-daily-fix.xml");
    expect(await res.text()).toContain("<loc>https://metfix.org/the-daily-fix/261004</loc>");
  });

  describe("archive /api/daily-fix/archive", () => {
    function listDay(date: string, status = "scheduled") {
      return {
        ...DAY,
        date,
        status,
        belly: { ...DAY.belly, title: `Belly ${date}`, excerpt: "<p>Rich &amp; creamy</p>", protein: { id: 2, name: "Chicken" } },
        body: { ...DAY.body, excerpt: "<p>Run 400 m<br />10 pull-ups</p>" },
      };
    }

    it("pages BSI in parallel, drops future/draft days, returns compact newest-first rows, edge-caches", async () => {
      cache.store.clear();
      cache.puts.length = 0;
      const offsets: number[] = [];
      fetchMock.mockImplementation(async (url: string) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset"));
        offsets.push(offset);
        const days =
          offset === 0
            ? [
                listDay("2026-10-13"), // tomorrow at frozen 12:00 DFX on 10-12
                listDay("2026-10-12"),
                listDay("2026-10-11", "draft"),
                ...Array.from({ length: 97 }, () => listDay("2026-10-10")),
              ]
            : [listDay("2026-09-01")];
        return new Response(JSON.stringify({ days, meta: { total: 101 } }), { status: 200 });
      });

      const res = await call("/api/daily-fix/archive");
      expect(res.status).toBe(200);
      expect(offsets.sort((a, b) => a - b)).toEqual([0, 100]);
      const body = (await res.json()) as { days: Array<Record<string, unknown>> };
      expect(body.days.map((d) => d.date)).toEqual(["2026-10-12", "2026-10-10", "2026-09-01"]);
      expect(body.days[0]).toEqual({
        date: "2026-10-12",
        belly: {
          title: "Belly 2026-10-12",
          protein: "Chicken",
          excerpt: "Rich & creamy",
          photo: "https://cdn.example.com/belly.jpg",
        },
        body: { title: "Body work", excerpt: "Run 400 m 10 pull-ups", photo: "https://cdn.example.com/body.jpg" },
        brain: { title: "Brain read", excerpt: "Article", photo: "https://cdn.example.com/brain.jpg", button: null },
      });

      await flush(ctx);
      const put = cache.puts.find((p) => p.key === "https://metfix.org/__dfcache/archive-v4");
      expect(put!.res.headers.get("Cache-Control")).toMatch(/^s-maxage=\d+$/);
      fetchMock.mockClear();
      expect((await call("/api/daily-fix/archive")).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it("any failed page → 503, nothing cached", async () => {
      cache.store.clear();
      cache.puts.length = 0;
      fetchMock.mockImplementation(async (url: string) => {
        const offset = Number(new URL(String(url)).searchParams.get("offset"));
        if (offset > 0) return new Response("nope", { status: 500 });
        return new Response(JSON.stringify({ days: [listDay("2026-10-12")], meta: { total: 150 } }), {
          status: 200,
        });
      });
      const res = await call("/api/daily-fix/archive");
      expect(res.status).toBe(503);
      await flush(ctx);
      expect(cache.puts.length).toBe(0);
    });
  });
});

describe("W27 truncation (shared cutDescription)", () => {
  it("exact string with astral chars + trim + boundaries", () => {
    // 154 code points then space-cut: build overlong with emoji (astral) and trailing punctuation.
    const core = `The Daily Fix 261004: Belly - ${"A".repeat(100)} 😀 ${"B".repeat(40)}.,:; -`;
    expect(Array.from(core).length).toBeGreaterThan(155);
    const cut = cutDescription(core);
    expect(Array.from(cut).length).toBeLessThanOrEqual(155);
    expect(cut.endsWith("\u2026")).toBe(true);
    expect(cut).toContain("😀");
    expect(cut).not.toMatch(/[.,:;\-\s]$/);

    const at155 = "x".repeat(155);
    expect(cutDescription(at155)).toBe(at155);
    const at156 = "x".repeat(156);
    const cut156 = cutDescription(at156);
    expect(cut156.endsWith("\u2026")).toBe(true);
    expect(Array.from(cut156).length).toBeLessThanOrEqual(155);
  });
});
