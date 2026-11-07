import { useCallback, useState } from "react";
import { fetchDailyFixComments } from "./comments";
import {
  mapDailyFixCompareTo,
  yymmddFromIso,
  type DailyFixCompareTo,
  type DailyFixDay,
  type DailyFixPriorLog,
} from "./model";

function formatScores(log: DailyFixPriorLog): string {
  const entries = Object.entries(log.scores);
  if (entries.length === 0) return "No scores logged";
  return entries
    .map(([key, value]) => `${key}: ${value ?? "—"}`)
    .join(" · ");
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "compare_to_date":
      return "From the linked compare day";
    case "exact_daily_workout_id":
    case "exact_custom_workout_id":
      return "Matched by workout id";
    case "identical_structure":
      return "Matched by identical structure";
    default:
      return reason || "Prior log";
  }
}

async function fetchCompareTo(dateIso: string): Promise<DailyFixCompareTo | null | "unauthorized"> {
  try {
    const res = await fetch(`/api/daily-fix/compare-to?date=${encodeURIComponent(dateIso)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) return "unauthorized";
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return mapDailyFixCompareTo(json);
  } catch {
    return null;
  }
}

export function CompareToPrior({ day }: { day: DailyFixDay }) {
  const seed = day.compare_to;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<DailyFixCompareTo | null>(seed);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  const onToggle = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const hydrated = await fetchCompareTo(day.date);
      if (hydrated === "unauthorized") {
        setCompare(seed);
        if (!seed?.date) {
          setError("Sign in to see your prior score for this workout.");
        }
      } else {
        const next = hydrated ?? seed;
        setCompare(next);
        if (!next?.date && !next?.my_prior_log) {
          setError("No prior log found for this workout yet.");
        }
      }
      const priorDate =
        (hydrated !== "unauthorized" ? hydrated?.date : null) ??
        (hydrated !== "unauthorized" ? hydrated?.my_prior_log?.date : null) ??
        seed?.date ??
        null;
      if (priorDate) {
        const comments = await fetchDailyFixComments(priorDate);
        if (comments.status === "loaded") {
          setCommentCount(comments.comments.filter((c) => c.pillar === "body").length);
        } else {
          setCommentCount(null);
        }
      } else {
        setCommentCount(null);
      }
    } catch {
      setError("Could not load prior log.");
    } finally {
      setLoading(false);
    }
  }, [day.date, open, seed]);

  const prior = compare?.my_prior_log ?? null;
  const priorDate = compare?.date ?? prior?.date ?? seed?.date ?? null;
  const yymmdd = priorDate ? yymmddFromIso(priorDate) : "";
  const href = yymmdd ? `/the-daily-fix/${yymmdd}?tab=body` : null;
  const labelDate = priorDate ?? seed?.date;

  return (
    <div className="df-compare">
      <button type="button" className="df-btn df-btn-ink" onClick={() => void onToggle()}>
        {open ? "Hide prior log" : labelDate ? `Compare to ${labelDate}` : "Compare to prior log"}
      </button>
      {open ? (
        <div className="df-compare-panel" aria-live="polite">
          {loading ? <p className="df-muted">Loading prior log…</p> : null}
          {error ? <p className="df-muted">{error}</p> : null}
          {!loading && prior ? (
            <div className="df-compare-log">
              <p>
                <strong>{prior.workout_title || "Prior workout"}</strong>
                {prior.date ? ` · ${prior.date}` : null}
              </p>
              <p className="df-muted">{reasonLabel(prior.match_reason)}</p>
              <p>{formatScores(prior)}</p>
              <p className="df-muted">Scaling: {prior.scaling_mode}</p>
            </div>
          ) : null}
          {!loading && commentCount != null && priorDate ? (
            <p className="df-muted">
              {commentCount} body comment{commentCount === 1 ? "" : "s"} on {priorDate}
            </p>
          ) : null}
          {href ? (
            <a className="df-btn" href={href}>
              Open prior Daily Fix day
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
