import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadDailyFixWorkout,
  type CustomWorkoutSummary,
  type DailyFixWorkoutRef,
  type PrOverviewRow,
} from "@/lib/account";
import { addDays, formatDayLabel, formatYymmdd, todayYmd } from "./bodyDates";
import { workoutBenchmarkSlug } from "./prCatalog";

export type ArchiveKind = "daily_fix" | "custom" | "benchmark" | "session";

export type ArchiveSelection =
  | { kind: "daily_fix"; date: string; fix: DailyFixWorkoutRef }
  | { kind: "custom"; workout: CustomWorkoutSummary }
  | { kind: "benchmark"; customWorkoutId: number; title: string }
  | { kind: "session"; title: string };

type Props = {
  open: boolean;
  kind: ArchiveKind | null;
  workouts: CustomWorkoutSummary[];
  benchmarks?: PrOverviewRow[];
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: ArchiveSelection) => void;
};

const DAILY_LOOKBACK = 7;
const MY_WORKOUTS_CAP = 14;
const BENCHMARK_SUGGESTIONS = 5;

function DailyArchiveSkeleton() {
  return (
    <ul className="dash-workout-archive__list" aria-busy="true" aria-label="Loading Daily Fix archive">
      {Array.from({ length: DAILY_LOOKBACK }, (_, i) => (
        <li key={i}>
          <div className="dash-workout-pick dash-workout-pick--skel">
            <span className="dash-skel dash-workout-pick__skel-meta" />
            <span className="dash-skel dash-workout-pick__skel-title" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function shufflePick<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}

function benchmarkLabel(row: PrOverviewRow): string {
  const klass = workoutBenchmarkSlug(row.benchmark_classification);
  if (klass === "girls") return "Girls";
  if (klass === "hero") return "Hero";
  if (klass === "named_benchmark") return "Named";
  return "Benchmark";
}

export function WorkoutSourceArchiveModal({
  open,
  kind,
  workouts,
  benchmarks = [],
  onOpenChange,
  onSelect,
}: Props) {
  const today = todayYmd();
  const [query, setQuery] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [dailyRows, setDailyRows] = useState<
    Array<{ date: string; fix: DailyFixWorkoutRef; loading?: boolean }>
  >([]);
  const [suggestedBenchmarks, setSuggestedBenchmarks] = useState<PrOverviewRow[]>([]);

  const mine = useMemo(() => workouts.slice(0, MY_WORKOUTS_CAP), [workouts]);
  const catalogBenchmarks = useMemo(
    () => benchmarks.filter((row) => row.custom_workout_id != null && row.custom_workout_id > 0),
    [benchmarks],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSessionTitle("");
      setDailyRows([]);
      setSuggestedBenchmarks([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || kind !== "benchmark") return;
    setSuggestedBenchmarks(shufflePick(catalogBenchmarks, BENCHMARK_SUGGESTIONS));
  }, [open, kind, catalogBenchmarks]);

  useEffect(() => {
    if (!open || kind !== "daily_fix") return;

    const dates = Array.from({ length: DAILY_LOOKBACK }, (_, i) => addDays(today, -i));
    const ac = new AbortController();
    setDailyRows(
      dates.map((date) => ({
        date,
        fix: { date, title: null, workout_id: null, custom_workout_id: null },
        loading: true,
      })),
    );

    dates.forEach((date) => {
      void (async () => {
        try {
          const fix = await loadDailyFixWorkout(date, { signal: ac.signal, force: true });
          if (ac.signal.aborted) return;
          setDailyRows((prev) =>
            prev.map((row) => (row.date === date ? { date, fix, loading: false } : row)),
          );
        } catch {
          if (ac.signal.aborted) return;
          setDailyRows((prev) =>
            prev.map((row) =>
              row.date === date
                ? {
                    date,
                    fix: {
                      date,
                      title: null,
                      workout_id: null,
                      custom_workout_id: null,
                    },
                    loading: false,
                  }
                : row,
            ),
          );
        }
      })();
    });

    return () => ac.abort();
  }, [open, kind, today]);

  const dailyStillLoading = dailyRows.length === 0 || dailyRows.some((row) => row.loading);

  const filteredDaily = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const stillLoading = dailyRows.some((row) => row.loading);
    return dailyRows.filter((row) => {
      if (row.loading) return !needle;
      const title = (row.fix.title || "").toLowerCase();
      if (!needle) {
        if (stillLoading) return true;
        return Boolean(row.fix.title) || row.date === today;
      }
      return title.includes(needle) || row.date.includes(needle) || formatYymmdd(row.date).includes(needle);
    });
  }, [dailyRows, query, today]);

  const filteredMine = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return mine;
    return mine.filter((row) => {
      const title = row.title.toLowerCase();
      const excerpt = (row.excerpt || "").toLowerCase();
      return title.includes(needle) || excerpt.includes(needle);
    });
  }, [mine, query]);

  const filteredBenchmarks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return catalogBenchmarks.filter((row) => {
      const title = row.name.toLowerCase();
      const klass = (row.benchmark_classification || "").toLowerCase();
      return title.includes(needle) || klass.includes(needle);
    });
  }, [catalogBenchmarks, query]);

  function onSessionSubmit(e: FormEvent) {
    e.preventDefault();
    const title = sessionTitle.trim();
    if (!title) return;
    onSelect({ kind: "session", title });
    onOpenChange(false);
  }

  const title =
    kind === "daily_fix"
      ? "Daily Fix archive"
      : kind === "custom"
        ? "My workouts"
        : kind === "benchmark"
          ? "Benchmarks"
          : "Quick activity";
  const description =
    kind === "daily_fix"
      ? "Pick a Daily Fix workout from the last 7 days."
      : kind === "custom"
        ? "Choose one of your saved workouts to log."
        : kind === "benchmark"
          ? "Try a suggested benchmark, or search the full catalog."
          : "Name a freeform session without a template.";

  return (
    <Dialog open={open && kind != null} onOpenChange={onOpenChange}>
      <DialogContent className="dash-workout-archive-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {kind === "session" ? (
          <form className="account-form" onSubmit={onSessionSubmit}>
            <label>
              Name
              <input
                value={sessionTitle}
                onChange={(ev) => setSessionTitle(ev.target.value)}
                required
                maxLength={180}
                autoFocus
                placeholder="Easy row, zone 2, etc."
              />
            </label>
            <DialogFooter>
              <button type="submit" className="account-btn" disabled={!sessionTitle.trim()}>
                Use this activity
              </button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <input
              className="dash-workout-archive__search"
              type="search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder={
                kind === "daily_fix"
                  ? "Search by title or date"
                  : kind === "benchmark"
                    ? "Search benchmarks"
                    : "Search workouts"
              }
              aria-label="Search archive"
            />
            {kind === "daily_fix" ? (
              dailyRows.length === 0 ? (
                <DailyArchiveSkeleton />
              ) : filteredDaily.length === 0 && !dailyStillLoading ? (
                <p className="dash-workout-archive__empty">No Daily Fix workouts match.</p>
              ) : (
                <ul
                  className="dash-workout-archive__list"
                  aria-busy={dailyStillLoading}
                  aria-label="Daily Fix archive"
                >
                  {filteredDaily.map((row) => {
                    if (row.loading) {
                      return (
                        <li key={row.date}>
                          <div className="dash-workout-pick dash-workout-pick--skel">
                            <span className="dash-skel dash-workout-pick__skel-meta" />
                            <span className="dash-skel dash-workout-pick__skel-title" />
                          </div>
                        </li>
                      );
                    }
                    const label = row.fix.title?.trim() || "No workout posted";
                    const disabled = !row.fix.title && !row.fix.custom_workout_id && !row.fix.workout_id;
                    return (
                      <li key={row.date}>
                        <button
                          type="button"
                          className="dash-workout-pick"
                          disabled={disabled}
                          onClick={() => {
                            onSelect({ kind: "daily_fix", date: row.date, fix: row.fix });
                            onOpenChange(false);
                          }}
                        >
                          <span className="dash-workout-pick__over">
                            <span aria-hidden="true">MF</span>
                            <span>{formatYymmdd(row.date)}</span>
                            <span>· {formatDayLabel(row.date, today)}</span>
                          </span>
                          <span className="dash-workout-pick__title">{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : kind === "benchmark" ? (
              query.trim() ? (
                filteredBenchmarks.length === 0 ? (
                  <p className="dash-workout-archive__empty">No benchmarks match.</p>
                ) : (
                  <ul className="dash-workout-archive__list" aria-label="Benchmark search results">
                    {filteredBenchmarks.map((row) => (
                      <li key={row.custom_workout_id}>
                        <button
                          type="button"
                          className="dash-workout-pick"
                          onClick={() => {
                            onSelect({
                              kind: "benchmark",
                              customWorkoutId: row.custom_workout_id!,
                              title: row.name,
                            });
                            onOpenChange(false);
                          }}
                        >
                          <span className="dash-workout-pick__over">{benchmarkLabel(row)}</span>
                          <span className="dash-workout-pick__title">{row.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : catalogBenchmarks.length === 0 ? (
                <p className="dash-workout-archive__empty">No benchmarks available yet.</p>
              ) : (
                <>
                  <p className="dash-workout-archive__suggest-label">Suggested</p>
                  <ul className="dash-workout-archive__list" aria-label="Suggested benchmarks">
                    {suggestedBenchmarks.map((row) => (
                      <li key={row.custom_workout_id}>
                        <button
                          type="button"
                          className="dash-workout-pick"
                          onClick={() => {
                            onSelect({
                              kind: "benchmark",
                              customWorkoutId: row.custom_workout_id!,
                              title: row.name,
                            });
                            onOpenChange(false);
                          }}
                        >
                          <span className="dash-workout-pick__over">{benchmarkLabel(row)}</span>
                          <span className="dash-workout-pick__title">{row.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : filteredMine.length === 0 ? (
              <p className="dash-workout-archive__empty">
                {mine.length === 0 ? "No saved workouts yet. Build one first." : "No workouts match."}
              </p>
            ) : (
              <ul className="dash-workout-archive__list">
                {filteredMine.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="dash-workout-pick"
                      onClick={() => {
                        onSelect({ kind: "custom", workout: row });
                        onOpenChange(false);
                      }}
                    >
                      <span className="dash-workout-pick__title">{row.title}</span>
                      {row.excerpt?.trim() ? (
                        <span className="dash-workout-pick__excerpt">{row.excerpt.trim()}</span>
                      ) : row.logging_type ? (
                        <span className="dash-workout-pick__excerpt">{row.logging_type}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
