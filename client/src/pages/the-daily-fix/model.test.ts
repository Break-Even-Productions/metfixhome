import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  bsiTodayIso,
  dailyFixCanonicalUrl,
  dailyFixHref,
  dailyFixPath,
  isoFromYymmdd,
  isCloserScheduledDay,
  parseDailyFixRoute,
  yymmddFromIso,
  sortedIngredients,
  visibleMacros,
  type DailyFixDay,
} from "./model";

describe("Daily Fix routes", () => {
  it("treats a bare path as today and does not emit a date", () => {
    expect(parseDailyFixRoute()).toMatchObject({
      kind: "today",
      iso: null,
      code: null,
      pillar: "belly",
      pillarExplicit: false,
      canonicalPath: "/the-daily-fix",
      canonicalHash: "",
    });
    expect(dailyFixPath()).toBe("/the-daily-fix");
  });

  it("keeps YYMMDD as canonical and hashes pillars", () => {
    expect(parseDailyFixRoute({ date: "250210" })).toMatchObject({
      kind: "day",
      iso: "2025-02-10",
      code: "250210",
      canonicalPath: "/the-daily-fix/250210",
      canonicalHash: "",
    });
    expect(parseDailyFixRoute({ date: "250210", hash: "#brain" })).toMatchObject({
      pillar: "brain",
      pillarExplicit: true,
      canonicalPath: "/the-daily-fix/250210",
      canonicalHash: "#brain",
    });
    expect(dailyFixPath("250210", "body")).toBe("/the-daily-fix/250210#body");
    expect(dailyFixHref("2025-02-10", "2025-02-10", null)).toBe("/the-daily-fix");
    expect(dailyFixHref("2025-02-10", "2025-02-10", "brain")).toBe("/the-daily-fix#brain");
    expect(dailyFixHref("2025-02-11", "2025-02-10", null)).toBe("/the-daily-fix/250210");
  });

  it("rewrites hyphenated, 8-digit, and slash dates to YYMMDD", () => {
    expect(parseDailyFixRoute({ date: "2025-02-10" }).code).toBe("250210");
    expect(parseDailyFixRoute({ date: "20250210" }).code).toBe("250210");
    expect(parseDailyFixRoute({ yy: "25", mm: "02", dd: "10" })).toMatchObject({
      kind: "day",
      code: "250210",
      canonicalPath: "/the-daily-fix/250210",
    });
    expect(dailyFixCanonicalUrl(parseDailyFixRoute({ date: "2025-02-10", pillar: "brain" }), "?utm=1")).toBe(
      "/the-daily-fix/250210?utm=1#brain",
    );
  });

  it("lets a path pillar win over a hash, then uses that hash", () => {
    expect(parseDailyFixRoute({ date: "250210", pillar: "brain", hash: "#body" })).toMatchObject({
      pillar: "brain",
      canonicalHash: "#brain",
    });
  });

  it("drops a bad pillar hash or path without becoming an invalid date", () => {
    expect(parseDailyFixRoute({ date: "250210", pillar: "feet" })).toMatchObject({
      kind: "day",
      pillar: "belly",
      pillarExplicit: false,
      canonicalHash: "",
    });
    expect(parseDailyFixRoute({ date: "250210", hash: "#feet" })).toMatchObject({
      kind: "day",
      pillar: "belly",
      pillarExplicit: false,
      canonicalHash: "",
    });
    expect(parseDailyFixRoute({ hash: "#feet" })).toMatchObject({
      kind: "today",
      pillar: "belly",
      canonicalPath: "/the-daily-fix",
      canonicalHash: "",
    });
    expect(parseDailyFixRoute({ hash: "#brain" })).toMatchObject({
      kind: "today",
      pillar: "brain",
      canonicalHash: "#brain",
    });
  });

  it("does not rewrite malformed or out-of-range dates", () => {
    const invalid = [
      { date: "250231" },
      { date: "20250231" },
      { date: "2025-02-31" },
      { yy: "25", mm: "02", dd: "31" },
      { yy: "25", mm: "2", dd: "10" },
      { date: "19990210" },
      { date: "25" },
    ];
    for (const input of invalid) {
      expect(parseDailyFixRoute(input).kind, JSON.stringify(input)).toBe("invalid");
      expect(parseDailyFixRoute(input).canonicalPath).toBe("");
    }
    expect(isoFromYymmdd("250229")).toBeNull();
    expect(isoFromYymmdd("240229")).toBe("2024-02-29");
    expect(yymmddFromIso("2025-02-10")).toBe("250210");
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
    expect(addCalendarDays("2025-02-11", 1)).toBe("2025-02-12");
    expect(isCloserScheduledDay({ date: "2025-02-12", requested_date: "2025-02-11" } as DailyFixDay, "2025-02-12")).toBe(true);
    expect(isCloserScheduledDay({ date: "2025-02-12", requested_date: "2025-02-11" } as DailyFixDay, "2025-02-11")).toBe(true);
    expect(isCloserScheduledDay({ date: "2025-02-11", requested_date: "2025-02-11" } as DailyFixDay, "2025-02-11")).toBe(false);
    expect(isCloserScheduledDay({ date: "2025-02-11" } as DailyFixDay, "2025-02-11")).toBe(false);
  });
});
