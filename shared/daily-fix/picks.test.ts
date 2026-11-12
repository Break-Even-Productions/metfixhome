import { describe, expect, it } from "vitest";
import { dailyFixPicks, recentDailyFixDates } from "./picks";

describe("daily fix list picks", () => {
  it("reads component ids and strips titles", () => {
    const picks = dailyFixPicks({
      date: "2026-11-06",
      belly: { id: 11, title: "Steak <em>fajitas</em>" },
      body: { id: 22, title: "Squat" },
      brain: { id: 33, title: "Sleep" },
    });
    expect(picks).toEqual([
      { source_type: "daily_mod", source_id: 11, title: "Steak fajitas", date: "2026-11-06" },
      { source_type: "daily_workout", source_id: 22, title: "Squat", date: "2026-11-06" },
      { source_type: "daily_article", source_id: 33, title: "Sleep", date: "2026-11-06" },
    ]);
  });

  it("walks back from the BSI calendar day", () => {
    const dates = recentDailyFixDates(3, new Date("2026-11-06T12:00:00Z"));
    expect(dates).toEqual(["2026-11-06", "2026-11-05", "2026-11-04"]);
  });
});