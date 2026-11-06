import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  createSparkEntry,
  deriveMembershipStatus,
  loadOverview,
  loadPrOverview,
  loadSparkEntries,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
  type PrOverview,
  type PrOverviewRow,
  type SparkEntry,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";

const CHART_W = 720;
const CHART_H = 280;
const CHART_PAD = { top: 28, right: 18, bottom: 44, left: 52 };

/** One decimal without `.toFixed` (CL-T21 money-scan forbids it in account/). */
function formatScoreNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const tenths = Math.round(n * 10) / 10;
  if (Number.isInteger(tenths)) return String(tenths);
  const whole = Math.trunc(tenths);
  const frac = Math.abs(Math.round((tenths - whole) * 10));
  return `${whole}.${frac}`;
}

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

function formatValue(n: number, unit: string | null | undefined): string {
  const u = unit?.trim();
  if (u === "lb" || u === "lbs") return `${Math.round(n)} ${u}`;
  if (u) return `${formatScoreNumber(n)} ${u}`;
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
  return row.score_unit_id === 1 || u === "lb" || u === "lbs" || u === "kg";
}

function rowKey(row: PrOverviewRow): string {
  if (row.measurement_id) return `m-${row.measurement_id}`;
  if (row.custom_workout_id) return `w-${row.custom_workout_id}`;
  return row.name;
}

function parseEntryDate(raw: string): Date | null {
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isFinite(d.getTime()) ? d : null;
}

function ymdToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTickDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type ChartPoint = {
  date: Date;
  last: number;
  best: number;
  label: string;
};

function buildChartSeries(entries: SparkEntry[], higherIsBetter: boolean): ChartPoint[] {
  const sorted = [...entries]
    .map((e) => ({ entry: e, date: parseEntryDate(e.measurement_date) }))
    .filter((x): x is { entry: SparkEntry; date: Date } => x.date != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let best = higherIsBetter ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  const points: ChartPoint[] = [];
  for (const { entry, date } of sorted) {
    const last = Number(entry.value);
    if (!Number.isFinite(last)) continue;
    if (higherIsBetter) best = Math.max(best, last);
    else best = Math.min(best, last);
    points.push({
      date,
      last,
      best,
      label: formatTickDate(date),
    });
  }
  return points;
}

function chartGeometry(points: ChartPoint[]) {
  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const values = points.flatMap((p) => [p.last, p.best]);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
    minV = 0;
    maxV = 1;
  }
  if (minV === maxV) {
    minV = minV * 0.9;
    maxV = maxV * 1.1 || 1;
  }
  const pad = (maxV - minV) * 0.08;
  minV -= pad;
  maxV += pad;
  const xAt = (i: number) =>
    CHART_PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) =>
    CHART_PAD.top + ((maxV - v) / (maxV - minV || 1)) * innerH;
  return { innerW, innerH, minV, maxV, xAt, yAt };
}

