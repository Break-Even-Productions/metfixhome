import { useEffect, useState, type FormEvent } from "react";
import { Link, useRoute } from "wouter";
import { basePath } from "@/const";
import {
  deleteCustomWorkout,
  loadCustomWorkout,
  loadMyCustomWorkouts,
  saveCustomWorkout,
  savePreferredMovementVideo,
  searchMovements,
  type CustomWorkoutSummary,
  type MovementRow,
  type WorkoutStructure,
  type WorkoutStructureSegment,
} from "@/lib/account";

function youtubeOrVimeoUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "youtube-nocookie.com" ||
      host === "vimeo.com" ||
      host === "player.vimeo.com"
    ) {
      return url.startsWith("http") ? url : `https://${url}`;
    }
  } catch {
    return null;
  }
  return null;
}
import DashboardLayout from "./DashboardLayout";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";

const PRESETS = [
  ["straight", "Straight"],
  ["rounds", "Rounds"],
  ["amrap", "AMRAP"],
  ["emom", "EMOM"],
  ["alternating_emom", "Alternating EMOM"],
  ["chipper", "Chipper"],
  ["tabata", "Tabata"],
] as const;

const SCORE_PRIMARY = [
  { id: "time", title: "Time", subtitle: "For time or time cap", accent: "#FF9F0A" },
  { id: "reps", title: "Reps", subtitle: "Rep totals and rounds plus reps", accent: "#30D158" },
  { id: "score", title: "Score", subtitle: "Composite or custom numeric score", accent: "#5E5CE6" },
  { id: "calories", title: "Calories", subtitle: "Energy burned", accent: "#FF453A" },
  { id: "distance", title: "Distance", subtitle: "Meters, miles, and similar", accent: "#64D2FF" },
  { id: "completion", title: "Completion", subtitle: "Finished or not finished", accent: "#32D74B" },
  { id: "rounds", title: "Rounds", subtitle: "Rounds completed", accent: "#0A84FF" },
] as const;

const WEIGHT_SUBS = [
  { id: "weight_max", label: "Max", hint: "Heaviest lift" },
  { id: "weight_sum", label: "Total", hint: "Total load" },
  { id: "weight_min", label: "Min", hint: "Lightest lift" },
] as const;

function isWeightScore(id: string): boolean {
  return id === "weight_max" || id === "weight_sum" || id === "weight_min";
}

