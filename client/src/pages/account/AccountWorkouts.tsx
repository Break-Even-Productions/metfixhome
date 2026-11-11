import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ClipboardList, Hammer, History, Zap } from "lucide-react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  createWorkoutLog,
  deriveMembershipStatus,
  loadCustomWorkout,
  loadOverview,
  loadPlannedWorkouts,
  loadSubscriptions,
  loadWorkoutLogs,
  type AccountOverview,
  type AccountSubscriptions,
  type PlannedWorkoutItem,
  type WorkoutLogItem,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { addDays, eachDay, formatDayLabel, formatScoreNumber, todayYmd } from "./bodyDates";

const NEAR_PAST = 4;
const UPCOMING = 4;

type FeedRow = {
  key: string;
  title: string;
  date: string;
  planned: boolean;
  logId: number | null;
  plannedId: number | null;
  minutes: number | null;
  calories: number | null;
  note: string | null;
  source: string | null;
  sourceId: number | null;
  meta: string | null;
};

function scoreLabel(row: WorkoutLogItem): string | null {
  const score = row.score_entries?.find((entry) => entry.score_value != null);
  if (!score || score.score_value == null) return null;
  const bits = [formatScoreNumber(score.score_value)];
  if (score.score_type) bits.push(score.score_type);
  if (row.scaling_mode === "scaled") bits.push("scaled");
  else if (row.scaling_mode === "rx") bits.push("Rx");
  return bits.join(" · ");
}

function loggedRow(row: WorkoutLogItem): FeedRow | null {
  const date = row.date_time?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    key: `log-${row.id}`,
    title: row.workout_title || "Workout",
    date,
    planned: false,
    logId: row.id,
    plannedId: null,
    minutes: row.activity_minutes,
    calories: row.calories_burned,
    note: row.workout_free_text,
    source: row.workout_source,
    sourceId: row.workout_source_id,
    meta: scoreLabel(row),
  };
}

function plannedRow(row: PlannedWorkoutItem): FeedRow | null {
  if (row.logged === 1) return null;
  return {
    key: `plan-${row.id}`,
    title: row.title?.trim() || "Planned workout",
    date: row.plan_date,
    planned: true,
    logId: null,
    plannedId: row.id,
    minutes: null,
    calories: null,
    note: null,
    source: row.workout_source,
    sourceId: row.workout_source_id,
    meta: "Planned",
  };
}

function notePreview(note: string): string {
  const text = note.replace(/\s+/g, " ").trim();
  if (text.length <= 96) return text;
  return `${text.slice(0, 93).trimEnd()}…`;
}

function rowHref(row: FeedRow): string {
  if (row.logId) return basePath(`/account/workouts/${row.logId}`);
  const q = new URLSearchParams();
  q.set("date", row.date);
  q.set("source", row.source === "custom" ? "custom" : "daily_fix");
  if (row.sourceId) q.set("id", String(row.sourceId));
  return basePath(`/account/workouts/log?${q.toString()}`);
}

