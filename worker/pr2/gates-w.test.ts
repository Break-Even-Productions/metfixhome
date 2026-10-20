/**
 * PR2 Round 1 — Comments read gates W1–W9 + B4W.1
 * Each `it` title starts with the gate ID (exactly one test per ID).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCommentsRoutes, shapeCommentsPayload } from "../comments";
import { publicDisplayName } from "../auth/public-name";
import { fetchDailyFixComments } from "../upstream";
import {
  KEY,
  UPSTREAM_LEAK_BODY,
  emptyAllFixture,
  headersObject,
  makeCache,
  makeEnv,
  richAllFixture,
} from "../auth/harness";

describe("PR2 W gates — comments read", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let cache: ReturnType<typeof makeCache>;
  let env: ReturnType<typeof makeEnv>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn();
    cache = makeCache();
    env = makeEnv({ DAILY_FIX_API_KEY: KEY });
    // caches.default fallback unused when we inject
    vi.stubGlobal("caches", { default: cache });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function call(
    path: string,
    init: RequestInit = {},
    opts: { key?: string | ""; bsiBaseUrl?: string } = {},
  ) {
    const key = opts.key === undefined ? KEY : opts.key;
    const e = makeEnv({ DAILY_FIX_API_KEY: key || undefined });
    let req: Request;
    try {
      req = new Request(`https://metfix.org${path}`, init);
    } catch {
      const method = String(init.method ?? "GET").toUpperCase();
      req = new Request(`https://metfix.org${path}`, { ...init, method: "GET" });
      Object.defineProperty(req, "method", { get: () => method });
    }
    const res = await handleCommentsRoutes(req, e, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      cachesDefault: cache,
      bsiBaseUrl: opts.bsiBaseUrl,
    });
    expect(res).not.toBeNull();
    return res!;
  }

  function assertNoLeak(res: Response, bodyText: string) {
    expect(bodyText).not.toContain(UPSTREAM_LEAK_BODY);
    expect(bodyText).not.toContain(KEY);
    expect(res.headers.get("X-Upstream-Leak")).toBeNull();
    for (const [, v] of res.headers) expect(v).not.toContain(KEY);
  }

  it("W1.1 GET type=all upstream 200 → 200 and exactly 1 upstream call", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(emptyAllFixture());
  });

  it("W1.2 sibling paths → 404 not_found, 0 upstream", async () => {
    // Trailing slash + :id handled inside comments routes.
    for (const path of ["/api/daily-fix/comments/", "/api/daily-fix/comments/1"]) {
      fetchMock.mockClear();
      const res = await call(`${path}?date=2025-02-10&type=all`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
    // Non-matching paths: handleCommentsRoutes returns null (index maps to JSON 404).
    for (const path of [
      "/api/daily-fix/commentsx",
      "/api/comments",
      "/api/daily-fix/Comments",
    ]) {
      fetchMock.mockClear();
      const req = new Request(`https://metfix.org${path}?date=2025-02-10&type=all`);
      const res = await handleCommentsRoutes(req, makeEnv({ DAILY_FIX_API_KEY: KEY }), {
        fetchImpl: fetchMock as unknown as typeof fetch,
        cachesDefault: cache,
      });
      expect(res).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("W2.1 PUT/PATCH/DELETE/OPTIONS/TRACE → 405 method_not_allowed Allow GET, HEAD, POST", async () => {
    for (const method of ["PUT", "PATCH", "DELETE", "OPTIONS", "TRACE"]) {
      fetchMock.mockClear();
      const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all", { method });
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method_not_allowed" });
      expect(res.headers.get("Allow")).toBe("GET, HEAD, POST");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("W2.2 HEAD matches GET status/headers minus body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const get = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    fetchMock.mockClear();
    cache.store.clear();
    cache.puts.length = 0;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const head = await call("/api/daily-fix/comments?date=2025-02-10&type=all", {
      method: "HEAD",
    });
    expect(head.status).toBe(get.status);
    expect(await head.text()).toBe("");
    const gh = headersObject(get);
    const hh = headersObject(head);
    for (const k of Object.keys(gh)) {
      if (k === "content-length") continue;
      expect(hh[k], k).toBe(gh[k]);
    }
  });

  it("W3.1 invalid dates → 400 invalid_date, 0 upstream", async () => {
    for (const q of [
      "?type=all",
      "?date=2025-2-10&type=all",
      "?date=2025-02-30&type=all",
      "?date=250210&type=all",
      "?date=2025-02-10T00:00&type=all",
      "?date=2025-02-10%00&type=all",
    ]) {
      fetchMock.mockClear();
      const res = await call(`/api/daily-fix/comments${q}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_date" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("W3.2 invalid types → 400 invalid_type, 0 upstream", async () => {
    for (const q of [
      "?date=2025-02-10",
      "?date=2025-02-10&type=BELLY",
      "?date=2025-02-10&type=x",
      "?date=2025-02-10&type=all,belly",
      "?date=2025-02-10&type=belly%00",
    ]) {
      fetchMock.mockClear();
      const res = await call(`/api/daily-fix/comments${q}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_type" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("W3.5 duplicated query params → 400 invalid_request, 0 upstream", async () => {
    fetchMock.mockClear();
    const res = await call(
      "/api/daily-fix/comments?date=2025-02-10&date=2025-02-10&type=all",
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W3.3 extra params stripped; upstream URL exact", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    await call(
      "/api/daily-fix/comments?foo=1&key=x&api_key=y&user_id=5&_method=POST&type=all&date=2025-02-10",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments?date=2025-02-10&type=all",
    );
  });

  it("W3.4 type=belly upstream URL exact", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ comments: [], meta: {} }), { status: 200 }),
    );
    await call("/api/daily-fix/comments?date=2025-02-10&type=belly");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments?date=2025-02-10&type=belly",
    );
  });

  it("W4.1 no DAILY_FIX_API_KEY → 503 unavailable Retry-After 300, 0 upstream", async () => {
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all", {}, { key: "" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("W4.2 upstream timeout at 3000ms → 503; signal aborted", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        if (signal.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    const pending = call("/api/daily-fix/comments?date=2025-02-10&type=all");
    await vi.advanceTimersByTimeAsync(2999);
    // still pending — race a tick
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Retry-After")).toBe("300");
  });

  it("W4.3 foreign bsiBaseUrl → 0 fetch, 503", async () => {
    for (const base of [
      "https://evil.example/wp-json/metfix/v1/daily-fix",
      "https://brokenscience.org.evil.example/wp-json/metfix/v1/daily-fix",
    ]) {
      fetchMock.mockClear();
      const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all", {}, {
        bsiBaseUrl: base,
      });
      expect(res.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("W5.1 upstream header set exactly accept,user-agent,x-api-key; no forwarded client headers", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    await call("/api/daily-fix/comments?date=2025-02-10&type=all", {
      headers: {
        Cookie: "a=1",
        Authorization: "Bearer EVIL",
        "X-WP-Nonce": "n",
        "X-Forwarded-For": "1.2.3.4",
        "CF-Connecting-IP": "1.2.3.4",
        "True-Client-IP": "1.2.3.4",
        Forwarded: "for=1.2.3.4",
        Origin: "https://evil.test",
        Referer: "https://evil.test/",
      },
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const h = init.headers as Record<string, string>;
    const keys = Object.keys(h).map((k) => k.toLowerCase()).sort();
    expect(keys).toEqual(["accept", "user-agent", "x-api-key"]);
    expect(h["Accept"] ?? h["accept"]).toBe("application/json");
    expect(h["User-Agent"] ?? h["user-agent"]).toBe("metfixhome-worker/1.0");
    expect(h["X-API-Key"] ?? h["x-api-key"]).toBe(KEY);
    expect(init.method ?? "GET").toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("W6.1 upstream 400 → 400 invalid_request", async () => {
    fetchMock.mockResolvedValue(
      new Response(UPSTREAM_LEAK_BODY, {
        status: 400,
        headers: { "X-Upstream-Leak": "1" },
      }),
    );
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ error: "invalid_request" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    assertNoLeak(res, text);
  });

  it("W6.2 upstream 404 → 404 not_found no-store, 0 cache.put", async () => {
    fetchMock.mockResolvedValue(
      new Response(UPSTREAM_LEAK_BODY, {
        status: 404,
        headers: { "X-Upstream-Leak": "1" },
      }),
    );
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const text = await res.text();
    expect(res.status).toBe(404);
    expect(JSON.parse(text)).toEqual({ error: "not_found" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(cache.puts.length).toBe(0);
    assertNoLeak(res, text);
  });

  it("W6.3 upstream 401 → 503; outcome unauthorized + log", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...a) => {
      logs.push(String(a[0]));
    });
    fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 401 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Retry-After")).toBe("300");
    const direct = await fetchDailyFixComments(
      "2025-02-10",
      "all",
      env,
      fetchMock as unknown as typeof fetch,
    );
    expect(direct.kind).toBe("unauthorized");
    expect(logs.some((l) => l.includes("unauthorized"))).toBe(true);
    spy.mockRestore();
  });

  it("W6.4 upstream 403 → 503; outcome forbidden + log", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...a) => {
      logs.push(String(a[0]));
    });
    fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 403 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    const direct = await fetchDailyFixComments(
      "2025-02-10",
      "all",
      env,
      fetchMock as unknown as typeof fetch,
    );
    expect(direct.kind).toBe("forbidden");
    expect(logs.some((l) => l.includes("forbidden"))).toBe(true);
    spy.mockRestore();
  });

  it("W6.5 upstream 429 → 503 Retry-After 60", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("W6.6 upstream 500/502 → 503 Retry-After 300", async () => {
    for (const status of [500, 502]) {
      fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status }));
      const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
      expect(res.status).toBe(503);
      expect(res.headers.get("Retry-After")).toBe("300");
    }
  });

  it("W6.7 upstream 200 not-json / wrong shape → 503", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    let res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.status).toBe(503);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ comments: "x" }), { status: 200 }),
    );
    res = await call("/api/daily-fix/comments?date=2025-02-11&type=all");
    expect(res.status).toBe(503);
  });

  it("W6.8 fetch throws TypeError → 503", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
  });

  it("W6.9 aggregate no-store + no upstream leak across W6.1–W6.8 outcomes", async () => {
    const cases: Array<() => void> = [
      () => fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 400, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 404, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 401, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 403, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 429, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockResolvedValue(new Response(UPSTREAM_LEAK_BODY, { status: 500, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockResolvedValue(new Response("not json", { status: 200, headers: { "X-Upstream-Leak": "1" } })),
      () => fetchMock.mockRejectedValue(new TypeError("network")),
    ];
    let i = 0;
    for (const setup of cases) {
      setup();
      const res = await call(`/api/daily-fix/comments?date=2025-02-${String(10 + i).padStart(2, "0")}&type=all`);
      i++;
      const text = await res.text();
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      assertNoLeak(res, text);
    }
  });

  it("W7.1 type=all response toStrictEqual shaped fixture", async () => {
    const raw = richAllFixture();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const body = await res.json();
    const expected = shapeCommentsPayload(raw, "all");
    expect(body).toStrictEqual(expected);
  });

  it("W7.2 type=brain top-level keys exactly comments,meta; comments array", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          comments: [
            {
              id: 1,
              user: { display_name: "A" },
              content: "c",
              timestamp: "t",
              like_count: 0,
              parent_id: null,
              deleted: 0,
              edited: 0,
              replies: [],
            },
          ],
          meta: { date: "2025-02-10", type: "brain" },
        }),
        { status: 200 },
      ),
    );
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=brain");
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["comments", "meta"]);
    expect(Array.isArray(body.comments)).toBe(true);
  });

  it("W7.3 whitelist keys; user only display_name; no id/liked/email/ip", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(richAllFixture()), { status: 200 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const body = (await res.json()) as {
      comments: { belly: Array<Record<string, unknown>> };
    };
    const walk = (nodes: Array<Record<string, unknown>>) => {
      for (const n of nodes) {
        expect(Object.keys(n).sort()).toEqual(
          [
            "content",
            "deleted",
            "edited",
            "id",
            "like_count",
            "parent_id",
            "replies",
            "timestamp",
            "user",
          ].sort(),
        );
        expect(Object.keys(n.user as object)).toEqual(["display_name"]);
        expect(n).not.toHaveProperty("liked");
        if (Array.isArray(n.replies)) walk(n.replies as Array<Record<string, unknown>>);
      }
    };
    walk(body.comments.belly);
    const text = JSON.stringify(body);
    expect(text).not.toContain('"liked"');
    expect(text).not.toContain("a@b.co");
  });

  it("W7.4 Content-Type application/json; charset=utf-8 exactly", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });

  it("B4W.1 publicDisplayName fail-closed Member; safe field positive control", async () => {
    for (const v of ["Jane", "", "Unknown", "a@b.co"]) {
      expect(publicDisplayName({ display_name: v })).toBe("Member");
    }
    expect(publicDisplayName({ display_name: "[Anonymous]" }, { allowAnonymous: true })).toBe(
      "[Anonymous]",
    );
    expect(publicDisplayName({ public_name_safe: "Jane", display_name: "x" })).toBe("Jane");
    expect(publicDisplayName({ public_name_safe: "", display_name: "Jane" })).toBe("Member");
    expect(publicDisplayName({ public_name_safe: "Unknown", display_name: "Jane" })).toBe("Member");
    expect(publicDisplayName({ public_name_safe: "a@b.co", display_name: "Jane" })).toBe("Member");
  });

  it("W8.1 deleted==1 top-level and reply omitted; order preserved; no deleted markers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(richAllFixture()), { status: 200 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const text = await res.text();
    const body = JSON.parse(text) as { comments: { belly: Array<{ id: number }> } };
    const ids = body.comments.belly.map((c) => c.id);
    expect(ids).toEqual([1, 3]);
    expect(text).not.toContain("removed");
    expect(text).not.toMatch(/\[Deleted\]/i);
    expect(JSON.stringify(body)).not.toContain('"id":11');
    expect(JSON.stringify(body)).not.toContain('"id":2');
    expect(JSON.stringify(body)).not.toContain('"id":21');
  });

  it("W8.2 deleted==2 → display_name [Anonymous], content kept", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(richAllFixture()), { status: 200 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const body = (await res.json()) as {
      comments: { belly: Array<{ id: number; user: { display_name: string }; content: string }> };
    };
    const anon = body.comments.belly.find((c) => c.id === 3);
    expect(anon?.user.display_name).toBe("[Anonymous]");
    expect(anon?.content).toBe("anon content");
  });

  it("W8.3 live replies under deleted==1 parent absent", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(richAllFixture()), { status: 200 }));
    const res = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("orphan");
    expect(text).not.toContain('"id":21');
  });

  it("W9.1 two identical anonymous GETs → 1 upstream; byte-equal; Cache-Control s-maxage=60", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const a = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const aText = await a.text();
    expect(a.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60");
    const b = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const bText = await b.text();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bText).toBe(aText);
    expect(b.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60");
  });

  it("W9.2 cache.put key exact; type=belly → 0 put/match", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    await call("/api/daily-fix/comments?foo=1&date=2025-02-10&type=all");
    expect(cache.puts.map((p) => p.key)).toEqual([
      "https://cache.metfix.internal/daily-fix/comments?date=2025-02-10",
    ]);
    cache.puts.length = 0;
    cache.matches.length = 0;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ comments: [], meta: {} }), { status: 200 }),
    );
    await call("/api/daily-fix/comments?date=2025-02-10&type=belly");
    expect(cache.puts.length).toBe(0);
    expect(cache.matches.length).toBe(0);
  });

  it("W9.3 W6 outcomes → 0 cache.put; following good request hits upstream", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(cache.puts.length).toBe(0);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("W9.4 Cookie/Authorization still served from same cache key; handler ignores those headers", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const anon = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const anonText = await anon.text();
    fetchMock.mockClear();
    const authed = await call("/api/daily-fix/comments?date=2025-02-10&type=all", {
      headers: { Authorization: "Bearer X", Cookie: "__Host-mfx_sid=abc" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(await authed.text()).toBe(anonText);
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../comments.ts", import.meta.url), "utf8"),
    );
    const getFn = src.slice(
      src.indexOf("async function handleCommentsGet"),
      src.indexOf("async function requireSession"),
    );
    expect(getFn).not.toMatch(/headers\.get\(\s*["']cookie["']\s*\)/i);
    expect(getFn).not.toMatch(/headers\.get\(\s*["']authorization["']\s*\)/i);
  });

  it("W9.6 caches.default injectable as deps.cachesDefault", async () => {
    const injected = makeCache();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const req = new Request(
      "https://metfix.org/api/daily-fix/comments?date=2025-02-10&type=all",
    );
    await handleCommentsRoutes(req, makeEnv({ DAILY_FIX_API_KEY: KEY }), {
      fetchImpl: fetchMock as unknown as typeof fetch,
      cachesDefault: injected,
    });
    expect(injected.puts.length).toBe(1);
    expect(cache.puts.length).toBe(0);
  });

  it("W9.5 HEAD first then GET → GET body is full JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const head = await call("/api/daily-fix/comments?date=2025-02-10&type=all", {
      method: "HEAD",
    });
    expect(await head.text()).toBe("");
    // HEAD must not store an empty body under the cache key
    expect(cache.puts.length).toBe(0);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(emptyAllFixture()), { status: 200 }),
    );
    const get = await call("/api/daily-fix/comments?date=2025-02-10&type=all");
    const body = await get.json();
    expect(body).toEqual(emptyAllFixture());
  });
});
