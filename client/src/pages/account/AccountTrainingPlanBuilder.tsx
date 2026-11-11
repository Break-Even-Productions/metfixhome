import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useRoute } from "wouter";
import { basePath } from "@/const";
import {
  loadMyCustomWorkouts,
  loadPlan,
  publishPlan,
  savePlan,
  schedulePlan,
  type CustomWorkoutSummary,
  type PlanDetail,
  type PlanWriteDay,
  type PlanWriteItem,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { BodyNav, BodyPanel, FeedSkeleton } from "./BodyWatermark";
import { todayYmd } from "./bodyDates";

const DURATIONS = [3, 7, 14, 30];

type DayDraft = {
  items: PlanWriteItem[];
};

function emptyDays(count: number, previous: DayDraft[] = []): DayDraft[] {
  return Array.from({ length: count }, (_, index) => previous[index] ?? { items: [] });
}

function fromPlan(plan: PlanDetail): DayDraft[] {
  const count = plan.duration_days ?? (plan.days.length || 7);
  const days = emptyDays(count);
  for (const day of plan.days) {
    if (day.day_index < 0 || day.day_index >= days.length) continue;
    days[day.day_index] = {
      items: day.items.map((item) => ({ ...item })),
    };
  }
  return days;
}

export default function AccountTrainingPlanBuilder() {
  const [, params] = useRoute("/account/plans/:planId");
  const planId = params?.planId === "new" ? 0 : Number(params?.planId);
  const editing = Number.isInteger(planId) && planId > 0;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(7);
  const [visibility, setVisibility] = useState("invite_only");
  const [days, setDays] = useState<DayDraft[]>(() => emptyDays(7));
  const [selected, setSelected] = useState(0);
  const [mine, setMine] = useState<CustomWorkoutSummary[]>([]);
  const [workoutId, setWorkoutId] = useState("");
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(editing ? planId : null);
  const [startDate, setStartDate] = useState(todayYmd());

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const page = await loadMyCustomWorkouts({ signal: ac.signal });
        if (!ac.signal.aborted) setMine(page.workouts ?? []);
      } catch {
        if (!ac.signal.aborted) setMine([]);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!editing) return;
    const ac = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const loaded = await loadPlan(planId, { signal: ac.signal, force: true });
        if (ac.signal.aborted) return;
        const nested = loaded.plan;
        const plan = (nested && typeof nested === "object" ? nested : loaded) as PlanDetail;
        setTitle(plan.title);
        setDescription(plan.description ?? "");
        setDuration(plan.duration_days ?? 7);
        setVisibility(plan.visibility || "invite_only");
        setDays(fromPlan(plan));
        setSavedId(plan.id);
      } catch {
        if (!ac.signal.aborted) setError("Unable to load this plan.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [editing, planId]);

  const day = days[selected];
  const payloadDays: PlanWriteDay[] = useMemo(
    () =>
      days.map((row, index) => ({
        day_index: index,
        items: row.items.map((item, sort) => ({ ...item, sort_order: sort })),
      })),
    [days],
  );

  function setDurationDays(next: number) {
    setDuration(next);
    setDays((prev) => emptyDays(next, prev));
    setSelected(0);
  }

  function addItem(item: PlanWriteItem) {
    setDays((prev) =>
      prev.map((row, index) =>
        index === selected ? { items: [...row.items, item] } : row,
      ),
    );
  }

  function removeItem(itemIndex: number) {
    setDays((prev) =>
      prev.map((row, index) =>
        index === selected
          ? { items: row.items.filter((_, i) => i !== itemIndex) }
          : row,
      ),
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const page = await savePlan(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          duration_days: duration,
          visibility,
          status: "draft",
          replace_days: true,
          days: payloadDays,
        },
        savedId ?? undefined,
      );
        setSavedId(page.plan.id);
      setMessage("Draft saved.");
    } catch {
      setError("Could not save this plan.");
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!savedId) {
      setMessage("Save the draft first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePlan(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          duration_days: duration,
          visibility,
          replace_days: true,
          days: payloadDays,
        },
        savedId,
      );
      await publishPlan(savedId);
      setMessage("Plan published.");
    } catch {
      setError("Could not publish this plan.");
    } finally {
      setBusy(false);
    }
  }

  async function onSchedule(e: FormEvent) {
    e.preventDefault();
    if (!savedId) {
      setMessage("Save the draft first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await schedulePlan(savedId, startDate);
      setMessage(`Scheduled from ${startDate}.`);
    } catch {
      setError("Could not schedule this plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      title={editing ? "Edit plan" : "Plan builder"}
      description="Build a training plan and put it on your calendar."
      hideChromeTitle
    >
      <BodyNav current="coaching" />
      <BodyPanel>
        <div className="dash-feed-actions">
          <Link href={basePath("/account/coaching")} className="account-btn account-btn--ghost">
            Coaching
          </Link>
          <Link href={basePath("/account/workouts/builder")} className="account-btn account-btn--ghost">
            Build a workout
          </Link>
        </div>
        <h2 className="dash-section-title">{editing ? "Edit plan" : "Build a plan"}</h2>
        <p className="account-muted">
          Workout days are edited here. Meal blocks already on a day stay with the plan and are edited with meals.
        </p>
        {loading ? <FeedSkeleton label="Loading plan" /> : null}
        {error ? <p className="account-error">{error}</p> : null}
        {!loading ? (
          <form className="account-form" onSubmit={onSave}>
            <label>
              Title
              <input value={title} onChange={(ev) => setTitle(ev.target.value)} required maxLength={180} />
            </label>
            <label>
              Description
              <textarea value={description} onChange={(ev) => setDescription(ev.target.value)} maxLength={2000} />
            </label>
            <div className="dash-segment" role="group" aria-label="Plan length">
              {DURATIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={duration === count ? "dash-segment__on" : ""}
                  aria-pressed={duration === count}
                  onClick={() => setDurationDays(count)}
                >
                  {count} days
                </button>
              ))}
            </div>
            <label>
              Visibility
              <select value={visibility} onChange={(ev) => setVisibility(ev.target.value)}>
                <option value="invite_only">Invite only</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <div className="dash-segment" role="tablist" aria-label="Plan days">
              {days.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={selected === index}
                  className={selected === index ? "dash-segment__on" : ""}
                  onClick={() => setSelected(index)}
                >
                  Day {index + 1}
                </button>
              ))}
            </div>
            {day ? (
              <>
                <ul className="dash-coach-list">
                  {day.items.map((item, index) => (
                    <li key={`${item.item_type}-${index}`}>
                      <p className="dash-feed-row__title">{item.label || item.item_type}</p>
                      <p className="dash-feed-row__meta">{item.item_type}</p>
                      {item.item_type === "meal" ? (
                        <p className="account-muted">Meal editing stays with meals.</p>
                      ) : (
                        <button
                          type="button"
                          className="account-btn account-btn--ghost"
                          onClick={() => removeItem(index)}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="account-form-row">
                  <label>
                    Add my workout
                    <select value={workoutId} onChange={(ev) => setWorkoutId(ev.target.value)}>
                      <option value="">Choose</option>
                      {mine.map((row) => (
                        <option key={row.id} value={String(row.id)}>
                          {row.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="account-btn"
                    onClick={() => {
                      const id = Number(workoutId);
                      const row = mine.find((item) => item.id === id);
                      if (!row) return;
                      addItem({
                        item_type: "workout",
                        workout_source: "custom",
                        workout_source_id: row.id,
                        label: row.title,
                      });
                    }}
                  >
                    Add workout
                  </button>
                </div>
                <div className="dash-feed-actions">
                  <button
                    type="button"
                    className="account-btn account-btn--ghost"
                    onClick={() =>
                      addItem({
                        item_type: "workout",
                        workout_source: "daily_fix",
                        relative_to_schedule_date: true,
                        label: "Daily Fix",
                      })
                    }
                  >
                    Add that day’s Daily Fix
                  </button>
                  <button
                    type="button"
                    className="account-btn account-btn--ghost"
                    onClick={() =>
                      addItem({
                        item_type: "brain",
                        brain_source_type: "daily_article",
                        relative_to_schedule_date: true,
                        label: "Daily reading",
                      })
                    }
                  >
                    Add that day’s reading
                  </button>
                </div>
              </>
            ) : null}
            {message ? <p className="account-muted">{message}</p> : null}
            <div className="dash-feed-actions">
              <button type="submit" className="account-btn" disabled={busy}>
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button type="button" className="account-btn account-btn--ghost" onClick={onPublish} disabled={busy}>
                Publish
              </button>
            </div>
          </form>
        ) : null}
        {savedId ? (
          <form className="account-form" onSubmit={onSchedule}>
            <label>
              Put it on the calendar
              <input type="date" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} required />
            </label>
            <button type="submit" className="account-btn" disabled={busy}>
              Schedule
            </button>
          </form>
        ) : null}
      </BodyPanel>
    </DashboardLayout>
  );
}
