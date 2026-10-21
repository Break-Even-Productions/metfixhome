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
  /** When false, show sign-in prompt and skip fetch (AU23.2 / P11). */
  signedIn: boolean;
  fetchImpl?: typeof fetch;
};

const FILTERS: ScalingFilter[] = ["all", "rx", "scaled"];

/**
 * Signed-in leaderboard panel (L7 / LB.N7). Names render as text nodes only.
 */
export function Leaderboard({
  dateIso,
  pillar,
  signedIn,
  fetchImpl,
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

  return (
    <section className="df-leaderboard" aria-label={`${pillarLabel(pillar)} leaderboard`}>
      <div className="df-leaderboard-head">
        <h3 className="df-leaderboard-title">Leaderboard</h3>
        {signedIn ? (
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
        ) : null}
      </div>

      {!signedIn || load.status === "signed_out" ? (
        <p className="df-muted" role="status">
          Sign in to see the leaderboard.
        </p>
      ) : null}

      {load.status === "loading" && signedIn ? (
        <p className="df-muted" role="status">
          Loading leaderboard…
        </p>
      ) : null}

      {load.status === "unavailable" ? (
        <p className="df-muted df-leaderboard-status" role="status">
          Leaderboard unavailable right now.
        </p>
      ) : null}

      {load.status === "no_leaderboard" ? (
        <p className="df-muted" role="status">
          No leaderboard for this day.
        </p>
      ) : null}

      {load.status === "loaded" ? (
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
      ) : null}
    </section>
  );
}
