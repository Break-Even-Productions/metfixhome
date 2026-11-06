/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { clearAccountCache } from "@/lib/account";
import { clearCsrfCache } from "@/lib/authRequest";
import { OVERVIEW_FIXTURE, SUBS_ACTIVE, jsonResponse } from "../../../test/account/testFixtures";
import AccountWorkouts from "./AccountWorkouts";
import { addDays, todayYmd } from "./bodyDates";

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

describe("AccountWorkouts", () => {
  it("shows a skeleton, then live sessions, and logs a session", async () => {
    const today = todayYmd();
    const tomorrow = addDays(today, 1);
    let releaseWorkouts: (value: Response) => void = () => {};
    const workoutsGate = new Promise<Response>((resolve) => {
      releaseWorkouts = resolve;
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/api/auth/csrf")) return jsonResponse({ csrf: "tok" });
      if (url.includes("/api/account/overview")) return jsonResponse(OVERVIEW_FIXTURE);
      if (url.includes("/api/account/subscriptions")) return jsonResponse(SUBS_ACTIVE);
      if (url.includes("/api/daily-fix")) {
        return jsonResponse({ body: { title: "Daily Engine" } });
      }
      if (url.includes("/api/account/workouts/planned")) {
        return jsonResponse({
          planned_workouts: [
            {
              id: 10,
              plan_date: today,
              workout_source: "custom",
              workout_source_id: 3,
              logged: 1,
              sort_order: 0,
              title: "Hidden Planned",
            },
            {
              id: 9,
              plan_date: tomorrow,
              workout_source: "daily_fix",
              workout_source_id: null,
              logged: 0,
              sort_order: 0,
              title: null,
            },
          ],
        });
      }
      if (url.includes("/api/account/workouts?") && method === "GET") return workoutsGate;
      if (method === "POST" && url.endsWith("/api/account/workouts")) {
        return jsonResponse({ ok: true, workout: null });
      }
      return jsonResponse({ error: "not_found" }, 404);
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(
      <Router>
        <AccountWorkouts />
      </Router>,
    );

    await waitFor(() => {
      expect(document.querySelector('[aria-label="Loading workouts"]')).toBeTruthy();
    });
    expect(screen.queryByText("Back Squat")).toBeNull();
    expect(screen.queryByText("Fran")).toBeNull();
    expect(screen.queryByText("Hidden Planned")).toBeNull();

    releaseWorkouts(
      jsonResponse({
        workouts: [
          {
            id: 4,
            workout_title: "Back Squat",
            date_time: `${today} 09:00:00`,
            calories_burned: null,
            activity_minutes: 40,
            workout_source: "custom",
            workout_source_id: 8,
            workout_free_text: null,
            scaling_mode: null,
            score_entries: [],
            photo_url: null,
          },
        ],
      }),
    );

    await waitFor(() => expect(screen.getByText("Back Squat")).toBeTruthy());
    expect(screen.getAllByText("Rest day").length).toBeGreaterThan(0);
    expect(screen.queryByText("Fran")).toBeNull();
    expect(screen.queryByText("Hidden Planned")).toBeNull();
    expect(document.querySelector(".dash-panel--body .account-body-watermark")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Upcoming" }));
    await waitFor(() => expect(screen.getByText("Daily Engine")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Log a session" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Easy row" } });
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));
    await waitFor(() => expect(screen.getByText("Session logged.")).toBeTruthy());
    const post = fetchImpl.mock.calls.find((call) => {
      const method = ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return method === "POST" && String(call[0]).endsWith("/api/account/workouts");
    });
    expect(post).toBeTruthy();
    const sent = JSON.parse(String((post?.[1] as RequestInit).body)) as {
      workout_title: string;
      date_time: string;
    };
    expect(sent.workout_title).toBe("Easy row");
    expect(sent.date_time).toBe(today);
  });

  it("keeps a locked feed on a skeleton without sample sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/account/overview")) {
          return jsonResponse({ ...OVERVIEW_FIXTURE, canonical_tier: "free" });
        }
        if (url.includes("/api/account/subscriptions")) {
          return jsonResponse({ canonical_tier: "free", items: [] });
        }
        return jsonResponse({ error: "not_found" }, 404);
      }),
    );
    render(
      <Router>
        <AccountWorkouts />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Unlock the workout feed")).toBeTruthy());
    expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
    expect(document.querySelector('[aria-label="Workout feed locked"]')).toBeTruthy();
    expect(screen.queryByText("Back Squat")).toBeNull();
    expect(screen.queryByText("Fran")).toBeNull();
  });
});
