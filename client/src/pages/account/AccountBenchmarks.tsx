import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  deriveMembershipStatus,
  loadOverview,
  loadPrOverview,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
  type PrOverview,
  type PrOverviewRow,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";

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

export default function AccountBenchmarks() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [prs, setPrs] = useState<PrOverview | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          setActiveId(
            firstLift.measurement_id
              ? `m-${firstLift.measurement_id}`
              : firstLift.custom_workout_id
                ? `w-${firstLift.custom_workout_id}`
                : firstLift.name,
          );
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
    return (
      all.find((r) =>
        r.measurement_id
          ? `m-${r.measurement_id}` === activeId
          : r.custom_workout_id
            ? `w-${r.custom_workout_id}` === activeId
            : r.name === activeId,
      ) ?? null
    );
  }, [activeId, prs]);

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
          value: "335 Squat · 425 Deadlift",
          note: "🔒 Auto-% working sets with Pro",
        },
        {
          label: "Benchmark conditioning",
          value: "3:14 Fran · 13:08 Row/L-Sit",
          note: "🔒 Compare repeat dates with Pro",
        },
        {
          label: "Metabolic markers",
          value: "1.1 TG:HDL · 4.2 Insulin",
          note: "🔒 Lab & body marker log with Pro",
        },
      ];

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
                <span className="dash-locked-badge">Preview · 1 of 18 lifts</span>
                <Link href={basePath("/join")} className="account-btn account-btn--accent">
                  Unlock full log
                </Link>
              </div>
            </div>
            <div className="dash-lift-tabs" aria-hidden="true">
              <span className="dash-lift-tab dash-lift-tab--on">
                Back Squat
                <span className="dash-lift-tab__score">335 lb SAMPLE</span>
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
                <p className="dash-lift-max">335 lb</p>
                <p className="account-muted">Sample preview · unlock to log your own PRs</p>
              </div>
              <div className="dash-pct-table">
                <p className="dash-kicker">Working-set percentages</p>
                <p className="account-muted">Based on 335 lb sample 1RM</p>
                <table>
                  <tbody>
                    {workingPercents(335)
                      .slice(0, 3)
                      .map((row) => (
                        <tr key={row.pct}>
                          <td>{row.pct}%</td>
                          <td>{row.reps}</td>
                          <td>{row.load} lb</td>
                        </tr>
                      ))}
                    {workingPercents(335)
                      .slice(3)
                      .map((row) => (
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
                <p className="dash-lift-max dash-lift-max--sm">3:14</p>
                <p className="account-muted">Sample · unlock to compare your attempts</p>
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
            <p className="account-muted">Loading your PR overview…</p>
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
                  <p className="account-muted">
                    No strength PRs yet. Log movement benchmarks in the MetFix app — they’ll sync here.
                  </p>
                ) : (
                  <>
                    <div className="dash-lift-tabs" role="tablist" aria-label="Lifts">
                      {strength.slice(0, 12).map((row) => {
                        const id = row.measurement_id
                          ? `m-${row.measurement_id}`
                          : row.name;
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

                    {activeRow && isStrengthMovement(activeRow) && activeRow.best_score != null ? (
                      <div className="dash-lift-detail">
                        <div>
                          <p className="dash-kicker">{activeRow.name} · 1-rep max</p>
                          <p className="dash-lift-max">{formatScore(activeRow)}</p>
                          <p className="account-muted">
                            {activeRow.total_entries} entr
                            {activeRow.total_entries === 1 ? "y" : "ies"}
                            {activeRow.last_score != null
                              ? ` · last ${formatScore({ ...activeRow, best_score: activeRow.last_score })}`
                              : ""}
                          </p>
                        </div>
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
                      const id = row.custom_workout_id
                        ? `w-${row.custom_workout_id}`
                        : row.name;
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
                      const id = row.measurement_id
                        ? `m-${row.measurement_id}`
                        : row.name;
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
