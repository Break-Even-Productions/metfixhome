import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_FIX_BFF_URL,
  dailyFixRequestUrl,
  fetchDailyFixDay,
  fetchIsoForRoute,
  loadDailyFixDay,
  mapDailyFixDay,
  peekLoadedDailyFixDay,
  prefetchDailyFixWindow,
  resetDailyFixDayCache,
} from "./data";
import { bsiTodayIso, dailyFixCanonicalUrl, parseDailyFixRoute } from "./model";

/** BSI `dfx_build_daily_fix_day_content` shape from the Worker. Not shipped as page content. */
const bsiDayBody = {
  date: "2025-02-10",
  belly: {
    title: "Steak bowls",
    photo_url: "https://example.com/ignore-belly.jpg",
    plate_photo: "https://example.com/ignore-plate.jpg",
    macros: { fat: 22, carb: null, protein: 34 },
    body: "<p>Legacy ingredients</p>",
    steps: "<p>Legacy steps</p>",
    has_structured_ingredients: true,
    has_structured_steps: true,
    recipe_ingredients: [
      { display: "Eggs", sort_order: 1 },
      { display: "Salt", sort_order: 2 },
    ],
    recipe_steps: [{ instruction: "Cook.", sort_order: 1 }],
  },
  body: {
    title: "Push",
    body: "<p>Work</p>",
    photo_url: "https://example.com/ignore-body.jpg",
  },
  brain: {
    title: "Read",
    body: "<p>Think</p>",
    excerpt: "<p>Fallback excerpt</p>",
    article_url: "https://example.com/article",
    button_text: "FULL ARTICLE",
    photo_url: "https://example.com/ignore-brain.jpg",
  },
};

/** Live rest-day shape: body.body null, body.excerpt Rest day HTML, body.title Rest. */
const restDayBody = {
  date: "2026-10-05",
  belly: {
    title: "Rest meal",
    macros: { fat: null, carb: null, protein: null },
    has_structured_ingredients: false,
    has_structured_steps: false,
    recipe_ingredients: [],
    recipe_steps: [],
  },
  body: {
    title: "Rest",
    body: null,
    excerpt: "<p>Rest day</p>",
  },
  brain: {
    title: "Rest read",
    body: "<p>Take it easy</p>",
    excerpt: null,
  },
};

beforeEach(() => {
  resetDailyFixDayCache();
  vi.useRealTimers();
});

afterEach(() => {
  resetDailyFixDayCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Daily Fix BFF request", () => {
  it("asks the Worker for an ISO date, never a YYMMDD path segment", () => {
    expect(dailyFixRequestUrl("2025-02-10")).toBe(`${DAILY_FIX_BFF_URL}?date=2025-02-10`);
    expect(dailyFixRequestUrl("2025-02-10")).not.toContain("250210");
    expect(DAILY_FIX_BFF_URL).toContain("metfix-bff.wispy-mode-982d.workers.dev");
  });

  it("resolves the fetch date from the route after rewrite shapes, not the raw segment", () => {
    const today = bsiTodayIso(new Date("2026-03-10T23:30:00.000Z"));
    expect(today).toBe("2026-03-11");
    expect(fetchIsoForRoute("today", null, today)).toBe("2026-03-11");

    for (const input of [{ date: "250210" }, { date: "2025-02-10" }, { date: "20250210" }, { yy: "25", mm: "02", dd: "10" }]) {
      const route = parseDailyFixRoute(input);
      expect(route.kind).toBe("day");
      expect(fetchIsoForRoute(route.kind, route.iso, today)).toBe("2025-02-10");
    }

    const invalid = parseDailyFixRoute({ date: "250231" });
    expect(invalid.kind).toBe("invalid");
    expect(fetchIsoForRoute(invalid.kind, invalid.iso, today)).toBeNull();
  });
});

