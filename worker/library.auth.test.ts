/**
 * Library browse reuses one access token and does not end the session on a
 * BSI 401. The session is cleared only when the refresh grant is invalid_grant.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SID_COOKIE } from "./auth/cookies";
import type { Env } from "./upstream";

const sessionState = vi.hoisted(() => ({
  load: vi.fn(),
  destroy: vi.fn(async () => null),
}));

vi.mock("./auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/session")>();
  return {
    ...actual,
    loadActingAccess: (...args: unknown[]) => sessionState.load(...args),
    destroySession: (...args: unknown[]) => sessionState.destroy(...args),
  };
});

import { actingFailureReason } from "./auth/session";
import { handleLibraryApi } from "./library";

function memberLoad() {
  const now = Date.now();
  return {
    ok: true as const,
    hex: "sessionhexone0000",
    record: {
      bsi_access: "token-1",
      bsi_refresh: "refresh-1",
      access_exp: now + 3_600_000,
      user_public_name: "Member",
      bsi_user_id: "42",
      can_moderate: false,
      created: now,
      last_seen: now,
    },
  };
}

function env(): Env {
  return { BSI_POSTS_API_KEY: "test-key" } as Env;
}

function ctx(): ExecutionContext {
  return {
    waitUntil(p: Promise<unknown>) {
      void p;
    },
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
}

function memoryCache(): Cache & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    match: async (req: RequestInfo | URL) => {
      const key =
        typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    },
    put: async (req: RequestInfo | URL, res: Response) => {
      const key =
        typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
      store.set(key, res.clone());
    },
    delete: async () => false,
    keys: async () => [] as unknown as ReadonlyArray<Request>,
  } as Cache & { store: Map<string, Response> };
}

function term(id: number, slug: string, name = slug) {
  return { id, name, slug };
}

function searchPayload(title: string) {
  return {
    resources: [
      {
        id: 7,
        type: "post",
        title,
        excerpt: "",
        date: "2025-01-01T00:00:00.000Z",
        content_access_display: { access: "full" },
      },
    ],
    meta: { total: 1, count: 1, limit: 12, offset: 0, has_more: false },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function signedRequest(path: string): Request {
  return new Request(`https://metfix.org${path}`, {
    headers: { Cookie: `${SID_COOKIE}=sess-1` },
  });
}

describe("library session reuse", () => {
  beforeEach(() => {
    sessionState.load.mockReset();
    sessionState.destroy.mockReset();
    sessionState.load.mockResolvedValue(memberLoad());
    sessionState.destroy.mockResolvedValue(null);
  });

  function callsFor(
    decide: (url: URL, authorization: string | null) => Response,
  ) {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const authorization = new Headers(init?.headers).get("Authorization");
      calls.push({ url: url.toString(), authorization });
      return decide(url, authorization);
    });
    return { calls, fetchImpl };
  }

  async function run(
    path: string,
    fetchImpl: ReturnType<typeof vi.fn>,
    cache = memoryCache(),
  ) {
    const res = await handleLibraryApi(signedRequest(path), env(), ctx(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cachesDefault: cache,
    });
    return { res, cache };
  }

  function expectOneSessionLoad() {
    expect(sessionState.load).toHaveBeenCalledTimes(1);
    const opts = sessionState.load.mock.calls[0]?.[2] as
      | { force?: boolean }
      | undefined;
    expect(opts?.force).not.toBe(true);
    expect(sessionState.destroy).not.toHaveBeenCalled();
  }

  it("retries a library 401 once without the bearer and keeps the session", async () => {
    const { calls, fetchImpl } = callsFor((_url, authorization) => {
      if (authorization) return jsonResponse({ error: "unauthorized" }, 401);
      return jsonResponse(searchPayload("Public catalog"));
    });
    const { res, cache } = await run("/api/library/search?limit=3", fetchImpl);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const body = (await res.json()) as { resources: Array<{ title: string }> };
    expect(body.resources[0]?.title).toBe("Public catalog");
    expect(calls.map((call) => call.authorization)).toEqual([
      "Bearer token-1",
      null,
    ]);
    expectOneSessionLoad();
    expect(cache.store.size).toBe(0);
  });

  it("does not delete the session when the API-key retry is also 401", async () => {
    const { calls, fetchImpl } = callsFor(() =>
      jsonResponse({ error: "unauthorized" }, 401),
    );
    const { res } = await run("/api/library/search?limit=3", fetchImpl);
    expect(res.status).toBe(503);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(calls).toHaveLength(2);
    expectOneSessionLoad();
  });

  it("serves the API-key catalog and forwards Set-Cookie only for invalid_grant", async () => {
    sessionState.load.mockResolvedValue({ ok: false, reason: "invalid_grant" });
    const { calls, fetchImpl } = callsFor(() =>
      jsonResponse(searchPayload("Anonymous catalog")),
    );
    const { res } = await run("/api/library/search?limit=3", fetchImpl);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/__Host-mfx_sid=/);
    expect(cookie).toMatch(/Max-Age=0/);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBeNull();
    expect(sessionState.destroy).not.toHaveBeenCalled();

    sessionState.load.mockResolvedValue({ ok: false, reason: "ended" });
    const ended = callsFor(() => jsonResponse(searchPayload("Still there")));
    const endedRes = await run("/api/library/search?limit=3", ended.fetchImpl);
    expect(endedRes.res.status).toBe(200);
    expect(endedRes.res.headers.get("Set-Cookie")).toBeNull();
    expect(sessionState.destroy).not.toHaveBeenCalled();
  });

  it("refreshes once for filters and reuses that token on every leg", async () => {
    const { calls, fetchImpl } = callsFor((url, authorization) => {
      if (authorization) return jsonResponse({ error: "unauthorized" }, 401);
      if (url.pathname.endsWith("/topics")) return jsonResponse([]);
      if (url.pathname.endsWith("/content-type-terms")) return jsonResponse([]);
      if (url.pathname.endsWith("/categories-for-filter")) return jsonResponse([]);
      return jsonResponse({ error: "unexpected" }, 500);
    });
    const { res } = await run("/api/library/filters", fetchImpl);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(calls.filter((call) => call.authorization === "Bearer token-1")).toHaveLength(3);
    expect(calls.filter((call) => call.authorization == null)).toHaveLength(3);
    expectOneSessionLoad();
  });

  it("reuses one access token across archive legs", async () => {
    const { calls, fetchImpl } = callsFor((url, authorization) => {
      if (url.pathname.endsWith("/topics")) {
        return jsonResponse([term(43889, "glassman-archive", "Glassman Archive")]);
      }
      if (url.pathname.endsWith("/content-type-terms")) return jsonResponse([]);
      if (url.pathname.endsWith("/categories-for-filter")) {
        return jsonResponse([term(400, "glassman-archive", "Glassman Archive")]);
      }
      if (url.pathname.endsWith("/search")) {
        if (authorization) return jsonResponse({ error: "unauthorized" }, 401);
        return jsonResponse(searchPayload("Archive public"));
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });
    const { res } = await run("/api/library/archive?limit=3", fetchImpl);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const searches = calls.filter((call) => call.url.includes("/search?"));
    expect(searches.length).toBeGreaterThanOrEqual(2);
    expect(searches.filter((call) => call.authorization === "Bearer token-1").length).toBe(
      searches.length / 2,
    );
    expectOneSessionLoad();
  });

  it("keeps the member cache salt off the anonymous entry", async () => {
    const cache = memoryCache();
    const { fetchImpl } = callsFor(() => jsonResponse(searchPayload("Member post")));
    const { res } = await run("/api/library/search?limit=3", fetchImpl, cache);
    expect(res.status).toBe(200);
    const keys = [...cache.store.keys()];
    expect(keys.some((key) => key.includes("/search/anon"))).toBe(false);
    expect(keys.some((key) => key.includes("u42."))).toBe(true);
  });
});

describe("library auth source", () => {
  it("names invalid_grant only for that refresh status", () => {
    expect(actingFailureReason(401, { status: "invalid_grant" })).toBe("invalid_grant");
    expect(actingFailureReason(401, { status: "expired" })).toBe("ended");
    expect(actingFailureReason(404, { status: "invalid_grant" })).toBe("ended");
    expect(actingFailureReason(401, null)).toBe("ended");
  });

  it("does not call runUserBsiCall from the library worker", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./library.ts", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/runUserBsiCall\s*\(/);
    expect(src).toContain("libraryViewerCacheSalt");
    expect(src).toContain("fetchWithSharedAccess");
  });

  it("marks the refresh grant invalid_grant in the session DO", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./do/session.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toMatch(
      /upstream\.code === "invalid_grant"[\s\S]{0,220}status:\s*"invalid_grant"/,
    );
  });
});
