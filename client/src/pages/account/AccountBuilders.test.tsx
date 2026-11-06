/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import { clearCsrfCache } from "@/lib/authRequest";
import { OVERVIEW_FIXTURE, SUBS_ACTIVE, jsonResponse } from "../../../test/account/testFixtures";
import AccountTrainingPlanBuilder from "./AccountTrainingPlanBuilder";
import AccountQuickLog from "./AccountQuickLog";
import AccountWorkoutBuilder from "./AccountWorkoutBuilder";
import { todayYmd } from "./bodyDates";

vi.mock("@/lib/session", () => ({
  loadMe: vi.fn(async () => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
  refreshMeAfterAuthChange: vi.fn(),
  peekMe: vi.fn(() => ({
    status: "signed_in",
    public_name: "Ada Lovelace",
    moderator: false,
  })),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

beforeEach(() => {
  clearAccountCache();
  clearCsrfCache();
});

afterEach(() => {
  cleanup();
  clearAccountCache();
  clearCsrfCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function accountFetch(extra: (url: string, method: string, body: string) => Response | null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : "";
    if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "tok" });
    if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
    if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
    const hit = extra(url, method, body);
    if (hit) return hit;
    return jsonResponse({ error: "not_found" }, 404);
  });
}

describe("workout and plan builders", () => {
  it("saves a workout structure from the movement catalog", async () => {
    const fetchImpl = accountFetch((url, method) => {
      if (url.includes("/api/account/custom-workouts?") && method === "GET") {
        return jsonResponse({ workouts: [] });
      }
      if (url.includes("/api/account/movements") && method === "GET") {
        return jsonResponse({
          movements: [{ id: 12, name: "Thruster", category: "barbell" }],
        });
      }
      if (url.endsWith("/api/account/custom-workouts") && method === "POST") {
        return jsonResponse({ id: 44, title: "Fran", logging_type: "time" });
      }
      return null;
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(
      <Router>
        <AccountWorkoutBuilder />
      </Router>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Save workout" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fran" } });
    fireEvent.change(screen.getByLabelText("Add a movement"), { target: { value: "thru" } });
    fireEvent.click(screen.getByRole("button", { name: "Find movement" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Thruster/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Thruster/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save workout" }));

    await waitFor(() => expect(screen.getByText("Saved Fran.")).toBeTruthy());
    const post = fetchImpl.mock.calls.find((call) => {
      const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return method === "POST" && String(call[0]).endsWith("/api/account/custom-workouts");
    });
    const sent = JSON.parse(String((post?.[1] as RequestInit).body)) as {
      logging_type: string;
      structure: { version: number; segments: Array<{ steps: Array<{ movement_id: number; prescription: { reps: number } }> }> };
    };
    expect(sent.logging_type).toBe("time");
    expect(sent.structure.version).toBe(1);
    expect(sent.structure.segments[0]?.steps[0]).toMatchObject({
      movement_id: 12,
      prescription: { reps: 10 },
    });
  });

  it("posts Rx scores and movement actuals", async () => {
    const today = todayYmd();
    const fetchImpl = accountFetch((url, method) => {
      if (url.includes("/api/account/custom-workouts?") && method === "GET") {
        return jsonResponse({ workouts: [{ id: 8, title: "Fran", photo_url: null }] });
      }
      if (url.includes("/api/account/custom-workouts/8") && method === "GET") {
        return jsonResponse({
          id: 8,
          title: "Fran",
          photo_url: null,
          logging_type: "time",
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
                    movement_name: "Thruster",
                    prescription: { reps: 21, weight: 95, weight_unit_id: 1 },
                  },
                ],
              },
            ],
          },
          workout_items: [
            {
              workout_item_id: 3,
              logging_type: "time",
              scoring_direction: "lower_better",
              scoring_field: "time",
              title: "Time",
              mirror_measurement_id: null,
            },
          ],
        });
      }
      if (url.includes("/api/account/daily-fix") && method === "GET") {
        return jsonResponse({ date: today, title: null, workout_id: null, custom_workout_id: null });
      }
      if (url.endsWith("/api/account/workouts") && method === "POST") {
        return jsonResponse({ ok: true, workout: null });
      }
      return null;
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(
      <Router>
        <AccountQuickLog />
      </Router>,
    );

    fireEvent.click(screen.getByRole("button", { name: /My workout/i }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "My workouts" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Fran" }));
    await waitFor(() => expect(screen.getByLabelText(/Time/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Time/), { target: { value: "3:00" } });
    fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "21" } });
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "95" } });
    fireEvent.click(screen.getByRole("button", { name: "Log workout" }));

    await waitFor(() => expect(screen.getByText("Workout logged.")).toBeTruthy());
    const post = fetchImpl.mock.calls.find((call) => {
      const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return method === "POST" && String(call[0]).endsWith("/api/account/workouts");
    });
    const sent = JSON.parse(String((post?.[1] as RequestInit).body)) as {
      scaling_mode: string;
      workout_source: string;
      scores: Array<{ score_value: number }>;
      movement_actuals: Array<{ movement_id: number; reps: number; weight: number }>;
    };
    expect(sent.scaling_mode).toBe("rx");
    expect(sent.workout_source).toBe("custom");
    expect(sent.scores[0]?.score_value).toBe(180);
    expect(sent.movement_actuals[0]).toMatchObject({
      movement_id: 12,
      segment_id: "seg-1",
      step_order: 0,
      reps: 21,
      weight: 95,
      weight_unit_id: 1,
    });
  });

  it("saves a plan draft that can keep a meal block", async () => {
    const fetchImpl = accountFetch((url, method) => {
      if (url.includes("/api/account/custom-workouts?") && method === "GET") {
        return jsonResponse({ workouts: [{ id: 8, title: "Fran", photo_url: null }] });
      }
      if (url.includes("/api/account/plans/4") && method === "GET") {
        return jsonResponse({
          plan: {
            id: 4,
            title: "Engine week",
            description: null,
            duration_days: 7,
            visibility: "invite_only",
            status: "draft",
            is_active: true,
            can_edit: true,
            days: [
              {
                day_index: 0,
                notes: null,
                items: [
                  {
                    item_type: "meal",
                    sort_order: 0,
                    label: "Breakfast bowl",
                    recipe_source_type: "custom_recipe",
                    recipe_source_id: 14,
                    servings: 1,
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.endsWith("/api/account/plans/4") && method === "PUT") {
        return jsonResponse({
          plan: {
            id: 4,
            title: "Engine week",
            description: null,
            duration_days: 7,
            visibility: "invite_only",
            status: "draft",
            is_active: true,
            can_edit: true,
            days: [],
          },
        });
      }
      return null;
    });
    vi.stubGlobal("fetch", fetchImpl);
    window.history.pushState({}, "", "/account/plans/4");

    render(
      <Router>
        <AccountTrainingPlanBuilder />
      </Router>,
    );

    await waitFor(() => expect(screen.getByDisplayValue("Engine week")).toBeTruthy());
    expect(screen.getByText("Breakfast bowl")).toBeTruthy();
    expect(screen.getByText("Meal editing stays with meals.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add my workout"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Add workout" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(screen.getByText("Draft saved.")).toBeTruthy());
    const put = fetchImpl.mock.calls.find((call) => {
      const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return method === "PUT" && String(call[0]).endsWith("/api/account/plans/4");
    });
    const sent = JSON.parse(String((put?.[1] as RequestInit).body)) as {
      replace_days: boolean;
      days: Array<{ items: Array<{ item_type: string; recipe_source_id?: number; workout_source_id?: number }> }>;
    };
    expect(sent.replace_days).toBe(true);
    expect(sent.days[0]?.items.map((item) => item.item_type)).toEqual(["meal", "workout"]);
    expect(sent.days[0]?.items[0]?.recipe_source_id).toBe(14);
    expect(sent.days[0]?.items[1]?.workout_source_id).toBe(8);
  });
});
