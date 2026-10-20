/**
 * PR2 Round 1 — Leaderboard gates L* / LB*.
 * Each `it` title starts with the exact gate ID.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "./index";
import type { FetchImpl } from "./upstream";
import {
  ACCESS1,
  KEY,
  setupGate,
  seedSession,
  useGateHooks,
  type GateCtx,
} from "./auth/comment-write-harness";
import { resetLeaderboardLimiters } from "./leaderboard";
import { publicDisplayName } from "./auth/public-name";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

useGateHooks();

afterEach(() => {
  vi.restoreAllMocks();
  resetLeaderboardLimiters();
});

const DAY_FIXTURE = {
  date: "2025-02-10",
  belly: { title: "b", excerpt: "e" },
  body: {
    title: "b",
    body: "<p>body</p>",
    scoring_field: "reps",
    scoring_direction: "higher_better",
    order: "desc",
    daily_workout_id: 77,
  },
  brain: {
    title: "brain",
    body: "<p>brain</p>",
    scoring_field: "score",
    scoring_direction: "higher_better",
    order: "desc",
    daily_workout_id: 55,
  },
};

function dayJson(overrides?: Record<string, unknown>) {
  return { ...DAY_FIXTURE, ...overrides };
}

async function callLb(
  g: GateCtx,
  query: string,
  init: RequestInit = {},
  opts?: { bsiBaseUrl?: string },
) {
  const ctx = {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  return handleRequest(
    new Request(`https://metfix.org/api/daily-fix/leaderboard?${query}`, init),
    g.env,
    ctx,
    {
      fetchImpl: g.fetchMock as unknown as FetchImpl,
      cachesDefault: g.cache,
      bsiBaseUrl: opts?.bsiBaseUrl,
    },
  );
}

function mockDayAndLb(
  g: GateCtx,
  opts?: {
    day?: unknown | "fail";
    lb?: unknown | ((url: string, init?: RequestInit) => Response | Promise<Response>);
    lbStatus?: number;
  },
) {
  g.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("recaptcha")) {
      return Response.json({
        success: true,
        score: 0.9,
        action: "comment",
        hostname: "metfix.org",
      });
    }
    if (url.includes("/auth/web-login")) return g.defaultFetch(input, init);
    if (url.includes("/proxy/oauth/")) return g.defaultFetch(input, init);
    if (url.includes("/leaderboard")) {
      if (typeof opts?.lb === "function") return opts.lb(url, init);
      return new Response(JSON.stringify(opts?.lb ?? { leaderboard: [], total: 0 }), {
        status: opts?.lbStatus ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("brokenscience.org") && url.includes("daily-fix") && method === "GET") {
      if (opts?.day === "fail") return new Response("x", { status: 500 });
      return Response.json(opts?.day ?? dayJson());
    }
    return new Response("{}", { status: 404 });
  });
}

function lbCalls(g: GateCtx) {
  return g.fetchMock.mock.calls.filter(([u]) => String(u).includes("/leaderboard"));
}

function dayCalls(g: GateCtx) {
  return g.fetchMock.mock.calls.filter(([u]) => {
    const s = String(u);
    return s.includes("brokenscience.org") && s.includes("daily-fix") && !s.includes("/leaderboard") && !s.includes("/comments");
  });
}

describe("PR2 leaderboard gates L / LB", () => {
  it("L1.2 trailing path and wrong methods return not_found or method_not_allowed", async () => {
    const g = setupGate();
    mockDayAndLb(g);
    const c = {
      waitUntil() {},
      passThroughOnException() {},
    } as unknown as ExecutionContext;
    const slash = await handleRequest(
      new Request("https://metfix.org/api/daily-fix/leaderboard/"),
      g.env,
      c,
      { fetchImpl: g.fetchMock as unknown as FetchImpl, cachesDefault: g.cache },
    );
    expect(slash.status).toBe(404);
    expect(await slash.json()).toEqual({ error: "not_found" });
    const boards = await handleRequest(
      new Request("https://metfix.org/api/daily-fix/leaderboards?date=2025-02-10&type=brain"),
      g.env,
      c,
      { fetchImpl: g.fetchMock as unknown as FetchImpl, cachesDefault: g.cache },
    );
    expect(boards.status).toBe(404);
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const res = await handleRequest(
        new Request("https://metfix.org/api/daily-fix/leaderboard?date=2025-02-10&type=brain", {
          method,
        }),
        g.env,
        c,
        { fetchImpl: g.fetchMock as unknown as FetchImpl, cachesDefault: g.cache },
      );
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method_not_allowed" });
      expect(res.headers.get("Allow")).toMatch(/GET/);
    }
    expect(lbCalls(g).length).toBe(0);
  });

  it("L1.1 signed-in leaderboard uses one day read and one upstream call", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockDayAndLb(g, { lb: { leaderboard: [], total: 0 } });
    g.fetchMock.mockClear();
    const res = await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dayCalls(g).length).toBe(1);
    expect(lbCalls(g).length).toBe(1);
  });

  it("L2.1 invalid date type and scaling_filter bodies", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockDayAndLb(g);
    const cookie = { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` };
    const badDate = await callLb(g, "date=not-a-date&type=brain", { headers: cookie });
    expect(badDate.status).toBe(400);
    expect(await badDate.json()).toEqual({ error: "invalid_date" });
    expect(badDate.headers.get("Cache-Control")).toBe("no-store");

    for (const q of ["date=2025-02-10&type=all", "date=2025-02-10&type=x", "date=2025-02-10"]) {
      g.fetchMock.mockClear();
      const res = await callLb(g, q, { headers: cookie });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_type" });
      expect(lbCalls(g).length).toBe(0);
    }
    for (const sf of ["RX", "x"]) {
      g.fetchMock.mockClear();
      const res = await callLb(g, `date=2025-02-10&type=brain&scaling_filter=${sf}`, {
        headers: cookie,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_scaling_filter" });
      expect(lbCalls(g).length).toBe(0);
    }
    g.fetchMock.mockClear();
    const dup = await callLb(g, "date=2025-02-10&date=2025-02-10&type=brain", {
      headers: cookie,
    });
    expect(dup.status).toBe(400);
    expect(await dup.json()).toEqual({ error: "invalid_request" });
    expect(lbCalls(g).length).toBe(0);
  });

  it("L2.2 strips client extras from upstream query", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockDayAndLb(g);
    const q =
      "date=2025-02-10&type=brain&daily_workout_id=99&scoring_field=reps&scoring_direction=lower_better&order=asc&leaderboard_mode=all&limit=50&offset=100&user_id=5";
    await callLb(g, q, {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    expect(lbCalls(g).length).toBe(1);
    const [url] = lbCalls(g)[0]!;
    const u = new URL(String(url));
    expect(u.searchParams.get("daily_workout_id")).toBeNull();
    expect(u.searchParams.get("scoring_field")).toBe("score");
    expect(u.searchParams.get("scoring_direction")).toBe("higher_better");
    expect(u.searchParams.get("order")).toBe("desc");
    expect(u.searchParams.get("limit")).toBe("25");
    expect(u.searchParams.get("offset")).toBe("0");
    expect(u.searchParams.get("leaderboard_mode")).toBe("official");
    expect(u.searchParams.get("scaling_filter")).toBe("all");
    expect(u.searchParams.get("user_id")).toBeNull();
    const keys = [...new Set([...u.searchParams.keys()])].sort();
    expect(keys).toEqual(
      [
        "date",
        "leaderboard_mode",
        "limit",
        "offset",
        "order",
        "scaling_filter",
        "scoring_direction",
        "scoring_field",
      ].sort(),
    );
  });

  it("L2.3 upstream leaderboard path uses day workout id", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockDayAndLb(g);
    await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    const [url] = lbCalls(g)[0]!;
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe(
      "https://brokenscience.org/wp-json/metfix/v1/daily-fix/workouts/55/leaderboard",
    );
  });

  it("L3.1 signed-in upstream Bearer from session only", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockDayAndLb(g);
    await callLb(g, "date=2025-02-10&type=brain", {
      headers: {
        Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}; other=1`,
        Authorization: "Bearer EVIL",
      },
    });
    const [, init] = lbCalls(g)[0]!;
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    const keys = [...headers.keys()].map((k) => k.toLowerCase()).sort();
    expect(keys).toEqual(["accept", "authorization", "user-agent", "x-api-key"]);
    expect(headers.get("authorization")).toBe(`Bearer ${ACCESS1}`);
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("Authorization")).not.toBe("Bearer EVIL");
  });

  it("L3.2 missing key timeout and foreign baseUrl fail closed", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cookie = { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` };

    delete (g.env as { DAILY_FIX_API_KEY?: string }).DAILY_FIX_API_KEY;
    g.fetchMock.mockClear();
    mockDayAndLb(g);
    const nokey = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(nokey.status).toBe(503);
    expect(g.fetchMock).not.toHaveBeenCalled();
    g.env.DAILY_FIX_API_KEY = KEY;

    mockDayAndLb(g);
    g.fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/leaderboard")) {
        await new Promise(() => {}); // hang — AbortSignal.timeout should fire
      }
      return g.defaultFetch(input, init);
    });
    // Day fetch succeeds fast; leaderboard hangs → timeout → 503
    g.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof input === "string" ? input : (input as Request).url ?? input);
      if (url.includes("/leaderboard")) {
        const err = new DOMException("The operation was aborted due to timeout", "TimeoutError");
        throw err;
      }
      if (url.includes("daily-fix") && !url.includes("/comments")) {
        return Response.json(dayJson());
      }
      return g.defaultFetch(input, init);
    });
    const timed = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(timed.status).toBe(503);

    g.fetchMock.mockClear();
    mockDayAndLb(g);
    const foreign = await callLb(
      g,
      "date=2025-02-10&type=brain",
      { headers: cookie },
      { bsiBaseUrl: "https://evil.example/wp-json/metfix/v1/daily-fix" },
    );
    expect(foreign.status).toBe(503);
    expect(lbCalls(g).length).toBe(0);
  });

  it("L4.1 upstream errors map to unavailable without body leak", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cookie = { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` };
    const leak = "UPSTREAM_SECRET_LEAK_BODY";
    mockDayAndLb(g, {
      lb: async () =>
        new Response(leak, {
          status: 401,
          headers: { "Content-Type": "application/json", "X-Upstream-Leak": "1" },
        }),
    });
    const res = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const bodyText = await res.text();
    expect(bodyText).toBe(JSON.stringify({ error: "unavailable" }));
    expect(bodyText).not.toContain(leak);
  });

  it("L5.1 response row keys are rank public_name score_value scaling_mode logged_at is_self", async () => {
    const g = setupGate();
    const s = await seedSession(g, { user_id: 42 });
    mockDayAndLb(g, {
      lb: {
        total: 1,
        scoring_field: "score",
        score_unit_id: null,
        scoring_direction: "higher_better",
        dfx_date: "2025-02-10",
        live_at: null,
        window_end: null,
        leaderboard: [
          {
            rank: 1,
            user_id: 42,
            workout_log_id: 9,
            workout_title: "x",
            within_official_window: true,
            display_name: "x@y.com",
            public_name_safe: "Jane",
            score_value: 10,
            scaling_mode: "rx",
            logged_at: "t",
          },
        ],
      },
    });
    const res = await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      leaderboard: Record<string, unknown>[];
    };
    expect(Object.keys(body).sort()).toEqual(
      [
        "dfx_date",
        "leaderboard",
        "limit",
        "live_at",
        "offset",
        "score_unit_id",
        "scoring_direction",
        "scoring_field",
        "total",
        "window_end",
      ].sort(),
    );
    const row = body.leaderboard[0]!;
    expect(Object.keys(row).sort()).toEqual(
      ["is_self", "logged_at", "public_name", "rank", "scaling_mode", "score_value"].sort(),
    );
    expect(row).not.toHaveProperty("user_id");
    expect(row).not.toHaveProperty("workout_log_id");
    expect(row).not.toHaveProperty("workout_title");
    expect(row).not.toHaveProperty("within_official_window");
  });

  it("L5.2 public_name Member fallback via B4 helper", async () => {
    expect(publicDisplayName({ display_name: "OnlyDisplay" })).toBe("Member");
    expect(publicDisplayName({ public_name_safe: "Jane" })).toBe("Jane");
    const g = setupGate();
    const s = await seedSession(g);
    mockDayAndLb(g, {
      lb: {
        leaderboard: [
          { rank: 1, display_name: "OnlyDisplay", score_value: 1, scaling_mode: "rx", logged_at: "t" },
          {
            rank: 2,
            public_name_safe: "Jane",
            display_name: "ignored",
            score_value: 2,
            scaling_mode: "rx",
            logged_at: "t",
          },
        ],
        total: 2,
      },
    });
    const res = await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    const body = (await res.json()) as { leaderboard: Array<{ public_name: string }> };
    expect(body.leaderboard[0]!.public_name).toBe("Member");
    expect(body.leaderboard[1]!.public_name).toBe("Jane");
  });

  it("L6.1 all leaderboard responses Cache-Control no-store", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cookie = { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` };
    mockDayAndLb(g);
    const ok = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(ok.headers.get("Cache-Control")).toBe("no-store");
    const bad = await callLb(g, "date=bad&type=brain", { headers: cookie });
    expect(bad.headers.get("Cache-Control")).toBe("no-store");
    expect(g.cache.puts.length).toBe(0);
    expect(g.cache.matches.length).toBe(0);
  });

  it("L6.2 no scoring_field yields no_leaderboard without upstream", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cookie = { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` };
    mockDayAndLb(g, {
      day: {
        date: "2025-02-10",
        belly: { title: "b", excerpt: "e" },
        body: { title: "b", body: "<p>x</p>" },
        brain: { title: "brain", body: "<p>x</p>" },
      },
    });
    const res = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_leaderboard" });
    expect(lbCalls(g).length).toBe(0);

    mockDayAndLb(g, { day: "fail" });
    const unavail = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(unavail.status).toBe(503);
    expect(await unavail.json()).toEqual({ error: "unavailable" });
    expect(unavail.headers.get("Retry-After")).toBe("300");
    expect(lbCalls(g).length).toBe(0);
  });

  it("L6.3 per-bsi_user_id rate limit 11th 429", async () => {
    const g = setupGate();
    const s = await seedSession(g, { user_id: 7 });
    mockDayAndLb(g);
    const cookie = { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` };
    for (let i = 0; i < 10; i++) {
      const res = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
      expect(res.status).toBe(200);
    }
    g.fetchMock.mockClear();
    mockDayAndLb(g);
    const limited = await callLb(g, "date=2025-02-10&type=brain", { headers: cookie });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(dayCalls(g).length).toBe(0);
    expect(lbCalls(g).length).toBe(0);

    const s2 = await seedSession(g, { user_id: 8 });
    mockDayAndLb(g);
    const other = await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s2.sid)}` },
    });
    expect(other.status).toBe(200);
  });

  it("L6.4 client Map cache single-flight per date", () => {
    const clientRoot = path.join(REPO_ROOT, "client/src");
    const hits: string[] = [];
    function walk(dir: string) {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else if (/\.(ts|tsx)$/.test(name) && /leaderboard/i.test(abs)) hits.push(abs);
      }
    }
    walk(clientRoot);
    expect(
      hits.length,
      "L6.4 requires client leaderboard Map cache + single-flight module",
    ).toBeGreaterThan(0);
  });

  it("L7.1 client fetch uses relative /api/daily-fix/leaderboard query keys only", () => {
    const clientRoot = path.join(REPO_ROOT, "client/src");
    let found = false;
    function walk(dir: string) {
      if (!existsSync(dir) || found) return;
      for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else if (/\.(ts|tsx)$/.test(name)) {
          const text = readFileSync(abs, "utf8");
          if (text.includes("/api/daily-fix/leaderboard")) found = true;
        }
      }
    }
    walk(clientRoot);
    expect(found, "L7.1 client must fetch relative /api/daily-fix/leaderboard").toBe(true);
  });

  it("L7.2 client 503 shows Leaderboard unavailable right now", () => {
    const needle = "Leaderboard unavailable right now.";
    const clientRoot = path.join(REPO_ROOT, "client/src");
    let found = false;
    function walk(dir: string) {
      if (!existsSync(dir) || found) return;
      for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else if (/\.(ts|tsx)$/.test(name)) {
          if (readFileSync(abs, "utf8").includes(needle)) found = true;
        }
      }
    }
    walk(clientRoot);
    expect(found, `L7.2 client must show exact status text ${JSON.stringify(needle)}`).toBe(
      true,
    );
  });

  it("L7.3 XSS name renders as text without img nodes", () => {
    expect(
      false,
      "L7.3 needs client leaderboard DOM render (text nodes; no img for XSS public_name)",
    ).toBe(true);
  });

  it("L7.4 client Member fallback for blank public_name", () => {
    expect(false, "L7.4 needs client Member fallback for blank public_name").toBe(true);
  });

  it("LB.N9 renders at most 25 rows with limit 25 offset 0", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const rows = Array.from({ length: 30 }, (_, i) => ({
      rank: i + 1,
      public_name_safe: `U${i}`,
      score_value: 100 - i,
      scaling_mode: "rx",
      logged_at: "t",
      user_id: i + 1,
    }));
    mockDayAndLb(g, { lb: { leaderboard: rows, total: 30 } });
    const res = await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    const body = (await res.json()) as { leaderboard: unknown[] };
    expect(body.leaderboard.length).toBe(25);
    const [url] = lbCalls(g)[0]!;
    const u = new URL(String(url));
    expect(u.searchParams.get("limit")).toBe("25");
    expect(u.searchParams.get("offset")).toBe("0");
    // Client render / no paging control — absent until UI ships
    const hasPagingUi = readFileSync(
      path.join(REPO_ROOT, "client/src/pages/the-daily-fix/TheDailyFixPage.tsx"),
      "utf8",
    ).match(/leaderboard.*page|pagination/i);
    expect(hasPagingUi, "LB.N9 client must not expose paging controls").toBeFalsy();
  });

  it("LB.N10.1 is_self computed server-side from session bsi_user_id", async () => {
    const rows = [
      { rank: 1, user_id: 1, public_name_safe: "A", score_value: 9, scaling_mode: "rx", logged_at: "t" },
      { rank: 2, user_id: 2, public_name_safe: "B", score_value: 8, scaling_mode: "rx", logged_at: "t" },
    ];
    const gA = setupGate();
    const a = await seedSession(gA, { user_id: 1 });
    mockDayAndLb(gA, { lb: { leaderboard: rows, total: 2 } });
    const resA = await callLb(gA, "date=2025-02-10&type=brain&user_id=2", {
      headers: {
        Cookie: `__Host-mfx_sid=${encodeURIComponent(a.sid)}`,
        "X-User-Id": "2",
      },
      body: undefined,
    });
    const bodyA = (await resA.json()) as { leaderboard: Array<{ is_self: boolean }> };
    expect(bodyA.leaderboard.map((r) => r.is_self)).toEqual([true, false]);

    const gB = setupGate();
    const b = await seedSession(gB, { user_id: 2 });
    mockDayAndLb(gB, { lb: { leaderboard: rows, total: 2 } });
    const resB = await callLb(gB, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(b.sid)}` },
    });
    const bodyB = (await resB.json()) as { leaderboard: Array<{ is_self: boolean }> };
    expect(bodyB.leaderboard.map((r) => r.is_self)).toEqual([false, true]);
  });

  it("LB.N10.2 own row outside top 25 is not appended", async () => {
    const g = setupGate();
    const s = await seedSession(g, { user_id: 99 });
    const rows = Array.from({ length: 25 }, (_, i) => ({
      rank: i + 1,
      user_id: i + 1,
      public_name_safe: `U${i}`,
      score_value: 100 - i,
      scaling_mode: "rx",
      logged_at: "t",
    }));
    mockDayAndLb(g, { lb: { leaderboard: rows, total: 100 } });
    g.fetchMock.mockClear();
    mockDayAndLb(g, { lb: { leaderboard: rows, total: 100 } });
    const res = await callLb(g, "date=2025-02-10&type=brain", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    const body = (await res.json()) as { leaderboard: Array<{ is_self: boolean }> };
    expect(body.leaderboard.length).toBe(25);
    expect(body.leaderboard.every((r) => r.is_self === false)).toBe(true);
    expect(lbCalls(g).length).toBe(1);
  });

  it("LB.N7 one leaderboard per component filter all rx scaled", () => {
    // Server accepts filter set; client UI not shipped yet.
    const src = readFileSync(path.join(REPO_ROOT, "worker/leaderboard.ts"), "utf8");
    expect(src).toMatch(/scaling_filter/);
    expect(src).toMatch(/"all"/);
    expect(src).toMatch(/"rx"/);
    expect(src).toMatch(/"scaled"/);
    const clientRoot = path.join(REPO_ROOT, "client/src");
    let clientSends = false;
    function walk(dir: string) {
      if (!existsSync(dir) || clientSends) return;
      for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) walk(abs);
        else if (/\.(ts|tsx)$/.test(name)) {
          const t = readFileSync(abs, "utf8");
          if (
            t.includes("scaling_filter") &&
            t.includes("/api/daily-fix/leaderboard")
          ) {
            clientSends = true;
          }
        }
      }
    }
    walk(clientRoot);
    expect(
      clientSends,
      "LB.N7 client UI must send only date, type, scaling_filter",
    ).toBe(true);
  });
});
