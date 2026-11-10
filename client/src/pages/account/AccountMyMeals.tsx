import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  deletePlannedMeal,
  loadCustomRecipes,
  loadMacrosRange,
  loadMealsUpcoming,
  loadMealsWeek,
  loadOverview,
  loadSubscriptions,
  planMeal,
  type AccountOverview,
  type AccountSubscriptions,
  type CustomRecipe,
  type MacrosRangeEntry,
  type PlannedMeal,
} from "@/lib/account";
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

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatDayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  const d = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return date;
  return `${SHORT_WEEKDAYS[d.getDay()]} ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function mealTitle(m: PlannedMeal): string {
  return m.recipe_preview?.title || m.label || "Planned meal";
}

export default function AccountMyMeals() {
  const today = ymd(new Date());
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [planned, setPlanned] = useState<PlannedMeal[]>([]);
  const [upcoming, setUpcoming] = useState<PlannedMeal[]>([]);
  const [loggedEntries, setLoggedEntries] = useState<MacrosRangeEntry[]>([]);
  const [recipes, setRecipes] = useState<CustomRecipe[]>([]);
  const [timeline, setTimeline] = useState<"past" | "upcoming">("past");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [planDate, setPlanDate] = useState(today);
  const [planSlot, setPlanSlot] = useState(1);
  const [planSourceType, setPlanSourceType] = useState<"daily_mod" | "custom_recipe">(
    "custom_recipe",
  );
  const [planSourceId, setPlanSourceId] = useState("");
  const [planLabel, setPlanLabel] = useState("");

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const unlocked = metfixToolsUnlocked(tier);

  const pastStart = ymd(addDays(new Date(), -4));
  const upcomingEnd = ymd(addDays(new Date(), 4));

  async function refresh(signal?: AbortSignal) {
    const [week, up, macros, customs] = await Promise.all([
      loadMealsWeek(pastStart, today, { force: true, signal }),
      loadMealsUpcoming(40, { force: true, signal }),
      loadMacrosRange(pastStart, today, { force: true, signal, includeMeals: true }),
      loadCustomRecipes({ force: true, signal, limit: 40 }).catch(() => ({ recipes: [] })),
    ]);
    setPlanned(week.meals ?? []);
    setUpcoming((up.meals ?? []).filter((m) => m.date > today));
    setLoggedEntries(macros.entries ?? []);
    setRecipes(customs.recipes ?? []);
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
          await refresh(ac.signal);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load My Meals.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const todayPlanned = useMemo(
    () => planned.filter((m) => m.date === today),
    [planned, today],
  );
  const pastPlanned = useMemo(
    () =>
      planned
        .filter((m) => m.date < today)
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [planned, today],
  );
  const todayLogged = useMemo(() => {
    const entry = loggedEntries.find((e) => e.date === today);
    return entry?.meals ?? [];
  }, [loggedEntries, today]);

  const pastLoggedByDay = useMemo(() => {
    const map = new Map<string, NonNullable<MacrosRangeEntry["meals"]>>();
    for (const e of loggedEntries) {
      if (e.date >= today) continue;
      if (Array.isArray(e.meals) && e.meals.length > 0) map.set(e.date, e.meals);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [loggedEntries, today]);

  async function onPlanMeal(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const sourceIdRaw = planSourceId.trim();
    const label = planLabel.trim();
    const sourceId = sourceIdRaw ? Number(sourceIdRaw) : null;
    if (sourceIdRaw && (!Number.isFinite(sourceId) || sourceId == null || sourceId <= 0)) {
      setMessage("Recipe id must be a positive number.");
      return;
    }
    if (sourceId == null) {
      setMessage("BSI requires a recipe source id to plan a meal.");
      return;
    }
    setBusy(true);
    try {
      await planMeal(planDate, {
        recipe_source_type: planSourceType,
        recipe_source_id: sourceId,
        slot_index: planSlot,
        label: label || null,
      });
      await refresh();
      setMessage("Meal planned.");
      setPlanLabel("");
      setPlanSourceId("");
    } catch {
      setMessage("Could not plan that meal.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    setBusy(true);
    setMessage(null);
    try {
      await deletePlannedMeal(id);
      await refresh();
      setMessage("Planned meal removed.");
    } catch {
      setMessage("Could not delete that planned meal.");
    } finally {
      setBusy(false);
    }
  }

  function renderPlanned(list: PlannedMeal[]) {
    if (list.length === 0) {
      return <p className="account-muted">No planned meals in this range.</p>;
    }
    return (
      <ul className="belly-meal-list">
        {list.map((m) => (
          <li key={m.id} className="belly-meal-card">
            <div>
              <p className="belly-meal-card__when">{formatDayLabel(m.date, today)}</p>
              <h3 className="belly-meal-card__title">{mealTitle(m)}</h3>
              <p className="account-muted">
                Slot {m.slot_index}
                {m.logged ? " · logged" : ""}
                {m.recipe_preview?.macros
                  ? ` · ${Math.round(m.recipe_preview.macros.protein)}P / ${Math.round(m.recipe_preview.macros.fat)}F / ${Math.round(m.recipe_preview.macros.carbs)}C`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="account-btn"
              disabled={busy}
              onClick={() => onDelete(m.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";

  return (
    <DashboardLayout
      title={`${firstName}’s meals`}
      description="Today, past, and upcoming planned and logged meals."
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
            <span className="dash-chip">Belly · My Meals</span>
          </>
        }
        title={`${firstName}’s meals.`}
        lede="Planned calendar meals and logged macros — same hub as My Meals in the MetFix app."
        stats={[
          {
            label: "Today planned",
            value: String(todayPlanned.length),
          },
          {
            label: "Today logged",
            value: String(todayLogged.length),
          },
          {
            label: "Custom recipes",
            value: String(recipes.length),
          },
        ]}
      />
      {!unlocked ? <ProUnlockBanner introOffer={overview} /> : null}

      {unlocked ? (
        <div className="belly-subnav" aria-label="Belly sections">
          <Link href={basePath("/account/meal-plans")} className="belly-subnav__link">
            Meal Plans
          </Link>
          <Link href={basePath("/account/shopping-cart")} className="belly-subnav__link">
            Shopping Cart
          </Link>
          <Link
            href={basePath("/account/my-meals")}
            className="belly-subnav__link belly-subnav__link--active"
          >
            My Meals
          </Link>
        </div>
      ) : null}

      {loading ? <p className="account-muted">Loading meals…</p> : null}
      {error ? <p className="account-error">{error}</p> : null}

      {unlocked && !loading ? (
        <>
          <section className="belly-panel" aria-labelledby="my-meals-today">
            <h2 id="my-meals-today" className="dash-section-title">
              Today
            </h2>
            {todayPlanned.length === 0 && todayLogged.length === 0 ? (
              <p className="account-muted">No meals planned or logged for today yet.</p>
            ) : null}
            {todayPlanned.length > 0 ? (
              <>
                <h3 className="belly-subhead">Planned</h3>
                {renderPlanned(todayPlanned)}
              </>
            ) : null}
            {todayLogged.length > 0 ? (
              <>
                <h3 className="belly-subhead">Logged</h3>
                <ul className="belly-meal-list">
                  {todayLogged.map((m, i) => (
                    <li key={m.macroEntryId ?? i} className="belly-meal-card">
                      <div>
                        <h3 className="belly-meal-card__title">
                          {m.mealTitle || m.title || "Logged meal"}
                        </h3>
                        <p className="account-muted">
                          {m.macros
                            ? `${Math.round(m.macros.protein ?? 0)}P / ${Math.round(m.macros.fat ?? 0)}F / ${Math.round(m.macros.carbs ?? 0)}C`
                            : "Logged"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className="belly-panel" aria-labelledby="my-meals-timeline">
            <div className="belly-panel__head">
              <h2 id="my-meals-timeline" className="dash-section-title">
                Timeline
              </h2>
              <div className="belly-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={timeline === "past"}
                  className={
                    timeline === "past" ? "belly-tabs__btn belly-tabs__btn--on" : "belly-tabs__btn"
                  }
                  onClick={() => setTimeline("past")}
                >
                  Past
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timeline === "upcoming"}
                  className={
                    timeline === "upcoming"
                      ? "belly-tabs__btn belly-tabs__btn--on"
                      : "belly-tabs__btn"
                  }
                  onClick={() => setTimeline("upcoming")}
                >
                  Upcoming
                </button>
              </div>
            </div>
            {timeline === "past" ? (
              <>
                {renderPlanned(pastPlanned)}
                {pastLoggedByDay.map(([date, meals]) => (
                  <div key={date}>
                    <h3 className="belly-subhead">{formatDayLabel(date, today)} · logged</h3>
                    <ul className="belly-meal-list">
                      {meals.map((m, i) => (
                        <li key={m.macroEntryId ?? `${date}-${i}`} className="belly-meal-card">
                          <div>
                            <h3 className="belly-meal-card__title">
                              {m.mealTitle || m.title || "Logged meal"}
                            </h3>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              renderPlanned(
                upcoming.length > 0
                  ? upcoming
                  : planned.filter((m) => m.date > today && m.date <= upcomingEnd),
              )
            )}
          </section>

          <section className="belly-panel" aria-labelledby="plan-meal-heading">
            <h2 id="plan-meal-heading" className="dash-section-title">
              Plan a meal
            </h2>
            <p className="account-muted">
              Posts to the same calendar day endpoint the app uses (
              <code>POST /calendar/days/{"{date}"}/meals</code>).
            </p>
            <form className="belly-plan-form" onSubmit={onPlanMeal}>
              <label className="belly-field">
                <span>Date</span>
                <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
              </label>
              <label className="belly-field">
                <span>Slot</span>
                <select
                  value={planSlot}
                  onChange={(e) => setPlanSlot(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Slot {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="belly-field">
                <span>Recipe source</span>
                <select
                  value={planSourceType}
                  onChange={(e) =>
                    setPlanSourceType(e.target.value as "daily_mod" | "custom_recipe")
                  }
                >
                  <option value="custom_recipe">custom_recipe</option>
                  <option value="daily_mod">daily_mod</option>
                </select>
              </label>
              <label className="belly-field">
                <span>Recipe source id</span>
                <input
                  value={planSourceId}
                  onChange={(e) => setPlanSourceId(e.target.value)}
                  inputMode="numeric"
                  placeholder="Required"
                />
              </label>
              <label className="belly-field">
                <span>Label (optional)</span>
                <input value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} />
              </label>
              <button type="submit" className="account-btn account-btn--accent" disabled={busy}>
                {busy ? "Saving…" : "Plan meal"}
              </button>
            </form>
            {message ? <p className="account-muted">{message}</p> : null}
          </section>

          <section className="belly-panel" aria-labelledby="custom-recipes-heading">
            <div className="belly-panel__head">
              <div>
                <h2 id="custom-recipes-heading" className="dash-section-title">
                  Custom recipes
                </h2>
                <p className="account-muted">
                  Same library as the MetFix app Recipe Builder — create and edit on the web.
                </p>
              </div>
              <Link
                href={basePath("/account/my-meals/recipes/new")}
                className="account-btn account-btn--accent"
              >
                Create recipe
              </Link>
            </div>
            {recipes.length === 0 ? (
              <p className="account-muted">No custom recipes yet. Create one to use in meal plans.</p>
            ) : (
              <ul className="belly-meal-list">
                {recipes.map((r) => (
                  <li key={r.id} className="belly-meal-card">
                    <div>
                      <h3 className="belly-meal-card__title">{r.title}</h3>
                      <p className="account-muted">
                        #{r.id}
                        {r.macros
                          ? ` · ${Math.round(r.macros.protein ?? 0)}P / ${Math.round(r.macros.fat ?? 0)}F / ${Math.round(r.macros.carbs ?? 0)}C`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={basePath(`/account/my-meals/recipes/${r.id}/edit`)}
                      className="account-btn"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </DashboardLayout>
  );
}
