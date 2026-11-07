import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { basePath } from "@/const";
import {
  createSparkEntry,
  deriveMembershipStatus,
  loadOverview,
  loadPrOverview,
  loadSparkEntries,
  loadSparkMeasurements,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
  type PrOverview,
  type PrOverviewRow,
  type SparkEntry,
  type SparkPrDirection,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";
import { BodyNav, BodyPanel } from "./BodyWatermark";
import { formatStamp } from "./bodyDates";
import { WorkoutPrAttempts } from "./WorkoutPrAttempts";
import { HealthLogModal } from "./HealthLogModal";
import {
  buildChartSeries,
  formatScoreNumber,
  formatValue,
  PrChartSkeleton,
  PrProgressChart,
} from "./PrProgressChart";

function formatScore(row: PrOverviewRow): string {
  if (row.best_score == null) return "—";
  const n = row.best_score;
  const unit = row.unit_abbreviation?.trim();
  // Time-like scores under 3600s with no weight unit → mm:ss
  if (!unit && n > 30 && n < 3600 && Number.isInteger(n)) {
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (row.score_unit_id === 1 || unit === "lb" || unit === "lbs") {
    return `${Math.round(n)} lb`;
  }
  if (unit) return `${formatScoreNumber(n)} ${unit}`;
  return formatScoreNumber(n);
}

function workingPercents(oneRm: number): Array<{ pct: number; reps: string; load: number }> {
  return [
    { pct: 95, reps: "2 RM", load: Math.round(oneRm * 0.95) },
    { pct: 90, reps: "3 RM", load: Math.round(oneRm * 0.9) },
    { pct: 85, reps: "5 RM", load: Math.round(oneRm * 0.85) },
    { pct: 80, reps: "6–8", load: Math.round(oneRm * 0.8) },
    { pct: 75, reps: "8–10", load: Math.round(oneRm * 0.75) },
    { pct: 70, reps: "10–12", load: Math.round(oneRm * 0.7) },
  ];
}

function isStrengthMovement(row: PrOverviewRow): boolean {
  const u = (row.unit_abbreviation ?? "").toLowerCase();
  const mode = (row.score_mode ?? "").toLowerCase();
  if (mode === "weight") return true;
  return row.score_unit_id === 1 || u === "lb" || u === "lbs" || u === "kg";
}

function rowKey(row: PrOverviewRow): string {
  if (row.measurement_id) return `m-${row.measurement_id}`;
  if (row.custom_workout_id) return `w-${row.custom_workout_id}`;
  return row.name;
}

const RM_NAME = /^(.+?)\s+(\d+)\s*RM$/i;

/** Split "Bench Press 5RM" into a shared base + rep scheme. Non-RM names stay solo. */
function parseRmScheme(name: string): { base: string; reps: number } | null {
  const match = RM_NAME.exec(name.trim());
  if (!match) return null;
  const base = match[1]?.trim() ?? "";
  const reps = Number(match[2]);
  if (!base || !Number.isSafeInteger(reps) || reps <= 0) return null;
  return { base, reps };
}

type LiftScheme = {
  row: PrOverviewRow;
  reps: number | null;
};

type LiftGroup = {
  key: string;
  base: string;
  schemes: LiftScheme[];
};

function preferredScheme(group: LiftGroup): LiftScheme {
  return group.schemes.find((scheme) => scheme.reps === 1) ?? group.schemes[0]!;
}

/** Outer tab score: 1RM when present, else the selected scheme, else the best score. */
function groupScoreRow(group: LiftGroup, activeId: string | null): PrOverviewRow {
  const oneRm = group.schemes.find((scheme) => scheme.reps === 1);
  if (oneRm) return oneRm.row;
  const selected = group.schemes.find((scheme) => rowKey(scheme.row) === activeId);
  if (selected) return selected.row;
  return group.schemes.reduce((best, scheme) =>
    (scheme.row.best_score ?? Number.NEGATIVE_INFINITY) >
    (best.row.best_score ?? Number.NEGATIVE_INFINITY)
      ? scheme
      : best,
  ).row;
}

function groupPrRows(rows: PrOverviewRow[]): LiftGroup[] {
  const map = new Map<string, LiftGroup>();
  const groups: LiftGroup[] = [];
  for (const row of rows) {
    const parsed = parseRmScheme(row.name);
    const key = parsed ? parsed.base.toLowerCase() : `solo:${rowKey(row)}`;
    let group = map.get(key);
    if (!group) {
      group = { key, base: parsed?.base ?? row.name, schemes: [] };
      map.set(key, group);
      groups.push(group);
    }
    group.schemes.push({ row, reps: parsed?.reps ?? null });
  }
  for (const group of groups) {
    group.schemes.sort((a, b) => {
      if (a.reps == null && b.reps == null) return a.row.name.localeCompare(b.row.name);
      if (a.reps == null) return 1;
      if (b.reps == null) return -1;
      return a.reps - b.reps;
    });
  }
  return groups.sort((a, b) => a.base.localeCompare(b.base));
}

function ymdToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}

type HealthCatalogMeta = {
  pr_direction: SparkPrDirection;
  default_unit_id: number | null;
  unit_abbreviation: string | null;
};

type HealthMarker = {
  measurement_id: number;
  name: string;
  best_score: number;
  last_score: number;
  total_entries: number;
  unit_abbreviation: string | null;
  sub_type: string | null;
  pr_direction: SparkPrDirection;
  default_unit_id: number | null;
};

function higherIsBetterDirection(direction: SparkPrDirection | null | undefined): boolean {
  return direction !== "lower_better";
}

function pickBestScore(values: number[], direction: SparkPrDirection): number {
  return higherIsBetterDirection(direction) ? Math.max(...values) : Math.min(...values);
}

/** Aggregate spark entries into health markers (`measurement_type === "health"` only). */
function healthMarkersFromEntries(
  entries: SparkEntry[],
  metaById: Map<number, HealthCatalogMeta>,
): HealthMarker[] {
  const byId = new Map<
    number,
    {
      name: string;
      values: number[];
      last: number;
      lastTs: string;
      unit: string | null;
      sub_type: string | null;
      pr_direction: SparkPrDirection;
      default_unit_id: number | null;
    }
  >();

  for (const entry of entries) {
    if (entry.measurement_type !== "health") continue;
    const mid = entry.bsi_measurement_id;
    if (mid == null || !Number.isFinite(mid) || mid <= 0) continue;
    const value = Number(entry.value);
    if (!Number.isFinite(value)) continue;
    const date = entry.measurement_date;
    const meta = metaById.get(mid);
    const fromEntry =
      entry.pr_direction === "higher_better" ||
      entry.pr_direction === "lower_better" ||
      entry.pr_direction === "closer_to_target"
        ? entry.pr_direction
        : null;
    const pr_direction = fromEntry ?? meta?.pr_direction ?? "higher_better";
    const existing = byId.get(mid);
    if (!existing) {
      byId.set(mid, {
        name: entry.measurement_name?.trim() || `Metric ${mid}`,
        values: [value],
        last: value,
        lastTs: date,
        unit: entry.unit_abbreviation ?? meta?.unit_abbreviation ?? null,
        sub_type: entry.sub_type ?? null,
        pr_direction,
        default_unit_id: meta?.default_unit_id ?? entry.unit_id ?? null,
      });
      continue;
    }
    existing.values.push(value);
    if (date >= existing.lastTs) {
      existing.last = value;
      existing.lastTs = date;
    }
    if (!existing.unit && entry.unit_abbreviation) {
      existing.unit = entry.unit_abbreviation;
    }
    if (!existing.name && entry.measurement_name) {
      existing.name = entry.measurement_name.trim();
    }
    if (fromEntry) existing.pr_direction = fromEntry;
    else if (meta?.pr_direction) existing.pr_direction = meta.pr_direction;
    if (existing.default_unit_id == null && meta?.default_unit_id != null) {
      existing.default_unit_id = meta.default_unit_id;
    }
  }

  const rows: HealthMarker[] = [];
  for (const [measurement_id, row] of byId) {
    rows.push({
      measurement_id,
      name: row.name,
      best_score: pickBestScore(row.values, row.pr_direction),
      last_score: row.last,
      total_entries: row.values.length,
      unit_abbreviation: row.unit,
      sub_type: row.sub_type,
      pr_direction: row.pr_direction,
      default_unit_id: row.default_unit_id,
    });
  }
  return rows.sort((a, b) => b.total_entries - a.total_entries || a.name.localeCompare(b.name));
}

function ExploreSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="dash-bench-explore">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}

