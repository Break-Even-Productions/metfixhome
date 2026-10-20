import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dailyFixCommentsRequestUrl,
  fetchDailyFixComments,
  invalidateCommentsCache,
  mapDailyFixComments,
} from "./comments";

beforeEach(() => {
  invalidateCommentsCache();
});

afterEach(() => {
  invalidateCommentsCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Daily Fix comments request", () => {
  it("asks the same-origin Worker for ISO date + type=all, never YYMMDD", () => {
    const url = dailyFixCommentsRequestUrl("2025-02-10");
    expect(url).toBe("/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(url).not.toContain("250210");
    expect(url).not.toContain("X-API-Key");
    expect(url).not.toContain("metfix-bff");
  });
});

describe("mapDailyFixComments", () => {
  it("returns an empty list only for a real empty type=all payload", () => {
    expect(
      mapDailyFixComments({
        comments: { belly: [], body: [], brain: [] },
        meta: { date: "2025-02-10", type: "all", count: { belly: 0, body: 0, brain: 0, total: 0 } },
      }),
    ).toEqual([]);
  });

  it("flattens top-level comments from belly/body/brain", () => {
    const mapped = mapDailyFixComments({
      comments: {
        belly: [
          {
            id: 1,
            user: { id: 9, display_name: "Ada" },
            content: "Great steak",
            timestamp: "2025-02-10T12:00:00Z",
            replies: [],
          },
        ],
        body: [],
        brain: [
          {
            id: 2,
            user: { id: 8, display_name: "Bo" },
            content: "Good read",
            timestamp: "2025-02-10T13:00:00Z",
            replies: [{ id: 3, user: { id: 7, display_name: "Cy" }, content: "reply" }],
          },
        ],
      },
    });
    expect(mapped?.map((c) => ({ id: c.id, pillar: c.pillar, author: c.author, content: c.content }))).toEqual([
      { id: 1, pillar: "belly", author: "Ada", content: "Great steak" },
      { id: 2, pillar: "brain", author: "Bo", content: "Good read" },
    ]);
  });

  it("treats error bodies and malformed JSON shapes as unusable", () => {
    expect(mapDailyFixComments({ error: "not_found" })).toBeNull();
    expect(mapDailyFixComments({ comments: [] })).toBeNull();
    expect(mapDailyFixComments({ comments: { belly: [] } })).toBeNull();
  });
});

describe("fetchDailyFixComments", () => {
  it("marks 404 as unavailable, not an empty list", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: "not_found" }), { status: 404 }),
    );
    await expect(fetchDailyFixComments("2025-02-10", undefined, { fetchImpl })).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("marks 503, bad JSON, and thrown fetch as unavailable", async () => {
    await expect(
      fetchDailyFixComments("2025-02-10", undefined, {
        fetchImpl: vi.fn(async () => new Response("{}", { status: 503 })),
      }),
    ).resolves.toEqual({ status: "unavailable" });

    invalidateCommentsCache();
    await expect(
      fetchDailyFixComments("2025-02-10", undefined, {
        fetchImpl: vi.fn(async () => new Response("not-json", { status: 200 })),
      }),
    ).resolves.toEqual({ status: "unavailable" });

    invalidateCommentsCache();
    await expect(
      fetchDailyFixComments("2025-02-10", undefined, {
        fetchImpl: vi.fn(async () => {
          throw new TypeError("network");
        }),
      }),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("returns loaded empty only after a real empty list", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({ Accept: "application/json" });
      expect(init).not.toHaveProperty("Authorization");
      return new Response(
        JSON.stringify({ comments: { belly: [], body: [], brain: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    await expect(fetchDailyFixComments("2025-02-10", undefined, { fetchImpl })).resolves.toEqual({
      status: "loaded",
      comments: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      dailyFixCommentsRequestUrl("2025-02-10"),
      expect.objectContaining({ method: "GET", headers: { Accept: "application/json" } }),
    );
  });

  it("C6.3 shares one in-flight fetch and caches by date", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const empty = () =>
      new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const fetchImpl = vi.fn(async () => {
      if (fetchImpl.mock.calls.length <= 1) return pending;
      return empty();
    });

    const a = fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
    const b = fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch(empty());
    await expect(a).resolves.toEqual({ status: "loaded", comments: [] });
    await expect(b).resolves.toEqual({ status: "loaded", comments: [] });
    await expect(fetchDailyFixComments("2025-02-10", undefined, { fetchImpl })).resolves.toEqual({
      status: "loaded",
      comments: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(fetchDailyFixComments("2025-02-11", undefined, { fetchImpl })).resolves.toEqual({
      status: "loaded",
      comments: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
