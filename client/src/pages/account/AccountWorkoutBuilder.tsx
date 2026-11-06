import { useEffect, useState, type FormEvent } from "react";
import { Link, useRoute } from "wouter";
import { basePath } from "@/const";
import {
  deleteCustomWorkout,
  loadCustomWorkout,
  loadMyCustomWorkouts,
  saveCustomWorkout,
  searchMovements,
  type CustomWorkoutSummary,
  type MovementRow,
  type WorkoutStructure,
  type WorkoutStructureSegment,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";

const LOGGING = [
  ["time", "Time"],
  ["reps", "Reps"],
  ["score", "Score"],
  ["calories", "Calories"],
  ["distance", "Distance"],
  ["completion", "Completion"],
  ["weight_max", "Max weight"],
  ["weight_sum", "Total weight"],
  ["weight_min", "Min weight"],
  ["rounds", "Rounds"],
] as const;

const PRESETS = [
  ["straight", "Straight"],
  ["rounds", "Rounds"],
  ["amrap", "AMRAP"],
  ["emom", "EMOM"],
  ["alternating_emom", "Alternating EMOM"],
  ["chipper", "Chipper"],
  ["tabata", "Tabata"],
] as const;

function emptyStructure(): WorkoutStructure {
  return {
    version: 1,
    segments: [{ id: "seg-1", preset: "straight", steps: [] }],
  };
}

function segmentParams(seg: WorkoutStructureSegment): Record<string, number> | undefined {
  if (seg.preset === "rounds") {
    const count = seg.params?.round_count;
    if (count == null || count < 1) return undefined;
    return { round_count: count };
  }
  if (seg.preset === "amrap") {
    const cap = seg.params?.time_cap_seconds;
    if (cap == null || cap < 1) return undefined;
    return { time_cap_seconds: cap };
  }
  if (seg.preset === "emom" || seg.preset === "alternating_emom") {
    const minutes = seg.params?.duration_minutes;
    if (minutes == null || minutes < 1) return undefined;
    return { duration_minutes: minutes };
  }
  if (seg.preset === "tabata") {
    const work = seg.params?.work_seconds;
    const rest = seg.params?.rest_seconds;
    const rounds = seg.params?.interval_rounds;
    if (work == null || rest == null || rounds == null || rounds < 1) return undefined;
    return { work_seconds: work, rest_seconds: rest, interval_rounds: rounds };
  }
  return undefined;
}

export default function AccountWorkoutBuilder() {
  const [, params] = useRoute("/account/workouts/builder/:id");
  const editId = Number(params?.id);
  const editing = Number.isInteger(editId) && editId > 0;
  const [mine, setMine] = useState<CustomWorkoutSummary[]>([]);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [loggingType, setLoggingType] = useState<string>("time");
  const [structure, setStructure] = useState<WorkoutStructure>(emptyStructure);
  const [query, setQuery] = useState("");
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [editing, message]);

  useEffect(() => {
    if (!editing) return;
    const ac = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const row = await loadCustomWorkout(editId, { signal: ac.signal, force: true });
        if (ac.signal.aborted) return;
        setTitle(row.title);
        setExcerpt(row.excerpt ?? "");
        setLoggingType(row.logging_type ?? "time");
        setStructure(
          row.structure && row.structure.segments?.length ? row.structure : emptyStructure(),
        );
      } catch {
        if (!ac.signal.aborted) setError("Unable to load this workout.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [editing, editId]);

  function updateSegment(index: number, patch: Partial<WorkoutStructureSegment>) {
    setStructure((prev) => ({
      ...prev,
      segments: prev.segments.map((seg, i) => (i === index ? { ...seg, ...patch } : seg)),
    }));
  }

  async function onSearch(e?: FormEvent) {
    e?.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setError(null);
    try {
      const page = await searchMovements(term);
      setMovements(page.movements ?? []);
    } catch {
      setMovements([]);
      setError("Unable to search movements.");
    } finally {
      setSearching(false);
    }
  }

  function addMovement(movement: MovementRow) {
    setStructure((prev) => {
      const segments = prev.segments.map((seg, index) => {
        if (index !== prev.segments.length - 1) return seg;
        return {
          ...seg,
          steps: [
            ...seg.steps,
            {
              movement_id: movement.id,
              movement_name: movement.name,
              order: seg.steps.length,
              prescription: { reps: 10 },
            },
          ],
        };
      });
      return { ...prev, segments };
    });
  }

  function updateStep(
    segIndex: number,
    stepIndex: number,
    field: "reps" | "weight" | "distance_m" | "duration_sec" | "female_weight",
    raw: string,
  ) {
    const value = raw.trim() === "" ? undefined : Number(raw);
    setStructure((prev) => ({
      ...prev,
      segments: prev.segments.map((seg, i) => {
        if (i !== segIndex) return seg;
        return {
          ...seg,
          steps: seg.steps.map((step, j) => {
            if (j !== stepIndex) return step;
            if (field === "female_weight") {
              const female = { ...(step.prescription_female ?? {}) };
              if (value == null || Number.isNaN(value)) delete female.weight;
              else {
                female.weight = value;
                female.weight_unit_id = female.weight_unit_id ?? 1;
              }
              return { ...step, prescription_female: female };
            }
            const prescription = { ...(step.prescription ?? {}) };
            if (value == null || Number.isNaN(value)) delete prescription[field];
            else prescription[field] = value;
            if (field === "weight" && value != null && !Number.isNaN(value)) {
              prescription.weight_unit_id = prescription.weight_unit_id ?? 1;
            }
            return { ...step, prescription };
          }),
        };
      }),
    }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const segments = structure.segments.map((seg) => ({
      ...seg,
      params: segmentParams(seg),
      steps: seg.steps.map((step, order) => ({
        movement_id: step.movement_id,
        order,
        ...(step.movement_name ? { label: step.movement_name } : {}),
        prescription: {
          ...(step.prescription?.reps != null ? { reps: step.prescription.reps } : {}),
          ...(step.prescription?.weight != null
            ? { weight: step.prescription.weight, weight_unit_id: step.prescription.weight_unit_id ?? 1 }
            : {}),
          ...(step.prescription?.distance_m != null ? { distance_m: step.prescription.distance_m } : {}),
          ...(step.prescription?.duration_sec != null
            ? { duration_sec: step.prescription.duration_sec }
            : {}),
        },
        ...(step.prescription_female?.weight != null
          ? {
              prescription_female: {
                weight: step.prescription_female.weight,
                weight_unit_id: step.prescription_female.weight_unit_id ?? 1,
              },
            }
          : {}),
      })),
    }));
    if (segments.some((seg) => seg.steps.length === 0)) {
      setMessage("Add a movement to each segment.");
      return;
    }
    if (segments.some((seg) => seg.params == null && seg.preset !== "straight" && seg.preset !== "chipper")) {
      setMessage("Fill in the segment timing before saving.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await saveCustomWorkout(
        {
          title: title.trim(),
          excerpt: excerpt.trim() || undefined,
          logging_type: loggingType,
          structure: { version: 1, segments },
        },
        editing ? editId : undefined,
      );
      setMessage(`Saved ${saved.title}.`);
      if (!editing) {
        setTitle("");
        setExcerpt("");
        setStructure(emptyStructure());
      }
    } catch {
      setError("Could not save this workout.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!editing || !window.confirm("Delete this workout?")) return;
    setBusy(true);
    try {
      await deleteCustomWorkout(editId);
      window.location.assign(basePath("/account/workouts/builder"));
    } catch {
      setError("Could not delete this workout.");
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      title={editing ? "Edit workout" : "Workout builder"}
      description="Build a workout template the same way the MetFix app does."
      hideChromeTitle
    >
      <BodyNav current="workouts" />
      <BodyPanel>
        <div className="dash-feed-actions">
          <Link href={basePath("/account/workouts")} className="account-btn account-btn--ghost">
            Workout feed
          </Link>
          <Link href={basePath("/account/workouts/log")} className="account-btn account-btn--ghost">
            Quick log
          </Link>
        </div>
        <h2 className="dash-section-title">{editing ? "Edit workout" : "Build a workout"}</h2>
        {mine.length > 0 ? (
          <ul className="dash-coach-list">
            {mine.map((row) => (
              <li key={row.id}>
                <Link href={basePath(`/account/workouts/builder/${row.id}`)} className="dash-feed-row">
                  <span className="dash-feed-row__title">{row.title}</span>
                  <span className="dash-feed-row__meta">{row.logging_type ?? "Workout"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {loading ? <FeedSkeleton label="Loading workout" /> : null}
        {error ? <p className="account-error">{error}</p> : null}
        {!loading ? (
          <form className="account-form" onSubmit={onSave}>
            <label>
              Title
              <input value={title} onChange={(ev) => setTitle(ev.target.value)} required maxLength={180} />
            </label>
            <label>
              Notes
              <textarea value={excerpt} onChange={(ev) => setExcerpt(ev.target.value)} maxLength={500} />
            </label>
            <p className="dash-kicker">Score</p>
            <div className="dash-segment" role="group" aria-label="Logging type">
              {LOGGING.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={loggingType === id ? "dash-segment__on" : ""}
                  aria-pressed={loggingType === id}
                  onClick={() => setLoggingType(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {structure.segments.map((seg, segIndex) => (
              <fieldset key={seg.id} className="dash-builder-segment">
                <legend>Segment {segIndex + 1}</legend>
                <label>
                  Format
                  <select
                    value={seg.preset}
                    onChange={(ev) => updateSegment(segIndex, { preset: ev.target.value, params: {} })}
                  >
                    {PRESETS.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {seg.preset === "rounds" ? (
                  <label>
                    Rounds
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={seg.params?.round_count ?? ""}
                      onChange={(ev) =>
                        updateSegment(segIndex, {
                          params: { round_count: Number(ev.target.value) },
                        })
                      }
                    />
                  </label>
                ) : null}
                {seg.preset === "amrap" ? (
                  <label>
                    Time cap (seconds)
                    <input
                      type="number"
                      min={1}
                      value={seg.params?.time_cap_seconds ?? ""}
                      onChange={(ev) =>
                        updateSegment(segIndex, {
                          params: { time_cap_seconds: Number(ev.target.value) },
                        })
                      }
                    />
                  </label>
                ) : null}
                {seg.preset === "emom" || seg.preset === "alternating_emom" ? (
                  <label>
                    Minutes
                    <input
                      type="number"
                      min={1}
                      value={seg.params?.duration_minutes ?? ""}
                      onChange={(ev) =>
                        updateSegment(segIndex, {
                          params: { duration_minutes: Number(ev.target.value) },
                        })
                      }
                    />
                  </label>
                ) : null}
                {seg.preset === "tabata" ? (
                  <div className="account-form-row">
                    <label>
                      Work seconds
                      <input
                        type="number"
                        min={0}
                        value={seg.params?.work_seconds ?? ""}
                        onChange={(ev) =>
                          updateSegment(segIndex, {
                            params: {
                              ...seg.params,
                              work_seconds: Number(ev.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Rest seconds
                      <input
                        type="number"
                        min={0}
                        value={seg.params?.rest_seconds ?? ""}
                        onChange={(ev) =>
                          updateSegment(segIndex, {
                            params: { ...seg.params, rest_seconds: Number(ev.target.value) },
                          })
                        }
                      />
                    </label>
                    <label>
                      Intervals
                      <input
                        type="number"
                        min={1}
                        value={seg.params?.interval_rounds ?? ""}
                        onChange={(ev) =>
                          updateSegment(segIndex, {
                            params: { ...seg.params, interval_rounds: Number(ev.target.value) },
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}
                <ul className="dash-coach-list">
                  {seg.steps.map((step, stepIndex) => (
                    <li key={`${step.movement_id}-${stepIndex}`} className="dash-builder-step">
                      <p className="dash-feed-row__title">{step.movement_name || `Movement ${step.movement_id}`}</p>
                      <div className="account-form-row">
                        <label>
                          Rx reps
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.reps ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "reps", ev.target.value)}
                          />
                        </label>
                        <label>
                          Rx weight
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.weight ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "weight", ev.target.value)}
                          />
                        </label>
                        <label>
                          Unit
                          <select
                            value={String(step.prescription?.weight_unit_id ?? 1)}
                            onChange={(ev) => {
                              const unit = Number(ev.target.value);
                              setStructure((prev) => ({
                                ...prev,
                                segments: prev.segments.map((row, i) => {
                                  if (i !== segIndex) return row;
                                  return {
                                    ...row,
                                    steps: row.steps.map((item, j) => {
                                      if (j !== stepIndex) return item;
                                      return {
                                        ...item,
                                        prescription: { ...(item.prescription ?? {}), weight_unit_id: unit },
                                        prescription_female: {
                                          ...(item.prescription_female ?? {}),
                                          weight_unit_id: unit,
                                        },
                                      };
                                    }),
                                  };
                                }),
                              }));
                            }}
                          >
                            <option value="1">lb</option>
                            <option value="2">kg</option>
                            <option value="20">pood</option>
                          </select>
                        </label>
                        <label>
                          Women’s Rx weight
                          <input
                            type="number"
                            min={0}
                            value={step.prescription_female?.weight ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "female_weight", ev.target.value)}
                          />
                        </label>
                        <label>
                          Rx meters
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.distance_m ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "distance_m", ev.target.value)}
                          />
                        </label>
                        <label>
                          Rx seconds
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.duration_sec ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "duration_sec", ev.target.value)}
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
            <div className="account-form">
              <label>
                Add a movement
                <input
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Search the movement catalog"
                />
              </label>
              <button type="button" className="account-btn account-btn--ghost" disabled={searching} onClick={() => void onSearch()}>
                {searching ? "Searching…" : "Find movement"}
              </button>
            </div>
            {movements.length > 0 ? (
              <ul className="dash-coach-list">
                {movements.map((movement) => (
                  <li key={movement.id}>
                    <button type="button" className="dash-feed-row" onClick={() => addMovement(movement)}>
                      <span className="dash-feed-row__title">{movement.name}</span>
                      {movement.category ? (
                        <span className="dash-feed-row__meta">{movement.category}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {message ? <p className="account-muted">{message}</p> : null}
            <div className="dash-feed-actions">
              <button type="submit" className="account-btn" disabled={busy}>
                {busy ? "Saving…" : "Save workout"}
              </button>
              {editing ? (
                <button type="button" className="account-btn account-btn--ghost" onClick={onDelete} disabled={busy}>
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </BodyPanel>
    </DashboardLayout>
  );
}