export default function AccountBenchmarks() {
  const search = useSearch();
  const requestedLift = useMemo(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return params.get("lift");
  }, [search]);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [prs, setPrs] = useState<PrOverview | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [entries, setEntries] = useState<SparkEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [logValue, setLogValue] = useState("");
  const [logDate, setLogDate] = useState(ymdToday);
  const [logBusy, setLogBusy] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [entriesTick, setEntriesTick] = useState(0);
  const [workoutFocusId, setWorkoutFocusId] = useState<string | null>(null);
  const [healthFocusId, setHealthFocusId] = useState<number | null>(null);
  const [healthCatalog, setHealthCatalog] = useState<HealthMarker[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [prQuery, setPrQuery] = useState("");
  const [prFilter, setPrFilter] = useState<"strength" | "all">("strength");
  const [condQuery, setCondQuery] = useState("");
  const [healthQuery, setHealthQuery] = useState("");
  const [healthEntries, setHealthEntries] = useState<SparkEntry[]>([]);
  const [healthEntriesLoading, setHealthEntriesLoading] = useState(false);
  const [healthHover, setHealthHover] = useState<number | null>(null);
  const [healthListOpen, setHealthListOpen] = useState(false);
  const [healthLogOpen, setHealthLogOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su, overviewPr] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
          loadPrOverview({ signal: ac.signal, catalogCap: 500 }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        setPrs(overviewPr);
        const firstLift =
          overviewPr.movements.find((m) => m.best_score != null && isStrengthMovement(m)) ??
          overviewPr.movements.find((m) => m.best_score != null) ??
          null;
        const requestedMove = requestedLift
          ? overviewPr.movements.find((row) => rowKey(row) === requestedLift)
          : null;
        const requestedWorkout = requestedLift
          ? overviewPr.workouts.find((row) => rowKey(row) === requestedLift)
          : null;
        if (requestedMove) {
          setActiveId(rowKey(requestedMove));
          if (!isStrengthMovement(requestedMove)) setPrFilter("all");
        } else if (firstLift) {
          setActiveId(rowKey(firstLift));
        }
        if (requestedWorkout) setWorkoutFocusId(rowKey(requestedWorkout));
        else {
          const firstWorkout = overviewPr.workouts.find((w) => w.best_score != null) ?? null;
          if (firstWorkout) setWorkoutFocusId(rowKey(firstWorkout));
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load PRs & benchmarks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const pro = metfixToolsUnlocked(tier);
  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";
  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);

  const strength = useMemo(() => {
    const rows = (prs?.movements ?? []).filter(
      (m) => m.best_score != null && isStrengthMovement(m),
    );
    return [...rows].sort((a, b) => (b.best_score ?? 0) - (a.best_score ?? 0));
  }, [prs]);

  const movementPrs = useMemo(() => {
    const rows = (prs?.movements ?? []).filter((m) => m.best_score != null);
    return [...rows].sort((a, b) => (b.total_entries ?? 0) - (a.total_entries ?? 0));
  }, [prs]);

  const conditioning = useMemo(() => {
    const rows = (prs?.workouts ?? []).filter((w) => w.best_score != null);
    return [...rows].sort((a, b) => (b.total_entries ?? 0) - (a.total_entries ?? 0));
  }, [prs]);

  const exploredPrs = useMemo(() => {
    const base = prFilter === "strength" ? strength : movementPrs;
    return base.filter((row) => matchesQuery(row.name, prQuery));
  }, [prFilter, strength, movementPrs, prQuery]);

  const liftGroups = useMemo(() => groupPrRows(exploredPrs), [exploredPrs]);
  const activeGroup =
    liftGroups.find((group) => group.schemes.some((scheme) => rowKey(scheme.row) === activeId)) ??
    null;

  const exploredConditioning = useMemo(
    () => conditioning.filter((row) => matchesQuery(row.name, condQuery)),
    [conditioning, condQuery],
  );

  const exploredHealth = useMemo(
    () => healthCatalog.filter((row) => matchesQuery(row.name, healthQuery)),
    [healthCatalog, healthQuery],
  );

  // Load health-type spark entries + catalog directions for best/last charts.
  useEffect(() => {
    if (!pro) {
      setHealthCatalog([]);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setHealthLoading(true);
    (async () => {
      try {
        const [page, catalog] = await Promise.all([
          loadSparkEntries(
            { limit: 500 },
            { signal: ac.signal, force: entriesTick > 0 },
          ),
          loadSparkMeasurements(
            { measurement_type: "health" },
            { signal: ac.signal, force: entriesTick > 0 },
          ),
        ]);
        if (cancelled) return;
        const metaById = new Map<number, HealthCatalogMeta>();
        for (const m of catalog.measurements ?? []) {
          metaById.set(m.bsi_measurement_id, {
            pr_direction: m.pr_direction,
            default_unit_id: m.default_unit_id,
            unit_abbreviation: m.unit_abbreviation,
          });
        }
        const markers = healthMarkersFromEntries(
          Array.isArray(page.entries) ? page.entries : [],
          metaById,
        );
        setHealthCatalog(markers);
        setHealthFocusId((prev) => {
          if (prev != null && markers.some((m) => m.measurement_id === prev)) return prev;
          return markers[0]?.measurement_id ?? null;
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHealthCatalog([]);
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [pro, entriesTick]);

  const activeRow: PrOverviewRow | null = useMemo(() => {
    if (!activeId || !prs) return null;
    return prs.movements.find((r) => rowKey(r) === activeId) ?? null;
  }, [activeId, prs]);

  const activeScheme = parseRmScheme(activeRow?.name ?? "");
  const showWorkingPercents =
    activeRow != null &&
    isStrengthMovement(activeRow) &&
    activeRow.best_score != null &&
    (activeScheme == null || activeScheme.reps === 1);

  const measurementId = activeRow?.measurement_id ?? null;

  useEffect(() => {
    if (!pro || measurementId == null) {
      setEntries([]);
      setEntriesLoading(false);
      setEntriesError(null);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setEntriesLoading(true);
    setEntriesError(null);
    setHoverIndex(null);
    (async () => {
      try {
        const page = await loadSparkEntries(
          { measurement_id: measurementId, limit: 200 },
          { signal: ac.signal, force: entriesTick > 0 },
        );
        if (cancelled) return;
        setEntries(Array.isArray(page.entries) ? page.entries : []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEntries([]);
        setEntriesError("Unable to load entry history for this lift.");
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [pro, measurementId, entriesTick]);

  useEffect(() => {
    if (!pro || healthFocusId == null) {
      setHealthEntries([]);
      setHealthEntriesLoading(false);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setHealthEntriesLoading(true);
    setHealthHover(null);
    setHealthListOpen(false);
    (async () => {
      try {
        const page = await loadSparkEntries(
          { measurement_id: healthFocusId, limit: 200 },
          { signal: ac.signal, force: entriesTick > 0 },
        );
        if (cancelled) return;
        setHealthEntries(Array.isArray(page.entries) ? page.entries : []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHealthEntries([]);
      } finally {
        if (!cancelled) setHealthEntriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [pro, healthFocusId, entriesTick]);

  const higherIsBetter = useMemo(() => {
    if (!activeRow) return true;
    if (activeRow.pr_direction === "lower_better") return false;
    if (activeRow.pr_direction === "higher_better") return true;
    return isStrengthMovement(activeRow);
  }, [activeRow]);

  const chartPoints = useMemo(
    () => buildChartSeries(entries, higherIsBetter),
    [entries, higherIsBetter],
  );

  const activeHealth = useMemo(
    () => healthCatalog.find((m) => m.measurement_id === healthFocusId) ?? null,
    [healthCatalog, healthFocusId],
  );

  const healthHigherIsBetter = useMemo(
    () => higherIsBetterDirection(activeHealth?.pr_direction),
    [activeHealth?.pr_direction],
  );

  const healthChartPoints = useMemo(
    () => buildChartSeries(healthEntries, healthHigherIsBetter),
    [healthEntries, healthHigherIsBetter],
  );

  const unitLabel =
    activeRow?.unit_abbreviation?.trim() ||
    (activeRow?.score_unit_id === 1 ? "lb" : null);

  const topSquat = strength.find((r) => /squat/i.test(r.name));
  const topDead = strength.find((r) => /dead/i.test(r.name));
  const topFran = conditioning.find((r) => /fran/i.test(r.name));
  const topOther = conditioning.find((r) => r !== topFran);

  const heroStats = pro
    ? [
        {
          label: "Strength index",
          value:
            topSquat || topDead
              ? [topSquat && `${formatScore(topSquat)} ${topSquat.name}`, topDead && `${formatScore(topDead)} ${topDead.name}`]
                  .filter(Boolean)
                  .join(" · ") || `${strength.length} lifts`
              : strength.length > 0
                ? `${strength.length} logged lifts`
                : "No lifts yet",
          note: "From spark/pr-overview movements",
        },
        {
          label: "Benchmark conditioning",
          value:
            topFran || topOther
              ? [topFran && `${formatScore(topFran)} Fran`, topOther && `${formatScore(topOther)} ${topOther.name}`]
                  .filter(Boolean)
                  .join(" · ")
              : conditioning.length > 0
                ? `${conditioning.length} benchmarks`
                : "No benchmarks yet",
          note: "From spark/pr-overview workouts",
        },
        {
          label: "Health markers",
          value:
            healthCatalog.length > 0
              ? `${healthCatalog.length} marker${healthCatalog.length === 1 ? "" : "s"}`
              : "Log labs in the app",
          note: "Health-type spark measurements only",
        },
      ]
    : [
        {
          label: "Strength index",
          value: "Locked",
          note: "🔒 Auto-% working sets with Pro",
        },
        {
          label: "Benchmark conditioning",
          value: "Locked",
          note: "🔒 Compare repeat dates with Pro",
        },
        {
          label: "Health markers",
          value: "Locked",
          note: "🔒 Lab & metabolic log with Pro",
        },
      ];

  async function onLogPr(e: FormEvent) {
    e.preventDefault();
    if (!activeRow?.measurement_id) return;
    const value = Number(logValue);
    if (!Number.isFinite(value) || value <= 0) {
      setLogError("Enter a valid PR value.");
      return;
    }
    if (!logDate.trim()) {
      setLogError("Pick a measurement date.");
      return;
    }
    setLogBusy(true);
    setLogError(null);
    setLogMessage(null);
    try {
      const res = await createSparkEntry({
        measurement_id: activeRow.measurement_id,
        value,
        measurement_date: logDate.trim(),
        unit_id: activeRow.score_unit_id ?? undefined,
      });
      if (res.skipped || res.auto_log_skipped) {
        setLogMessage(res.message || "Entry skipped (not an improvement).");
      } else {
        setLogMessage(res.message || "PR logged.");
        setLogValue("");
      }
      const refreshed = await loadPrOverview({ force: true, catalogCap: 500 });
      setPrs(refreshed);
      setEntriesTick((n) => n + 1);
    } catch {
      setLogError("Could not log this PR. Try again.");
    } finally {
      setLogBusy(false);
    }
  }

  return (
    <DashboardLayout
      title={`${firstName}’s PRs, benchmarks & health markers`}
      description="Keep 1RM lifts, Daily Fix benchmark times, and metabolic health markers in one place."
      hideChromeTitle
    >
      <ToolHero
        photo="/Stills/athlete-bodyweight-deadlift-indoors-sunt-tropics-hydration.jpg"
        chips={
          <>
            <Link href={basePath("/account")} className="dash-chip">
              Overview
            </Link>
            {!pro ? (
              <span className="dash-chip dash-chip--accent">Preview · Included with MetFix Pro</span>
            ) : (
              <span className="dash-chip">Status · {status}</span>
            )}
          </>
        }
        title={`${firstName}’s PRs, benchmarks & health markers.`}
        lede="Keep your 1RM lifts, repeat Daily Fix benchmark times, and metabolic health markers in one place — with live working-set percentages from your logged PRs."
        cta={
          !pro ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock PR & Benchmark Tracking — 1 Month Free
            </Link>
          ) : null
        }
        stats={heroStats}
      />
      <BodyNav current="prs" />

      {error ? <p className="account-error">{error}</p> : null}

      {!pro ? (
        <BodyPanel className="dash-bench">
          <section className="dash-locked-panel" aria-labelledby="bench-locked-strength">
            <div className="dash-locked-head">
              <div>
                <p className="dash-kicker">Strength progression</p>
                <h2 id="bench-locked-strength" className="dash-section-title">
                  Strength &amp; working percentages
                </h2>
              </div>
              <div className="dash-locked-head">
                <span className="dash-locked-badge">Preview · Locked</span>
                <Link href={basePath("/join")} className="account-btn account-btn--accent">
                  Unlock full log
                </Link>
              </div>
            </div>
            <div className="dash-lift-tabs" aria-hidden="true">
              <span className="dash-lift-tab dash-lift-tab--on">
                Back Squat
                <span className="dash-lift-tab__score">Locked</span>
              </span>
              <span className="dash-lift-tab dash-day-tab--locked">
                Deadlift
                <span className="dash-lift-tab__score">Locked</span>
              </span>
              <span className="dash-lift-tab dash-day-tab--locked">
                Strict Press
                <span className="dash-lift-tab__score">Locked</span>
              </span>
            </div>
            <div className="dash-lift-detail">
              <div>
                <p className="dash-kicker">Back squat · 1-rep max curve</p>
                <p className="dash-lift-max">—</p>
                <p className="account-muted">Unlock MetFix Pro to log and chart your own PRs</p>
                <PrChartSkeleton />
              </div>
              <div className="dash-pct-table">
                <p className="dash-kicker">Working-set percentages</p>
                <p className="account-muted">Based on your logged 1RM</p>
                <table>
                  <tbody>
                    {workingPercents(100).map((row) => (
                      <tr key={row.pct} className="dash-pct-row--locked">
                        <td>{row.pct}%</td>
                        <td>{row.reps}</td>
                        <td>Locked</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="dash-pct-unlock">
                  <Link href={basePath("/join")} className="account-btn account-btn--accent">
                    Unlock full percentage chart
                  </Link>
                </p>
              </div>
            </div>
          </section>

          <section className="dash-locked-panel" aria-labelledby="bench-locked-cond">
            <div className="dash-locked-head">
              <div>
                <p className="dash-kicker">Repeat tests</p>
                <h2 id="bench-locked-cond" className="dash-section-title">
                  Benchmark conditioning times
                </h2>
              </div>
              <span className="dash-locked-badge">Locked history</span>
            </div>
            <div className="dash-bench-grid">
              <article className="dash-bench-card">
                <h3 className="dash-meal-card__title">Fran</h3>
                <p className="dash-lift-max dash-lift-max--sm">—</p>
                <p className="account-muted">Unlock to compare your attempts</p>
              </article>
              <article className="dash-bench-card dash-bench-card--locked">
                <h3 className="dash-meal-card__title">Row &amp; L-Sit</h3>
                <p className="dash-lift-max dash-lift-max--sm">—</p>
                <p className="account-muted">
                  <Link href={basePath("/join")}>Unlock history</Link>
                </p>
              </article>
            </div>
          </section>

          <section className="dash-locked-panel" aria-labelledby="bench-locked-markers">
            <div className="dash-locked-head">
              <div>
                <p className="dash-kicker">Pro health log</p>
                <h2 id="bench-locked-markers" className="dash-section-title">
                  Metabolic health markers
                </h2>
              </div>
              <Link href={basePath("/join")} className="account-btn account-btn--accent">
                Unlock lab tracker
              </Link>
            </div>
            <div className="dash-lock-pills" aria-hidden="true">
              <span className="dash-lock-pill">TG:HDL ratio</span>
              <span className="dash-lock-pill">Fasting insulin</span>
              <span className="dash-lock-pill">HbA1c</span>
              <span className="dash-lock-pill">Resting HR</span>
            </div>
          </section>

          <ProUnlockBanner introOffer={overview} />
        </BodyPanel>
      ) : (
        <BodyPanel className="dash-bench">
          {loading ? (
            <section className="dash-bench-section" aria-busy="true">
              <div className="dash-bench-head">
                <div>
                  <p className="dash-kicker">Strength progression</p>
                  <h2 className="dash-section-title">Strength &amp; working percentages</h2>
                </div>
              </div>
              <PrChartSkeleton />
            </section>
          ) : (
            <>
              <section className="dash-bench-section" aria-labelledby="strength-heading">
                <div className="dash-bench-head">
                  <div>
                    <p className="dash-kicker">Strength progression</p>
                    <h2 id="strength-heading" className="dash-section-title">
                      Strength & working percentages
                    </h2>
                  </div>
                  <div className="dash-bench-head__aside">
                    <span className="dash-chip">
                      {movementPrs.length} logged · {strength.length} strength
                    </span>
                    <Link
                      href={basePath("/account/benchmarks/all")}
                      className="account-btn account-btn--ghost dash-bench-viewall"
                    >
                      View all PR types
                    </Link>
                  </div>
                </div>

                {movementPrs.length === 0 ? (
                  <div className="dash-empty">
                    <p className="account-muted">
                      No strength PRs yet. Log a movement below once it appears in your overview,
                      or log benchmarks in the MetFix app — they’ll sync here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="dash-bench-explore-row">
                      <ExploreSearch
                        value={prQuery}
                        onChange={setPrQuery}
                        placeholder="Search lifts & movements…"
                        label="Search PRs"
                      />
                      <div className="dash-segment" role="tablist" aria-label="PR filter">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={prFilter === "strength"}
                          className={prFilter === "strength" ? "dash-segment__on" : ""}
                          onClick={() => setPrFilter("strength")}
                        >
                          Strength
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={prFilter === "all"}
                          className={prFilter === "all" ? "dash-segment__on" : ""}
                          onClick={() => setPrFilter("all")}
                        >
                          All movements
                        </button>
                      </div>
                    </div>

                    {liftGroups.length === 0 ? (
                      <p className="account-muted">No movements match that search.</p>
                    ) : (
                      <>
                        <div className="dash-lift-tabs" role="tablist" aria-label="Lifts">
                          {liftGroups.map((group) => {
                            const preferred = preferredScheme(group);
                            const on = group.schemes.some((scheme) => rowKey(scheme.row) === activeId);
                            const scoreRow = groupScoreRow(group, activeId);
                            return (
                              <button
                                key={group.key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                className={`dash-lift-tab${on ? " dash-lift-tab--on" : ""}`}
                                onClick={() => {
                                  if (on) return;
                                  setActiveId(rowKey(preferred.row));
                                }}
                              >
                                {group.base}
                                <span className="dash-lift-tab__score">{formatScore(scoreRow)}</span>
                              </button>
                            );
                          })}
                        </div>
                        {activeGroup && activeGroup.schemes.length > 1 ? (
                          <div
                            className="dash-segment dash-lift-schemes"
                            role="tablist"
                            aria-label={`${activeGroup.base} rep schemes`}
                          >
                            {activeGroup.schemes.map((scheme) => {
                              const id = rowKey(scheme.row);
                              const on = id === activeId;
                              const label =
                                scheme.reps != null ? `${scheme.reps}RM` : scheme.row.name;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  role="tab"
                                  aria-selected={on}
                                  className={on ? "dash-segment__on" : ""}
                                  onClick={() => setActiveId(id)}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </>
                    )}

                    {activeRow ? (
                      <div
                        className={`dash-lift-detail${
                          isStrengthMovement(activeRow) ? " dash-lift-detail--chart" : ""
                        }`}
                      >
                        <div>
                          <p className="dash-kicker">
                            {activeScheme
                              ? `${activeScheme.base} · ${activeScheme.reps}RM curve`
                              : `${activeRow.name} · progress`}
                          </p>
                          <p className="dash-lift-max">
                            {activeRow.best_score != null ? formatScore(activeRow) : "—"}
                          </p>
                          <p className="account-muted">
                            {activeRow.total_entries} entr
                            {activeRow.total_entries === 1 ? "y" : "ies"}
                            {activeRow.last_score != null
                              ? ` · last ${formatScore({ ...activeRow, best_score: activeRow.last_score })}`
                              : ""}
                          </p>

                          {entriesLoading ? (
                            <PrChartSkeleton />
                          ) : entriesError ? (
                            <p className="account-error">{entriesError}</p>
                          ) : chartPoints.length === 0 ? (
                            <div className="dash-empty dash-empty--chart">
                              <p className="account-muted">
                                No entry history for this movement yet. Log a PR to start the curve.
                              </p>
                            </div>
                          ) : (
                            <PrProgressChart
                              points={chartPoints}
                              unit={unitLabel}
                              hoverIndex={hoverIndex}
                              onHover={setHoverIndex}
                            />
                          )}

                          {activeRow.measurement_id != null ? (
                            <form className="account-form dash-pr-log" onSubmit={onLogPr}>
                              <p className="dash-kicker">Log a new PR</p>
                              <div className="account-form-row">
                                <label>
                                  Value{unitLabel ? ` (${unitLabel})` : ""}
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="any"
                                    value={logValue}
                                    onChange={(ev) => setLogValue(ev.target.value)}
                                    required
                                    disabled={logBusy}
                                  />
                                </label>
                                <label>
                                  Date
                                  <input
                                    type="date"
                                    value={logDate}
                                    onChange={(ev) => setLogDate(ev.target.value)}
                                    required
                                    disabled={logBusy}
                                  />
                                </label>
                              </div>
                              {logError ? <p className="account-error">{logError}</p> : null}
                              {logMessage ? <p className="account-muted">{logMessage}</p> : null}
                              <button type="submit" className="account-btn" disabled={logBusy}>
                                {logBusy ? "Saving…" : "Log PR"}
                              </button>
                            </form>
                          ) : (
                            <p className="account-muted">
                              This lift has no measurement id — log it from the MetFix app.
                            </p>
                          )}
                        </div>
                        {showWorkingPercents && activeRow.best_score != null ? (
                          <div className="dash-pct-table">
                            <p className="dash-kicker">Working-set percentages</p>
                            <p className="account-muted">
                              Based on {formatScore(activeRow)} 1RM
                            </p>
                            <table>
                              <tbody>
                                {workingPercents(activeRow.best_score).map((row) => (
                                  <tr key={row.pct}>
                                    <td>{row.pct}%</td>
                                    <td>{row.reps}</td>
                                    <td>{row.load} lb</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </section>

              <section className="dash-bench-section" aria-labelledby="cond-heading">
                <div className="dash-bench-head">
                  <div>
                    <p className="dash-kicker">Repeat tests</p>
                    <h2 id="cond-heading" className="dash-section-title">
                      Benchmark conditioning times
                    </h2>
                  </div>
                  <span className="dash-chip">
                    {conditioning.length} benchmark{conditioning.length === 1 ? "" : "s"}
                  </span>
                </div>
                {conditioning.length === 0 ? (
                  <p className="account-muted">No workout benchmarks logged yet.</p>
                ) : (
                  <>
                    <ExploreSearch
                      value={condQuery}
                      onChange={setCondQuery}
                      placeholder="Search benchmarks…"
                      label="Search benchmarks"
                    />
                    {exploredConditioning.length === 0 ? (
                      <p className="account-muted">No benchmarks match that search.</p>
                    ) : (
                      <div className="dash-bench-grid">
                        {exploredConditioning.map((row) => {
                          const id = rowKey(row);
                          const on = id === workoutFocusId;
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`dash-bench-card${on ? " dash-bench-card--on" : ""}`}
                              aria-pressed={on}
                              onClick={() => setWorkoutFocusId(id)}
                            >
                              <h3 className="dash-meal-card__title">{row.name}</h3>
                              <p className="dash-lift-max dash-lift-max--sm">{formatScore(row)}</p>
                              <p className="account-muted">
                                Best · {row.total_entries} attempt
                                {row.total_entries === 1 ? "" : "s"}
                                {row.benchmark_classification
                                  ? ` · ${row.benchmark_classification}`
                                  : ""}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                {(() => {
                  const focus = conditioning.find((row) => rowKey(row) === workoutFocusId);
                  if (!focus) return null;
                  if (focus.custom_workout_id == null) {
                    return (
                      <p className="account-muted">
                        {focus.name} has no workout id, so attempt history stays in the MetFix app.
                      </p>
                    );
                  }
                  return (
                    <WorkoutPrAttempts
                      customWorkoutId={focus.custom_workout_id}
                      name={focus.name}
                      showChart
                      lowerIsBetter={focus.pr_direction !== "higher_better"}
                    />
                  );
                })()}
              </section>

              <section className="dash-bench-section" aria-labelledby="mark-heading">
                <div className="dash-bench-head">
                  <div>
                    <p className="dash-kicker">Pro health log</p>
                    <h2 id="mark-heading" className="dash-section-title">
                      Metabolic health markers
                    </h2>
                  </div>
                  <span className="dash-chip">
                    {healthCatalog.length} marker{healthCatalog.length === 1 ? "" : "s"}
                  </span>
                </div>
                {healthLoading ? (
                  <PrChartSkeleton />
                ) : healthCatalog.length === 0 ? (
                  <p className="account-muted">
                    No health markers logged yet. Health-type metrics from the MetFix app (weight,
                    labs, vitals, and more) appear here — movement PRs stay in Strength above.
                  </p>
                ) : (
                  <>
                    <ExploreSearch
                      value={healthQuery}
                      onChange={setHealthQuery}
                      placeholder="Search health markers…"
                      label="Search health markers"
                    />
                    {exploredHealth.length === 0 ? (
                      <p className="account-muted">No health markers match that search.</p>
                    ) : (
                      <div className="dash-lift-tabs" role="tablist" aria-label="Health markers">
                        {exploredHealth.map((row) => {
                          const on = row.measurement_id === healthFocusId;
                          return (
                            <button
                              key={row.measurement_id}
                              type="button"
                              role="tab"
                              aria-selected={on}
                              className={`dash-lift-tab${on ? " dash-lift-tab--on" : ""}`}
                              onClick={() => setHealthFocusId(row.measurement_id)}
                            >
                              {row.name}
                              <span className="dash-lift-tab__score">
                                {formatValue(row.best_score, row.unit_abbreviation)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {activeHealth ? (
                      <div className="dash-lift-detail">
                        <div>
                          <div className="dash-health-detail-head">
                            <div>
                              <p className="dash-kicker">{activeHealth.name} · trend</p>
                              <p className="dash-lift-max">
                                {formatValue(
                                  activeHealth.best_score,
                                  activeHealth.unit_abbreviation,
                                )}
                              </p>
                              <p className="account-muted">
                                {activeHealth.total_entries} entr
                                {activeHealth.total_entries === 1 ? "y" : "ies"}
                                {` · last ${formatValue(activeHealth.last_score, activeHealth.unit_abbreviation)}`}
                                {activeHealth.sub_type ? ` · ${activeHealth.sub_type}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="dash-health-add"
                              aria-label={`Log new ${activeHealth.name} entry`}
                              onClick={() => setHealthLogOpen(true)}
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 16 16"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              >
                                <path d="M8 2.5v11M2.5 8h11" />
                              </svg>
                            </button>
                          </div>
                          {healthEntriesLoading ? (
                            <PrChartSkeleton />
                          ) : healthChartPoints.length === 0 ? (
                            <p className="account-muted">No chart history for this marker yet.</p>
                          ) : (
                            <PrProgressChart
                              points={healthChartPoints}
                              unit={activeHealth.unit_abbreviation}
                              hoverIndex={healthHover}
                              onHover={setHealthHover}
                            />
                          )}

                          <button
                            type="button"
                            className="dash-health-entries-toggle"
                            aria-expanded={healthListOpen}
                            onClick={() => setHealthListOpen((v) => !v)}
                          >
                            <span>
                              {healthListOpen ? "Hide" : "Show"} entries
                              {healthEntries.length > 0 ? ` (${healthEntries.length})` : ""}
                            </span>
                            <span aria-hidden="true">{healthListOpen ? "▴" : "▾"}</span>
                          </button>
                          {healthListOpen ? (
                            healthEntries.length === 0 ? (
                              <p className="account-muted">No entries for this marker yet.</p>
                            ) : (
                              <ol className="dash-attempt-list">
                                {[...healthEntries]
                                  .sort((a, b) =>
                                    b.measurement_date.localeCompare(a.measurement_date),
                                  )
                                  .map((entry, i) => {
                                    const label = formatStamp(entry.measurement_date);
                                    return (
                                      <li
                                        key={
                                          entry.id != null
                                            ? String(entry.id)
                                            : `${entry.measurement_date}-${entry.value}-${i}`
                                        }
                                      >
                                        <span>{label}</span>
                                        <span>
                                          {formatValue(
                                            entry.value,
                                            entry.unit_abbreviation ??
                                              activeHealth.unit_abbreviation,
                                          )}
                                        </span>
                                      </li>
                                    );
                                  })}
                              </ol>
                            )
                          ) : null}

                          <HealthLogModal
                            open={healthLogOpen}
                            onOpenChange={setHealthLogOpen}
                            measurementId={activeHealth.measurement_id}
                            measurementName={activeHealth.name}
                            defaultUnitId={activeHealth.default_unit_id}
                            defaultUnitAbbreviation={activeHealth.unit_abbreviation}
                            historyUnitIds={healthEntries
                              .map((e) => e.unit_id)
                              .filter((id): id is number => id != null && id > 0)}
                            onLogged={() => setEntriesTick((n) => n + 1)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </>
          )}
        </BodyPanel>
      )}
    </DashboardLayout>
  );
}
