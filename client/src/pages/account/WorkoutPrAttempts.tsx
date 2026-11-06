import { useEffect, useState } from "react";
import { loadWorkoutLogs, type WorkoutLogItem } from "@/lib/account";
import { FeedSkeleton } from "./BodyWatermark";
import { addDays, formatDayLabel, formatScoreNumber, todayYmd } from "./bodyDates";

type Attempt = {
  id: number;
  date: string;
  score: string | null;
  note: string | null;
};

function attemptsFrom(logs: WorkoutLogItem[], customWorkoutId: number, today: string): Attempt[] {
  return logs
    .filter(
      (row) => row.workout_source === "custom" && row.workout_source_id === customWorkoutId,
    )
    .map((row) => {
      const date = row.date_time.slice(0, 10);
      const score = row.score_entries.find((entry) => entry.score_value != null);
      const scoreLabel = score
        ? [formatScoreNumber(score.score_value ?? 0), score.score_type].filter(Boolean).join(" ")
        : null;
      return {
        id: row.id,
        date,
        score: scoreLabel,
        note: row.workout_free_text,
      };
    })
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((row) => ({ ...row, date: formatDayLabel(row.date, today) }));
}

/** Workout-benchmark history — same calendar filter the app uses on the PR screen. */
export function WorkoutPrAttempts({
  customWorkoutId,
  name,
}: {
  customWorkoutId: number;
  name: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    const today = todayYmd();
    const start = addDays(today, -730);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const page = await loadWorkoutLogs(start, today, { signal: ac.signal });
        if (cancelled) return;
        setAttempts(attemptsFrom(page.workouts ?? [], customWorkoutId, today));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAttempts([]);
        setError("Unable to load attempts for this benchmark.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [customWorkoutId]);

  if (loading) return <FeedSkeleton label={`Loading ${name} attempts`} />;
  if (error) return <p className="account-error">{error}</p>;
  if (attempts.length === 0) {
    return <p className="account-muted">No logged attempts for {name} in the last two years.</p>;
  }

  return (
    <ol className="dash-attempt-list">
      {attempts.map((attempt) => (
        <li key={attempt.id}>
          <span>{attempt.date}</span>
          <span>{attempt.score ?? attempt.note ?? "Logged"}</span>
        </li>
      ))}
    </ol>
  );
}