describe("page route checks", () => {
  it("fetches date=2025-02-10 once for /the-daily-fix/250210#brain and ignores pillar hash changes", () => {
    const today = "2026-03-11";
    const brain = parseDailyFixRoute({ date: "250210", hash: "#brain" });
    const body = parseDailyFixRoute({ date: "250210", hash: "#body" });
    const belly = parseDailyFixRoute({ date: "250210", hash: "#belly" });
    expect(brain.canonicalPath).toBe("/the-daily-fix/250210");
    expect(brain.canonicalHash).toBe("#brain");
    expect(fetchIsoForRoute(brain.kind, brain.iso, today)).toBe("2025-02-10");
    expect(fetchIsoForRoute(body.kind, body.iso, today)).toBe("2025-02-10");
    expect(fetchIsoForRoute(belly.kind, belly.iso, today)).toBe("2025-02-10");
    expect(new Set([brain.iso, body.iso, belly.iso])).toEqual(new Set(["2025-02-10"]));
  });

  it("ends rewrite shapes on /the-daily-fix/250210 and keeps that bar", () => {
    for (const input of [{ date: "2025-02-10" }, { date: "20250210" }, { yy: "25", mm: "02", dd: "10" }, { date: "250210" }]) {
      const route = parseDailyFixRoute(input);
      expect(dailyFixCanonicalUrl(route)).toBe("/the-daily-fix/250210");
      expect(route.canonicalPath).toBe("/the-daily-fix/250210");
      expect(route.canonicalHash).toBe("");
    }
  });

  it("does not treat /the-daily-fix/25/02/10/belly as a Daily Fix day fetch", () => {
    const fourSegmentPath = "/the-daily-fix/25/02/10/belly";
    const afterPrefix = fourSegmentPath.replace(/^\/the-daily-fix\/?/, "").split("/").filter(Boolean);
    expect(afterPrefix).toEqual(["25", "02", "10", "belly"]);
    expect(afterPrefix.length).toBe(4);
    expect(fetchIsoForRoute("invalid", null, "2026-03-11")).toBeNull();
  });
});