function scoreSummary(id: string): { title: string; subtitle: string; accent: string } {
  const primary = SCORE_PRIMARY.find((row) => row.id === id);
  if (primary) return primary;
  const sub = WEIGHT_SUBS.find((row) => row.id === id);
  return {
    title: "Weight",
    subtitle: sub ? `Load-based score · ${sub.label}` : "Load-based score",
    accent: "#BF5AF2",
  };
}

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
  const [scoreOpen, setScoreOpen] = useState(true);

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
        setScoreOpen(false);
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
    setMovements([]);
    setQuery("");
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
      steps: seg.steps.map((step, order) => {
        const attachUrl = step.videos?.[0]?.url ? youtubeOrVimeoUrl(step.videos[0].url) : null;
        return {
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
          ...(attachUrl
            ? {
                videos: [
                  {
                    url: attachUrl,
                    ...(step.videos?.[0]?.title ? { title: step.videos[0].title } : {}),
                  },
                ],
              }
            : {}),
        };
      }),
    }));
    if (segments.some((seg) => seg.steps.length === 0)) {
      setMessage("Add a movement to each segment.");
      return;
    }
    for (const seg of segments) {
      for (const step of seg.steps) {
        const raw = (step as { videos?: Array<{ url?: string }> }).videos?.[0]?.url;
        if (raw && !youtubeOrVimeoUrl(raw)) {
          setMessage("Workout demo videos must be YouTube or Vimeo links.");
          return;
        }
      }
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
            Log workout
          </Link>
        </div>
        <h2 className="dash-section-title">{editing ? "Edit workout" : "Build a workout"}</h2>
        {loading ? <FeedSkeleton label="Loading workout" /> : null}
        {error ? <p className="account-error">{error}</p> : null}
        {!loading ? (
          <form className="dash-wb" onSubmit={onSave}>
            {mine.length > 0 ? (
              <div className="dash-wb__library">
                <p className="dash-wb__label">Your workouts</p>
                <div className="dash-wb__chips">
                  {mine.map((row) => (
                    <Link key={row.id} href={basePath(`/account/workouts/builder/${row.id}`)} className="dash-wb__chip">
                      {row.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="dash-wb__label">Basics</p>
            <input
              className="dash-wb__input"
              aria-label="Title"
              placeholder="Title"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              required
              maxLength={180}
            />
            <textarea
              className="dash-wb__input dash-wb__notes"
              aria-label="Notes"
              placeholder="Short description (optional)"
              value={excerpt}
              onChange={(ev) => setExcerpt(ev.target.value)}
              maxLength={500}
            />
            <div className="dash-wb__section-head">
              <p className="dash-wb__label">Scoring</p>
              {scoreOpen ? null : (
                <button
                  type="button"
                  className="dash-wb__text-btn"
                  aria-label="Change scoring type"
                  onClick={() => setScoreOpen(true)}
                >
                  Change
                </button>
              )}
            </div>
            <p className="dash-wb__hint">How should this block be scored on the leaderboard?</p>
            {scoreOpen ? (
              <div className="dash-wb__score-grid" role="group" aria-label="Logging type">
                {SCORE_PRIMARY.map((cell) => {
                  const on = loggingType === cell.id;
                  return (
                    <button
                      key={cell.id}
                      type="button"
                      className={on ? "dash-wb__score-card dash-wb__score-card--on" : "dash-wb__score-card"}
                      aria-pressed={on}
                      onClick={() => {
                        setLoggingType(cell.id);
                        setScoreOpen(false);
                      }}
                    >
                      <span className="dash-wb__score-icon" style={{ background: `${cell.accent}29`, color: cell.accent }} aria-hidden="true">
                        {cell.title.slice(0, 1)}
                      </span>
                      <span>
                        <span className="dash-wb__score-title">{cell.title}</span>
                        <span className="dash-wb__score-sub">{cell.subtitle}</span>
                      </span>
                      <span className={on ? "dash-wb__check dash-wb__check--on" : "dash-wb__check"} aria-hidden="true" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={isWeightScore(loggingType) ? "dash-wb__score-card dash-wb__score-card--on" : "dash-wb__score-card"}
                  aria-pressed={isWeightScore(loggingType)}
                  onClick={() => {
                    if (!isWeightScore(loggingType)) setLoggingType("weight_max");
                    setScoreOpen(false);
                  }}
                >
                  <span className="dash-wb__score-icon" style={{ background: "#BF5AF229", color: "#BF5AF2" }} aria-hidden="true">
                    W
                  </span>
                  <span>
                    <span className="dash-wb__score-title">Weight</span>
                    <span className="dash-wb__score-sub">Load-based score</span>
                  </span>
                  <span className={isWeightScore(loggingType) ? "dash-wb__check dash-wb__check--on" : "dash-wb__check"} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="dash-wb__score-summary">
                <div className="dash-wb__score-card dash-wb__score-card--on">
                  <span
                    className="dash-wb__score-icon"
                    style={{ background: `${scoreSummary(loggingType).accent}29`, color: scoreSummary(loggingType).accent }}
                    aria-hidden="true"
                  >
                    {scoreSummary(loggingType).title.slice(0, 1)}
                  </span>
                  <span>
                    <span className="dash-wb__score-title">{scoreSummary(loggingType).title}</span>
                    <span className="dash-wb__score-sub">{scoreSummary(loggingType).subtitle}</span>
                  </span>
                  <span className="dash-wb__check dash-wb__check--on" aria-hidden="true" />
                </div>
              </div>
            )}
            {isWeightScore(loggingType) && !scoreOpen ? (
              <div className="dash-wb__weight-row" role="group" aria-label="Weight score">
                {WEIGHT_SUBS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={loggingType === opt.id ? "dash-wb__weight dash-wb__weight--on" : "dash-wb__weight"}
                    aria-pressed={loggingType === opt.id}
                    onClick={() => setLoggingType(opt.id)}
                  >
                    <span>{opt.label}</span>
                    <span className="dash-wb__score-sub">{opt.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="dash-wb__label">Segment</p>
            <p className="dash-wb__hint">
              One timer format per block. Pick a preset, set rounds or a time cap where needed, then add movements.
            </p>
            {structure.segments.map((seg, segIndex) => (
              <section key={seg.id} className="dash-wb__card" aria-label={`Segment ${segIndex + 1}`}>
                <h3 className="dash-wb__card-title">Segment {segIndex + 1}</h3>
                <div className="dash-wb__chips" role="group" aria-label="Format">
                  {PRESETS.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={seg.preset === id ? "dash-wb__chip dash-wb__chip--on" : "dash-wb__chip"}
                      aria-pressed={seg.preset === id}
                      onClick={() => updateSegment(segIndex, { preset: id, params: {} })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {seg.preset === "rounds" ? (
                  <label className="dash-wb__param">
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
                  <label className="dash-wb__param">
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
                  <label className="dash-wb__param">
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
                  <div className="dash-wb__metrics">
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
                <div className="dash-wb__moves-head">
                  <p className="dash-wb__moves-label">Movements</p>
                </div>
                {seg.steps.length === 0 ? <p className="dash-wb__hint">No movements yet.</p> : null}
                <ul className="dash-wb__moves">
                  {seg.steps.map((step, stepIndex) => (
                    <li key={`${step.movement_id}-${stepIndex}`} className="dash-wb__move">
                      <p className="dash-wb__move-name">{step.movement_name || `Movement ${step.movement_id}`}</p>
                      <div className="dash-wb__metrics">
                        <label>
                          Reps
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.reps ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "reps", ev.target.value)}
                          />
                        </label>
                        <label>
                          Weight
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
                          Women’s Rx
                          <input
                            type="number"
                            min={0}
                            value={step.prescription_female?.weight ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "female_weight", ev.target.value)}
                          />
                        </label>
                        <label>
                          Meters
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.distance_m ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "distance_m", ev.target.value)}
                          />
                        </label>
                        <label>
                          Seconds
                          <input
                            type="number"
                            min={0}
                            value={step.prescription?.duration_sec ?? ""}
                            onChange={(ev) => updateStep(segIndex, stepIndex, "duration_sec", ev.target.value)}
                          />
                        </label>
                      </div>
                      <label className="dash-wb__param">
                        Workout demo video (optional)
                        <input
                          type="url"
                          placeholder="YouTube or Vimeo URL for this shared workout"
                          value={step.videos?.[0]?.url ?? ""}
                          onChange={(ev) => {
                            const value = ev.target.value;
                            setStructure((prev) => ({
                              ...prev,
                              segments: prev.segments.map((row, i) => {
                                if (i !== segIndex) return row;
                                return {
                                  ...row,
                                  steps: row.steps.map((item, j) => {
                                    if (j !== stepIndex) return item;
                                    if (!value.trim()) return { ...item, videos: undefined };
                                    return {
                                      ...item,
                                      videos: [{ url: value, title: item.videos?.[0]?.title }],
                                    };
                                  }),
                                };
                              }),
                            }));
                          }}
                        />
                      </label>
                      {step.demo_video?.url ? (
                        <p className="dash-wb__hint">
                          Resolved demo ({step.demo_video.source}):{" "}
                          <a href={step.demo_video.url} target="_blank" rel="noreferrer">
                            open video
                          </a>
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="dash-wb__text-btn"
                        onClick={() => {
                          const url = youtubeOrVimeoUrl(step.videos?.[0]?.url ?? "");
                          if (!url) {
                            setMessage("Enter a YouTube or Vimeo URL on this step first, then save as preferred.");
                            return;
                          }
                          void (async () => {
                            try {
                              await savePreferredMovementVideo(step.movement_id, url);
                              setMessage(`Saved preferred demo for ${step.movement_name || "movement"}.`);
                            } catch {
                              setError("Could not save preferred movement video.");
                            }
                          })();
                        }}
                      >
                        Save URL as my preferred for this movement
                      </button>
                    </li>
                  ))}
                </ul>
                {segIndex === structure.segments.length - 1 ? (
                  <>
                    <div className="dash-wb__add">
                      <input
                        aria-label="Add a movement"
                        value={query}
                        onChange={(ev) => setQuery(ev.target.value)}
                        placeholder="Search the movement catalog"
                        onKeyDown={(ev) => {
                          if (ev.key !== "Enter") return;
                          ev.preventDefault();
                          void onSearch();
                        }}
                      />
                      <button type="button" className="dash-wb__add-btn" disabled={searching} onClick={() => void onSearch()}>
                        {searching ? "Searching…" : "Find movement"}
                      </button>
                    </div>
                    {movements.length > 0 ? (
                      <ul className="dash-wb__results">
                        {movements.map((movement) => (
                          <li key={movement.id}>
                            <button type="button" onClick={() => addMovement(movement)}>
                              <span>{movement.name}</span>
                              {movement.category ? <span className="dash-wb__score-sub">{movement.category}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
              </section>
            ))}
            {message ? <p className="dash-wb__hint">{message}</p> : null}
            <button type="submit" className="account-btn dash-wb__save" disabled={busy}>
              {busy ? "Saving…" : "Save workout"}
            </button>
            {editing ? (
              <button type="button" className="account-btn account-btn--ghost dash-wb__delete" onClick={onDelete} disabled={busy}>
                Delete
              </button>
            ) : null}
          </form>
        ) : null}
      </BodyPanel>
    </DashboardLayout>
  );
}
