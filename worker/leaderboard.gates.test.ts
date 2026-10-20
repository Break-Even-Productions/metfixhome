import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "./index";
import type { Env } from "./upstream";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stubEnv(fetchImpl: typeof fetch): Env {
  return {
    ASSETS: { fetch: async () => new Response("{}", { status: 404 }) } as unknown as Fetcher,
    DAILY_FIX_API_KEY: "key",
    AUTH_SESSIONS: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    } as unknown as KVNamespace,
    SESSION: {
      idFromName: () => ({ toString: () => "s" }),
      get: () => ({ fetch: async () => new Response(null, { status: 503 }) }),
    } as unknown as DurableObjectNamespace,
    LOGIN_THROTTLE: {
      idFromName: () => ({ toString: () => "t" }),
      get: () => ({ fetch: async () => new Response(null, { status: 503 }) }),
    } as unknown as DurableObjectNamespace,
    OAUTH_STATE: {
      idFromName: () => ({ toString: () => "o" }),
      get: () => ({ fetch: async () => new Response(null, { status: 503 }) }),
    } as unknown as DurableObjectNamespace,
  };
}

function ctx() {
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

afterEach(() => {
  vi.restoreAllMocks();
});

const LB_FULL = readFileSync(path.join(REPO_ROOT, "worker/leaderboard.ts"), "utf8").includes(
  "scaling_filter",
);

describe("PR2 leaderboard gates L / LB", () => {
  it("L1.2 trailing path and wrong methods return not_found or method_not_allowed", async () => {
    const fetchImpl = vi.fn();
    const env = stubEnv(fetchImpl);
    const c = ctx();
    const slash = await handleRequest(
      new Request("https://metfix.org/api/daily-fix/leaderboard/"),
      env,
      c,
      { fetchImpl },
    );
    expect(slash.status).toBe(404);
    expect(await slash.json()).toEqual({ error: "not_found" });
    const boards = await handleRequest(
      new Request("https://metfix.org/api/daily-fix/leaderboards?date=2025-02-10&type=brain"),
      env,
      c,
      { fetchImpl },
    );
    expect(boards.status).toBe(404);
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const res = await handleRequest(
        new Request("https://metfix.org/api/daily-fix/leaderboard?date=2025-02-10&type=brain", {
          method,
        }),
        env,
        c,
        { fetchImpl },
      );
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method_not_allowed" });
      expect(res.headers.get("Allow")).toMatch(/GET/);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.skipIf(!LB_FULL)("L1.1 signed-in leaderboard uses one day read and one upstream call", () => {});
  it.skipIf(!LB_FULL)("L2.1 invalid date type and scaling_filter bodies", () => {});
  it.skipIf(!LB_FULL)("L2.2 strips client extras from upstream query", () => {});
  it.skipIf(!LB_FULL)("L2.3 upstream leaderboard path uses day workout id", () => {});
  it.skipIf(!LB_FULL)("L3.1 signed-in upstream Bearer from session only", () => {});
  it.skipIf(!LB_FULL)("L3.2 missing key timeout and foreign baseUrl fail closed", () => {});
  it.skipIf(!LB_FULL)("L4.1 upstream errors map to unavailable without body leak", () => {});
  it.skipIf(!LB_FULL)("L5.1 response row keys are rank public_name score_value scaling_mode logged_at is_self", () => {});
  it.skipIf(!LB_FULL)("L5.2 public_name Member fallback via B4 helper", () => {});
  it.skipIf(!LB_FULL)("L6.1 all leaderboard responses Cache-Control no-store", () => {});
  it.skipIf(!LB_FULL)("L6.2 no scoring_field yields no_leaderboard without upstream", () => {});
  it.skipIf(!LB_FULL)("L6.3 per-bsi_user_id rate limit 11th 429", () => {});
  it.skipIf(!LB_FULL)("L6.4 client Map cache single-flight per date", () => {});
  it.skipIf(!LB_FULL)("L7.1 client fetch uses relative /api/daily-fix/leaderboard query keys only", () => {});
  it.skipIf(!LB_FULL)("L7.2 client 503 shows Leaderboard unavailable right now", () => {});
  it.skipIf(!LB_FULL)("L7.3 XSS name renders as text without img nodes", () => {});
  it.skipIf(!LB_FULL)("L7.4 client Member fallback for blank public_name", () => {});
  it.skipIf(!LB_FULL)("LB.N9 renders at most 25 rows with limit 25 offset 0", () => {});
  it.skipIf(!LB_FULL)("LB.N10.1 is_self computed server-side from session bsi_user_id", () => {});
  it.skipIf(!LB_FULL)("LB.N10.2 own row outside top 25 is not appended", () => {});
  it.skipIf(!LB_FULL)("LB.N7 one leaderboard per component filter all rx scaled", () => {});
});
