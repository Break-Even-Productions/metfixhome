import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  bsiTodayIso,
  dailyFixPath,
  isCloserScheduledDay,
  isIsoDate,
  parseDailyFixRoute,
  parsePillar,
  sortedIngredients,
  visibleMacros,
  type DailyFixDay,
} from "./model";
import { loadDailyFixState } from "./data";

describe("Daily Fix routes", () => {
  it("treats a bare path as today with the default pillar view", () => {
    expect(parseDailyFixRoute()).toEqual({
      kind: "today",
      date: null,
      pillar: "belly",
      pillarInUrl: false,
    });
    expect(dailyFixPath()).toBe("/the-daily-fix");
  });

  it("keeps YYYY-MM-DD days and optional pillars", () => {
    expect(parseDailyFixRoute("2025-02-11")).toMatchObject({
      kind: "day",
      date: "2025-02-11",
      pillar: "belly",
      pillarInUrl: false,
    });
    expect(parseDailyFixRoute("2025-02-11", "brain")).toMatchObject({
      kind: "day",
      pillar: "brain",
      pillarInUrl: true,
    });
    expect(dailyFixPath("2025-02-11", "body")).toBe("/the-daily-fix/2025-02-11/body");
  });

  it("falls invalid pillars back to belly and rejects YYMMDD", () => {
    expect(parsePillar("nope")).toBe("belly");
    expect(parseDailyFixRoute("2025-02-11", "legs").pillar).toBe("belly");
    expect(parseDailyFixRoute("250211").kind).toBe("invalid");
    expect(isIsoDate("2025-02-31")).toBe(false);
    expect(isIsoDate("2025-02-11")).toBe(true);
  });
});

describe("BSI today", () => {
  it("uses Etc/GMT-2 rather than the machine's local date", () => {
    const utcLate = new Date("2026-03-10T23:30:00.000Z");
    expect(bsiTodayIso(utcLate)).toBe("2026-03-11");
    const utcEarly = new Date("2026-03-10T00:30:00.000Z");
    expect(bsiTodayIso(utcEarly)).toBe("2026-03-10");
  });
});

describe("static load state", () => {
  it("never invents a sample day", () => {
    expect(loadDailyFixState("today")).toEqual({ status: "unavailable" });
    expect(loadDailyFixState("day")).toEqual({ status: "unavailable" });
    expect(loadDailyFixState("invalid")).toEqual({ status: "invalid" });
  });
});

describe("day contract helpers", () => {
  it("omits null macros and does not invent a basis", () => {
    expect(visibleMacros({ fat: 12, carb: null, protein: 30 })).toEqual([
      { label: "Fat", grams: 12 },
      { label: "Protein", grams: 30 },
    ]);
  });

  it("sorts structured recipe fields without group labels", () => {
    expect(
      sortedIngredients([
        { display: "Salt", sort_order: 2 },
        { display: "Eggs", sort_order: 1 },
      ]).map((item) => item.display),
    ).toEqual(["Eggs", "Salt"]);
  });

  it("flags a closer scheduled day", () => {
    const day = { date: "2025-02-12", requested_date: "2025-02-11" } as DailyFixDay;
    expect(isCloserScheduledDay(day, "2025-02-11")).toBe(true);
    expect(addCalendarDays("2025-02-11", 1)).toBe("2025-02-12");
  });
});
