import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  bsiTodayIso,
  dailyFixCanonicalUrl,
  dailyFixHref,
  dailyFixPath,
  extractYoutubeId,
  glassMacroRows,
  isoFromYymmdd,
  isCloserScheduledDay,
  mapHttpsPhotoUrl,
  parseDailyFixRoute,
  plainText,
  readMinutes,
  yymmddFromIso,
  sortedIngredients,
  visibleMacros,
  youtubeEmbedUrl,
  type DailyFixDay,
} from "./model";

describe("tab preview text", () => {
  it("plainText strips tags, decodes entities once, and splits <br>/<p> into spaces", () => {
    expect(plainText('<p dir="ltr">Run 400 m<br />10 pull-ups</p><p>Rest &amp; repeat</p>')).toBe(
      "Run 400 m 10 pull-ups Rest & repeat",
    );
    expect(plainText(null)).toBe("");
  });

  it("readMinutes rounds at 230 wpm with a 1-minute floor; null when empty", () => {
    expect(readMinutes("<p>short</p>")).toBe(1);
    expect(readMinutes(`<p>${"word ".repeat(690)}</p>`)).toBe(3);
    expect(readMinutes("<p> </p>")).toBeNull();
  });
});

describe("Daily Fix routes", () => {
  it("treats a bare path as today and does not emit a date", () => {
    expect(parseDailyFixRoute()).toMatchObject({
      kind: "today",
      iso: null,
      code: null,
      pillar: "belly",
      pillarExplicit: false,
      canonicalPath: "/the-daily-fix",
      tab: null,
    });
    expect(dailyFixPath()).toBe("/the-daily-fix");
  });

  it("keeps YYMMDD as canonical and tabs pillars", () => {
    expect(parseDailyFixRoute({ date: "250210" })).toMatchObject({
      kind: "day",
      iso: "2025-02-10",
      code: "250210",
      canonicalPath: "/the-daily-fix/250210",
      tab: null,
    });
    expect(parseDailyFixRoute({ date: "250210", search: "?tab=brain" })).toMatchObject({
      pillar: "brain",
      pillarExplicit: true,
      canonicalPath: "/the-daily-fix/250210",
      tab: "brain",
    });
    expect(dailyFixPath("250210", "body")).toBe("/the-daily-fix/250210?tab=body");
    expect(dailyFixHref("2025-02-10", "2025-02-10", null)).toBe("/the-daily-fix");
    expect(dailyFixHref("2025-02-10", "2025-02-10", "brain")).toBe("/the-daily-fix?tab=brain");
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
      "/the-daily-fix/250210?utm=1&tab=brain",
    );
  });

  it("lets a path pillar set the tab", () => {
    expect(parseDailyFixRoute({ date: "250210", pillar: "brain" })).toMatchObject({
      pillar: "brain",
      tab: "brain",
    });
  });

  it("drops a bad path pillar without becoming a valid day route", () => {
    expect(parseDailyFixRoute({ date: "250210", pillar: "feet" })).toMatchObject({
      kind: "invalid",
    });
  });

  it("keeps tab in its original query position (edge parity)", () => {
    expect(
      dailyFixCanonicalUrl(
        parseDailyFixRoute({ date: "250210", search: "?tab=brain" }),
        "?a=%2F&tab=brain&b=c+d",
      ),
    ).toBe("/the-daily-fix/250210?a=%2F&tab=brain&b=c+d");
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

  it("glass macros gate keeps only values > 0 in Protein/Fat/Carbs order", () => {
    expect(glassMacroRows({ fat: 12, carb: null, protein: 30 })).toEqual([
      { label: "Protein", grams: 30 },
      { label: "Fat", grams: 12 },
    ]);
    expect(glassMacroRows({ fat: 0, carb: 0, protein: 0 })).toEqual([]);
    expect(glassMacroRows({ fat: null, carb: null, protein: null })).toEqual([]);
    expect(glassMacroRows({ fat: 0, carb: 5, protein: null })).toEqual([{ label: "Carbs", grams: 5 }]);
    expect(glassMacroRows({ fat: -1, carb: 0, protein: null })).toEqual([]);
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

describe("belly media URL helpers", () => {
  it("mapHttpsPhotoUrl keeps trimmed https only (PR #5 lock — no http upgrade)", () => {
    expect(mapHttpsPhotoUrl("  https://cdn.example.com/steak.jpg  ")).toBe("https://cdn.example.com/steak.jpg");
    expect(mapHttpsPhotoUrl("http://cdn.example.com/steak.jpg")).toBeNull();
    expect(mapHttpsPhotoUrl("")).toBeNull();
    expect(mapHttpsPhotoUrl("   ")).toBeNull();
    expect(mapHttpsPhotoUrl(null)).toBeNull();
    expect(mapHttpsPhotoUrl("/relative.jpg")).toBeNull();
  });

  it("C2: javascript: and data: photo URLs map to null", () => {
    expect(mapHttpsPhotoUrl("javascript:alert(1)")).toBeNull();
    expect(mapHttpsPhotoUrl("data:image/png;base64,AAAA")).toBeNull();
  });

  it("extractYoutubeId accepts watch / youtu.be / embed / shorts / live and strips &t=", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=jHXO-qIk28A")).toBe("jHXO-qIk28A");
    expect(extractYoutubeId("https://www.youtube.com/watch?v=jHXO-qIk28A&t=12s")).toBe("jHXO-qIk28A");
    expect(extractYoutubeId("https://youtu.be/jHXO-qIk28A")).toBe("jHXO-qIk28A");
    expect(extractYoutubeId("https://www.youtube.com/embed/jHXO-qIk28A")).toBe("jHXO-qIk28A");
    expect(extractYoutubeId("https://www.youtube.com/shorts/jHXO-qIk28A")).toBe("jHXO-qIk28A");
    expect(extractYoutubeId("https://www.youtube.com/live/jHXO-qIk28A")).toBe("jHXO-qIk28A");
  });

  it("unparseable yt → null (no play UI id)", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(extractYoutubeId("https://example.com/watch?v=jHXO-qIk28A")).toBeNull();
    expect(extractYoutubeId("not a url")).toBeNull();
    expect(extractYoutubeId("")).toBeNull();
    expect(extractYoutubeId(null)).toBeNull();
    expect(extractYoutubeId("jHXO-qIk28A")).toBeNull();
  });

  it("C3: wrong-length ids and youtube.com with no id map to null", () => {
    expect(extractYoutubeId("abcdefghij")).toBeNull();
    expect(extractYoutubeId("abcdefghijkl")).toBeNull();
    expect(extractYoutubeId("https://www.youtube.com/")).toBeNull();
    expect(extractYoutubeId("https://www.youtube.com/watch")).toBeNull();
  });

  it("youtubeEmbedUrl builds autoplay embed from id only", () => {
    expect(youtubeEmbedUrl("jHXO-qIk28A")).toBe(
      "https://www.youtube.com/embed/jHXO-qIk28A?autoplay=1&rel=0&playsinline=1",
    );
  });
});