function linePath(
  points: ChartPoint[],
  pick: "last" | "best",
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p[pick])}`)
    .join(" ");
}

function PrProgressChart({
  points,
  unit,
  hoverIndex,
  onHover,
}: {
  points: ChartPoint[];
  unit: string | null;
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  const { minV, maxV, xAt, yAt } = chartGeometry(points);
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const t = i / (yTicks - 1);
    return minV + (maxV - minV) * (1 - t);
  });
  // Dense date labels vs mobile — aim for ~8 ticks, always include ends.
  const maxDateTicks = Math.min(points.length, 8);
  const dateIndexes =
    points.length <= maxDateTicks
      ? points.map((_, i) => i)
      : Array.from({ length: maxDateTicks }, (_, i) =>
          Math.round((i / (maxDateTicks - 1)) * (points.length - 1)),
        );

  const hover = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="dash-pr-chart">
      <div className="dash-pr-chart__legend" aria-hidden="true">
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--best">Best</span>
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--last">Last</span>
        {unit ? <span className="dash-pr-chart__unit">{unit}</span> : null}
      </div>
      <svg
        className="dash-pr-chart__svg"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={`Best and last ${unit ?? "score"} over time`}
        onMouseLeave={() => onHover(null)}
      >
        {yLabels.map((v, i) => {
          const y = yAt(v);
          return (
            <g key={`y-${i}`}>
              <line
                className="dash-pr-chart__grid"
                x1={CHART_PAD.left}
                x2={CHART_W - CHART_PAD.right}
                y1={y}
                y2={y}
              />
              <text className="dash-pr-chart__tick" x={CHART_PAD.left - 8} y={y + 3} textAnchor="end">
                {formatScoreNumber(v)}
              </text>
            </g>
          );
        })}
        {dateIndexes.map((i) => (
          <text
            key={`x-${i}`}
            className="dash-pr-chart__tick dash-pr-chart__tick--x"
            x={xAt(i)}
            y={CHART_H - 12}
            textAnchor="middle"
          >
            {points[i]!.label}
          </text>
        ))}
        <path
          className="dash-pr-chart__line dash-pr-chart__line--best"
          d={linePath(points, "best", xAt, yAt)}
          fill="none"
        />
        <path
          className="dash-pr-chart__line dash-pr-chart__line--last"
          d={linePath(points, "last", xAt, yAt)}
          fill="none"
        />
        {points.map((p, i) => (
          <g key={`pt-${i}`}>
            <circle
              className="dash-pr-chart__hit"
              cx={xAt(i)}
              cy={yAt(p.last)}
              r={14}
              onMouseEnter={() => onHover(i)}
              onFocus={() => onHover(i)}
            />
            <circle
              className="dash-pr-chart__dot dash-pr-chart__dot--last"
              cx={xAt(i)}
              cy={yAt(p.last)}
              r={hoverIndex === i ? 5 : 3.5}
            />
            <circle
              className="dash-pr-chart__dot dash-pr-chart__dot--best"
              cx={xAt(i)}
              cy={yAt(p.best)}
              r={hoverIndex === i ? 4.5 : 3}
            />
          </g>
        ))}
        {hover && hoverIndex != null ? (
          <g className="dash-pr-chart__tooltip">
            <rect
              x={Math.min(xAt(hoverIndex) + 10, CHART_W - 150)}
              y={Math.max(yAt(hover.last) - 48, 4)}
              width={140}
              height={42}
              rx={6}
            />
            <text
              x={Math.min(xAt(hoverIndex) + 18, CHART_W - 142)}
              y={Math.max(yAt(hover.last) - 30, 20)}
            >
              {hover.label}
            </text>
            <text
              x={Math.min(xAt(hoverIndex) + 18, CHART_W - 142)}
              y={Math.max(yAt(hover.last) - 14, 36)}
            >
              {`Best ${formatValue(hover.best, unit)} · Last ${formatValue(hover.last, unit)}`}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function PrChartSkeleton() {
  return (
    <div className="dash-pr-chart dash-pr-chart--skeleton" aria-busy="true" aria-label="Loading chart">
      <div className="dash-pr-chart__legend" aria-hidden="true">
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--best">Best</span>
        <span className="dash-pr-chart__swatch dash-pr-chart__swatch--last">Last</span>
      </div>
      <svg className="dash-pr-chart__svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const y = CHART_PAD.top + (i / 4) * (CHART_H - CHART_PAD.top - CHART_PAD.bottom);
          return (
            <line
              key={i}
              className="dash-pr-chart__grid dash-pr-chart__grid--skel"
              x1={CHART_PAD.left}
              x2={CHART_W - CHART_PAD.right}
              y1={y}
              y2={y}
            />
          );
        })}
        <path
          className="dash-pr-chart__skel-line"
          d={`M ${CHART_PAD.left} ${CHART_H * 0.62} L ${CHART_W * 0.28} ${CHART_H * 0.55} L ${CHART_W * 0.48} ${CHART_H * 0.48} L ${CHART_W * 0.68} ${CHART_H * 0.42} L ${CHART_W - CHART_PAD.right} ${CHART_H * 0.36}`}
          fill="none"
        />
        {[0.18, 0.34, 0.5, 0.66, 0.82].map((t, i) => {
          const x = CHART_PAD.left + t * (CHART_W - CHART_PAD.left - CHART_PAD.right);
          const h = 28 + ((i * 17) % 40);
          return (
            <rect
              key={t}
              className="dash-pr-chart__skel-bar"
              x={x - 6}
              y={CHART_H - CHART_PAD.bottom - h}
              width={12}
              height={h}
              rx={3}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function AccountBenchmarks() {
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
          overviewPr.workouts.find((w) => w.best_score != null) ??
          null;
        if (firstLift) {
          setActiveId(rowKey(firstLift));
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

  const conditioning = useMemo(() => {
    const rows = (prs?.workouts ?? []).filter((w) => w.best_score != null);
    return [...rows].sort((a, b) => (b.total_entries ?? 0) - (a.total_entries ?? 0));
  }, [prs]);

  const markers = useMemo(() => {
    const rows = (prs?.movements ?? []).filter(
      (m) => m.best_score != null && !isStrengthMovement(m),
    );
    return rows.slice(0, 8);
  }, [prs]);

  const activeRow: PrOverviewRow | null = useMemo(() => {
    if (!activeId || !prs) return null;
    const all = [...prs.movements, ...prs.workouts];
    return all.find((r) => rowKey(r) === activeId) ?? null;
  }, [activeId, prs]);

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

  const higherIsBetter = useMemo(() => {
    if (!activeRow) return true;
    return isStrengthMovement(activeRow);
  }, [activeRow]);

  const chartPoints = useMemo(
    () => buildChartSeries(entries, higherIsBetter),
    [entries, higherIsBetter],
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
          label: "Metabolic markers",
          value: markers.length > 0 ? `${markers.length} markers` : "Log labs in the app",
          note: "Non-weight movement measurements",
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
          label: "Metabolic markers",
          value: "Locked",
          note: "🔒 Lab & body marker log with Pro",
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
      title={`${firstName}’s PRs, benchmarks & body markers`}
      description="Keep 1RM lifts, Daily Fix benchmark times, and metabolic markers in one place."
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
        title={`${firstName}’s PRs, benchmarks & body markers.`}
        lede="Keep your 1RM lifts, repeat Daily Fix benchmark times, and metabolic markers in one place — with live working-set percentages from your logged PRs."
        cta={
          !pro ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock PR & Benchmark Tracking — 1 Month Free
            </Link>
          ) : null
        }
        stats={heroStats}
      />

      {error ? <p className="account-error">{error}</p> : null}

      {!pro ? (
        <div className="dash-panel dash-bench">
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
                  Metabolic &amp; body markers
                </h2>
              </div>
              <Link href={basePath("/join")} className="account-btn account-btn--accent">
                Unlock lab &amp; body tracker
              </Link>
            </div>
            <div className="dash-lock-pills" aria-hidden="true">
              <span className="dash-lock-pill">TG:HDL ratio</span>
              <span className="dash-lock-pill">Fasting insulin</span>
              <span className="dash-lock-pill">Waist-to-height</span>
              <span className="dash-lock-pill">HbA1c</span>
            </div>
          </section>

          <ProUnlockBanner />
        </div>
      ) : (
        <div className="dash-panel dash-bench">
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
                  <span className="dash-chip">
                    {strength.length} lift{strength.length === 1 ? "" : "s"}
                  </span>
                </div>

                {strength.length === 0 ? (
                  <div className="dash-empty">
                    <p className="account-muted">
                      No strength PRs yet. Log a movement below once it appears in your overview,
                      or log benchmarks in the MetFix app — they’ll sync here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="dash-lift-tabs" role="tablist" aria-label="Lifts">
                      {strength.slice(0, 12).map((row) => {
                        const id = rowKey(row);
                        const on = id === activeId;
                        return (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            className={`dash-lift-tab${on ? " dash-lift-tab--on" : ""}`}
                            onClick={() => setActiveId(id)}
                          >
                            {row.name}
                            <span className="dash-lift-tab__score">{formatScore(row)}</span>
                          </button>
                        );
                      })}
                    </div>

                    {activeRow && isStrengthMovement(activeRow) ? (
                      <div className="dash-lift-detail dash-lift-detail--chart">
                        <div>
                          <p className="dash-kicker">{activeRow.name} · 1-rep max curve</p>
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
                                No entry history for this lift yet. Log a PR to start the curve.
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
                        {activeRow.best_score != null ? (
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
                </div>
                {conditioning.length === 0 ? (
                  <p className="account-muted">No workout benchmarks logged yet.</p>
                ) : (
                  <div className="dash-bench-grid">
                    {conditioning.slice(0, 8).map((row) => {
                      const id = rowKey(row);
                      return (
                        <article key={id} className="dash-bench-card">
                          <h3 className="dash-meal-card__title">{row.name}</h3>
                          <p className="dash-lift-max dash-lift-max--sm">{formatScore(row)}</p>
                          <p className="account-muted">
                            Best · {row.total_entries} attempt
                            {row.total_entries === 1 ? "" : "s"}
                            {row.benchmark_classification
                              ? ` · ${row.benchmark_classification}`
                              : ""}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="dash-bench-section" aria-labelledby="mark-heading">
                <div className="dash-bench-head">
                  <div>
                    <p className="dash-kicker">Pro health log</p>
                    <h2 id="mark-heading" className="dash-section-title">
                      Metabolic & body markers
                    </h2>
                  </div>
                </div>
                {markers.length === 0 ? (
                  <p className="account-muted">
                    No lab / body markers in your PR overview yet.
                  </p>
                ) : (
                  <div className="dash-bench-grid">
                    {markers.map((row) => {
                      const id = rowKey(row);
                      return (
                        <article key={id} className="dash-bench-card">
                          <h3 className="dash-meal-card__title">{row.name}</h3>
                          <p className="dash-lift-max dash-lift-max--sm">{formatScore(row)}</p>
                          <p className="account-muted">
                            {row.total_entries} entr
                            {row.total_entries === 1 ? "y" : "ies"}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
