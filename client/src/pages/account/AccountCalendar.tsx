import { useEffect, useMemo, useState } from "react";
import {
  loadCalendarSurface,
  type CalendarSurface,
  type CalendarSurfaceCounts,
} from "@/lib/account";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** App calendarIndicatorDots palette (meal tint uses account accent). */
const DOT_MEAL = "var(--color-accent)";
const DOT_WORKOUT = "#ff69b4";
const DOT_BRAIN = "#22c55e";
const DOT_EVENT = "#d4af37";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Monday-first column index (0–6) for a Date. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function countOn(map: CalendarSurfaceCounts | undefined, date: string): number {
  if (!map) return 0;
  const n = map[date];
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

type DayDots = {
  meal: number;
  workout: number;
  brain: number;
  event: number;
};

function dotsForDay(surface: CalendarSurface | null, date: string): DayDots {
  if (!surface) {
    return { meal: 0, workout: 0, brain: 0, event: 0 };
  }
  const mealLogged =
    countOn(surface.logged_meal_counts, date) +
    countOn(surface.unlogged_meal_counts, date);
  const meal = mealLogged > 0 ? mealLogged : countOn(surface.meal_counts, date);

  const workoutLogged =
    countOn(surface.logged_planned_workout_counts, date) +
    countOn(surface.unlogged_planned_workout_counts, date);
  const workout =
    workoutLogged > 0
      ? workoutLogged
      : countOn(surface.planned_workout_counts, date) ||
        countOn(surface.workout_counts, date);

  const brainLogged =
    countOn(surface.logged_brain_counts, date) +
    countOn(surface.unlogged_brain_counts, date);
  const brain =
    brainLogged > 0 ? brainLogged : countOn(surface.brain_counts, date);

  const event = countOn(surface.event_counts, date);
  return { meal, workout, brain, event };
}

function hasActivity(dots: DayDots): boolean {
  return dots.meal + dots.workout + dots.brain + dots.event > 0;
}

type Props = {
  /** Controlled month (1st of month). Defaults to current month. */
  initialMonth?: Date;
};

export function AccountCalendar({ initialMonth }: Props) {
  const [cursor, setCursor] = useState(() =>
    startOfMonth(initialMonth ?? new Date()),
  );
  const [surface, setSurface] = useState<CalendarSurface | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const start = ymd(new Date(year, month, 1));
    const end = ymd(new Date(year, month, daysInMonth(year, month)));
    return { start, end };
  }, [cursor]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await loadCalendarSurface(range.start, range.end, {
          signal: ac.signal,
          force: true,
        });
        if (cancelled) return;
        setSurface(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSurface(null);
        setError("Calendar data unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [range.start, range.end]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const total = daysInMonth(year, month);
    const pad = mondayIndex(new Date(year, month, 1));
    const out: Array<{ key: string; day: number | null; date: string | null }> =
      [];
    for (let i = 0; i < pad; i++) {
      out.push({ key: `pad-${i}`, day: null, date: null });
    }
    for (let day = 1; day <= total; day++) {
      const date = ymd(new Date(year, month, day));
      out.push({ key: date, day, date });
    }
    return out;
  }, [cursor]);

  const today = ymd(new Date());
  const label = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <section
      className="account-calendar"
      aria-labelledby="account-calendar-heading"
      data-loading={loading ? "true" : "false"}
    >
      <div className="account-calendar__head">
        <div>
          <h2 id="account-calendar-heading" className="account-section-title">
            Calendar
          </h2>
          <p className="account-calendar__lede">
            Meals, workouts, brain, and events for the month.
          </p>
        </div>
        <div className="account-calendar__nav">
          <button
            type="button"
            className="account-btn account-btn--ghost account-calendar__nav-btn"
            aria-label="Previous month"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            ‹
          </button>
          <span className="account-calendar__month account-mono">{label}</span>
          <button
            type="button"
            className="account-btn account-btn--ghost account-calendar__nav-btn"
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            ›
          </button>
        </div>
      </div>

      {error ? <p className="account-error account-calendar__error">{error}</p> : null}

      {loading ? (
        <div
          className="account-calendar__grid account-calendar__grid--skeleton"
          aria-busy="true"
          aria-label="Loading calendar"
        >
          {WEEKDAYS.map((d) => (
            <span key={d} className="account-calendar__dow">
              {d}
            </span>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <span key={i} className="account-calendar__cell account-calendar__cell--skel" />
          ))}
        </div>
      ) : (
        <div className="account-calendar__grid" role="grid" aria-label={label}>
          {WEEKDAYS.map((d) => (
            <span key={d} className="account-calendar__dow" role="columnheader">
              {d}
            </span>
          ))}
          {cells.map((cell) => {
            if (cell.day == null || cell.date == null) {
              return (
                <span
                  key={cell.key}
                  className="account-calendar__cell account-calendar__cell--empty"
                  aria-hidden="true"
                />
              );
            }
            const dots = dotsForDay(surface, cell.date);
            const active = hasActivity(dots);
            const isToday = cell.date === today;
            return (
              <div
                key={cell.key}
                className={[
                  "account-calendar__cell",
                  active ? "account-calendar__cell--active" : null,
                  isToday ? "account-calendar__cell--today" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="gridcell"
                aria-label={`${cell.date}${active ? ", has activity" : ""}`}
                data-date={cell.date}
              >
                <span className="account-calendar__day account-mono">{cell.day}</span>
                <span className="account-calendar__dots" aria-hidden="true">
                  {dots.meal > 0 ? (
                    <span
                      className="account-calendar__dot"
                      style={{ background: DOT_MEAL }}
                      title={`${dots.meal} meal${dots.meal === 1 ? "" : "s"}`}
                    />
                  ) : null}
                  {dots.workout > 0 ? (
                    <span
                      className="account-calendar__dot"
                      style={{ background: DOT_WORKOUT }}
                      title={`${dots.workout} workout${dots.workout === 1 ? "" : "s"}`}
                    />
                  ) : null}
                  {dots.brain > 0 ? (
                    <span
                      className="account-calendar__dot"
                      style={{ background: DOT_BRAIN }}
                      title={`${dots.brain} brain`}
                    />
                  ) : null}
                  {dots.event > 0 ? (
                    <span
                      className="account-calendar__dot"
                      style={{ background: DOT_EVENT }}
                      title={`${dots.event} event${dots.event === 1 ? "" : "s"}`}
                    />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ul className="account-calendar__legend">
        <li>
          <span className="account-calendar__dot" style={{ background: DOT_MEAL }} /> Meals
        </li>
        <li>
          <span className="account-calendar__dot" style={{ background: DOT_WORKOUT }} /> Workouts
        </li>
        <li>
          <span className="account-calendar__dot" style={{ background: DOT_BRAIN }} /> Brain
        </li>
        <li>
          <span className="account-calendar__dot" style={{ background: DOT_EVENT }} /> Events
        </li>
      </ul>
    </section>
  );
}
