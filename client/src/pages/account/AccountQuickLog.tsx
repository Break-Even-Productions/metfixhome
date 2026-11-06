import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Plus, X } from "lucide-react";
import { Link, useSearch } from "wouter";
import { basePath } from "@/const";
import {
  createWorkoutLog,
  loadCustomWorkout,
  loadDailyFixWorkout,
  loadMyCustomWorkouts,
  loadPrOverview,
  loadSparkUserInfo,
  type CustomWorkoutSummary,
  type MovementActualInput,
  type PrOverviewRow,
  type WorkoutItemScore,
  type WorkoutLoggableDimension,
  type WorkoutLogScoreInput,
  type WorkoutStepPrescription,
  type WorkoutStructureSegment,
  type WorkoutStructureStep,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { formatDayLabel, formatYymmdd, todayYmd } from "./bodyDates";
import {
  WorkoutSourceArchiveModal,
  type ArchiveKind,
  type ArchiveSelection,
} from "./WorkoutSourceArchiveModal";

type Source = "session" | "daily_fix" | "custom" | "benchmark";

type ActualFields = {
  reps: string;
  weight: string;
  weight_unit_id: number;
  distance: string;
  seconds: string;
  calories: string;
  inches: string;
  bodyweight: string;
  bodyweight_unit_id: number;
};

type LogStep = WorkoutStructureStep & {
  segment_id: string;
  round_count: number;
};

const ARCHIVE_CHIPS: Array<{ id: Exclude<ArchiveKind, "session">; label: string; hint: string }> = [
  { id: "daily_fix", label: "Daily Fix", hint: "Browse the archive" },
  { id: "custom", label: "My workout", hint: "Open saved workouts" },
  { id: "benchmark", label: "Benchmarks", hint: "Suggested classics + search" },
];

const ALL_LOG_DIMS: WorkoutLoggableDimension[] = [
  "weight",
  "reps",
  "time",
  "distance",
  "calories",
  "inches",
  "bodyweight_adjustment",
];

const MAX_RX_DIMS = 3;

const EMPTY_ACTUAL: ActualFields = {
  reps: "",
  weight: "",
  weight_unit_id: 1,
  distance: "",
  seconds: "",
  calories: "",
  inches: "",
  bodyweight: "",
  bodyweight_unit_id: 1,
};

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

function segmentRoundCount(seg: WorkoutStructureSegment): number {
  if (seg.preset !== "rounds") return 1;
  const raw = Number(seg.params?.round_count ?? seg.params?.rounds ?? 1);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(100, Math.floor(raw));
}

/** Matches mobile: flat key for 1 round, `:rN` (0-based) when multi-round. */
function actualKey(
  segmentId: string,
  stepOrder: number,
  round0: number,
  roundCount: number,
): string {
  return roundCount > 1 ? `${segmentId}:${stepOrder}:r${round0}` : `${segmentId}:${stepOrder}`;
}

function stepDimKey(segmentId: string, stepOrder: number): string {
  return `${segmentId}:${stepOrder}`;
}

function flattenLogSteps(workout: CustomWorkoutSummary | null): LogStep[] {
  if (!workout?.structure) return [];
  const out: LogStep[] = [];
  for (const seg of workout.structure.segments) {
    const roundCount = segmentRoundCount(seg);
    for (const step of seg.steps) {
      out.push({ ...step, segment_id: seg.id, round_count: roundCount });
    }
  }
  return out;
}

function maxRoundCount(steps: LogStep[]): number {
  let max = 1;
  for (const step of steps) {
    if (step.round_count > max) max = step.round_count;
  }
  return max;
}

function stepsForRound(steps: LogStep[], round0: number): LogStep[] {
  return steps.filter((step) => round0 < step.round_count);
}

function effectivePrescription(
  step: WorkoutStructureStep,
  gender: "male" | "female" | null,
): WorkoutStepPrescription {
  if (gender === "female") {
    return { ...(step.prescription ?? {}), ...(step.prescription_female ?? {}) };
  }
  return { ...(step.prescription ?? {}) };
}

function dimsFromPrescription(p: WorkoutStepPrescription): WorkoutLoggableDimension[] {
  const out: WorkoutLoggableDimension[] = [];
  const w = Number(p.weight);
  const r = Number(p.reps);
  const t = Number(p.duration_sec);
  const dist = Number(p.distance_m);
  const cal = Number(p.calories);
  const inch = Number(p.inches);
  const bw = Number(p.bodyweight_adjustment);
  if (!Number.isNaN(w) && w > 0) out.push("weight");
  if (!Number.isNaN(r) && r > 0) out.push("reps");
  if (!Number.isNaN(t) && t > 0) out.push("time");
  if (!Number.isNaN(dist) && dist > 0) out.push("distance");
  if (!Number.isNaN(cal) && cal > 0) out.push("calories");
  if (!Number.isNaN(inch) && inch > 0) out.push("inches");
  if (!Number.isNaN(bw) && bw !== 0) out.push("bodyweight_adjustment");
  return out.slice(0, MAX_RX_DIMS);
}

function defaultDimsForStep(
  step: WorkoutStructureStep,
  gender: "male" | "female" | null,
): WorkoutLoggableDimension[] {
  if (step.builder_rx_dimensions?.length) {
    return step.builder_rx_dimensions.slice(0, MAX_RX_DIMS);
  }
  if (step.loggable?.allow?.length) {
    return ALL_LOG_DIMS.filter((d) => step.loggable!.allow!.includes(d)).slice(0, MAX_RX_DIMS);
  }
  const fromRx = dimsFromPrescription(effectivePrescription(step, gender));
  return fromRx.length > 0 ? fromRx : ["reps"];
}

function dimensionLabel(dim: WorkoutLoggableDimension): string {
  switch (dim) {
    case "weight":
      return "Weight";
    case "reps":
      return "Reps";
    case "time":
      return "Time (sec)";
    case "distance":
      return "Distance (m)";
    case "calories":
      return "Calories";
    case "inches":
      return "Inches";
    case "bodyweight_adjustment":
      return "Vest / assist";
  }
}

function rxPlaceholder(
  dim: WorkoutLoggableDimension,
  rx: WorkoutStepPrescription,
): string | undefined {
  switch (dim) {
    case "weight":
      return rx.weight != null ? String(rx.weight) : undefined;
    case "reps":
      return rx.reps != null ? String(rx.reps) : undefined;
    case "time":
      return rx.duration_sec != null ? String(rx.duration_sec) : undefined;
    case "distance":
      return rx.distance_m != null ? String(rx.distance_m) : undefined;
    case "calories":
      return rx.calories != null ? String(rx.calories) : undefined;
    case "inches":
      return rx.inches != null ? String(rx.inches) : undefined;
    case "bodyweight_adjustment":
      return rx.bodyweight_adjustment != null ? String(rx.bodyweight_adjustment) : undefined;
  }
}

function formatRxSummary(
  dims: WorkoutLoggableDimension[],
  rx: WorkoutStepPrescription,
): string | null {
  const parts: string[] = [];
  for (const dim of dims) {
    const ph = rxPlaceholder(dim, rx);
    if (!ph) continue;
    if (dim === "reps") parts.push(`${ph} reps`);
    else if (dim === "weight") parts.push(`${ph} ${rx.weight_unit_id === 2 ? "kg" : "lb"}`);
    else if (dim === "distance") parts.push(`${ph} m`);
    else if (dim === "time") parts.push(`${ph}s`);
    else if (dim === "calories") parts.push(`${ph} cal`);
    else if (dim === "inches") parts.push(`${ph}"`);
    else if (dim === "bodyweight_adjustment") {
      const unit = rx.bodyweight_adjustment_unit_id === 2 ? "kg" : "lb";
      const n = Number(ph);
      parts.push(`${n > 0 ? "+" : ""}${ph} ${unit} vest`);
    }
  }
  return parts.length ? `Rx · ${parts.join(" · ")}` : null;
}

function actualHasValue(row: ActualFields | undefined): boolean {
  if (!row) return false;
  return Boolean(
    row.reps.trim() ||
      row.weight.trim() ||
      row.distance.trim() ||
      row.seconds.trim() ||
      row.calories.trim() ||
      row.inches.trim() ||
      row.bodyweight.trim(),
  );
}

function patchActual(
  prev: Record<string, ActualFields>,
  key: string,
  patch: Partial<ActualFields>,
): Record<string, ActualFields> {
  const cur = prev[key] ?? EMPTY_ACTUAL;
  return { ...prev, [key]: { ...cur, ...patch } };
}

export default function AccountQuickLog() {
  const search = useSearch();
  const initial = useMemo(() => new URLSearchParams(search), [search]);
  const today = todayYmd();
  const [source, setSource] = useState<Source>(
    initial.get("source") === "custom" ||
      initial.get("source") === "daily_fix" ||
      initial.get("source") === "benchmark"
      ? (initial.get("source") as Source)
      : "daily_fix",
  );
  const [date, setDate] = useState(initial.get("date") || today);
  const [customId, setCustomId] = useState(initial.get("id") ?? "");
  const [mine, setMine] = useState<CustomWorkoutSummary[]>([]);
  const [benchmarks, setBenchmarks] = useState<PrOverviewRow[]>([]);
  const [workout, setWorkout] = useState<CustomWorkoutSummary | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [dailyTitle, setDailyTitle] = useState<string | null>(null);
  const [dailyWorkoutId, setDailyWorkoutId] = useState<number | null>(null);
  const [scaling, setScaling] = useState<"rx" | "scaled">("rx");
  const [scores, setScores] = useState<Record<number, string>>({});
  const [scoreUnits, setScoreUnits] = useState<Record<number, number>>({});
  const [actuals, setActuals] = useState<Record<string, ActualFields>>({});
  const [extraDims, setExtraDims] = useState<Record<string, WorkoutLoggableDimension[]>>({});
  const [activeRound0, setActiveRound0] = useState(0);
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [trainingGender, setTrainingGender] = useState<"male" | "female" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveKind, setArchiveKind] = useState<ArchiveKind | null>(null);

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
        const [page, prs] = await Promise.all([
          loadMyCustomWorkouts({ signal: ac.signal, limit: 14 }),
          loadPrOverview({ signal: ac.signal, catalogCap: 500 }),
        ]);
        if (ac.signal.aborted) return;
        setMine(page.workouts ?? []);
        setBenchmarks(prs.workouts ?? []);
      } catch {
        if (!ac.signal.aborted) {
          setMine([]);
          setBenchmarks([]);
        }
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setWorkout(null);
    setDailyTitle(null);
    setDailyWorkoutId(null);
    setActuals({});
    setExtraDims({});
    setActiveRound0(0);
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
  const allSteps = useMemo(() => flattenLogSteps(workout), [workout]);
  const roundTotal = maxRoundCount(allSteps);
  const multiRound = roundTotal > 1;
  const round0 = Math.min(activeRound0, Math.max(0, roundTotal - 1));
  const visibleSteps = stepsForRound(allSteps, round0);
  const title =
    source === "session"
      ? sessionTitle.trim()
      : source === "daily_fix"
        ? dailyTitle || workout?.title || "Daily Fix"
        : workout?.title || pickedLabel || "Workout";

  function onArchiveSelect(selection: ArchiveSelection) {
    setScores({});
    setScoreUnits({});
    setActuals({});
    setExtraDims({});
    setActiveRound0(0);
    setMessage(null);
    setError(null);
    if (selection.kind === "daily_fix") {
      setSource("daily_fix");
      setDate(selection.date);
      setDailyTitle(selection.fix.title);
      setDailyWorkoutId(selection.fix.workout_id);
      setPickedLabel(selection.fix.title);
      setCustomId("");
      setSessionTitle("");
      return;
    }
    if (selection.kind === "custom") {
      setSource("custom");
      setCustomId(String(selection.workout.id));
      setWorkout(selection.workout);
      setPickedLabel(selection.workout.title);
      setDailyTitle(null);
      setDailyWorkoutId(null);
      setSessionTitle("");
      return;
    }
    if (selection.kind === "benchmark") {
      setSource("benchmark");
      setCustomId(String(selection.customWorkoutId));
      setWorkout(null);
      setPickedLabel(selection.title);
      setDailyTitle(null);
      setDailyWorkoutId(null);
      setSessionTitle("");
      return;
    }
    setSource("session");
    setSessionTitle(selection.title);
    setWorkout(null);
    setPickedLabel(selection.title);
    setDailyTitle(null);
    setDailyWorkoutId(null);
    setCustomId("");
  }

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
    for (const step of allSteps) {
      for (let r = 0; r < step.round_count; r += 1) {
        const key = actualKey(step.segment_id, step.order, r, step.round_count);
        const row = actuals[key];
        if (!row) continue;
        const reps = row.reps.trim() === "" ? undefined : Number(row.reps);
        const weight = row.weight.trim() === "" ? undefined : Number(row.weight);
        const distance = row.distance.trim() === "" ? undefined : Number(row.distance);
        const seconds = row.seconds.trim() === "" ? undefined : Number(row.seconds);
        const calories = row.calories.trim() === "" ? undefined : Number(row.calories);
        const inches = row.inches.trim() === "" ? undefined : Number(row.inches);
        const bodyweight = row.bodyweight.trim() === "" ? undefined : Number(row.bodyweight);
        if (
          (reps != null && Number.isNaN(reps)) ||
          (weight != null && Number.isNaN(weight)) ||
          (distance != null && Number.isNaN(distance)) ||
          (seconds != null && Number.isNaN(seconds)) ||
          (calories != null && Number.isNaN(calories)) ||
          (inches != null && Number.isNaN(inches)) ||
          (bodyweight != null && Number.isNaN(bodyweight))
        ) {
          setMessage(
            `Check the numbers for ${step.movement_name || "that movement"}${
              step.round_count > 1 ? ` (round ${r + 1})` : ""
            }.`,
          );
          return;
        }
        if (
          reps == null &&
          weight == null &&
          distance == null &&
          seconds == null &&
          calories == null &&
          inches == null &&
          bodyweight == null
        ) {
          continue;
        }
        movementRows.push({
          movement_id: step.movement_id,
          segment_id: step.segment_id,
          step_order: step.order,
          ...(step.round_count > 1 ? { round_index: r + 1 } : {}),
          ...(reps != null ? { reps } : {}),
          ...(weight != null ? { weight, weight_unit_id: row.weight_unit_id || 1 } : {}),
          ...(distance != null ? { distance_m: distance } : {}),
          ...(seconds != null ? { time_sec: seconds } : {}),
          ...(calories != null ? { calories } : {}),
          ...(inches != null ? { inches } : {}),
          ...(bodyweight != null
            ? {
                bodyweight_adjustment: bodyweight,
                bodyweight_adjustment_unit_id: row.bodyweight_unit_id || 1,
              }
            : {}),
        });
      }
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
          : (source === "custom" || source === "benchmark") && workout
            ? { workout_source: "custom" as const, workout_source_id: workout.id }
            : {}),
        ...(scoreRows.length > 0 ? { scores: scoreRows } : {}),
        ...(measurements.length > 0 ? { measurements } : {}),
        ...(movementRows.length > 0 ? { movement_actuals: movementRows } : {}),
      });
      setMessage("Workout logged.");
      setScores({});
      setActuals({});
      setExtraDims({});
      setActiveRound0(0);
      setNotes("");
    } catch {
      setError("Could not log this workout.");
    } finally {
      setBusy(false);
    }
  }

  function visibleDimsForStep(step: LogStep): WorkoutLoggableDimension[] {
    const base = defaultDimsForStep(step, trainingGender);
    const extras = extraDims[stepDimKey(step.segment_id, step.order)] ?? [];
    const seen = new Set<WorkoutLoggableDimension>();
    const out: WorkoutLoggableDimension[] = [];
    for (const dim of [...base, ...extras]) {
      if (seen.has(dim)) continue;
      seen.add(dim);
      out.push(dim);
    }
    return out;
  }

  function addDimToStep(step: LogStep, dim: WorkoutLoggableDimension) {
    const id = stepDimKey(step.segment_id, step.order);
    setExtraDims((prev) => {
      const base = defaultDimsForStep(step, trainingGender);
      const cur = prev[id] ?? [];
      if (base.includes(dim) || cur.includes(dim)) return prev;
      return { ...prev, [id]: [...cur, dim] };
    });
  }

  function removeExtraDimFromStep(step: LogStep, dim: WorkoutLoggableDimension) {
    const id = stepDimKey(step.segment_id, step.order);
    const base = defaultDimsForStep(step, trainingGender);
    if (base.includes(dim)) return;
    setExtraDims((prev) => {
      const cur = (prev[id] ?? []).filter((d) => d !== dim);
      if (cur.length === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: cur };
    });
  }

  function applyActualsToRemainder() {
    if (!multiRound || round0 >= roundTotal - 1) return;
    setActuals((prev) => {
      const next = { ...prev };
      for (const step of visibleSteps) {
        if (step.round_count <= round0 + 1) continue;
        const srcKey = actualKey(step.segment_id, step.order, round0, step.round_count);
        const src = prev[srcKey];
        if (!actualHasValue(src)) continue;
        for (let r = round0 + 1; r < step.round_count; r += 1) {
          next[actualKey(step.segment_id, step.order, r, step.round_count)] = { ...src! };
        }
      }
      return next;
    });
    setMessage(`Applied round ${round0 + 1} values to remaining rounds.`);
  }

  const canApplyRemainder =
    multiRound &&
    round0 < roundTotal - 1 &&
    visibleSteps.some((step) => {
      if (step.round_count <= round0 + 1) return false;
      return actualHasValue(
        actuals[actualKey(step.segment_id, step.order, round0, step.round_count)],
      );
    });

  const roundDigits = String(round0 + 1).padStart(2, "0");

  return (
    <DashboardLayout
      title="Log workout"
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
          <button
            type="button"
            className="account-btn account-btn--ghost"
            onClick={() => setArchiveKind("session")}
          >
            Quick activity
          </button>
        </div>
        <h2 className="dash-section-title">Log workout</h2>
        <div className="dash-archive-chips" role="group" aria-label="Choose workout source">
          {ARCHIVE_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`dash-archive-chip${source === chip.id ? " dash-archive-chip--on" : ""}`}
              aria-pressed={source === chip.id}
              onClick={() => setArchiveKind(chip.id)}
            >
              <span className="dash-archive-chip__copy">
                <span className="dash-archive-chip__label">{chip.label}</span>
                <span className="dash-archive-chip__hint">{chip.hint}</span>
              </span>
              <ChevronRight className="dash-archive-chip__chev" strokeWidth={2.25} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="dash-source-pick">
          <div className="dash-source-pick__meta">
            <p className="dash-source-pick__kicker">
              {source === "daily_fix"
                ? "Daily Fix"
                : source === "custom"
                  ? "My workout"
                  : source === "benchmark"
                    ? "Benchmark"
                    : "Quick activity"}
            </p>
            <p className="dash-source-pick__title">
              {source === "session"
                ? sessionTitle.trim() || "Name your activity"
                : title || "Choose a workout"}
            </p>
            <p className="dash-source-pick__sub">
              {source === "daily_fix"
                ? `${formatYymmdd(date)} · ${formatDayLabel(date, today)}`
                : source === "custom"
                  ? customId
                    ? "Saved template"
                    : "Pick from your archive"
                  : source === "benchmark"
                    ? customId
                      ? "Named benchmark"
                      : "Pick a suggested classic"
                    : "Freeform session"}
            </p>
          </div>
          <button
            type="button"
            className="account-btn account-btn--ghost"
            onClick={() => setArchiveKind(source === "session" ? "session" : source)}
          >
            Change
          </button>
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
          {source === "session" ? (
            <label>
              Name
              <input value={sessionTitle} onChange={(ev) => setSessionTitle(ev.target.value)} required maxLength={180} />
            </label>
          ) : null}
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
          {allSteps.length > 0 ? (
            <>
              {multiRound ? (
                <div className="dash-round-clock-bar">
                  <div className="dash-round-clock" role="group" aria-label="Round selector">
                    <div className="dash-round-clock__face" aria-live="polite">
                      <span className="dash-round-clock__word">ROUND</span>
                      <span className="dash-round-clock__digits">
                        <span className="dash-round-clock__ghost" aria-hidden="true">
                          88
                        </span>
                        <span className="dash-round-clock__value">{roundDigits}</span>
                      </span>
                      <span className="dash-round-clock__of">
                        / {String(roundTotal).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="dash-round-clock__controls">
                      <button
                        type="button"
                        className="dash-round-clock__btn"
                        aria-label="Next round"
                        disabled={round0 >= roundTotal - 1}
                        onClick={() => setActiveRound0((r) => Math.min(roundTotal - 1, r + 1))}
                      >
                        <ChevronUp strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="dash-round-clock__btn"
                        aria-label="Previous round"
                        disabled={round0 <= 0}
                        onClick={() => setActiveRound0((r) => Math.max(0, r - 1))}
                      >
                        <ChevronDown strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="account-btn account-btn--ghost"
                    disabled={!canApplyRemainder}
                    onClick={applyActualsToRemainder}
                  >
                    Apply to remainder
                  </button>
                </div>
              ) : null}
              <fieldset>
                <legend>{scaling === "rx" ? "Rx movement log" : "Scaled movement log"}</legend>
                {visibleSteps.map((step) => {
                  const key = actualKey(step.segment_id, step.order, round0, step.round_count);
                  const rx = effectivePrescription(step, trainingGender);
                  const baseDims = defaultDimsForStep(step, trainingGender);
                  const dims = visibleDimsForStep(step);
                  const addable = ALL_LOG_DIMS.filter((d) => !dims.includes(d));
                  const row = actuals[key] ?? EMPTY_ACTUAL;
                  const rxSummary = formatRxSummary(baseDims, rx);
                  const weightUnit = row.weight_unit_id || rx.weight_unit_id || 1;
                  const bodyweightUnit =
                    row.bodyweight_unit_id || rx.bodyweight_adjustment_unit_id || 1;
                  return (
                    <div key={key} className="dash-builder-step">
                      <p className="dash-feed-row__title">
                        {step.movement_name || step.label || `Movement ${step.movement_id}`}
                      </p>
                      {rxSummary ? <p className="dash-feed-row__meta">{rxSummary}</p> : null}
                      <div className="dash-log-dims">
                        {dims.map((dim) => {
                          const isExtra = !baseDims.includes(dim);
                          const ph = rxPlaceholder(dim, rx);
                          if (dim === "weight") {
                            return (
                              <div key={dim} className="dash-log-dim">
                                <div className="dash-log-dim__head">
                                  <span>{dimensionLabel(dim)}</span>
                                  {isExtra ? (
                                    <button
                                      type="button"
                                      className="dash-log-dim__remove"
                                      aria-label={`Remove ${dimensionLabel(dim)}`}
                                      onClick={() => removeExtraDimFromStep(step, dim)}
                                    >
                                      <X strokeWidth={2.25} aria-hidden="true" />
                                    </button>
                                  ) : null}
                                </div>
                                <div className="dash-log-dim__split">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    placeholder={ph}
                                    value={row.weight}
                                    onChange={(ev) =>
                                      setActuals((prev) =>
                                        patchActual(prev, key, {
                                          weight: ev.target.value,
                                          weight_unit_id: weightUnit,
                                        }),
                                      )
                                    }
                                  />
                                  <select
                                    value={weightUnit}
                                    aria-label="Weight unit"
                                    onChange={(ev) =>
                                      setActuals((prev) =>
                                        patchActual(prev, key, {
                                          weight_unit_id: Number(ev.target.value),
                                        }),
                                      )
                                    }
                                  >
                                    <option value={1}>lb</option>
                                    <option value={2}>kg</option>
                                  </select>
                                </div>
                              </div>
                            );
                          }
                          if (dim === "bodyweight_adjustment") {
                            return (
                              <div key={dim} className="dash-log-dim">
                                <div className="dash-log-dim__head">
                                  <span>{dimensionLabel(dim)}</span>
                                  {isExtra ? (
                                    <button
                                      type="button"
                                      className="dash-log-dim__remove"
                                      aria-label={`Remove ${dimensionLabel(dim)}`}
                                      onClick={() => removeExtraDimFromStep(step, dim)}
                                    >
                                      <X strokeWidth={2.25} aria-hidden="true" />
                                    </button>
                                  ) : null}
                                </div>
                                <div className="dash-log-dim__split">
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={ph ?? "+vest / −assist"}
                                    value={row.bodyweight}
                                    onChange={(ev) =>
                                      setActuals((prev) =>
                                        patchActual(prev, key, {
                                          bodyweight: ev.target.value,
                                          bodyweight_unit_id: bodyweightUnit,
                                        }),
                                      )
                                    }
                                  />
                                  <select
                                    value={bodyweightUnit}
                                    aria-label="Vest / assist unit"
                                    onChange={(ev) =>
                                      setActuals((prev) =>
                                        patchActual(prev, key, {
                                          bodyweight_unit_id: Number(ev.target.value),
                                        }),
                                      )
                                    }
                                  >
                                    <option value={1}>lb</option>
                                    <option value={2}>kg</option>
                                  </select>
                                </div>
                              </div>
                            );
                          }
                          const field =
                            dim === "reps"
                              ? "reps"
                              : dim === "time"
                                ? "seconds"
                                : dim === "distance"
                                  ? "distance"
                                  : dim === "calories"
                                    ? "calories"
                                    : "inches";
                          return (
                            <div key={dim} className="dash-log-dim">
                              <div className="dash-log-dim__head">
                                <span>{dimensionLabel(dim)}</span>
                                {isExtra ? (
                                  <button
                                    type="button"
                                    className="dash-log-dim__remove"
                                    aria-label={`Remove ${dimensionLabel(dim)}`}
                                    onClick={() => removeExtraDimFromStep(step, dim)}
                                  >
                                    <X strokeWidth={2.25} aria-hidden="true" />
                                  </button>
                                ) : null}
                              </div>
                              <input
                                type="number"
                                min={dim === "inches" || dim === "calories" || dim === "reps" || dim === "distance" || dim === "time" ? 0 : undefined}
                                step="any"
                                placeholder={ph}
                                value={row[field]}
                                onChange={(ev) =>
                                  setActuals((prev) =>
                                    patchActual(prev, key, { [field]: ev.target.value }),
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                      {addable.length > 0 ? (
                        <div className="dash-log-dim-add">
                          <label className="dash-log-dim-add__label">
                            <Plus strokeWidth={2.25} aria-hidden="true" />
                            <span>Add field</span>
                            <select
                              value=""
                              aria-label={`Add field for ${step.movement_name || "movement"}`}
                              onChange={(ev) => {
                                const dim = ev.target.value as WorkoutLoggableDimension;
                                if (!dim) return;
                                addDimToStep(step, dim);
                              }}
                            >
                              <option value="" disabled>
                                Choose…
                              </option>
                              {addable.map((dim) => (
                                <option key={dim} value={dim}>
                                  {dimensionLabel(dim)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </fieldset>
            </>
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
        <WorkoutSourceArchiveModal
          open={archiveKind != null}
          kind={archiveKind}
          workouts={mine}
          benchmarks={benchmarks}
          onOpenChange={(next) => {
            if (!next) setArchiveKind(null);
          }}
          onSelect={onArchiveSelect}
        />
      </BodyPanel>
    </DashboardLayout>
  );
}
