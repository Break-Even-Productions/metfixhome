import { describe, expect, it } from "vitest";
import type { PrOverviewRow } from "@/lib/account";
import { buildPrCatalog, catalogItems, movementScoreKind, workoutBenchmarkSlug } from "./prCatalog";

function row(partial: Partial<PrOverviewRow> & Pick<PrOverviewRow, "name">): PrOverviewRow {
  return {
    type: "measurement",
    custom_workout_id: null,
    measurement_id: 1,
    best_score: 100,
    last_score: 90,
    total_entries: 1,
    unit_abbreviation: "lb",
    score_unit_id: 1,
    benchmark_classification: null,
    is_benchmark: false,
    ...partial,
  };
}

describe("pr catalog grouping", () => {
  it("keeps unlogged catalog options and groups by type", () => {
    const sections = buildPrCatalog({
      movements: [
        row({ name: "Bench Press 5RM", measurement_id: 2, best_score: 145 }),
        row({ name: "Bench Press 3RM", measurement_id: 3, best_score: null }),
        row({
          name: "5k Row",
          measurement_id: 4,
          score_mode: "time",
          unit_abbreviation: "sec",
          score_unit_id: null,
          best_score: null,
        }),
        row({ name: "Snatch 1RM", measurement_id: 5, best_score: null }),
      ],
      workouts: [
        row({
          name: "Fran",
          type: "workout",
          measurement_id: null,
          custom_workout_id: 9,
          benchmark_classification: "girl",
          unit_abbreviation: null,
          score_unit_id: null,
          best_score: 180,
        }),
        row({
          name: "Murph",
          type: "workout",
          measurement_id: null,
          custom_workout_id: 10,
          benchmark_classification: "hero",
          unit_abbreviation: null,
          score_unit_id: null,
          best_score: null,
        }),
      ],
    });
    expect(sections.map((section) => `${section.family}:${section.title}`)).toEqual([
      "Movements:Weight",
      "Movements:Time",
      "Benchmarks:Girls",
      "Benchmarks:Heroes",
    ]);
    expect(workoutBenchmarkSlug("girl")).toBe("girls");
    expect(movementScoreKind(row({ name: "Run", score_mode: "distance", unit_abbreviation: "m", score_unit_id: null }))).toBe(
      "distance",
    );
    const weight = sections[0]!;
    const items = catalogItems(weight.rows);
    expect(items.map((item) => item.title)).toEqual(["Bench Press", "Snatch"]);
    expect(items[0]?.tags).toEqual([
      { label: "3RM", logged: false },
      { label: "5RM 145 lb", logged: true },
    ]);
    expect(items[0]?.logged).toBe(true);
    expect(items[1]?.tags).toEqual([{ label: "Not logged", logged: false }]);
    expect(items[1]?.logged).toBe(false);
  });
});
