import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  loadOverview,
  loadPlan,
  loadPlanLibrary,
  loadSubscriptions,
  startMealPlan,
  setMealPlanActive,
  type AccountOverview,
  type AccountSubscriptions,
  type MealPlanLibrary,
  type MealPlanSummary,
} from "@/lib/account";
import { BellyCoachingPanel } from "./BellyCoachingPanel";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function flattenBucket(lib: MealPlanLibrary | null, which: "active" | "inactive"): MealPlanSummary[] {
  if (!lib) return [];
  const bucket = lib[which];
  const used = Array.isArray(bucket?.used) ? bucket.used : [];
  const saved = Array.isArray(bucket?.saved_only) ? bucket.saved_only : [];
  const seen = new Set<number>();
  const out: MealPlanSummary[] = [];
  for (const p of [...used, ...saved]) {
    if (!p || typeof p.id !== "number" || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function countItems(plan: MealPlanSummary): { meals: number; workouts: number; brain: number } {
  let meals = 0;
  let workouts = 0;
  let brain = 0;
  for (const day of plan.days ?? []) {
    for (const item of day.items ?? []) {
      if (item.item_type === "meal") meals += 1;
      else if (item.item_type === "workout") workouts += 1;
      else if (item.item_type === "brain") brain += 1;
    }
  }
  return { meals, workouts, brain };
}

export default function AccountMealPlans() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [library, setLibrary] = useState<MealPlanLibrary | null>(null);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MealPlanSummary | null>(null);
  const [startDate, setStartDate] = useState(ymd(new Date()));

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const unlocked = metfixToolsUnlocked(tier);

  async function refreshLibrary(signal?: AbortSignal) {
    const lib = await loadPlanLibrary({ force: true, signal });
    setLibrary(lib);
  }

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ov, su] = await Promise.all([
          loadOverview({ force: true, signal: ac.signal }),
          loadSubscriptions({ force: true, signal: ac.signal }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        const nextTier = su?.canonical_tier ?? ov?.canonical_tier ?? "free";
        if (metfixToolsUnlocked(nextTier)) {
          await refreshLibrary(ac.signal);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load meal plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const plans = useMemo(() => flattenBucket(library, tab), [library, tab]);

  async function onExpand(plan: MealPlanSummary) {
    if (expandedId === plan.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(plan.id);
    setDetail(null);
    try {
      const full = await loadPlan(plan.id, { force: true });
      setDetail(full);
    } catch {
      setDetail(plan);
    }
  }

  async function onStart(plan: MealPlanSummary) {
    setMessage(null);
    setBusyId(plan.id);
    try {
      await startMealPlan(plan.id, startDate, plan);
      await refreshLibrary();
      setMessage(`Scheduled “${plan.title}” from ${startDate} and marked active.`);
    } catch {
      setMessage("Could not start that plan. Publish or check the start date.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDeactivate(plan: MealPlanSummary) {
    setMessage(null);
    setBusyId(plan.id);
    try {
      await setMealPlanActive(plan.id, false);
      await refreshLibrary();
      setMessage(`Deactivated “${plan.title}”.`);
    } catch {
      setMessage("Could not deactivate that plan.");
    } finally {
      setBusyId(null);
    }
  }

  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";

  return (
    <DashboardLayout
      title={`${firstName}’s meal plans`}
      description="Active and saved hybrid meal plans — schedule onto your calendar."
      hideChromeTitle
    >
      <ToolHero
        photo="/daily-fix/260930-cilantro-lime-steak.jpg"
        photoFallback="/Stills/athlete-bodyweight-sit-gym.jpg"
        chips={
          <>
            <Link href={basePath("/account")} className="dash-chip">
              Overview
            </Link>
            <span className="dash-chip">Belly · Meal Plans</span>
          </>
        }
        title={`${firstName}’s hybrid meal plans.`}
        lede="Active and saved plans from the MetFix app — schedule onto your calendar, activate, or park inactive ones."
        stats={[
          {
            label: "Active",
            value: String(library?.meta?.active_count ?? flattenBucket(library, "active").length),
          },
          {
            label: "Inactive",
            value: String(
              library?.meta?.inactive_count ?? flattenBucket(library, "inactive").length,
            ),
          },
          {
            label: "Start date",
            value: startDate,
            note: "Used when you tap Start",
          },
        ]}
      />
      {!unlocked ? <ProUnlockBanner /> : null}

      {unlocked ? (
        <div className="belly-subnav" aria-label="Belly sections">
          <Link href={basePath("/account/meal-plans")} className="belly-subnav__link belly-subnav__link--active">
            Meal Plans
          </Link>
          <Link href={basePath("/account/shopping-cart")} className="belly-subnav__link">
            Shopping Cart
          </Link>
          <Link href={basePath("/account/my-meals")} className="belly-subnav__link">
            My Meals
          </Link>
        </div>
      ) : null}

      {loading ? <p className="account-muted">Loading plans…</p> : null}
      {error ? <p className="account-error">{error}</p> : null}

      {unlocked && !loading ? (
        <section className="belly-panel" aria-labelledby="meal-plans-heading">
          <div className="belly-panel__head">
            <div>
              <h2 id="meal-plans-heading" className="dash-section-title">
                Plan library
              </h2>
              <p className="account-muted">
                Same buckets as the app: active vs inactive, with schedule-to-calendar.
              </p>
            </div>
            <div className="belly-builder-actions">
              <Link href={basePath("/account/meal-plans/new")} className="account-btn account-btn--accent">
                Create plan
              </Link>
              <div className="belly-tabs" role="tablist" aria-label="Plan status">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "active"}
                  className={tab === "active" ? "belly-tabs__btn belly-tabs__btn--on" : "belly-tabs__btn"}
                  onClick={() => setTab("active")}
                >
                  Active ({library?.meta?.active_count ?? flattenBucket(library, "active").length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "inactive"}
                  className={tab === "inactive" ? "belly-tabs__btn belly-tabs__btn--on" : "belly-tabs__btn"}
                  onClick={() => setTab("inactive")}
                >
                  Inactive ({library?.meta?.inactive_count ?? flattenBucket(library, "inactive").length})
                </button>
              </div>
            </div>
          </div>

          <label className="belly-field">
            <span>Start date for schedule</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          {plans.length === 0 ? (
            <div className="account-empty">
              <h3 className="account-empty__title">No {tab} plans</h3>
              <p className="account-muted">
                Create a hybrid plan here, then start it onto your calendar.
              </p>
              <Link href={basePath("/account/meal-plans/new")} className="account-btn account-btn--accent">
                Create plan
              </Link>
            </div>
          ) : (
            <ul className="belly-plan-list">
              {plans.map((plan) => {
                const counts = countItems(detail?.id === plan.id ? detail : plan);
                const open = expandedId === plan.id;
                return (
                  <li key={plan.id} className="belly-plan-card">
                    <div className="belly-plan-card__main">
                      <div>
                        <h3 className="belly-plan-card__title">{plan.title}</h3>
                        <p className="account-muted">
                          {plan.duration_days} day{plan.duration_days === 1 ? "" : "s"}
                          {plan.status ? ` · ${plan.status}` : ""}
                          {plan.usage_status ? ` · ${plan.usage_status.replace("_", " ")}` : ""}
                          {typeof plan.times_scheduled === "number"
                            ? ` · scheduled ${plan.times_scheduled}×`
                            : ""}
                        </p>
                        {plan.description ? (
                          <p className="belly-plan-card__desc">{plan.description}</p>
                        ) : null}
                      </div>
                      <div className="belly-plan-card__actions">
                        <Link
                          href={basePath(`/account/meal-plans/${plan.id}/edit`)}
                          className="account-btn"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="account-btn"
                          onClick={() => onExpand(plan)}
                        >
                          {open ? "Hide days" : "View days"}
                        </button>
                        {tab === "inactive" || !plan.is_active ? (
                          <button
                            type="button"
                            className="account-btn account-btn--accent"
                            disabled={busyId === plan.id || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)}
                            onClick={() => onStart(plan)}
                          >
                            {busyId === plan.id ? "Starting…" : "Start on date"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="account-btn"
                            disabled={busyId === plan.id}
                            onClick={() => onDeactivate(plan)}
                          >
                            {busyId === plan.id ? "Saving…" : "Deactivate"}
                          </button>
                        )}
                      </div>
                    </div>
                    {open ? (
                      <div className="belly-plan-card__detail">
                        {!detail || detail.id !== plan.id ? (
                          <p className="account-muted">Loading days…</p>
                        ) : (detail.days?.length ?? 0) === 0 ? (
                          <p className="account-muted">
                            No day rows yet ({counts.meals} meals · {counts.workouts} workouts ·{" "}
                            {counts.brain} brain).
                          </p>
                        ) : (
                          <ol className="belly-plan-days">
                            {(detail.days ?? []).map((day) => (
                              <li key={day.id}>
                                <strong>Day {day.day_index + 1}</strong>
                                <ul>
                                  {(day.items ?? []).map((item) => (
                                    <li key={item.id}>
                                      {item.item_type}
                                      {item.label ? `: ${item.label}` : ""}
                                      {item.recipe_source_type
                                        ? ` (${item.recipe_source_type} #${item.recipe_source_id ?? "—"})`
                                        : ""}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {message ? <p className="account-muted">{message}</p> : null}
        </section>
      ) : null}

      {unlocked && !loading ? (
        <BellyCoachingPanel
          overview={overview}
          tier={tier}
          plans={[
            ...flattenBucket(library, "active"),
            ...flattenBucket(library, "inactive"),
          ]}
        />
      ) : null}
    </DashboardLayout>
  );
}
