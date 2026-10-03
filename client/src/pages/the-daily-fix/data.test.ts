import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_FIX_BFF_URL,
  dailyFixRequestUrl,
  fetchDailyFixDay,
  fetchIsoForRoute,
  mapDailyFixDay,
} from "./data";
import { bsiTodayIso, parseDailyFixRoute } from "./model";

const sampleDayBody = {
  date: "2025-02-10",
  belly: {
    title: "Steak bowls",
    fat: 22,
    carb: null,
    protein: 34,
    has_structured_ingredients: true,
    has_structured_steps: true,
    recipe_ingredients: [
      { display: "Eggs", sort_order: 1 },
      { display: "Salt", sort_order: 2 },
    ],
    recipe_steps: [{ instruction: "Cook.", sort_order: 1 }],
  },
  body: { title: "Push", html: "<p>Work</p>" },
  brain: { title: "Read", html: "<p>Think</p>", article_url: "https://example.com", button_text: "FULL ARTICLE" },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe("mapDailyFixDay", () => {
  it("loads a day body and sets requested_date when the Worker returns a closer day", () => {
    const day = mapDailyFixDay(sampleDayBody, "2025-02-10");
    expect(day?.belly.title).toBe("Steak bowls");
    expect(day?.belly.fat).toBe(22);
    expect(day?.belly.carb).toBeNull();
    expect(day?.belly.recipe_ingredients.map((item) => item.display)).toEqual(["Eggs", "Salt"]);
    expect(day?.requested_date).toBeUndefined();

    const closer = mapDailyFixDay({ ...sampleDayBody, date: "2025-02-12" }, "2025-02-10");
    expect(closer?.date).toBe("2025-02-12");
    expect(closer?.requested_date).toBe("2025-02-10");
  });

  it("rejects error objects and missing day fields", () => {
    expect(mapDailyFixDay({ error: "unavailable" }, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay({}, "2025-02-10")).toBeNull();
    expect(mapDailyFixDay(null, "2025-02-10")).toBeNull();
  });
});

describe("fetchDailyFixDay", () => {
  it("never invents a sample day when the network fails or the Worker is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })),
    );
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await fetchDailyFixDay("2025-02-10")).toEqual({ status: "unavailable" });
  });

  it("loads a stubbed 200 day without shipping that stub as page content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(`${DAILY_FIX_BFF_URL}?date=2025-02-10`);
      return new Response(JSON.stringify(sampleDayBody), {
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
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
