import { useEffect, useState } from "react";
import {
  fetchDailyFixLeaderboard,
  type LeaderboardLoadState,
  type ScalingFilter,
} from "./leaderboard";
import { pillarLabel, type Pillar } from "./model";

type LeaderboardProps = {
  dateIso: string | null;
  pillar: Pillar;
  /** When false, skip fetch and render nothing (AU23.2 / P11). */
  signedIn: boolean;
  fetchImpl?: typeof fetch;
  /** When true, omit the title (parent CommunityPanel owns chrome). */
  embedded?: boolean;
};

const FILTERS: ScalingFilter[] = ["all", "rx", "scaled"];

/**
 * Signed-in leaderboard panel (L7 / LB.N7). Names render as text nodes only.
 * Renders nothing when signed out, when there is no board, or when the default
 * load comes back with zero entries.
 */
export function Leaderboard({
  dateIso,
  pillar,
  signedIn,
  fetchImpl,
  embedded = false,
}: LeaderboardProps) {
  const [scaling, setScaling] = useState<ScalingFilter>("all");
  const [load, setLoad] = useState<LeaderboardLoadState>({ status: "loading" });

  useEffect(() => {
    if (!signedIn) {
      setLoad({ status: "signed_out" });
      return;
    }
    if (!dateIso) {
      setLoad({ status: "unavailable" });
      return;
    }
    let cancelled = false;
    setLoad({ status: "loading" });
    const ac = new AbortController();
    void fetchDailyFixLeaderboard(dateIso, pillar, scaling, ac.signal, {
      fetchImpl,
    }).then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [dateIso, pillar, scaling, signedIn, fetchImpl]);

  if (!signedIn || load.status === "signed_out" || load.status === "no_leaderboard") {
    return null;
  }

  if (load.status === "unavailable") {
    return (
      <section
        className={embedded ? "df-leaderboard df-leaderboard-embedded" : "df-leaderboard"}
        aria-label={`${pillarLabel(pillar)} leaderboard`}
      >
        <p className="df-muted df-leaderboard-status" role="status">
          Leaderboard unavailable right now.
        </p>
      </section>
    );
  }

  if (load.status === "loading") {
    return (
      <section
        className={embedded ? "df-leaderboard df-leaderboard-embedded" : "df-leaderboard"}
        aria-label={`${pillarLabel(pillar)} leaderboard`}
      >
        <p className="df-muted" role="status">
          Loading leaderboard…
        </p>
      </section>
    );
  }

  // loaded — hide entirely when the board has no rows (standalone / default filter).
  if (load.rows.length === 0 && scaling === "all") {
    return null;
  }

  return (
    <section
      className={embedded ? "df-leaderboard df-leaderboard-embedded" : "df-leaderboard"}
      aria-label={`${pillarLabel(pillar)} leaderboard`}
    >
      <div className="df-leaderboard-head">
        {embedded ? null : <h3 className="df-leaderboard-title">Leaderboard</h3>}
        <div className="df-leaderboard-filters" role="group" aria-label="Scaling filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={
                f === scaling ? "df-leaderboard-filter is-active" : "df-leaderboard-filter"
              }
              aria-pressed={f === scaling}
              onClick={() => setScaling(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {load.rows.length === 0 ? (
        <p className="df-muted" role="status">
          No entries for this filter.
        </p>
      ) : (
        <ol className="df-leaderboard-list">
          {load.rows.map((row) => (
            <li
              key={`${row.rank}-${row.public_name}-${row.logged_at ?? ""}`}
              className={row.is_self ? "df-leaderboard-row is-self" : "df-leaderboard-row"}
            >
              <span className="df-leaderboard-rank">{row.rank}</span>
              <span className="df-leaderboard-name">{row.public_name}</span>
              <span className="df-leaderboard-score">{row.score_value ?? ""}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
