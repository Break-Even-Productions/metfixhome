import { useEffect, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  loadPrOverview,
  loadSparkEntries,
  type PrOverview,
  type PrOverviewRow,
  type SparkEntry,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

function formatScore(row: PrOverviewRow): string {
  if (row.best_score == null) return "—";
  const n = row.best_score;
  const unit = row.unit_abbreviation?.trim();
  if (unit) return `${n} ${unit}`;
  return String(n);
}

function entryLabel(entry: SparkEntry): string {
  return (
    entry.measurement_name?.trim() ||
    (entry.bsi_measurement_id != null
      ? `Measurement ${entry.bsi_measurement_id}`
      : "Spark entry")
  );
}

function formatEntryDate(raw: string): string {
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AccountSpark() {
  const [overview, setOverview] = useState<PrOverview | null>(null);
  const [entries, setEntries] = useState<SparkEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setEntriesError(null);
      try {
        const [pr, spark] = await Promise.allSettled([
          loadPrOverview({ signal: ac.signal, force: true }),
          loadSparkEntries({ limit: 40 }, { signal: ac.signal, force: true }),
        ]);
        if (cancelled) return;

        if (pr.status === "fulfilled") {
          setOverview(pr.value);
        } else if (!(pr.reason instanceof DOMException && pr.reason.name === "AbortError")) {
          setError("Unable to load Spark / PR overview.");
        }

        if (spark.status === "fulfilled") {
          setEntries(Array.isArray(spark.value.entries) ? spark.value.entries : []);
        } else if (
          !(spark.reason instanceof DOMException && spark.reason.name === "AbortError")
        ) {
          setEntries([]);
          setEntriesError(
            "Spark entry history is unavailable (worker proxy may not be live yet).",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const movements = overview?.movements ?? [];
  const workouts = overview?.workouts ?? [];
  const hasOverview = movements.length + workouts.length > 0;
  const hasEntries = (entries?.length ?? 0) > 0;

  return (
    <DashboardLayout
      title="My Data / Spark"
      description="Measurement history and personal-record overview from Spark."
    >
      {error ? <p className="account-error">{error}</p> : null}

      <div className="account-card">
        <h2>PR overview</h2>
        <p className="account-muted" style={{ marginTop: 0 }}>
          Strength and conditioning markers from your Spark profile.
        </p>
        {loading && !overview ? (
          <p className="account-muted" aria-busy="true">
            Loading overview…
          </p>
        ) : null}
        {!loading && !error && !hasOverview ? (
          <p className="account-muted">No PR overview rows yet.</p>
        ) : null}
        {hasOverview ? (
          <ul className="account-spark-list">
            {[...movements, ...workouts].map((row) => {
              const key =
                row.measurement_id != null
                  ? `m-${row.measurement_id}`
                  : row.custom_workout_id != null
                    ? `w-${row.custom_workout_id}`
                    : row.name;
              return (
                <li key={key} className="account-spark-list__item">
                  <div>
                    <div className="account-spark-list__title">{row.name}</div>
                    <div className="account-muted">
                      {row.type ?? (row.is_benchmark ? "Benchmark" : "Measurement")}
                      {row.total_entries > 0
                        ? ` · ${row.total_entries} entr${row.total_entries === 1 ? "y" : "ies"}`
                        : null}
                    </div>
                  </div>
                  <div className="account-mono account-spark-list__score">
                    {formatScore(row)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p style={{ marginTop: "1rem" }}>
          <Link href={basePath("/account/benchmarks")} className="account-btn account-btn--ghost">
            Open benchmarks
          </Link>
        </p>
      </div>

      <div className="account-card">
        <h2>Recent Spark entries</h2>
        {entriesError ? <p className="account-error">{entriesError}</p> : null}
        {loading && entries == null ? (
          <p className="account-muted" aria-busy="true">
            Loading entries…
          </p>
        ) : null}
        {!loading && !entriesError && !hasEntries ? (
          <p className="account-muted">No Spark entries yet.</p>
        ) : null}
        {hasEntries ? (
          <ul className="account-spark-list">
            {entries!.map((entry, i) => (
              <li
                key={entry.id != null ? String(entry.id) : `${entry.measurement_date}-${i}`}
                className="account-spark-list__item"
              >
                <div>
                  <div className="account-spark-list__title">{entryLabel(entry)}</div>
                  <div className="account-muted">
                    {formatEntryDate(entry.measurement_date)}
                    {entry.status || entry.type
                      ? ` · ${entry.status ?? entry.type}`
                      : null}
                  </div>
                </div>
                <div className="account-mono account-spark-list__score">
                  {entry.value}
                  {entry.unit_abbreviation ? ` ${entry.unit_abbreviation}` : ""}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