export default function AccountWorkouts() {
  const today = useMemo(() => todayYmd(), []);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [gate, setGate] = useState<"loading" | "locked" | "open" | "error">("loading");
  const [pastExtra, setPastExtra] = useState(0);
  const [logs, setLogs] = useState<WorkoutLogItem[]>([]);
  const [planned, setPlanned] = useState<PlannedWorkoutItem[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"past" | "upcoming">("past");
  const [reload, setReload] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [logTitle, setLogTitle] = useState("");
  const [logDate, setLogDate] = useState(today);
  const [logMinutes, setLogMinutes] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logBusy, setLogBusy] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);

  const start = addDays(today, -(NEAR_PAST + pastExtra));
  const end = addDays(today, UPCOMING);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        const tier = su?.canonical_tier ?? ov?.canonical_tier ?? "free";
        setGate(metfixToolsUnlocked(tier) ? "open" : "locked");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load workouts.");
        setGate("error");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    if (gate !== "open") return;
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [logged, plans] = await Promise.all([
          loadWorkoutLogs(start, end, { signal: ac.signal, force: reload > 0 }),
          loadPlannedWorkouts(start, end, { signal: ac.signal, force: reload > 0 }),
        ]);
        if (cancelled) return;
        setLogs(logged.workouts ?? []);
        setPlanned(plans.planned_workouts ?? []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLogs([]);
        setPlanned([]);
        setError("Unable to load workouts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [gate, start, end, reload]);

  const rows = useMemo(() => {
    const out: FeedRow[] = [];
    for (const row of logs) {
      const shaped = loggedRow(row);
      if (shaped) out.push(shaped);
    }
    for (const row of planned) {
      const shaped = plannedRow(row);
      if (!shaped) continue;
      const key =
        shaped.source === "daily_fix"
          ? `daily_fix:${shaped.date}`
          : shaped.sourceId
            ? `custom:${shaped.sourceId}`
            : "";
      if (key && titles[key]) shaped.title = titles[key]!;
      out.push(shaped);
    }
    return out;
  }, [logs, planned, titles]);

  useEffect(() => {
    if (gate !== "open") return;
    const ac = new AbortController();
    const pending = planned.filter((row) => row.logged !== 1 && !row.title);
    if (pending.length === 0) return;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        pending.slice(0, 12).map(async (row) => {
          try {
            if (row.workout_source === "daily_fix") {
              const res = await fetch(
                `/api/daily-fix?date=${encodeURIComponent(row.plan_date)}`,
                { signal: ac.signal, credentials: "same-origin", headers: { Accept: "application/json" } },
              );
              if (!res.ok) return;
              const json = (await res.json()) as { body?: { title?: unknown } };
              const title = typeof json.body?.title === "string" ? json.body.title.trim() : "";
              if (title) next[`daily_fix:${row.plan_date}`] = title;
            } else if (row.workout_source_id) {
              const custom = await loadCustomWorkout(row.workout_source_id, { signal: ac.signal });
              if (custom.title) next[`custom:${row.workout_source_id}`] = custom.title;
            }
          } catch {
            /* title stays the planned label */
          }
        }),
      );
      if (ac.signal.aborted || Object.keys(next).length === 0) return;
      setTitles((prev) => ({ ...prev, ...next }));
    })();
    return () => ac.abort();
  }, [gate, planned]);

  const byDate = useMemo(() => {
    const map = new Map<string, FeedRow[]>();
    for (const row of rows) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
    return map;
  }, [rows]);

  const loggedCount = rows.filter((row) => !row.planned).length;
  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";
  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);

  const nearPast = eachDay(addDays(today, -NEAR_PAST), addDays(today, -1)).reverse();
  const olderDays =
    pastExtra > 0
      ? eachDay(start, addDays(today, -(NEAR_PAST + 1)))
          .reverse()
          .filter((day) => (byDate.get(day)?.length ?? 0) > 0)
      : [];
  const upcomingDays = eachDay(addDays(today, 1), end);

  async function onLog(e: FormEvent) {
    e.preventDefault();
    const title = logTitle.trim();
    if (!title) {
      setLogMessage("Add a workout name.");
      return;
    }
    setLogBusy(true);
    setLogMessage(null);
    try {
      await createWorkoutLog({
        workout_title: title,
        date_time: logDate,
        ...(logMinutes.trim() ? { activity_minutes: Number(logMinutes) } : {}),
        ...(logNote.trim() ? { workout_free_text: logNote.trim() } : {}),
      });
      setLogTitle("");
      setLogNote("");
      setLogMinutes("");
      setLogMessage("Session logged.");
      setReload((n) => n + 1);
    } catch {
      setLogMessage("Could not log this session.");
    } finally {
      setLogBusy(false);
    }
  }

  function renderDay(day: string, showRest: boolean) {
    const items = byDate.get(day) ?? [];
    return (
      <section key={day} className="dash-feed-day">
        <h3>{formatDayLabel(day, today)}</h3>
        {items.length === 0 && showRest ? (
          <p className="dash-rest">Rest day</p>
        ) : (
          <ul>
            {items.map((row) => (
              <li key={row.key}>
                <Link
                  href={rowHref(row)}
                  className={`dash-feed-row${row.planned ? " dash-feed-row--planned" : ""}`}
                >
                  <span className="dash-feed-row__copy">
                    <span className="dash-feed-row__title">{row.title}</span>
                    <span className="dash-feed-row__stats">
                      {row.meta ? <span>{row.meta}</span> : null}
                      {row.minutes != null ? <span>{row.minutes} min</span> : null}
                      {row.calories != null ? <span>{row.calories} kcal</span> : null}
                    </span>
                    {row.note ? (
                      <span className="dash-feed-row__note">{notePreview(row.note)}</span>
                    ) : null}
                  </span>
                  <span className="dash-feed-row__go" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const heroStats =
    gate === "open"
      ? [
          {
            label: "Logged in view",
            value: loading ? "—" : String(loggedCount),
            note: "Sessions in this window",
          },
          {
            label: "Today",
            value: loading ? "—" : String(byDate.get(today)?.length ?? 0),
            note: formatDayLabel(today, today),
          },
          {
            label: "Planned ahead",
            value: loading
              ? "—"
              : String(rows.filter((row) => row.planned && row.date > today).length),
            note: "Next 4 days",
          },
        ]
      : [
          { label: "Logged in view", value: "Locked", note: "Included with MetFix Pro" },
          { label: "Today", value: "Locked", note: "Your calendar sessions" },
          { label: "Planned ahead", value: "Locked", note: "Next 4 days" },
        ];

  return (
    <DashboardLayout
      title={`${firstName}’s workouts`}
      description="Logged sessions and planned workouts from your MetFix calendar."
      hideChromeTitle
    >
      <ToolHero
        photo="/Stills/athlete-bodyweight-squat-gym.jpg"
        chips={
          <>
            <Link href={basePath("/account")} className="dash-chip">
              Overview
            </Link>
            {gate === "open" ? (
              <span className="dash-chip">Status · {status}</span>
            ) : (
              <span className="dash-chip dash-chip--accent">Included with MetFix Pro</span>
            )}
          </>
        }
        title={`${firstName}’s workout feed.`}
        lede="Logged sessions and planned workouts from the same calendar the MetFix app uses — today, the last few days, and what’s coming up."
        cta={
          gate === "locked" ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock the workout feed
            </Link>
          ) : null
        }
        stats={heroStats}
      />
      <BodyNav current="workouts" />

      {error ? <p className="account-error">{error}</p> : null}

      {gate !== "open" ? (
        <BodyPanel>
          <FeedSkeleton label="Workout feed locked" />
          {gate === "locked" ? <ProUnlockBanner introOffer={overview} /> : null}
        </BodyPanel>
      ) : (
        <BodyPanel className="dash-feed">
          <div className="dash-feed-actions dash-feed-actions--icons">
            <button
              type="button"
              className={`account-btn account-btn--ghost account-btn--icon${logOpen ? " account-btn--accent" : ""}`}
              onClick={() => setLogOpen((v) => !v)}
              aria-label={logOpen ? "Close quick log" : "Quick log"}
              title={logOpen ? "Close quick log" : "Quick log"}
              aria-pressed={logOpen}
            >
              <Zap strokeWidth={2.25} aria-hidden="true" />
            </button>
            <Link
              href={basePath("/account/workouts/builder")}
              className="account-btn account-btn--ghost account-btn--icon"
              aria-label="Build a workout"
              title="Build a workout"
            >
              <Hammer strokeWidth={2.25} aria-hidden="true" />
            </Link>
            <Link
              href={basePath("/account/workouts/log")}
              className="account-btn account-btn--ghost account-btn--icon"
              aria-label="Log workout"
              title="Log workout"
            >
              <ClipboardList strokeWidth={2.25} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="account-btn account-btn--ghost account-btn--icon"
              onClick={() => setPastExtra((n) => Math.min(n + 14, 90))}
              disabled={pastExtra >= 90 || loading}
              aria-label="Earlier sessions"
              title="Earlier sessions"
            >
              <History strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>

          {logOpen ? (
            <form className="account-form dash-pr-log" onSubmit={onLog}>
              <p className="dash-kicker">Quick log</p>
              <div className="account-form-row">
                <label>
                  Name
                  <input
                    value={logTitle}
                    onChange={(ev) => setLogTitle(ev.target.value)}
                    required
                    disabled={logBusy}
                    maxLength={180}
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
                <label>
                  Minutes
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={logMinutes}
                    onChange={(ev) => setLogMinutes(ev.target.value)}
                    disabled={logBusy}
                  />
                </label>
              </div>
              <label>
                Notes
                <textarea
                  value={logNote}
                  onChange={(ev) => setLogNote(ev.target.value)}
                  maxLength={2000}
                  disabled={logBusy}
                />
              </label>
              {logMessage ? <p className="account-muted">{logMessage}</p> : null}
              <button type="submit" className="account-btn" disabled={logBusy}>
                {logBusy ? "Saving…" : "Save"}
              </button>
            </form>
          ) : null}

          {loading ? (
            <FeedSkeleton label="Loading workouts" />
          ) : (
            <>
              {renderDay(today, true)}
              <div className="dash-segment" role="tablist" aria-label="Workout timeline">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "past"}
                  className={tab === "past" ? "dash-segment__on" : ""}
                  onClick={() => setTab("past")}
                >
                  Past
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "upcoming"}
                  className={tab === "upcoming" ? "dash-segment__on" : ""}
                  onClick={() => setTab("upcoming")}
                >
                  Upcoming
                </button>
              </div>
              {tab === "past" ? (
                <>
                  {olderDays.map((day) => renderDay(day, false))}
                  {nearPast.map((day) => renderDay(day, true))}
                </>
              ) : (
                upcomingDays.map((day) => renderDay(day, true))
              )}
            </>
          )}
        </BodyPanel>
      )}
    </DashboardLayout>
  );
}
