import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { basePath } from "@/const";
import {
  createWorkoutLog,
  loadCustomWorkout,
  loadDailyFixWorkout,
  loadMyCustomWorkouts,
  loadSparkUserInfo,
  type CustomWorkoutSummary,
  type MovementActualInput,
  type WorkoutItemScore,
  type WorkoutLogScoreInput,
  type WorkoutStructureStep,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { todayYmd } from "./bodyDates";

type Source = "session" | "daily_fix" | "custom";

function parseScore(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const clock = /^(\d{1,3}):(\d{2})$/.exec(text);
  if (clock) {
    const minutes = Number(clock[1]);
    const seconds = Number(clock[2]);
    if (seconds > 59) return null;
    return minutes * 60 + seconds;
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function stepsOf(workout: CustomWorkoutSummary | null): Array<WorkoutStructureStep & { segment_id: string }> {
  if (!workout?.structure) return [];
  const out: Array<WorkoutStructureStep & { segment_id: string }> = [];
  for (const seg of workout.structure.segments) {
    for (const step of seg.steps) out.push({ ...step, segment_id: seg.id });
  }
  return out;
}

export default function AccountQuickLog() {
  const search = useSearch();
  const initial = useMemo(() => new URLSearchParams(search), [search]);
  const today = todayYmd();
  const [source, setSource] = useState<Source>(
    initial.get("source") === "custom" || initial.get("source") === "daily_fix"
      ? (initial.get("source") as Source)
      : "daily_fix",
  );
  const [date, setDate] = useState(initial.get("date") || today);
  const [customId, setCustomId] = useState(initial.get("id") ?? "");
  const [mine, setMine] = useState<CustomWorkoutSummary[]>([]);
  const [workout, setWorkout] = useState<CustomWorkoutSummary | null>(null);
  const [dailyTitle, setDailyTitle] = useState<string | null>(null);
  const [dailyWorkoutId, setDailyWorkoutId] = useState<number | null>(null);
  const [scaling, setScaling] = useState<"rx" | "scaled">("rx");
  const [scores, setScores] = useState<Record<number, string>>({});
  const [scoreUnits, setScoreUnits] = useState<Record<number, number>>({});
  const [actuals, setActuals] = useState<
    Record<string, { reps: string; weight: string; distance: string; seconds: string }>
  >({});
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [trainingGender, setTrainingGender] = useState<"male" | "female" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const info = await loadSparkUserInfo({ signal: ac.signal });
        if (!ac.signal.aborted) setTrainingGender(info.training_gender);
      } catch {
        if (!ac.signal.aborted) setTrainingGender(null);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const page = await loadMyCustomWorkouts({ signal: ac.signal });
        if (!ac.signal.aborted) setMine(page.workouts ?? []);
      } catch {
        if (!ac.signal.aborted) setMine([]);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setWorkout(null);
    setDailyTitle(null);
    setDailyWorkoutId(null);
    setError(null);
    if (source === "session") return;
    setLoading(true);
    (async () => {
      try {
        let templateId: number | null = null;
        if (source === "daily_fix") {
          const fix = await loadDailyFixWorkout(date, { signal: ac.signal, force: true });
          if (ac.signal.aborted) return;
          setDailyTitle(fix.title);
          setDailyWorkoutId(fix.workout_id);
          templateId = fix.custom_workout_id;
        } else {
          const id = Number(customId);
          templateId = Number.isInteger(id) && id > 0 ? id : null;
        }
        if (templateId) {
          const row = await loadCustomWorkout(templateId, { signal: ac.signal, force: true });
          if (!ac.signal.aborted) setWorkout(row);
        }
      } catch {
        if (!ac.signal.aborted) setError("Unable to load that workout.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [source, date, customId]);

  const scoreItems: WorkoutItemScore[] = workout?.workout_items ?? [];
  const steps = stepsOf(workout);
  const title =
    source === "session"
      ? sessionTitle.trim()
      : source === "daily_fix"
        ? dailyTitle || workout?.title || "Daily Fix"
        : workout?.title || "Workout";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title) {
      setMessage("Add a workout name.");
      return;
    }
    const scoreRows: WorkoutLogScoreInput[] = [];
    const measurements: Array<{ measurement_id: number; value: number; unit_id?: number }> = [];
    for (const item of scoreItems) {
      const raw = scores[item.workout_item_id] ?? "";
      if (!raw.trim()) continue;
      const value = parseScore(raw);
      if (value == null) {
        setMessage(`Enter a number for ${item.title || item.scoring_field}. Time can be seconds or m:ss.`);
        return;
      }
      const weightScore = item.logging_type === "weight_max" || item.logging_type === "weight_sum" || item.logging_type === "weight_min";
      const unit = weightScore ? scoreUnits[item.workout_item_id] ?? 1 : undefined;
      scoreRows.push({
        score_type: item.scoring_field,
        score_value: value,
        workout_item_id: item.workout_item_id,
        ...(item.scoring_direction ? { scoring_direction: item.scoring_direction } : {}),
        ...(unit != null ? { score_unit_id: unit } : {}),
      });
      if (item.mirror_measurement_id) {
        measurements.push({
          measurement_id: item.mirror_measurement_id,
          value,
          ...(unit != null ? { unit_id: unit } : {}),
        });
      }
    }
    const movementRows: MovementActualInput[] = [];
    for (const step of steps) {
      const key = `${step.segment_id}:${step.order}`;
      const row = actuals[key];
      if (!row) continue;
      const reps = row.reps.trim() === "" ? undefined : Number(row.reps);
      const weight = row.weight.trim() === "" ? undefined : Number(row.weight);
      const distance = row.distance.trim() === "" ? undefined : Number(row.distance);
      const seconds = row.seconds.trim() === "" ? undefined : Number(row.seconds);
      if (
        (reps != null && Number.isNaN(reps)) ||
        (weight != null && Number.isNaN(weight)) ||
        (distance != null && Number.isNaN(distance)) ||
        (seconds != null && Number.isNaN(seconds))
      ) {
        setMessage(`Check the numbers for ${step.movement_name || "that movement"}.`);
        return;
      }
      if (reps == null && weight == null && distance == null && seconds == null) continue;
      movementRows.push({
        movement_id: step.movement_id,
        segment_id: step.segment_id,
        step_order: step.order,
        ...(reps != null ? { reps } : {}),
        ...(weight != null ? { weight, weight_unit_id: 1 } : {}),
        ...(distance != null ? { distance_m: distance } : {}),
        ...(seconds != null ? { time_sec: seconds } : {}),
      });
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await createWorkoutLog({
        workout_title: title,
        date_time: `${date} 12:00:00`,
        ...(notes.trim() ? { workout_free_text: notes.trim() } : {}),
        ...(minutes.trim() ? { activity_minutes: Number(minutes) } : {}),
        scaling_mode: scaling,
        ...(source === "daily_fix"
          ? {
              workout_source: "daily_fix" as const,
              ...(dailyWorkoutId ? { workout_source_id: dailyWorkoutId } : {}),
              daily_fix_date: date,
            }
          : source === "custom" && workout
            ? { workout_source: "custom" as const, workout_source_id: workout.id }
            : {}),
        ...(scoreRows.length > 0 ? { scores: scoreRows } : {}),
        ...(measurements.length > 0 ? { measurements } : {}),
        ...(movementRows.length > 0 ? { movement_actuals: movementRows } : {}),
      });
      setMessage("Workout logged.");
      setScores({});
      setActuals({});
      setNotes("");
    } catch {
      setError("Could not log this workout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      title="Quick log"
      description="Log a workout score, Rx or scaled, with movement totals."
      hideChromeTitle
    >
      <BodyNav current="workouts" />
      <BodyPanel>
        <div className="dash-feed-actions">
          <Link href={basePath("/account/workouts")} className="account-btn account-btn--ghost">
            Workout feed
          </Link>
          <Link href={basePath("/account/workouts/builder")} className="account-btn account-btn--ghost">
            Build a workout
          </Link>
        </div>
        <h2 className="dash-section-title">Quick log</h2>
        <div className="dash-segment" role="tablist" aria-label="What to log">
          {(
            [
              ["daily_fix", "Daily Fix"],
              ["custom", "My workout"],
              ["session", "Quick activity"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={source === id}
              className={source === id ? "dash-segment__on" : ""}
              onClick={() => setSource(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="dash-segment" role="group" aria-label="Scaling">
          <button
            type="button"
            className={scaling === "rx" ? "dash-segment__on" : ""}
            aria-pressed={scaling === "rx"}
            onClick={() => setScaling("rx")}
          >
            Rx
          </button>
          <button
            type="button"
            className={scaling === "scaled" ? "dash-segment__on" : ""}
            aria-pressed={scaling === "scaled"}
            onClick={() => setScaling("scaled")}
          >
            Scaled
          </button>
        </div>
        {error ? <p className="account-error">{error}</p> : null}
        {loading ? <FeedSkeleton label="Loading workout" /> : null}
        <form className="account-form" onSubmit={onSubmit}>
          <label>
            Date
            <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} required />
          </label>
          {source === "custom" ? (
            <label>
              Workout
              <select value={customId} onChange={(ev) => setCustomId(ev.target.value)} required>
                <option value="">Choose a workout</option>
                {mine.map((row) => (
                  <option key={row.id} value={String(row.id)}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {source === "session" ? (
            <label>
              Name
              <input value={sessionTitle} onChange={(ev) => setSessionTitle(ev.target.value)} required maxLength={180} />
            </label>
          ) : (
            <p className="dash-feed-row__title">{title}</p>
          )}
          {scoreItems.length > 0 ? (
            <fieldset>
              <legend>Score</legend>
              {scoreItems.map((item) => (
                <div key={item.workout_item_id}>
                  <label>
                    {item.title || item.scoring_field}
                    {item.logging_type ? ` · ${item.logging_type}` : ""}
                    <input
                      value={scores[item.workout_item_id] ?? ""}
                      onChange={(ev) =>
                        setScores((prev) => ({ ...prev, [item.workout_item_id]: ev.target.value }))
                      }
                      inputMode="decimal"
                      placeholder={item.logging_type === "time" ? "Seconds or m:ss" : "Score"}
                    />
                  </label>
                  {item.logging_type === "weight_max" ||
                  item.logging_type === "weight_sum" ||
                  item.logging_type === "weight_min" ? (
                    <label>
                      Unit
                      <select
                        value={String(scoreUnits[item.workout_item_id] ?? 1)}
                        onChange={(ev) =>
                          setScoreUnits((prev) => ({
                            ...prev,
                            [item.workout_item_id]: Number(ev.target.value),
                          }))
                        }
                      >
                        <option value="1">lb</option>
                        <option value="2">kg</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              ))}
            </fieldset>
          ) : null}
          {steps.length > 0 ? (
            <fieldset>
              <legend>{scaling === "rx" ? "Rx movement log" : "Scaled movement log"}</legend>
              {steps.map((step) => {
                const key = `${step.segment_id}:${step.order}`;
                const rx = step.prescription;
                return (
                  <div key={key} className="dash-builder-step">
                    <p className="dash-feed-row__title">{step.movement_name || step.label || `Movement ${step.movement_id}`}</p>
                    {rx || step.prescription_female ? (
                      <p className="dash-feed-row__meta">
                        {trainingGender === "female" && step.prescription_female?.weight != null
                          ? `Rx · ${step.prescription_female.weight} lb`
                          : `Rx${rx?.reps != null ? ` · ${rx.reps} reps` : ""}${
                              rx?.weight != null ? ` · ${rx.weight} lb` : ""
                            }${
                              step.prescription_female?.weight != null
                                ? ` · women’s Rx ${step.prescription_female.weight} lb`
                                : ""
                            }${rx?.distance_m != null ? ` · ${rx.distance_m} m` : ""}${
                              rx?.duration_sec != null ? ` · ${rx.duration_sec}s`
                                : ""
                            }`}
                      </p>
                    ) : null}
                    <div className="account-form-row">
                      <label>
                        Reps
                        <input
                          type="number"
                          min={0}
                          value={actuals[key]?.reps ?? ""}
                          onChange={(ev) =>
                            setActuals((prev) => ({
                              ...prev,
                              [key]: {
                                reps: ev.target.value,
                                weight: prev[key]?.weight ?? "",
                                distance: prev[key]?.distance ?? "",
                                seconds: prev[key]?.seconds ?? "",
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Weight (lb)
                        <input
                          type="number"
                          min={0}
                          value={actuals[key]?.weight ?? ""}
                          onChange={(ev) =>
                            setActuals((prev) => ({
                              ...prev,
                              [key]: {
                                reps: prev[key]?.reps ?? "",
                                weight: ev.target.value,
                                distance: prev[key]?.distance ?? "",
                                seconds: prev[key]?.seconds ?? "",
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Meters
                        <input
                          type="number"
                          min={0}
                          value={actuals[key]?.distance ?? ""}
                          onChange={(ev) =>
                            setActuals((prev) => ({
                              ...prev,
                              [key]: {
                                reps: prev[key]?.reps ?? "",
                                weight: prev[key]?.weight ?? "",
                                distance: ev.target.value,
                                seconds: prev[key]?.seconds ?? "",
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Seconds
                        <input
                          type="number"
                          min={0}
                          value={actuals[key]?.seconds ?? ""}
                          onChange={(ev) =>
                            setActuals((prev) => ({
                              ...prev,
                              [key]: {
                                reps: prev[key]?.reps ?? "",
                                weight: prev[key]?.weight ?? "",
                                distance: prev[key]?.distance ?? "",
                                seconds: ev.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </fieldset>
          ) : null}
          <label>
            Minutes
            <input type="number" min={0} max={1440} value={minutes} onChange={(ev) => setMinutes(ev.target.value)} />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} maxLength={2000} />
          </label>
          {message ? <p className="account-muted">{message}</p> : null}
          <button type="submit" className="account-btn" disabled={busy || loading}>
            {busy ? "Saving…" : "Log workout"}
          </button>
        </form>
      </BodyPanel>
    </DashboardLayout>
  );
}
