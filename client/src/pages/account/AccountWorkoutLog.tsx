import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { basePath } from "@/const";
import {
  deleteWorkoutLog,
  loadCustomWorkout,
  loadWorkoutLog,
  type CustomWorkoutSummary,
  type WorkoutLogItem,
  type WorkoutMovementActual,
  type WorkoutStructureStep,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { formatDayLabel, formatScoreNumber, todayYmd } from "./bodyDates";

function sourceLabel(source: string | null): string | null {
  if (source === "daily_fix") return "Daily Fix";
  if (source === "custom") return "Custom workout";
  if (source === "favorite") return "Favorite";
  if (source === "affiliate") return "Affiliate";
  return source;
}

function formatScoreEntry(entry: WorkoutLogItem["score_entries"][number]): string {
  const bits = [
    entry.score_value != null ? formatScoreNumber(entry.score_value) : null,
    entry.score_type,
    entry.scaling_mode === "scaled" ? "scaled" : entry.scaling_mode === "rx" ? "Rx" : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function formatActual(row: WorkoutMovementActual): string {
  const bits: string[] = [];
  if (row.reps != null) bits.push(`${row.reps} reps`);
  if (row.weight != null) {
    const unit = row.weight_unit_id === 2 ? "kg" : "lb";
    bits.push(`${formatScoreNumber(row.weight)} ${unit}`);
  }
  if (row.distance_m != null) bits.push(`${formatScoreNumber(row.distance_m)} m`);
  if (row.time_sec != null) {
    const m = Math.floor(row.time_sec / 60);
    const s = row.time_sec % 60;
    bits.push(m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`);
  }
  if (row.calories != null) bits.push(`${row.calories} kcal`);
  return bits.join(" · ");
}

function formatPrescription(step: WorkoutStructureStep): string | null {
  const rx = step.prescription;
  if (!rx && !step.prescription_female) return null;
  const bits: string[] = [];
  if (rx?.reps != null) bits.push(`${rx.reps} reps`);
  if (rx?.weight != null) bits.push(`${rx.weight} lb`);
  if (step.prescription_female?.weight != null) {
    bits.push(`women’s Rx ${step.prescription_female.weight} lb`);
  }
  if (rx?.distance_m != null) bits.push(`${rx.distance_m} m`);
  if (rx?.duration_sec != null) bits.push(`${rx.duration_sec}s`);
  if (rx?.calories != null) bits.push(`${rx.calories} kcal`);
  return bits.length > 0 ? bits.join(" · ") : null;
}

function stepsOf(workout: CustomWorkoutSummary | null): WorkoutStructureStep[] {
  if (!workout?.structure) return [];
  const out: WorkoutStructureStep[] = [];
  for (const seg of workout.structure.segments) {
    for (const step of seg.steps) out.push(step);
  }
  return out;
}

export default function AccountWorkoutLog() {
  const [, params] = useRoute("/account/workouts/:id");
  const [, setLocation] = useLocation();
  const logId = Number(params?.id);
  const today = useMemo(() => todayYmd(), []);
  const [workout, setWorkout] = useState<WorkoutLogItem | null>(null);
  const [structure, setStructure] = useState<CustomWorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isSafeInteger(logId) || logId <= 0) {
      setWorkout(null);
      setLoading(false);
      setError("Workout not found.");
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const page = await loadWorkoutLog(logId, { signal: ac.signal, force: true });
        if (cancelled) return;
        setWorkout(page.workout);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setWorkout(null);
        setError("Could not load this workout.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [logId]);

  useEffect(() => {
    if (!workout || workout.workout_source !== "custom" || !workout.workout_source_id) {
      setStructure(null);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const custom = await loadCustomWorkout(workout.workout_source_id!, { signal: ac.signal });
        if (!cancelled) setStructure(custom);
      } catch {
        if (!cancelled) setStructure(null);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [workout]);

  const date = workout?.date_time?.slice(0, 10) ?? "";
  const actuals = workout?.movement_actuals ?? [];
  const prescribed = stepsOf(structure);

  async function onRemove() {
    if (!workout) return;
    if (!window.confirm("Remove this logged workout?")) return;
    setBusy(true);
    try {
      await deleteWorkoutLog(workout.id);
      setLocation(basePath("/account/workouts"));
    } catch {
      setError("Could not remove this workout.");
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      title={workout?.workout_title || "Workout log"}
      description="Session details from your MetFix workout log."
      hideChromeTitle
    >
      <BodyNav current="workouts" />
      <BodyPanel className="dash-log">
        <div className="dash-feed-actions">
          <Link href={basePath("/account/workouts")} className="account-btn account-btn--ghost">
            Workout feed
          </Link>
          <Link href={basePath("/account/workouts/log")} className="account-btn account-btn--ghost">
            Log workout
          </Link>
        </div>

        {loading ? <FeedSkeleton label="Loading workout" /> : null}
        {error ? <p className="account-error">{error}</p> : null}

        {!loading && workout ? (
          <>
            <p className="dash-kicker">Logged session</p>
            <h2 className="dash-section-title">{workout.workout_title || "Workout"}</h2>
            <p className="dash-log__when">
              {/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDayLabel(date, today) : workout.date_time}
              {sourceLabel(workout.workout_source) ? ` · ${sourceLabel(workout.workout_source)}` : ""}
              {workout.scaling_mode === "rx"
                ? " · Rx"
                : workout.scaling_mode === "scaled"
                  ? " · Scaled"
                  : ""}
            </p>

            <div className="dash-log__stats" aria-label="Session stats">
              {workout.activity_minutes != null ? (
                <div className="dash-log__stat">
                  <span className="dash-log__stat-value">{workout.activity_minutes}</span>
                  <span className="dash-log__stat-label">Minutes</span>
                </div>
              ) : null}
              {workout.calories_burned != null ? (
                <div className="dash-log__stat">
                  <span className="dash-log__stat-value">{workout.calories_burned}</span>
                  <span className="dash-log__stat-label">Calories</span>
                </div>
              ) : null}
              {workout.score_entries.length > 0 ? (
                <div className="dash-log__stat dash-log__stat--wide">
                  <span className="dash-log__stat-value">
                    {workout.score_entries
                      .map(formatScoreEntry)
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                  <span className="dash-log__stat-label">Score</span>
                </div>
              ) : null}
            </div>

            {workout.score_entries.length > 0 ? (
              <section className="dash-log__section" aria-labelledby="log-scores">
                <h3 id="log-scores">Scores</h3>
                <ul className="dash-log__list">
                  {workout.score_entries.map((entry, index) => (
                    <li key={`${entry.score_type ?? "score"}-${index}`}>
                      <span className="dash-log__list-title">
                        {entry.score_type?.trim() || "Score"}
                      </span>
                      <span className="dash-log__list-meta">{formatScoreEntry(entry)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {actuals.length > 0 ? (
              <section className="dash-log__section" aria-labelledby="log-moves">
                <h3 id="log-moves">Movements</h3>
                <ul className="dash-log__list">
                  {actuals.map((row, index) => (
                    <li key={`${row.movement_id}-${row.step_order ?? index}`}>
                      <span className="dash-log__list-title">
                        {row.movement_name || `Movement ${row.movement_id}`}
                      </span>
                      {formatActual(row) ? (
                        <span className="dash-log__list-meta">{formatActual(row)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : prescribed.length > 0 ? (
              <section className="dash-log__section" aria-labelledby="log-structure">
                <h3 id="log-structure">Workout structure</h3>
                <ul className="dash-log__list">
                  {prescribed.map((step, index) => (
                    <li key={`${step.movement_id}-${step.order}-${index}`}>
                      <span className="dash-log__list-title">
                        {step.movement_name || step.label || `Movement ${step.movement_id}`}
                      </span>
                      {formatPrescription(step) ? (
                        <span className="dash-log__list-meta">{formatPrescription(step)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {workout.workout_free_text ? (
              <section className="dash-log__section" aria-labelledby="log-notes">
                <h3 id="log-notes">Notes</h3>
                <p className="dash-log__notes">{workout.workout_free_text}</p>
              </section>
            ) : null}

            {workout.photo_url ? (
              <section className="dash-log__section" aria-labelledby="log-photo">
                <h3 id="log-photo">Photo</h3>
                <img className="dash-log__photo" src={workout.photo_url} alt="" />
              </section>
            ) : null}

            <div className="dash-log__actions">
              <button
                type="button"
                className="account-btn account-btn--ghost"
                onClick={onRemove}
                disabled={busy}
              >
                {busy ? "Removing…" : "Remove session"}
              </button>
            </div>
          </>
        ) : null}
      </BodyPanel>
    </DashboardLayout>
  );
}