describe("mapDailyFixDay", () => {
  it("maps the BSI Worker day shape onto DailyFixDay", () => {
    const day = mapDailyFixDay(bsiDayBody, "2025-02-10");
    expect(day).not.toBeNull();
    expect(day?.belly.title).toBe("Steak bowls");
    expect(day?.belly.fat).toBe(22);
    expect(day?.belly.carb).toBeNull();
    expect(day?.belly.protein).toBe(34);
    expect(day?.belly.recipe_ingredients.map((item) => item.display)).toEqual(["Eggs", "Salt"]);
    expect(day?.body.html).toContain("Work");
    expect(day?.brain.html).toContain("Think");
    expect(day?.requested_date).toBeUndefined();
    expect(day && "photo_url" in day.belly).toBe(false);
  });

  it("uses body.excerpt when body.body is null or empty (rest-day fixture)", () => {
    const fromNull = mapDailyFixDay(restDayBody, "2026-10-05");
    expect(fromNull?.body.title).toBe("Rest");
    expect(fromNull?.body.html).toBe("<p>Rest day</p>");
    expect(fromNull?.belly.title).toBe("Rest meal");
    expect(fromNull?.brain.html).toContain("Take it easy");

    const fromEmpty = mapDailyFixDay(
      {
        ...restDayBody,
        body: { title: "Rest", body: "", excerpt: "<p>Rest day</p>" },
      },
      "2026-10-05",
    );
    expect(fromEmpty?.body.html).toBe("<p>Rest day</p>");
  });

  it("prefers body.body over excerpt when both are present", () => {
    const day = mapDailyFixDay(
      {
        ...bsiDayBody,
        body: { title: "Push", body: "<p>Work</p>", excerpt: "<p>Excerpt</p>" },
      },
      "2025-02-10",
    );
    expect(day?.body.html).toBe("<p>Work</p>");
  });

  it("keeps whitespace-only body.body without falling back to excerpt", () => {
    const day = mapDailyFixDay(
      {
        ...bsiDayBody,
        body: { title: "Push", body: "   ", excerpt: "<p>Excerpt</p>" },
      },
      "2025-02-10",
    );
    expect(day?.body.html).toBe("   ");
  });

  it("uses brain.excerpt when brain.body is empty", () => {
    const day = mapDailyFixDay(
      {
        ...bsiDayBody,
        brain: { ...bsiDayBody.brain, body: "", excerpt: "<p>Excerpt only</p>" },
      },
      "2025-02-10",
    );
    expect(day?.brain.html).toBe("<p>Excerpt only</p>");
  });

  it("sets requested_date when the Worker returns a closer day", () => {
    const closer = mapDailyFixDay({ ...bsiDayBody, date: "2025-02-12" }, "2025-02-10");
    expect(closer?.date).toBe("2025-02-12");
    expect(closer?.requested_date).toBe("2025-02-10");
  });

  it("rejects missing/invalid top-level date, null workout, error objects, and the old flat client shape", () => {
    expect(mapDailyFixDay({ error: "unavailable" }, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay({}, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay(null, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay({ ...bsiDayBody, date: null }, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay({ ...bsiDayBody, date: "not-a-date" }, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay({ ...bsiDayBody, date: "2025-02-31" }, "2025-02-10")).toBeNull();
    expect(
      mapDailyFixDay(
        {
          ...bsiDayBody,
          body: { title: null, body: null, excerpt: null },
        },
        "2025-02-10",
      ),
    ).toBeNull();
    expect(
      mapDailyFixDay(
        {
          date: "2025-02-10",
          belly: { title: "x", fat: 1, carb: 2, protein: 3 },
          body: { title: "y", html: "<p>nope</p>" },
          brain: { title: "z", html: "<p>nope</p>" },
        },
        "2025-02-10",
      ),
    ).toBeNull();
  });
});

describe("loadDailyFixDay cache", () => {
  it("shares one GET per ISO and does not cache failures", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(bsiDayBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([
      loadDailyFixDay("2025-02-10", { allowCloser: false }),
      loadDailyFixDay("2025-02-10", { allowCloser: false }),
    ]);
    expect(a.status).toBe("loaded");
    expect(b.status).toBe("loaded");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await loadDailyFixDay("2025-03-01", { allowCloser: true })).toEqual({ status: "unavailable" });
    expect(peekLoadedDailyFixDay("2025-03-01")).toBeNull();
  });

  it("caches under returned date and aliases requested; dated mismatch is unavailable without refetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ...bsiDayBody, date: "2026-03-09" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const closer = await loadDailyFixDay("2026-03-10", { allowCloser: true });
    expect(closer.status).toBe("loaded");
    if (closer.status === "loaded") {
      expect(closer.day.date).toBe("2026-03-09");
      expect(closer.day.requested_date).toBe("2026-03-10");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const exact = await loadDailyFixDay("2026-03-09", { allowCloser: false });
    expect(exact.status).toBe("loaded");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const datedMismatch = await loadDailyFixDay("2026-03-10", { allowCloser: false });
    expect(datedMismatch).toEqual({ status: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prefetch warms today/−1/−2 without future days", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        seen.push(url);
        const date = new URL(url).searchParams.get("date")!;
        return new Response(JSON.stringify({ ...bsiDayBody, date }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    prefetchDailyFixWindow("2026-03-11");
    await vi.waitFor(() => expect(seen).toHaveLength(3));
    expect(seen).toEqual([
      `${DAILY_FIX_BFF_URL}?date=2026-03-11`,
      `${DAILY_FIX_BFF_URL}?date=2026-03-10`,
      `${DAILY_FIX_BFF_URL}?date=2026-03-09`,
    ]);
  });
});

describe("fetchDailyFixDay", () => {
  it("never invents a sample day when the network fails or the Worker is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })),
    );
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });

    resetDailyFixDayCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });

    resetDailyFixDayCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });

    resetDailyFixDayCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });
  });

  it("loads a stubbed BSI-shaped 200 day without shipping that stub as page content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(`${DAILY_FIX_BFF_URL}?date=2025-02-10`);
      return new Response(JSON.stringify(bsiDayBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDailyFixDay("2025-02-10");
    expect(result.status).toBe("loaded");
    if (result.status === "loaded") {
      expect(result.day.belly.title).toBe("Steak bowls");
      expect(result.day.belly.protein).toBe(34);
      expect(result.day.body.html).toContain("Work");
      expect(result.day.brain.html).toContain("Think");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
