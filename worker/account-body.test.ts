import { describe, expect, it } from "vitest";
import {
  directoryQuery,
  movementQuery,
  parseYmdRange,
  shapeCoachingClient,
  shapeCustomWorkout,
  shapeDirectory,
  shapePlannedWorkouts,
  shapeSparkUserInfo,
  shapeWorkoutLogs,
  validateCustomWorkoutBody,
  validateLogWorkoutBody,
  validatePlanWriteBody,
} from "./account-body";

describe("account body shapers", () => {
  it("keeps workout titles and drops user ids", () => {
    const shaped = shapeWorkoutLogs({
      workouts: [
        {
          id: 4,
          user_id: 99,
          workout_title: "Back Squat",
          date_time: "2026-11-06 09:00:00",
          activity_minutes: "40",
          calories_burned: 280,
          workout_source: "custom",
          workout_source_id: 8,
          score_entries: [{ score_type: "load", score_value: 225, scaling_mode: "rx" }],
          movement_actuals: [
            { movement_id: 12, movement_name: "Back Squat", reps: 5, weight: 225, weight_unit_id: 1 },
          ],
          photo_url: "http://insecure.example/a.jpg",
        },
      ],
    });
    const row = (shaped.workouts as Array<Record<string, unknown>>)[0]!;
    expect(row.workout_title).toBe("Back Squat");
    expect(row.activity_minutes).toBe(40);
    expect(row.photo_url).toBeNull();
    expect(row.movement_actuals).toEqual([
      { movement_id: 12, movement_name: "Back Squat", reps: 5, weight: 225, weight_unit_id: 1 },
    ]);
    expect(row).not.toHaveProperty("user_id");
    expect(JSON.stringify(shaped)).not.toContain("99");
  });

  it("rejects inverted and oversized workout ranges", () => {
    expect(parseYmdRange("2026-11-06", "2026-11-01")).toBeNull();
    expect(parseYmdRange("2026-02-31", "2026-03-01")).toBeNull();
    expect(parseYmdRange("2024-01-01", "2026-11-06")).toBeNull();
    expect(parseYmdRange("2026-11-01", "2026-11-06")).toEqual({
      start: "2026-11-01",
      end: "2026-11-06",
    });
  });

  it("requires a title and a real date to log a workout", () => {
    expect(validateLogWorkoutBody({ date_time: "2026-11-06" })).toEqual({ ok: false });
    const ok = validateLogWorkoutBody({
      workout_title: "  Easy row  ",
      date_time: "2026-11-06",
      activity_minutes: 20,
    });
    expect(ok).toEqual({
      ok: true,
      body: {
        workout_title: "Easy row",
        date_time: "2026-11-06 12:00:00",
        activity_minutes: 20,
      },
    });
  });

  it("shapes client coaches and drops non-https directory avatars", () => {
    const hub = shapeCoachingClient({
      coaches: [
        {
          id: 3,
          status: "pending",
          invited_by: "coach",
          coach: { user_id: 12, display_name: "Ada Coach" },
        },
      ],
      affiliates: [{ affiliate_id: 2, name: "North Gym", member_count: 14 }],
    });
    expect(hub.coaches).toEqual([
      {
        id: 3,
        status: "pending",
        invited_by: "coach",
        viewer_is_coach: false,
        counterparty: {
          user_id: "12",
          name: "Ada Coach",
          display_name: "Ada Coach",
        },
      },
    ]);
    const directory = shapeDirectory({
      trainers: [{ user_id: "7", name: "Sam", avatar: "javascript:alert(1)" }],
    });
    expect((directory.trainers as Array<{ avatar: string | null }>)[0]?.avatar).toBeNull();
  });

  it("keeps unlogged planned rows and rejects a bad directory query", () => {
    const planned = shapePlannedWorkouts({
      planned_workouts: [
        {
          id: 5,
          plan_date: "2026-11-07",
          workout_source: "daily_fix",
          workout_source_id: 11,
          logged: 0,
        },
      ],
    });
    expect(planned.planned_workouts).toHaveLength(1);
    expect(directoryQuery(new URLSearchParams("limit=99"))).toBeNull();
    expect(directoryQuery(new URLSearchParams("name=ada&limit=10"))).toContain("name=ada");
  });

  it("saves a workout structure and logs Rx scores with movement actuals", () => {
    const saved = validateCustomWorkoutBody(
      {
        title: "Fran",
        logging_type: "time",
        user_id: 99,
        structure: {
          version: 1,
          segments: [
            {
              id: "seg-1",
              preset: "straight",
              steps: [
                {
                  movement_id: 12,
                  order: 0,
                  label: "Thruster",
                  prescription: { reps: 21, weight: 95, weight_unit_id: 1 },
                  prescription_female: { weight: 65, weight_unit_id: 1 },
                },
              ],
            },
          ],
        },
      },
      "create",
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.body).not.toHaveProperty("user_id");
    const structure = saved.body.structure as {
      segments: Array<{ steps: Array<{ prescription_female: { weight: number } }> }>;
    };
    expect(structure.segments[0]?.steps[0]?.prescription_female.weight).toBe(65);

    const echoed = shapeCustomWorkout({
      id: 8,
      title: "Fran",
      user_id: 99,
      logging_type: "time",
      structure: saved.body.structure,
      workout_items: [
        {
          id: 3,
          logging_type: "time",
          scoring_field: "time",
          scoring_direction: "lower_better",
          title: "Time",
        },
      ],
    });
    expect(echoed?.logging_type).toBe("time");
    expect(echoed).not.toHaveProperty("user_id");
    expect(echoed?.workout_items).toEqual([
      {
        workout_item_id: 3,
        logging_type: "time",
        scoring_direction: "lower_better",
        scoring_field: "time",
        title: "Time",
        mirror_measurement_id: null,
      },
    ]);

    const logged = validateLogWorkoutBody({
      workout_title: "Fran",
      date_time: "2026-11-06 12:00:00",
      workout_source: "custom",
      workout_source_id: 8,
      scaling_mode: "rx",
      scores: [{ score_type: "time", score_value: 180, workout_item_id: 3, scoring_direction: "lower_better" }],
      movement_actuals: [
        { movement_id: 12, segment_id: "seg-1", step_order: 0, reps: 21, weight: 95, weight_unit_id: 1 },
      ],
    });
    expect(logged).toEqual({
      ok: true,
      body: {
        workout_title: "Fran",
        date_time: "2026-11-06 12:00:00",
        workout_source: "custom",
        workout_source_id: 8,
        scaling_mode: "rx",
        scores: [
          {
            score_type: "time",
            score_value: 180,
            workout_item_id: 3,
            scoring_direction: "lower_better",
          },
        ],
        movement_actuals: [
          {
            movement_id: 12,
            segment_id: "seg-1",
            step_order: 0,
            reps: 21,
            weight: 95,
            weight_unit_id: 1,
          },
        ],
      },
    });
    expect(movementQuery(new URLSearchParams("search=" + "x".repeat(81)))).toBeNull();
  });

  it("keeps meal items when a plan rewrite is saved", () => {
    const saved = validatePlanWriteBody(
      {
        title: "Engine week",
        duration_days: 7,
        visibility: "invite_only",
        replace_days: true,
        days: [
          {
            day_index: 0,
            items: [
              {
                item_type: "meal",
                sort_order: 0,
                label: "Breakfast bowl",
                recipe_source_type: "custom_recipe",
                recipe_source_id: 14,
                servings: 1,
              },
              {
                item_type: "workout",
                sort_order: 1,
                label: "Daily Fix",
                workout_source: "daily_fix",
                relative_to_schedule_date: true,
              },
            ],
          },
        ],
      },
      "create",
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const days = saved.body.days as Array<{ items: Array<{ item_type: string; recipe_source_id?: number }> }>;
    expect(days[0]?.items.map((item) => item.item_type)).toEqual(["meal", "workout"]);
    expect(days[0]?.items[0]?.recipe_source_id).toBe(14);
  });

  it("keeps only training gender from spark user info", () => {
    expect(
      shapeSparkUserInfo({
        training_gender: "female",
        weight_display_unit: "kg",
        email: "ada@example.test",
        user_id: 99,
      }),
    ).toEqual({ training_gender: "female", weight_display_unit: "kg" });
    expect(shapeSparkUserInfo({ training_gender: "other" })).toEqual({
      training_gender: null,
      weight_display_unit: null,
    });
  });
});
