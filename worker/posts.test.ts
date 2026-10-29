/**
 * Worker posts API + HTML unit tests (PW*, PH* via handleRequest, PS Worker-pass).
 * Spec: metfix-pr3-posts-tests.r1.13
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_SIZE, MAX_UPSTREAM_BYTES, isPostListBody, isPostDetailBody } from "../shared/posts";
import { installHtmlRewriterPolyfill } from "./test/htmlrewriter-polyfill";
import { DETAIL_PAGE_CSP } from "./csp";
import { handleRequest, type Env } from "./index";
import { parseListPage, isValidPostId } from "./posts";
import { assertBsiHost } from "./upstream";

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
</head><body><div id="root"></div></body></html>`;

const LOCK_BODY = "LOCKED-BODY-7f3";
const LOCK_EXC = "LOCKED-EXC-7f3";
const LOCK_VID = "LOCKED-VID-7f3";
const POSTS_KEY = "test-posts-key";
const DF_KEY = "test-secret-key";

type CacheStore = Map<string, Response>;

function makeCache(): Cache & {
  store: CacheStore;
  puts: Array<{ key: string; res: Response }>;
  matches: string[];
} {
  const store: CacheStore = new Map();
  const puts: Array<{ key: string; res: Response }> = [];
  const matches: string[] = [];
  return {
    store,
    puts,
    matches,
    async match(request: RequestInfo) {
      const key = typeof request === "string" ? request : request.url;
      matches.push(key);
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
  } as unknown as Cache & {
    store: CacheStore;
    puts: Array<{ key: string; res: Response }>;
    matches: string[];
  };
}

function makeEnv(
  assetsFetch: ReturnType<typeof vi.fn>,
  opts: { dailyFixKey?: string; postsKey?: string | null } = {},
): Env {
  const env: Env = {
    ASSETS: { fetch: assetsFetch } as unknown as Fetcher,
    DAILY_FIX_API_KEY: opts.dailyFixKey ?? DF_KEY,
  };
  if ("postsKey" in opts) {
    if (opts.postsKey != null && opts.postsKey !== "") {
      env.BSI_POSTS_API_KEY = opts.postsKey;
    }
  } else {
    env.BSI_POSTS_API_KEY = POSTS_KEY;
  }
  return env;
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

function unlockedItem(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Post ${id}`,
    excerpt: "Hello",
    date: "2026-10-19T10:00:00+00:00",
    featured_image: null,
    author: { id: 1, name: "A" },
    categories: [{ id: 1, name: "News", slug: "news" }],
    access_levels: [],
    content_access_display: {
      has_content_access: false,
      is_exclusive: false,
      access: "full",
    },
    permalink: `https://brokenscience.org/post-${id}`,
    content: `<p>Body ${id}</p>`,
    ...overrides,
  };
}

function lockedItem(id: number, overrides: Record<string, unknown> = {}) {
  return unlockedItem(id, {
    title: LOCK_BODY,
    excerpt: LOCK_EXC,
    video: LOCK_VID,
    content: LOCK_BODY,
    access_levels: ["members"],
    content_access_display: {
      has_content_access: true,
      is_exclusive: true,
      access: "preview",
    },
    ...overrides,
  });
}

function listUpstreamJson(
  posts: unknown[],
  total: number,
  metaExtra: Record<string, unknown> = {},
) {
  return {
    posts,
    meta: { total, per_page: 10, has_more: false, ...metaExtra },
  };
}

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function listPageUrl(page: number): string {
  const offset = (page - 1) * PAGE_SIZE;
  return `https://brokenscience.org/wp-json/bsi/v1/posts?limit=${PAGE_SIZE}&offset=${offset}&preview=true`;
}

function assertNoSecretsOrLock(text: string) {
  expect(text).not.toContain(POSTS_KEY);
  expect(text).not.toContain(DF_KEY);
  expect(text).not.toContain(LOCK_BODY);
  expect(text).not.toContain(LOCK_EXC);
  expect(text).not.toContain(LOCK_VID);
}

function assertConsoleClean(calls: unknown[][]) {
  for (const args of calls) {
    const joined = args.map(String).join(" ");
    assertNoSecretsOrLock(joined);
  }
}

function assertPostsHandlerConsole(calls: unknown[][]) {
  for (const args of calls) {
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args.length).toBeLessThanOrEqual(2);
    expect(String(args[0])).toMatch(/^posts:[a-z_]+$/);
    if (args.length === 2) {
      expect(typeof args[1] === "number" || Number.isFinite(Number(args[1]))).toBe(true);
    }
  }
}

describe("posts helpers", () => {
  it("PAGE_SIZE is 12 (PW10 constant pin)", () => {
    expect(PAGE_SIZE).toBe(12);
  });

  it("parseListPage: absent → 1; bad → bad_page (PW6/PW7)", () => {
    expect(parseListPage("")).toEqual({ ok: true, page: 1 });
    expect(parseListPage("?page=2")).toEqual({ ok: true, page: 2 });
    expect(parseListPage("?page=0").ok).toBe(false);
    expect(parseListPage("?page=51").ok).toBe(false);
    expect(parseListPage("?page[]=1").ok).toBe(false);
    expect(parseListPage("?Page=1").ok).toBe(false);
    expect(parseListPage("?page=1&page=2").ok).toBe(false);
    expect(parseListPage("?page=%31").ok).toBe(false);
  });

  it("isValidPostId (A3)", () => {
    expect(isValidPostId("1")).toBe(true);
    expect(isValidPostId("0")).toBe(false);
    expect(isValidPostId("2147483648")).toBe(false);
    expect(isValidPostId("abc")).toBe(false);
    expect(isValidPostId("01")).toBe(false);
  });
});

describe("PW posts API", () => {
  let assetsFetch: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cache: ReturnType<typeof makeCache>;
  let ctx: ReturnType<typeof makeCtx>;
  let consoleSpies: Array<ReturnType<typeof vi.spyOn>>;
  let consoleCalls: unknown[][];

  beforeEach(() => {
    assetsFetch = vi.fn(
      async () =>
        new Response(INDEX_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html", "Cache-Control": "public, s-maxage=60" },
        }),
    );
    fetchMock = vi.fn();
    cache = makeCache();
    ctx = makeCtx();
    consoleCalls = [];
    consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        consoleCalls.push(args);
      }),
    );
  });

  afterEach(() => {
    assertConsoleClean(consoleCalls);
    for (const s of consoleSpies) s.mockRestore();
    vi.restoreAllMocks();
  });

  async function call(
    path: string,
    init: RequestInit = {},
    envOverrides?: { postsKey?: string | null; dailyFixKey?: string },
    depsExtra: Record<string, unknown> = {},
  ) {
    const req = new Request(`https://metfix.org${path}`, init);
    return handleRequest(req, makeEnv(assetsFetch, envOverrides ?? {}), ctx, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      cachesDefault: cache,
      ...depsExtra,
    });
  }

  function mockListOk(posts: unknown[], total: number, metaExtra: Record<string, unknown> = {}) {
    fetchMock.mockResolvedValue(jsonRes(listUpstreamJson(posts, total, metaExtra)));
  }

  function mockDetailOk(post: unknown) {
    fetchMock.mockResolvedValue(jsonRes({ post }));
  }

  function clearCache() {
    cache.store.clear();
    cache.puts.length = 0;
    cache.matches.length = 0;
    ctx.pending.length = 0;
  }

  // ── PW1 ──────────────────────────────────────────────────────────
  it("PW1 GET /api/posts and /api/posts/ identical", async () => {
    mockListOk([unlockedItem(1)], 1);
    const a = await call("/api/posts");
    await flush(ctx);
    const aBody = await a.clone().text();
    const aHeaders = Object.fromEntries(a.headers);
    clearCache();
    fetchMock.mockClear();
    mockListOk([unlockedItem(1)], 1);
    const b = await call("/api/posts/");
    expect(a.status).toBe(200);
    expect(b.status).toBe(a.status);
    expect(await b.clone().text()).toBe(aBody);
    expect(Object.fromEntries(b.headers)).toEqual(aHeaders);
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(1));
  });

  // ── PW2 ──────────────────────────────────────────────────────────
  it("PW2 bad paths/ids → catch-all 404 byte-equal to /api/zzz", async () => {
    const zzz = await call("/api/zzz");
    const zzzBody = await zzz.clone().text();
    const zzzHeaders = Object.fromEntries(zzz.headers);
    expect(zzz.headers.get("Cache-Control")).toBeNull();
    const paths = [
      "/api/posts/1/unknown",
      "/api/posts/abc",
      "/api/posts/0",
      "/api/posts/2147483648",
      "/api/posts/01",
      "/api/posts/1/",
      "/api/posts//1",
      "/api/postsx",
      "/api/posts/1.json",
    ];
    for (const path of paths) {
      fetchMock.mockClear();
      cache.puts.length = 0;
      const res = await call(path);
      expect(res.status, path).toBe(zzz.status);
      expect(await res.text(), path).toBe(zzzBody);
      expect(Object.fromEntries(res.headers), path).toEqual(zzzHeaders);
      expect(fetchMock, path).toHaveBeenCalledTimes(0);
      expect(cache.puts.length, path).toBe(0);
    }
  });

  // ── PW3 ──────────────────────────────────────────────────────────
  it("PW3 non-GET → 405 Allow GET, HEAD on list and detail", async () => {
    for (const path of ["/api/posts", "/api/posts/1"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        fetchMock.mockClear();
        cache.puts.length = 0;
        const res = await call(path, { method });
        expect(res.status).toBe(405);
        expect(res.headers.get("Allow")).toBe("GET, HEAD");
        expect(fetchMock).toHaveBeenCalledTimes(0);
        expect(cache.puts.length).toBe(0);
        const body = await res.text();
        expect(body).not.toContain("brokenscience");
      }
    }
  });

  // ── PW4 ──────────────────────────────────────────────────────────
  it("PW4 HEAD /api/posts cold → same headers as GET, body 0, one fetch+put; warm GET hits", async () => {
    mockListOk([unlockedItem(1)], 1);
    const head = await call("/api/posts", { method: "HEAD" });
    await flush(ctx);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.puts.length).toBe(1);

    fetchMock.mockClear();
    const get = await call("/api/posts");
    expect(get.status).toBe(200);
    expect(Object.fromEntries(get.headers)).toEqual(
      expect.objectContaining({
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
        "x-content-type-options": "nosniff",
      }),
    );
    expect(Object.fromEntries(head.headers)).toEqual(Object.fromEntries(get.headers));
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("PW4 HEAD /api/posts/1 cold then GET hits", async () => {
    mockDetailOk(unlockedItem(1));
    const head = await call("/api/posts/1", { method: "HEAD" });
    await flush(ctx);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    const get = await call("/api/posts/1");
    expect(get.status).toBe(200);
    expect(Object.fromEntries(head.headers)).toEqual(Object.fromEntries(get.headers));
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("PW4 HEAD on 400/404/503 → same status/headers as GET, no body, no put", async () => {
    const h400 = await call("/api/posts?page=0", { method: "HEAD" });
    const g400 = await call("/api/posts?page=0");
    expect(h400.status).toBe(400);
    expect(await h400.text()).toBe("");
    expect(Object.fromEntries(h400.headers)).toEqual(Object.fromEntries(g400.headers));
    expect(cache.puts.length).toBe(0);

    fetchMock.mockResolvedValue(jsonRes({}, 404));
    const h404 = await call("/api/posts/9", { method: "HEAD" });
    fetchMock.mockResolvedValue(jsonRes({}, 404));
    const g404 = await call("/api/posts/9");
    expect(h404.status).toBe(404);
    expect(await h404.text()).toBe("");
    expect(Object.fromEntries(h404.headers)).toEqual(Object.fromEntries(g404.headers));
    expect(cache.puts.length).toBe(0);

    fetchMock.mockResolvedValue(jsonRes({}, 500));
    const h503 = await call("/api/posts", { method: "HEAD" });
    fetchMock.mockResolvedValue(jsonRes({}, 500));
    const g503 = await call("/api/posts");
    expect(h503.status).toBe(503);
    expect(await h503.text()).toBe("");
    expect(Object.fromEntries(h503.headers)).toEqual(Object.fromEntries(g503.headers));
    expect(cache.puts.length).toBe(0);
  });

  // ── PW5 ──────────────────────────────────────────────────────────
  it("PW5 Daily Fix /api/daily-fix still reachable (dispatch order)", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({
        date: "2026-10-04",
        belly: { title: "B", body: "", steps: "", macros: { fat: 0, carb: 0, protein: 0 }, photo_url: null, has_structured_ingredients: false, has_structured_steps: false, recipe_ingredients: [], recipe_steps: [] },
        body: { title: "", body: "", photo_url: null },
        brain: { title: "", body: "", photo_url: null },
      }),
    );
    const res = await call("/api/daily-fix?date=2026-10-04");
    // Must not 404 as catch-all; posts dispatch must not steal DF routes.
    expect(res.status).not.toBe(404);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("daily");
  });

  // ── PW6 ──────────────────────────────────────────────────────────
  it.each([
    ["absent", "/api/posts", 1],
    ["1", "/api/posts?page=1", 1],
    ["2", "/api/posts?page=2", 2],
    ["50", "/api/posts?page=50", 50],
  ] as const)("PW6 page %s → offset for page %s", async (_label, path, page) => {
    mockListOk([], 0);
    await call(path);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(page));
  });

  // ── PW7 ──────────────────────────────────────────────────────────
  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
    "51",
    "999",
    "",
    "01",
    "+1",
    "%31",
    "%201",
    "%20%201",
    "1%20",
    "1e1",
    "0x1",
    "2147483648",
  ])("PW7 bad page=%s → 400 bad_page no-store", async (raw) => {
    // Raw query string (Q1). Use percent-encoding for spaces so URL parser does not strip them.
    const path = raw === "" ? "/api/posts?page=" : `/api/posts?page=${raw}`;
    const res = await call(path);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_page" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(cache.puts.length).toBe(0);
  });

  it("PW7 repeated / bare / array page → 400", async () => {
    for (const path of ["/api/posts?page=1&page=2", "/api/posts?page", "/api/posts?page[]=1"]) {
      fetchMock.mockClear();
      const res = await call(path);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_page" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  // ── PW8 ──────────────────────────────────────────────────────────
  it("PW8 extra params ignored; upstream URL = page-2 PW10", async () => {
    mockListOk([], 0);
    await call(
      "/api/posts?page=2&limit=100&preview=false&per_page=100&offset=5&_fields=content&search=x&context=edit",
    );
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(2));
  });

  // ── PW9 ──────────────────────────────────────────────────────────
  it.each(["Page", "PAGE", "pAgE", "pageX", "page_", "pages", "page[]", "page[0]", "page.x", "PAGEs"])(
    "PW9 page-name prefix %s → 400",
    async (name) => {
      const res = await call(`/api/posts?${name}=1`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_page" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    },
  );

  it("PW9 page-prefix with valid page=2 still 400", async () => {
    const res = await call("/api/posts?page=2&pageX=1");
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("PW9 unrelated names containing page later are ignored", async () => {
    mockListOk([], 0);
    await call("/api/posts?page=2&xpage=1&homepage=1&_page=1");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(2));
  });

  // ── PW10 / PW10b ─────────────────────────────────────────────────
  it("PW10 exact list + detail URLs; PAGE_SIZE === 12", async () => {
    expect(PAGE_SIZE).toBe(12);
    mockListOk([], 0);
    await call("/api/posts?page=2");
    const listUrl = String(fetchMock.mock.calls[0]![0]);
    expect(listUrl).toBe(
      "https://brokenscience.org/wp-json/bsi/v1/posts?limit=12&offset=12&preview=true",
    );
    expect(listUrl).toContain("limit=12");
    expect(listUrl).not.toContain("per_page");
    expect(listUrl.endsWith("&")).toBe(false);

    fetchMock.mockClear();
    mockDetailOk(unlockedItem(5));
    await call("/api/posts/5");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://brokenscience.org/wp-json/bsi/v1/posts/5",
    );
  });

  it.each([
    [1, 10],
    [2, 100],
    [50, undefined],
    [1, 12],
  ] as const)("PW10b page %s meta.per_page=%s → body per_page=PAGE_SIZE", async (page, perPage) => {
    expect(PAGE_SIZE).toBe(12);
    const meta: Record<string, unknown> = { total: 0, has_more: true };
    if (perPage !== undefined) meta.per_page = perPage;
    fetchMock.mockResolvedValue(jsonRes({ posts: [], meta }));
    const res = await call(`/api/posts?page=${page}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["has_more", "page", "per_page", "posts"].sort());
    expect(body.per_page).toBe(PAGE_SIZE);
    expect(body.page).toBe(page);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(page));
  });

  // ── PW11 ─────────────────────────────────────────────────────────
  it("PW11 exactly 3 upstream headers; incoming never copied", async () => {
    mockListOk([], 0);
    await call("/api/posts", {
      headers: {
        Authorization: "Bearer abc",
        Cookie: "__Host-mfx_sid=s; wordpress_logged_in_x=y",
        "X-WP-Nonce": "n",
        "X-Forwarded-For": "1.2.3.4",
        "X-Real-IP": "1.2.3.4",
        "CF-Connecting-IP": "1.2.3.4",
        "True-Client-IP": "1.2.3.4",
        Forwarded: "for=1.2.3.4",
        Referer: "https://evil.example/",
        Origin: "https://evil.example",
        "X-API-Key": "attacker",
      },
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect([...headers.entries()]).toHaveLength(3);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-API-Key")).toBe(POSTS_KEY);
    expect(headers.get("User-Agent")).toBe("metfixhome-worker/1.0");
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("manual");
  });

  // ── PW12 ─────────────────────────────────────────────────────────
  it("PW12 AbortSignal.timeout(3000) once; signal passed to fetch", async () => {
    const fakeSignal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(fakeSignal);
    mockListOk([], 0);
    await call("/api/posts");
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(3000);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBe(fakeSignal);
    expect(init.redirect).toBe("manual");
    expect(init.method).toBe("GET");
    timeoutSpy.mockRestore();
  });

  // ── PW13 ─────────────────────────────────────────────────────────
  it("PW13 assertBsiHost runs on every posts upstream URL", async () => {
    clearCache();
    mockListOk([], 0);
    await call("/api/posts");
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(() => assertBsiHost(url)).not.toThrow();
    expect(url.startsWith("https://brokenscience.org/wp-json/bsi/v1/posts")).toBe(true);

    // PX9 runtime: bsiBaseUrl / baseUrl / host on deps must not change posts upstream.
    clearCache();
    fetchMock.mockClear();
    mockListOk([], 0);
    await call("/api/posts", {}, undefined, {
      bsiBaseUrl: "https://evil.example",
      baseUrl: "https://evil.example",
      host: "evil.example",
    });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(1));
  });

  // ── PW14 ─────────────────────────────────────────────────────────
  it("PW14 no key → 503; never uses DAILY_FIX; spaced key sent untrimmed", async () => {
    for (const postsKey of [null, "", "   ", "\t\n"] as const) {
      fetchMock.mockClear();
      const res = await call("/api/posts", {}, { postsKey, dailyFixKey: DF_KEY });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "unavailable" });
      expect(res.headers.get("Retry-After")).toBe("300");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
    fetchMock.mockClear();
    clearCache();
    mockListOk([], 0);
    await call("/api/posts", {}, { postsKey: " test-posts-key " });
    expect(fetchMock).toHaveBeenCalled();
    // Headers.get may trim — assert the raw init value is byte-exact (Q3).
    const rawHeaders = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(rawHeaders["X-API-Key"]).toBe(" test-posts-key ");
  });

  // ── PW15 ─────────────────────────────────────────────────────────
  it("PW15 dual-secret: posts uses test-posts-key only", async () => {
    mockListOk([unlockedItem(1)], 1);
    await call("/api/posts");
    const headers = new Headers((fetchMock.mock.calls[0]![1] as RequestInit).headers);
    expect(headers.get("X-API-Key")).toBe(POSTS_KEY);
    expect(headers.get("X-API-Key")).not.toBe(DF_KEY);
  });

  // ── PW16 ─────────────────────────────────────────────────────────
  it("PW16 no key/LOCK in body/headers; posts console shape", async () => {
    mockListOk([unlockedItem(1)], 1);
    const res = await call("/api/posts");
    await flush(ctx);
    assertNoSecretsOrLock(await res.clone().text());
    for (const [, v] of res.headers) assertNoSecretsOrLock(v);
    assertPostsHandlerConsole(consoleCalls.filter((a) => String(a[0] ?? "").startsWith("posts:")));
  });

  // ── PW17 ─────────────────────────────────────────────────────────
  it("PW17 detail upstream 404 → not_found max-age=60", async () => {
    fetchMock.mockResolvedValue(jsonRes({ code: "post_not_found" }, 404));
    const a = await call("/api/posts/5");
    expect(a.status).toBe(404);
    expect(await a.json()).toEqual({ error: "not_found" });
    expect(a.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(cache.puts.length).toBe(0);

    fetchMock.mockResolvedValue(jsonRes({ code: "rest_no_route" }, 404));
    const b = await call("/api/posts/6");
    expect(b.status).toBe(404);
    expect(await b.json()).toEqual({ error: "not_found" });
  });

  // ── PW18 ─────────────────────────────────────────────────────────
  it.each([
    [400, { code: "rest_invalid_param", message: "bad" }],
    [401, { code: "forbidden" }],
    [401, { code: "unauthorized" }],
    [403, { code: "forbidden" }],
    [429, { code: "rate_limited" }],
    [418, { message: "teapot" }],
    [500, { message: "err" }],
    [502, {}],
    [503, {}],
  ] as const)("PW18 upstream %s → 503 unavailable", async (status, body) => {
    fetchMock.mockResolvedValue(
      jsonRes(body, status, {
        "Retry-After": "5",
        "X-RateLimit-Limit": "60",
        "Set-Cookie": "x=1",
        Server: "nginx",
        "X-Powered-By": "PHP",
        Link: "<https://evil.example/>",
      }),
    );
    const res = await call("/api/posts/1");
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "unavailable" });
    expect(text).not.toContain("teapot");
    expect(text).not.toContain("bad");
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(cache.puts.length).toBe(0);
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Server")).toBeNull();
  });

  it("PW18 301/302 no follow; timeout; throw; bad JSON/HTML/null/array/string", async () => {
    for (const status of [301, 302]) {
      fetchMock.mockClear();
      cache.puts.length = 0;
      fetchMock.mockResolvedValue(
        new Response(null, { status, headers: { Location: "https://evil.example/" } }),
      );
      const res = await call("/api/posts/1");
      expect(res.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cache.puts.length).toBe(0);
    }

    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    expect((await call("/api/posts/1")).status).toBe(503);

    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect((await call("/api/posts/1")).status).toBe(503);

    fetchMock.mockResolvedValueOnce(new Response("{not-json", { status: 200 }));
    expect((await call("/api/posts/1")).status).toBe(503);

    fetchMock.mockResolvedValueOnce(
      new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    );
    expect((await call("/api/posts/1")).status).toBe(503);

    for (const body of [null, [], "x"]) {
      fetchMock.mockClear();
      fetchMock.mockResolvedValueOnce(jsonRes(body));
      expect((await call("/api/posts/1")).status).toBe(503);
    }
  });

  // ── PW19 / PW20 ──────────────────────────────────────────────────
  it("PW19 list upstream 404 → 503", async () => {
    fetchMock.mockResolvedValue(jsonRes({}, 404));
    const res = await call("/api/posts");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(cache.puts.length).toBe(0);
  });

  it("PW20 upstream hop-by-hop headers never appear", async () => {
    mockListOk([unlockedItem(1)], 1);
    fetchMock.mockResolvedValueOnce(
      jsonRes(listUpstreamJson([unlockedItem(1)], 1), 200, {
        "X-RateLimit-Remaining": "1",
        "Set-Cookie": "a=b",
        Server: "s",
        "X-Powered-By": "p",
        Link: "<x>",
      }),
    );
    const res = await call("/api/posts");
    expect(res.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Server")).toBeNull();
    expect(res.headers.get("X-Powered-By")).toBeNull();
    expect(res.headers.get("Link")).toBeNull();
  });

  // ── PW21 / PW22 ──────────────────────────────────────────────────
  it("PW21 happy path exact key sets; per_page=12; has_more false", async () => {
    expect(PAGE_SIZE).toBe(12);
    const posts = [unlockedItem(1), unlockedItem(2), unlockedItem(3)];
    mockListOk(posts, 3);
    const res = await call("/api/posts");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      posts: Array<Record<string, unknown>>;
      page: number;
      per_page: number;
      has_more: boolean;
    };
    expect(Object.keys(body).sort()).toEqual(["has_more", "page", "per_page", "posts"].sort());
    expect(body.page).toBe(1);
    expect(body.per_page).toBe(12);
    expect(body.has_more).toBe(false);
    expect(body.posts).toHaveLength(3);
    for (const p of body.posts) {
      expect(Object.keys(p).sort()).toEqual(
        ["author", "category", "date", "excerpt", "id", "image", "title"].sort(),
      );
    }
    expect(isPostListBody(body)).toBe(true);
  });

  it("PW22 never forwards video/content/access sentinels", async () => {
    const item = unlockedItem(1, {
      video: "VID-SENT",
      content: "CONTENT-SENT",
      content_types: ["x"],
      access_levels: [],
      content_access_display: {
        has_content_access: false,
        is_exclusive: false,
        access: "full",
        content_access_display: "CAD-SENT",
      },
      comment_count: 99,
      featured_image_srcset: "SRCSET-SENT",
      permalink: "https://brokenscience.org/x",
      author: { id: 42, name: "A" },
    });
    mockListOk([item], 1);
    const text = await (await call("/api/posts")).text();
    for (const s of ["VID-SENT", "CONTENT-SENT", "CAD-SENT", "SRCSET-SENT", "permalink", "video", "content_types"]) {
      expect(text).not.toContain(s === "permalink" ? '"permalink"' : s);
    }
    expect(text).not.toContain('"id":42');
  });

  // ── PW23 ─────────────────────────────────────────────────────────
  it.each([
    [24, 1, true],
    [24, 2, false],
    [25, 2, true],
    [12, 1, false],
    [13, 1, true],
    [0, 1, false],
    [10000, 49, true],
    [10000, 50, false],
    [11, 1, false],
  ] as const)("PW23 has_more total=%s page=%s → %s", async (total, page, expected) => {
    expect(PAGE_SIZE).toBe(12);
    mockListOk(total === 0 ? [] : [unlockedItem(1)], total);
    const res = await call(`/api/posts?page=${page}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { has_more: boolean }).has_more).toBe(expected);
  });

  it("PW23 ignores meta.has_more; invalid total → 503", async () => {
    clearCache();
    mockListOk([unlockedItem(1)], 12, { has_more: true });
    expect(((await (await call("/api/posts")).json()) as { has_more: boolean }).has_more).toBe(false);

    clearCache();
    mockListOk([unlockedItem(1)], 25, { has_more: false });
    expect(((await (await call("/api/posts")).json()) as { has_more: boolean }).has_more).toBe(true);

    for (const total of ["24", "0", true, false, null, [], [24], "", -1, -12, -0.5, 1.5]) {
      fetchMock.mockClear();
      clearCache();
      fetchMock.mockResolvedValue(jsonRes({ posts: [], meta: { total, per_page: 10 } }));
      const res = await call("/api/posts");
      expect(res.status, String(total)).toBe(503);
      expect(await res.json()).toEqual({ error: "unavailable" });
      expect(cache.puts.length).toBe(0);
    }

    clearCache();
    fetchMock.mockResolvedValue(jsonRes({ posts: [], meta: { per_page: 10 } }));
    expect((await call("/api/posts")).status).toBe(503);
  });

  // ── PW24 / PW25 / PW26 / PW27 / PW44 ─────────────────────────────
  it("PW24 drops bad items; keeps valid siblings", async () => {
    const posts = [
      null,
      1,
      "x",
      [],
      unlockedItem(0),
      unlockedItem(-1),
      { ...unlockedItem(1), id: "5" },
      { ...unlockedItem(1), id: 1.5 },
      { ...unlockedItem(1), title: "" },
      { ...unlockedItem(1), title: "a".repeat(201) },
      { ...unlockedItem(1), date: "not-a-date" },
      unlockedItem(99, { title: "Keep" }),
    ];
    mockListOk(posts, 12);
    const body = (await (await call("/api/posts")).json()) as { posts: Array<{ id: number }> };
    expect(body.posts.map((p) => p.id)).toEqual([99]);
  });

  it("PW25 field transforms via Worker", async () => {
    const excerpt500 = "é".repeat(499) + "𐍈" + "Z"; // 501 code points
    mockListOk(
      [
        unlockedItem(1, {
          title: "  Trimmed  ",
          excerpt: "<p>Hi <b>x</b></p>",
          date: "2026-10-19T10:00:00+02:00",
          author: { name: "A" },
          categories: [{ name: "News", slug: "news" }],
        }),
        unlockedItem(2, {
          excerpt: "&lt;script&gt;",
          author: undefined,
          categories: [],
        }),
        unlockedItem(3, { excerpt: "&amp;lt;" }),
        unlockedItem(4, { excerpt: excerpt500 }),
      ],
      4,
    );
    const body = (await (await call("/api/posts")).json()) as {
      posts: Array<{ title: string; excerpt: string; date: string; author: string | null; category: { name: string; slug: string } | null }>;
    };
    expect(body.posts[0]!.title).toBe("Trimmed");
    expect(body.posts[0]!.excerpt).toBe("Hi x");
    expect(body.posts[0]!.date).toBe("2026-10-19T08:00:00.000Z");
    expect(body.posts[0]!.author).toBe("A");
    expect(body.posts[0]!.category).toEqual({ name: "News", slug: "news" });
    expect(body.posts[1]!.excerpt).toBe("<script>");
    expect(body.posts[1]!.author).toBeNull();
    expect(body.posts[1]!.category).toBeNull();
    expect(body.posts[2]!.excerpt).toBe("&lt;");
    expect(Array.from(body.posts[3]!.excerpt)).toHaveLength(500);
    expect(body.posts[3]!.excerpt.endsWith("Z")).toBe(false);
  });

  it("PW26 unmappable → 503; empty page ok; N4a locked-drop pages", async () => {
    fetchMock.mockResolvedValue(jsonRes({ posts: "nope", meta: { total: 0, per_page: 10 } }));
    expect((await call("/api/posts")).status).toBe(503);

    fetchMock.mockResolvedValue(jsonRes({ posts: [], meta: "nope" }));
    expect((await call("/api/posts")).status).toBe(503);

    fetchMock.mockResolvedValue(jsonRes("x"));
    expect((await call("/api/posts")).status).toBe(503);

    mockListOk([], 0);
    const empty = (await (await call("/api/posts?page=3")).json()) as Record<string, unknown>;
    expect(empty).toEqual({ posts: [], page: 3, per_page: 12, has_more: false });

    // N4a (i): page 2, total 13, one locked → empty, has_more false
    mockListOk([lockedItem(1)], 13);
    const n4a = (await (await call("/api/posts?page=2")).json()) as {
      posts: unknown[];
      page: number;
      per_page: number;
      has_more: boolean;
    };
    expect(n4a).toEqual({ posts: [], page: 2, per_page: 12, has_more: false });
    assertNoSecretsOrLock(JSON.stringify(n4a));

    // N4a (ii): page 1, total 13, 12 locked → empty, has_more true
    mockListOk(
      Array.from({ length: 12 }, (_, i) => lockedItem(i + 1)),
      13,
    );
    const n4b = (await (await call("/api/posts")).json()) as {
      posts: unknown[];
      has_more: boolean;
      page: number;
      per_page: number;
    };
    expect(n4b).toEqual({ posts: [], page: 1, per_page: 12, has_more: true });
    assertNoSecretsOrLock(JSON.stringify(n4b));
  });

  it("PW27 duplicate ids keep first", async () => {
    const posts = [5, 7, 5, 9, 7].map((id, i) => unlockedItem(id, { title: `T${id}-${i}` }));
    mockListOk(posts, 5);
    const body = (await (await call("/api/posts")).json()) as {
      posts: Array<{ id: number; title: string }>;
    };
    expect(body.posts.map((p) => p.id)).toEqual([5, 7, 9]);
    expect(body.posts.map((p) => p.title)).toEqual(["T5-0", "T7-1", "T9-3"]);
  });

  it("PW44 order preserved with drop + duplicate", async () => {
    clearCache();
    const ordered = [9, 3, 12, 1, 7].map((id) => unlockedItem(id));
    ordered[1] = lockedItem(3);
    ordered.push(unlockedItem(9, { title: "dup" }));
    mockListOk(ordered, 6);
    const body2 = (await (await call("/api/posts")).json()) as { posts: Array<{ id: number }> };
    expect(body2.posts.map((p) => p.id)).toEqual([9, 12, 1, 7]);
  });

  // ── PW28–PW34 ────────────────────────────────────────────────────
  it("PW28 detail happy path key set + sanitized content", async () => {
    mockDetailOk(
      unlockedItem(5, {
        content: `<p>Hi</p><script>alert(1)</script>`,
        permalink: "https://brokenscience.org/x",
      }),
    );
    const res = await call("/api/posts/5");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { post: Record<string, unknown> };
    expect(Object.keys(body).sort()).toEqual(["post"]);
    expect(Object.keys(body.post).sort()).toEqual(
      [
        "access",
        "author",
        "categories",
        "category",
        "content",
        "content_types",
        "date",
        "excerpt",
        "id",
        "image",
        "locked",
        "permalink",
        "title",
        "topics",
        "video",
      ].sort(),
    );
    expect(String(body.post.content)).toContain("<p>");
    expect(String(body.post.content)).not.toContain("alert");
    expect(isPostDetailBody(body)).toBe(true);
  });

  it.each([
    ["https://brokenscience.org/x", "https://brokenscience.org/x"],
    ["https://brokenscience.org", "https://brokenscience.org/"],
    ["https://BROKENSCIENCE.ORG/x", "https://brokenscience.org/x"],
  ] as const)("PW29 permalink kept %s", async (raw, expected) => {
    mockDetailOk(unlockedItem(1, { permalink: raw }));
    const body = (await (await call("/api/posts/1")).json()) as { post: { permalink: string | null } };
    expect(body.post.permalink).toBe(expected);
  });

  it.each([
    "http://brokenscience.org/x",
    "https://www.brokenscience.org/x",
    "https://a.brokenscience.org/x",
    "https://brokenscience.org:443/x",
    "https://brokenscience.org:8443/x",
    "https://u:p@brokenscience.org/x",
    "https://brokenscience.org.evil.com/x",
    "https://evil.com/?brokenscience.org",
    "https://brokenscience.org./x",
    "javascript:alert(1)",
    "data:text/html,x",
    "//brokenscience.org/x",
    "/x",
    "",
  ])("PW29 permalink null for %s", async (raw) => {
    mockDetailOk(unlockedItem(1, { permalink: raw }));
    const body = (await (await call("/api/posts/1")).json()) as { post: { permalink: string | null } };
    expect(body.post.permalink).toBeNull();
  });

  it("PW29 missing/non-string permalink → null; list never emits permalink", async () => {
    mockDetailOk(unlockedItem(1, { permalink: undefined }));
    expect(
      ((await (await call("/api/posts/1")).json()) as { post: { permalink: null } }).post.permalink,
    ).toBeNull();
    mockDetailOk(unlockedItem(1, { permalink: 1 as unknown as string }));
    expect(
      ((await (await call("/api/posts/1")).json()) as { post: { permalink: null } }).post.permalink,
    ).toBeNull();
    mockListOk([unlockedItem(1)], 1);
    expect(await (await call("/api/posts")).text()).not.toContain('"permalink"');
  });

  it("PW30 D8 table: locked dropped / unlocked kept; LOCK absent", async () => {
    const dropCases: Array<Record<string, unknown>> = [
      { access_levels: undefined },
      { access_levels: null },
      { access_levels: {} },
      { access_levels: ["x"] },
      { access_levels: [""] },
      { content_access_display: undefined },
      { content_access_display: null },
      { content_access_display: [] },
      { content_access_display: "full" },
      {
        content_access_display: {
          has_content_access: true,
          is_exclusive: false,
          access: "full",
        },
      },
      {
        content_access_display: {
          has_content_access: "false",
          is_exclusive: false,
          access: "full",
        },
      },
      {
        content_access_display: {
          is_exclusive: false,
          access: "full",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: true,
          access: "full",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: "false",
          access: "full",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          access: "full",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: false,
          access: "preview",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: false,
          access: "none",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: false,
          access: "Full",
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: false,
        },
      },
      {
        content_access_display: {
          has_content_access: false,
          is_exclusive: false,
          access: null,
        },
      },
      {
        // expired exclusive still flagged
        content_access_display: {
          has_content_access: false,
          is_exclusive: true,
          access: "full",
        },
      },
      {
        access_levels: ["x"],
        content_access_display: {
          has_content_access: false,
          is_exclusive: false,
          access: "full",
        },
      },
    ];

    for (const [i, overrides] of dropCases.entries()) {
      const item = lockedItem(100 + i, overrides);
      fetchMock.mockClear();
      clearCache();
      mockListOk([item], 1);
      const list = await call("/api/posts");
      const listJson = await list.json();
      expect((listJson as { posts: unknown[] }).posts, `drop list ${i}`).toHaveLength(0);
      assertNoSecretsOrLock(JSON.stringify(listJson));

      clearCache();
      mockDetailOk(item);
      const detail = await call(`/api/posts/${100 + i}`);
      expect(detail.status, `drop detail ${i}`).toBe(404);
      const detailText = await detail.text();
      expect(JSON.parse(detailText)).toEqual({ error: "not_found" });
      expect(detail.headers.get("Cache-Control")).toBe("public, max-age=60");
      assertNoSecretsOrLock(detailText);
      expect(cache.puts.length).toBe(0);
    }

    // Expired exclusive reported unlocked → kept
    const expiredUnlocked = unlockedItem(200, {
      content_access_display: {
        has_content_access: false,
        is_exclusive: false,
        access: "full",
        access_group_labels: ["Members"],
        show_same: 1,
        has_preview: true,
      },
    });
    mockListOk([expiredUnlocked], 1);
    const kept = (await (await call("/api/posts")).json()) as { posts: Array<{ id: number }> };
    expect(kept.posts.map((p) => p.id)).toEqual([200]);
    mockDetailOk(expiredUnlocked);
    expect((await call("/api/posts/200")).status).toBe(200);

    // Control unlocked
    mockListOk([unlockedItem(201)], 1);
    expect(
      ((await (await call("/api/posts")).json()) as { posts: unknown[] }).posts,
    ).toHaveLength(1);
  });

  it("PW31 filter before cache: locked not in put; locked detail put=0", async () => {
    mockListOk([unlockedItem(1), lockedItem(2)], 2);
    await call("/api/posts");
    await flush(ctx);
    expect(cache.puts.length).toBe(1);
    const putText = await cache.puts[0]!.res.text();
    assertNoSecretsOrLock(putText);
    expect(putText).not.toContain('"id":2');

    cache.puts.length = 0;
    mockDetailOk(lockedItem(8));
    const res = await call("/api/posts/8");
    expect(res.status).toBe(404);
    expect(cache.puts.length).toBe(0);
  });

  it("PW32 locked and upstream-404 identical; differ from catch-all", async () => {
    clearCache();
    mockDetailOk(lockedItem(8));
    const locked = await call("/api/posts/8");
    const lockedText = await locked.clone().text();
    const lockedHeaders = Object.fromEntries(locked.headers);
    fetchMock.mockResolvedValue(jsonRes({}, 404));
    const missing = await call("/api/posts/9");
    expect(locked.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await missing.clone().text()).toBe(lockedText);
    expect(Object.fromEntries(missing.headers)).toEqual(lockedHeaders);
    expect(locked.headers.get("Cache-Control")).toBe("public, max-age=60");

    const catchAll = await call("/api/posts/abc");
    expect(catchAll.status).toBe(404);
    // Classes differ: posts not_found is cacheable; catch-all has no Cache-Control (PW2).
    expect(catchAll.headers.get("Cache-Control")).toBeNull();
    expect(Object.fromEntries(catchAll.headers)).not.toEqual(lockedHeaders);
  });

  it("PW33 empty content after sanitize → 200 content:\"\"", async () => {
    mockDetailOk(unlockedItem(1, { content: "<script>x</script>" }));
    const body = (await (await call("/api/posts/1")).json()) as { post: { content: string } };
    expect(body.post.content).toBe("");
  });

  it("PW34 detail {} / {post:null} / {post:[]} → 503", async () => {
    for (const body of [{}, { post: null }, { post: [] }]) {
      fetchMock.mockClear();
      fetchMock.mockResolvedValue(jsonRes(body));
      expect((await call("/api/posts/1")).status).toBe(503);
    }
  });

  // ── PW35 / PW43 ──────────────────────────────────────────────────
  it("PW35 featured_image allowlist", async () => {
    clearCache();
    mockListOk(
      [unlockedItem(1, { featured_image: "https://brokenscience.org/wp-content/uploads/a.jpg" })],
      1,
    );
    const ok = (await (await call("/api/posts")).json()) as { posts: Array<{ image: string | null }> };
    expect(ok.posts[0]!.image).toBe("https://brokenscience.org/wp-content/uploads/a.jpg");

    const bad = [
      "https://cdn.brokenscience.org/a.jpg",
      "http://brokenscience.org/a.jpg",
      "https://u:p@brokenscience.org/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,xx",
      "//brokenscience.org/a.jpg",
      "not a url",
      "",
    ];
    for (const featured_image of bad) {
      clearCache();
      mockListOk([unlockedItem(1, { featured_image })], 1);
      const body = (await (await call("/api/posts")).json()) as {
        posts: Array<{ image: string | null }>;
      };
      expect(body.posts[0]!.image, featured_image).toBeNull();
    }
  });

  it("PW43 image host lookalikes → null; BrokenScience.ORG kept", async () => {
    const bad = [
      "https://brokenscience.org.evil.com/a.jpg",
      "https://evilbrokenscience.org/a.jpg",
      "https://brokenscience.org@evil.com/a.jpg",
      "https://evil.com@brokenscience.org/a.jpg",
      "https://brokenscience.org./a.jpg",
      "https://brokenscience.org:443/a.jpg",
      "https://brokenscience.org:8443/a.jpg",
      "https://www.brokenscience.org/a.jpg",
    ];
    for (const featured_image of bad) {
      clearCache();
      mockListOk([unlockedItem(1, { featured_image })], 1);
      const body = (await (await call("/api/posts")).json()) as {
        posts: Array<{ image: string | null }>;
      };
      expect(body.posts[0]!.image, featured_image).toBeNull();
    }
    clearCache();
    mockListOk(
      [unlockedItem(1, { featured_image: "https://BrokenScience.ORG/a.jpg" })],
      1,
    );
    const ok = (await (await call("/api/posts")).json()) as { posts: Array<{ image: string | null }> };
    expect(ok.posts[0]!.image).toBe("https://brokenscience.org/a.jpg");
  });

  // ── PW36–PW41 / PW45 / PW46 ──────────────────────────────────────
  it("PW36 cache keys synthetic; absent page = page=1", async () => {
    mockListOk([unlockedItem(1)], 1);
    await call("/api/posts?page=2&x=1");
    await flush(ctx);
    expect(cache.puts[0]?.key).toBe("https://metfix.org/__cache/v2/posts/list?page=2");

    cache.puts.length = 0;
    mockListOk([unlockedItem(1)], 1);
    await call("/api/posts");
    await flush(ctx);
    expect(cache.puts[0]?.key).toBe("https://metfix.org/__cache/v2/posts/list?page=1");

    cache.puts.length = 0;
    mockDetailOk(unlockedItem(5));
    await call("/api/posts/5");
    await flush(ctx);
    expect(cache.puts[0]?.key).toBe("https://metfix.org/__cache/v2/posts/5");
  });

  it("PW37 stored s-maxage; client headers = apiOkHeaders", async () => {
    mockListOk([unlockedItem(1)], 1);
    const res = await call("/api/posts");
    await flush(ctx);
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(cache.puts[0]!.res.headers.get("Cache-Control")).toBe("s-maxage=300");

    cache.puts.length = 0;
    mockDetailOk(unlockedItem(1));
    await call("/api/posts/1");
    await flush(ctx);
    expect(cache.puts[0]!.res.headers.get("Cache-Control")).toBe("s-maxage=600");
  });

  it("PW38 second identical request is cache hit", async () => {
    mockListOk([unlockedItem(1)], 1);
    const a = await call("/api/posts");
    await flush(ctx);
    const aText = await a.text();
    fetchMock.mockClear();
    const b = await call("/api/posts");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(await b.text()).toBe(aText);
  });

  it("PW39 400/404/503/405 never put", async () => {
    expect((await call("/api/posts?page=0")).status).toBe(400);
    expect(cache.puts.length).toBe(0);
    fetchMock.mockResolvedValue(jsonRes({}, 404));
    expect((await call("/api/posts/9")).status).toBe(404);
    expect(cache.puts.length).toBe(0);
    fetchMock.mockResolvedValue(jsonRes({}, 500));
    expect((await call("/api/posts")).status).toBe(503);
    expect(cache.puts.length).toBe(0);
    expect((await call("/api/posts", { method: "POST" })).status).toBe(405);
    expect(cache.puts.length).toBe(0);
  });

  it("PW40 corrupt cache entry refetched; guards shared", async () => {
    expect(isPostListBody).toBeTypeOf("function");
    expect(isPostDetailBody).toBeTypeOf("function");
    await cache.put(
      "https://metfix.org/__cache/v2/posts/list?page=1",
      new Response(JSON.stringify({ posts: [], page: 1, per_page: 12 }), {
        status: 200,
      }),
    );
    mockListOk([], 0);
    await call("/api/posts");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Extra key
    fetchMock.mockClear();
    await cache.put(
      "https://metfix.org/__cache/v2/posts/list?page=1",
      new Response(
        JSON.stringify({ posts: [], page: 1, per_page: 12, has_more: false, extra: 1 }),
        { status: 200 },
      ),
    );
    mockListOk([], 0);
    await call("/api/posts");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("PW41 API put via waitUntil; HTML miss awaits put", async () => {
    clearCache();
    // Defer cache.put so API response can resolve before the store is written.
    let resolvePut!: () => void;
    const putGate = new Promise<void>((r) => {
      resolvePut = r;
    });
    const origPut = cache.put.bind(cache);
    cache.put = async (request: RequestInfo, response: Response) => {
      await putGate;
      return origPut(request, response);
    };

    mockListOk([unlockedItem(1)], 1);
    const waitSpy = vi.spyOn(ctx, "waitUntil");
    const apiRes = await call("/api/posts");
    expect(apiRes.status).toBe(200);
    expect(waitSpy).toHaveBeenCalled();
    expect(cache.store.has("https://metfix.org/__cache/v2/posts/list?page=1")).toBe(false);
    resolvePut();
    await flush(ctx);
    expect(cache.store.has("https://metfix.org/__cache/v2/posts/list?page=1")).toBe(true);

    // Restore immediate put for HTML path assertion.
    cache.put = origPut;
    clearCache();
    waitSpy.mockClear();
    const waitUntilCountBefore = waitSpy.mock.calls.length;
    mockDetailOk(unlockedItem(5));
    const html = await call("/posts/5", { headers: { Accept: "text/html" } });
    expect(html.status).toBe(200);
    // HTML path awaits put — entry present when response resolves
    expect(cache.store.has("https://metfix.org/__cache/v2/posts/5")).toBe(true);
    // waitUntil not used for the HTML put (count unchanged for put)
    expect(waitSpy.mock.calls.length).toBe(waitUntilCountBefore);
  });

  it("PW45 concurrent list misses; no error bodies stored", async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => {
      const i = n++;
      if (i === 0) {
        return jsonRes({}, 503);
      }
      return jsonRes(listUpstreamJson([unlockedItem(1)], 1));
    });
    const results = await Promise.all([
      call("/api/posts"),
      call("/api/posts"),
      call("/api/posts"),
      call("/api/posts"),
      call("/api/posts"),
    ]);
    await flush(ctx);
    for (const r of results) {
      expect([200, 503]).toContain(r.status);
    }
    for (const p of cache.puts) {
      const t = await p.res.clone().text();
      expect(t).not.toContain('"error"');
      assertNoSecretsOrLock(t);
      expect(JSON.parse(t)).toEqual(
        expect.objectContaining({ posts: expect.any(Array), per_page: 12 }),
      );
    }
  });

  it("PW46 HTML then API same id → exactly 1 upstream; reverse; list; warm HTML", async () => {
    // (a) HTML then API detail
    mockDetailOk(unlockedItem(5));
    const html = await call("/posts/5", { headers: { Accept: "text/html" } });
    expect(html.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const cached = cache.store.get("https://metfix.org/__cache/v2/posts/5");
    expect(cached).toBeTruthy();
    const cachedText = await cached!.clone().text();
    fetchMock.mockClear();
    const api = await call("/api/posts/5");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(await api.text()).toBe(cachedText);

    // (b) reverse: API then HTML
    cache.store.clear();
    cache.puts.length = 0;
    mockDetailOk(unlockedItem(6));
    await call("/api/posts/6");
    await flush(ctx);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    const html2 = await call("/posts/6", { headers: { Accept: "text/html" } });
    expect(html2.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    // (c) list HTML then API page=2
    cache.store.clear();
    cache.puts.length = 0;
    fetchMock.mockClear();
    mockListOk([unlockedItem(1)], 1);
    await call("/posts?page=2", { headers: { Accept: "text/html" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(2));
    fetchMock.mockClear();
    await call("/api/posts?page=2");
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(cache.store.has("https://metfix.org/__cache/v2/posts/list?page=2")).toBe(true);

    // (d) warm HTML → 0 upstream
    fetchMock.mockClear();
    await call("/posts?page=2", { headers: { Accept: "text/html" } });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  // ── PW42 ─────────────────────────────────────────────────────────
  it("PW42 size cap: oversize → 503; stream cancel; multi-byte", async () => {
    expect(MAX_UPSTREAM_BYTES).toBe(1048576);
    clearCache();

    let cancelled = false;
    let pullCount = 0;
    const chunk = new Uint8Array(64 * 1024);
    chunk.fill(0x61);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount++;
        // Keep producing until the reader cancels past the cap.
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(stream, { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const res = await call("/api/posts");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(cache.puts.length).toBe(0);
    expect(cancelled).toBe(true);
    expect(pullCount).toBeGreaterThan(1);

    // Multi-byte chars crossing the limit by bytes
    cancelled = false;
    const euro = new TextEncoder().encode("€"); // 3 bytes
    const multi = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(euro);
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(multi, { status: 200 }));
    expect((await call("/api/posts/1")).status).toBe(503);
    expect(cancelled).toBe(true);
  });

  it("PW42 exactly MAX_UPSTREAM_BYTES of valid JSON → 200", async () => {
    clearCache();
    const item = unlockedItem(1);
    const payload = JSON.stringify(listUpstreamJson([item], 1));
    const encoder = new TextEncoder();
    const base = encoder.encode(payload);
    expect(base.byteLength).toBeLessThan(MAX_UPSTREAM_BYTES);
    // Pad inside a JSON string field so the body stays valid JSON at exact cap.
    const padNeed = MAX_UPSTREAM_BYTES - base.byteLength;
    const paddedItem = unlockedItem(1, {
      title: `Post 1${"x".repeat(Math.max(0, padNeed))}`,
    });
    // title max is 200 — instead pad via a ignored upstream-only field that JSON still counts.
    const raw = JSON.stringify({
      posts: [item],
      meta: { total: 1, per_page: 10, has_more: false },
      _pad: "y".repeat(Math.max(0, MAX_UPSTREAM_BYTES - encoder.encode(JSON.stringify({
        posts: [item],
        meta: { total: 1, per_page: 10, has_more: false },
        _pad: "",
      })).byteLength)),
    });
    expect(encoder.encode(raw).byteLength).toBe(MAX_UPSTREAM_BYTES);
    fetchMock.mockResolvedValueOnce(
      new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const res = await call("/api/posts");
    expect(res.status).toBe(200);
    void paddedItem;
  });

  // ── PS Worker-pass (detail content) ──────────────────────────────
  it("PS1–PS7 Worker-pass: sanitize on detail content", async () => {
    mockDetailOk(
      unlockedItem(1, {
        content: [
          "<p>a</p><h2>b</h2><h1>H1</h1><div>D</div>",
          "<script>SENTINEL-script</script>",
          '<p onclick="x" class="c" style="color:red">p</p>',
          '<a href="javascript:alert(1)">x</a>',
          '<a href="https://evil.example/x">ext</a>',
          '<img src="https://brokenscience.org/a.jpg" onerror="x">',
          '<img src="http://brokenscience.org/a.jpg">',
          "<!-- comment -->",
        ].join(""),
      }),
    );
    const body = (await (await call("/api/posts/1")).json()) as { post: { content: string } };
    const c = body.post.content;
    expect(c).toContain("<p>");
    expect(c).toContain("<h2>");
    expect(c).not.toContain("<h1>");
    expect(c).not.toContain("<div>");
    expect(c).not.toContain("SENTINEL-script");
    expect(c).not.toContain("onclick");
    expect(c).not.toContain("javascript:");
    expect(c).toContain('rel="noopener noreferrer nofollow"');
    expect(c).toContain('loading="lazy"');
    expect(c).toContain('referrerpolicy="no-referrer"');
    expect(c).not.toContain("http://brokenscience.org");
    expect(c).not.toContain("<!--");
  });

  it("PS8 title/excerpt are plain strings in JSON (not HTML sink)", async () => {
    mockListOk(
      [unlockedItem(1, { title: '<img src=x onerror=alert(1)>', excerpt: "<b>Hi</b>" })],
      1,
    );
    const body = (await (await call("/api/posts")).json()) as {
      posts: Array<{ title: string; excerpt: string }>;
    };
    expect(body.posts[0]!.title).toBe('<img src=x onerror=alert(1)>');
    expect(body.posts[0]!.excerpt).toBe("Hi");
  });

  // ── PH via handleRequest (unit / polyfill) ───────────────────────
  it("PH2 non-GET and Accept:json → ASSETS; no upstream", async () => {
    const res = await call("/posts", {
      method: "POST",
      headers: { Accept: "text/html" },
    });
    // Non-GET on HTML path falls through to ASSETS in index
    expect(assetsFetch).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(0);

    assetsFetch.mockClear();
    const res2 = await call("/posts", { headers: { Accept: "application/json" } });
    expect(res2.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("PH3 list head exact strings; s-maxage stripped", async () => {
    mockListOk([unlockedItem(1)], 1);
    const res = await call("/posts", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Posts — MetFix</title>");
    expect(html).toContain('content="Articles from Broken Science."');
    expect(html).toContain('content="noindex, follow"');
    expect(html).not.toMatch(/<link[^>]+rel="canonical"/);
    expect(html).toContain('content="website"');
    expect(html).toContain("https://metfix.org/social-preview.jpg");
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("PH4 invalid page HTML → page-1 head, never 400", async () => {
    for (const q of ["abc", "51", "0"]) {
      clearCache();
      fetchMock.mockClear();
      mockListOk([unlockedItem(1)], 1);
      const res = await call(`/posts?page=${q}`, { headers: { Accept: "text/html" } });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("<title>Posts — MetFix</title>");
      expect(fetchMock).toHaveBeenCalled();
      expect(String(fetchMock.mock.calls[0]![0])).toBe(listPageUrl(1));
    }
  });

  it("PH5 detail with permalink head", async () => {
    mockDetailOk(
      unlockedItem(5, {
        title: "Hello",
        excerpt: "World excerpt here",
        permalink: "https://brokenscience.org/hello",
        featured_image: "https://brokenscience.org/a.jpg",
      }),
    );
    const res = await call("/posts/5", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Hello — MetFix</title>");
    expect(html).toContain('content="index, follow"');
    expect(html).toContain('href="https://brokenscience.org/hello"');
    expect(html).toContain('content="article"');
    expect(html).toContain("https://brokenscience.org/a.jpg");
  });

  it("PH6 detail without permalink → noindex, og:url posts/id", async () => {
    mockDetailOk(unlockedItem(5, { permalink: "http://brokenscience.org/x", title: "T" }));
    const html = await (await call("/posts/5", { headers: { Accept: "text/html" } })).text();
    expect(html).toContain('content="noindex, follow"');
    expect(html).not.toMatch(/<link[^>]+rel="canonical"/);
    expect(html).toContain('content="https://metfix.org/posts/5"');
  });

  it("PH7 escaping in head", async () => {
    mockDetailOk(
      unlockedItem(5, {
        title: `"><script>x</script>`,
        excerpt: `a " b < c & d`,
        permalink: null,
      }),
    );
    const html = await (await call("/posts/5", { headers: { Accept: "text/html" } })).text();
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain('"><script>x</script>');
  });

  it("PH8 og:image allowlisted else fallback; cdn → fallback", async () => {
    mockDetailOk(
      unlockedItem(5, {
        featured_image: "https://cdn.brokenscience.org/a.jpg",
        permalink: "https://brokenscience.org/x",
      }),
    );
    const html = await (await call("/posts/5", { headers: { Accept: "text/html" } })).text();
    expect(html).toContain("https://metfix.org/social-preview.jpg");
    expect(html).not.toContain("cdn.brokenscience.org");
  });

  it("PH9 upstream 404 / locked / invalid id → 404; invalid no upstream", async () => {
    const invalid = await call("/posts/abc", { headers: { Accept: "text/html" } });
    expect(invalid.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    fetchMock.mockResolvedValue(jsonRes({}, 404));
    const missing = await call("/posts/9", { headers: { Accept: "text/html" } });
    expect(missing.status).toBe(404);

    mockDetailOk(lockedItem(8));
    const locked = await call("/posts/8", { headers: { Accept: "text/html" } });
    expect(locked.status).toBe(404);
    assertNoSecretsOrLock(await locked.text());
  });

  it("PH10 upstream failure → 503; ASSETS failure → plain 503", async () => {
    fetchMock.mockResolvedValue(jsonRes({}, 500));
    const res = await call("/posts", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    assetsFetch.mockRejectedValueOnce(new Error("assets down"));
    mockListOk([unlockedItem(1)], 1);
    const res2 = await call("/posts", { headers: { Accept: "text/html" } });
    expect(res2.status).toBe(503);
  });

  it("PH11 trailing slash redirects", async () => {
    const a = await call("/posts/", { headers: { Accept: "text/html" }, redirect: "manual" });
    expect(a.status).toBe(301);
    expect(a.headers.get("Location")).toBe("/posts");

    const b = await call("/posts/?page=2", {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    expect(b.status).toBe(301);
    expect(b.headers.get("Location")).toBe("/posts?page=2");

    const c = await call("/posts/123/", {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    expect(c.status).toBe(301);
    expect(c.headers.get("Location")).toBe("/posts/123");
  });

  it("PH12 / PH14 / PH13 HTML shares cache; locked no LOCK; one robots", async () => {
    mockDetailOk(unlockedItem(5));
    const html = await call("/posts/5", { headers: { Accept: "text/html" } });
    expect(html.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const htmlText = await html.text();
    expect((htmlText.match(/name="robots"/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((htmlText.match(/rel="canonical"/g) ?? []).length).toBeLessThanOrEqual(1);

    fetchMock.mockClear();
    expect((await call("/api/posts/5")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    mockDetailOk(lockedItem(8));
    const lockedHtml = await (await call("/posts/8", { headers: { Accept: "text/html" } })).text();
    assertNoSecretsOrLock(lockedHtml);
  });

  it("PH15 Worker uses buildPostsHead values (list title exact)", async () => {
    mockListOk([], 0);
    const html = await (await call("/posts", { headers: { Accept: "text/html" } })).text();
    expect(html).toContain("<title>Posts — MetFix</title>");
    expect(html).toContain("Articles from Broken Science.");
  });

  it("TC14 handlePostsHtml sets DETAIL_PAGE_CSP and reCAPTCHA site key", async () => {
    mockDetailOk(unlockedItem(42));
    const reqEnv = makeEnv(assetsFetch);
    reqEnv.RECAPTCHA_SITE_KEY = "6LeTestSiteKey_abc-123";
    const res = await handleRequest(
      new Request("https://metfix.org/posts/42", { headers: { Accept: "text/html" } }),
      reqEnv,
      ctx,
      { fetchImpl: fetchMock as unknown as typeof fetch, cachesDefault: cache },
    );
    expect(res.headers.get("Content-Security-Policy")).toBe(DETAIL_PAGE_CSP);
    const html = await res.text();
    expect(html).toContain("window.__MFX_RECAPTCHA_SITE_KEY__");
    expect(html).toContain("6LeTestSiteKey_abc-123");
    expect(DETAIL_PAGE_CSP).toContain("https://brokenscience.org");
  });
});
