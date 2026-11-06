import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  createShoppingListFromMeals,
  deriveMembershipStatus,
  emailShoppingList,
  generateShoppingList,
  loadMacrosDaily,
  loadMealsWeek,
  loadOverview,
  loadSubscriptions,
  planMeal,
  type AccountOverview,
  type AccountSubscriptions,
  type MacrosDaily,
  type MealsWeek,
  type PlannedMeal,
  type ShoppingList,
  type ShoppingListGroceryItem,
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

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const SLOT_LABELS = ["", "First meal", "Second meal", "Third meal", "Fourth meal", "Fifth meal", "Sixth meal"];

function mealTitle(m: PlannedMeal): string {
  return m.recipe_preview?.title || m.label || "Planned meal";
}

function formatG(n: number): string {
  return `${Math.round(n)}g`;
}

function flattenGroceryItems(list: ShoppingList | null): ShoppingListGroceryItem[] {
  if (!list) return [];
  const byCat = list.items_by_category;
  if (byCat && typeof byCat === "object") {
    const rows: ShoppingListGroceryItem[] = [];
    for (const [category, items] of Object.entries(byCat)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        rows.push({ ...item, category: item.category ?? category });
      }
    }
    if (rows.length > 0) {
      return rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
  }
  // Fallback: recipe snapshot ingredients before generate.
  const snap: ShoppingListGroceryItem[] = [];
  for (const item of list.items ?? []) {
    const ingredients = item.snapshot_data?.ingredients;
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      ingredients.forEach((name, i) => {
        snap.push({
          id: item.id * 1000 + i,
          item_name: name,
          quantity: "",
          sort_order: i,
          category: item.snapshot_data?.title ?? null,
        });
      });
    } else if (item.snapshot_data?.title) {
      snap.push({
        id: item.id,
        item_name: item.snapshot_data.title,
        quantity: "",
        sort_order: 0,
      });
    }
  }
  return snap;
}

function MealCardSkeleton() {
  return (
    <article className="dash-meal-card dash-meal-card--skel" aria-hidden="true">
      <div className="dash-meal-card__media">
        <div className="dash-skel dash-skel--media" />
      </div>
      <div className="dash-meal-card__body">
        <div className="dash-skel dash-skel--title" />
        <div className="dash-macro-row">
          <div className="dash-skel dash-skel--macro" />
          <div className="dash-skel dash-skel--macro" />
          <div className="dash-skel dash-skel--macro" />
          <div className="dash-skel dash-skel--macro" />
        </div>
      </div>
    </article>
  );
}

export default function AccountMeals() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [week, setWeek] = useState<MealsWeek | null>(null);
  const [macros, setMacros] = useState<MacrosDaily | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => ymd(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [planDate, setPlanDate] = useState(() => ymd(new Date()));
  const [planSlot, setPlanSlot] = useState(1);
  const [planSourceType, setPlanSourceType] = useState<"custom_recipe" | "daily_mod">(
    "custom_recipe",
  );
  const [planSourceId, setPlanSourceId] = useState("");
  const [planLabel, setPlanLabel] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [shoppingBusy, setShoppingBusy] = useState(false);
  const [shoppingMessage, setShoppingMessage] = useState<string | null>(null);

  const weekDates = useMemo(() => {
    const start = startOfWeekMonday(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { date: ymd(d), label: d.toLocaleDateString(undefined, { weekday: "short" }) };
    });
  }, []);

  const weekStart = weekDates[0]!.date;
  const weekEnd = weekDates[6]!.date;

  async function refreshWeek(signal?: AbortSignal) {
    const meals = await loadMealsWeek(weekStart, weekEnd, { force: true, signal });
    setWeek(meals);
    return meals;
  }

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su, meals, mac] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
          loadMealsWeek(weekStart, weekEnd, { signal: ac.signal }),
          loadMacrosDaily(ymd(new Date()), { signal: ac.signal }).catch(() => null),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        setWeek(meals);
        setMacros(mac);
        const today = ymd(new Date());
        const withMeals = weekDates
          .map((d) => d.date)
          .filter((d) => (meals.grouped_by_date?.[d]?.length ?? 0) > 0);
        if (withMeals.includes(today)) setSelectedDate(today);
        else if (withMeals[0]) setSelectedDate(withMeals[0]);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load meal plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [weekDates, weekStart, weekEnd]);

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const pro = metfixToolsUnlocked(tier);
  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";
  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);

  const dayMeals = useMemo(() => {
    const list = week?.grouped_by_date?.[selectedDate] ?? [];
    return [...list].sort((a, b) => a.slot_index - b.slot_index);
  }, [week, selectedDate]);

  const weekMealCount = week?.meals.length ?? 0;
  const weekProtein = useMemo(
    () =>
      (week?.meals ?? []).reduce(
        (sum, m) => sum + (m.recipe_preview?.macros.protein ?? 0),
        0,
      ),
    [week],
  );

  const groceryItems = useMemo(() => flattenGroceryItems(shoppingList), [shoppingList]);

  const targetP = macros?.goal_protein || macros?.protein || 0;
  const targetF = macros?.goal_fat || macros?.fat || 0;
  const targetC = macros?.goal_carbs || macros?.carbs || 0;

  const heroStats = pro
    ? [
        {
          label: "Daily metabolic target",
          value:
            targetP || targetF || targetC
              ? `${formatG(targetP)} P · ${formatG(targetF)} F · ${formatG(targetC)} C`
              : "No macros logged today",
          note:
            macros && (macros.protein || macros.fat || macros.carbs)
              ? `Logged today · ${Math.round(macros.calories)} kcal`
              : "From BSI macros / daily",
        },
        {
          label: "Weekly structure",
          value: `${weekMealCount} planned meal${weekMealCount === 1 ? "" : "s"}`,
          note:
            weekProtein > 0
              ? `${Math.round(weekProtein)}g protein across the week`
              : "From calendar/meals",
        },
        {
          label: "Smart grocery list",
          value: shoppingList
            ? groceryItems.length > 0
              ? `${groceryItems.length} item${groceryItems.length === 1 ? "" : "s"}`
              : "List ready — generate items"
            : weekMealCount > 0
              ? "Build from planned meals"
              : "Add meals to unlock list",
          note: shoppingList?.title || "Create + generate from this week",
        },
      ]
    : [
        {
          label: "Daily metabolic target",
          value: "Custom macro dial",
          note: "🔒 Included with MetFix Pro",
        },
        {
          label: "Weekly structure",
          value: "Plan meals on your calendar",
          note: "🔒 Live meal planning with Pro",
        },
        {
          label: "Smart grocery list",
          value: "Emailable aisle list",
          note: "🔒 Built from your planned meals with Pro",
        },
      ];

  async function onPlanMeal(e: FormEvent) {
    e.preventDefault();
    setPlanMessage(null);
    const sourceIdRaw = planSourceId.trim();
    const label = planLabel.trim();
    if (!sourceIdRaw && !label) {
      setPlanMessage("Add a recipe id or a label.");
      return;
    }
    const sourceId = sourceIdRaw ? Number(sourceIdRaw) : null;
    if (sourceIdRaw && (!Number.isFinite(sourceId) || sourceId == null || sourceId <= 0)) {
      setPlanMessage("Recipe id must be a positive number.");
      return;
    }
    setPlanning(true);
    try {
      await planMeal(planDate, {
        recipe_source_type: planSourceType,
        recipe_source_id: sourceId,
        slot_index: planSlot,
        label: label || null,
      });
      await refreshWeek();
      setSelectedDate(planDate);
      setPlanMessage("Meal planned.");
      setPlanLabel("");
      setPlanSourceId("");
    } catch {
      setPlanMessage("Could not plan that meal. Try again.");
    } finally {
      setPlanning(false);
    }
  }

  async function onBuildShoppingList() {
    setShoppingMessage(null);
    const meals = week?.meals ?? [];
    if (meals.length === 0) {
      setShoppingMessage("Plan meals this week before building a list.");
      return;
    }
    setShoppingBusy(true);
    try {
      const created = await createShoppingListFromMeals({
        title: `Week of ${weekStart}`,
        dates: weekDates.map((d) => d.date),
        meals: meals.map((m) => ({ planned_meal_id: m.id, servings: 1 })),
      });
      const generated = await generateShoppingList(created.id);
      setShoppingList(generated.list);
      setShoppingMessage("Shopping list generated from your planned meals.");
    } catch {
      setShoppingMessage("Could not build the shopping list.");
    } finally {
      setShoppingBusy(false);
    }
  }

  async function onEmailShoppingList() {
    if (!shoppingList?.id) return;
    setShoppingMessage(null);
    setShoppingBusy(true);
    try {
      const res = await emailShoppingList(shoppingList.id);
      setShoppingMessage(
        res.emailed_to
          ? `Sent to ${res.emailed_to}.`
          : res.message || "Shopping list emailed.",
      );
    } catch {
      setShoppingMessage("Could not email this list.");
    } finally {
      setShoppingBusy(false);
    }
  }

  return (
    <DashboardLayout
      title={`${firstName}’s weekly metabolic meal plan`}
      description="High-protein, whole-food menus calibrated to training load — with swaps and an aisle-sorted grocery list."
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
            {!pro ? (
              <span className="dash-chip dash-chip--accent">Preview · Included with MetFix Pro</span>
            ) : (
              <span className="dash-chip">Status · {status}</span>
            )}
          </>
        }
        title={`${firstName}’s weekly metabolic meal plan.`}
        lede="High-protein, whole-food menus calibrated to your training load, insulin sensitivity, and kitchen schedule — planned meals from your MetFix calendar."
        cta={
          !pro ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock Meal Plans — 1 Month Free
            </Link>
          ) : null
        }
        stats={heroStats}
      />

      {error ? <p className="account-error">{error}</p> : null}

      {!pro ? (
        <div className="dash-panel dash-meals">
          <section className="dash-locked-panel" aria-labelledby="meals-locked-controls">
            <div className="dash-locked-head">
              <div>
                <h2 id="meals-locked-controls" className="dash-section-title">
                  Tailored to how you train and cook
                </h2>
                <p className="account-muted">Personalize macros, household scale, and exclusions.</p>
              </div>
              <div className="dash-locked-head">
                <span className="dash-locked-badge">Locked controls</span>
                <Link href={basePath("/join")} className="account-btn account-btn--accent">
                  Unlock customization
                </Link>
              </div>
            </div>
            <p className="dash-kicker">Metabolic track</p>
            <div className="dash-lock-pills" aria-hidden="true">
              <span className="dash-lock-pill">Insulin sensitivity &amp; fat loss</span>
              <span className="dash-lock-pill">Performance &amp; recovery</span>
              <span className="dash-lock-pill">Steady energy</span>
              <span className="dash-lock-pill">Recomp</span>
            </div>
            <p className="dash-kicker dash-kicker--spaced">Household scale</p>
            <div className="dash-lock-pills" aria-hidden="true">
              <span className="dash-lock-pill">1 person</span>
              <span className="dash-lock-pill">2 people</span>
              <span className="dash-lock-pill">4 people</span>
            </div>
            <p className="dash-kicker dash-kicker--spaced">Exclusions &amp; swaps</p>
            <div className="dash-lock-pills" aria-hidden="true">
              <span className="dash-lock-pill">Dairy-light</span>
              <span className="dash-lock-pill">No seed oils</span>
            </div>
          </section>

          <section className="dash-locked-panel" aria-labelledby="meals-locked-menu">
            <div className="dash-locked-head">
              <div>
                <p className="dash-kicker">Your week</p>
                <h2 id="meals-locked-menu" className="dash-section-title">
                  Live meal planning
                </h2>
                <p className="account-muted">
                  Pro unlocks your real planned meals — we never show sample plates as yours.
                </p>
              </div>
              <Link href={basePath("/join")} className="account-btn account-btn--accent">
                Unlock meal planner
              </Link>
            </div>
            <div className="dash-day-tabs" role="tablist" aria-label="Preview days">
              {weekDates.map((d, i) => (
                <span
                  key={d.date}
                  className={`dash-day-tab${i === 0 ? " dash-day-tab--on" : " dash-day-tab--locked"}`}
                  aria-hidden={i !== 0}
                >
                  <span className="dash-day-tab__dow">{d.label}</span>
                  <span className="dash-day-tab__count">
                    <span className="dash-day-tab__lock">Locked</span>
                  </span>
                </span>
              ))}
            </div>
            <div className="dash-empty dash-empty--locked">
              <p className="account-muted">
                Day tabs, meal cards, and grocery generation stay empty until Pro — no placeholder recipes.
              </p>
            </div>
          </section>

          <section className="dash-locked-panel" aria-labelledby="meals-locked-grocery">
            <div className="dash-locked-head">
              <div>
                <h2 id="meals-locked-grocery" className="dash-section-title">
                  Shopping list from planned meals
                </h2>
                <p className="account-muted">Create, generate, and email your aisle list with Pro.</p>
              </div>
              <span className="dash-locked-badge">Locked</span>
            </div>
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock grocery list
            </Link>
          </section>

          <ProUnlockBanner />
        </div>
      ) : (
        <div className="dash-panel dash-meals">
          <div className="dash-day-tabs" role="tablist" aria-label="Days this week">
            {weekDates.map((d) => {
              const count = week?.grouped_by_date?.[d.date]?.length ?? 0;
              const active = d.date === selectedDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`dash-day-tab${active ? " dash-day-tab--on" : ""}`}
                  onClick={() => {
                    setSelectedDate(d.date);
                    setPlanDate(d.date);
                  }}
                >
                  <span className="dash-day-tab__dow">{d.label}</span>
                  <span className="dash-day-tab__count">
                    {loading ? "…" : count > 0 ? `${count} meal${count === 1 ? "" : "s"}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="dash-meal-grid" aria-busy="true" aria-label="Loading meals">
              <MealCardSkeleton />
              <MealCardSkeleton />
              <MealCardSkeleton />
            </div>
          ) : dayMeals.length === 0 ? (
            <div className="dash-empty">
              <h2 className="dash-section-title">No meals planned for this day</h2>
              <p className="account-muted">Use the form below to plan a meal for {selectedDate}.</p>
            </div>
          ) : (
            <div className="dash-meal-grid">
              {dayMeals.map((m) => {
                const mealMacros = m.recipe_preview?.macros;
                const kcal = mealMacros
                  ? Math.round(mealMacros.protein * 4 + mealMacros.carbs * 4 + mealMacros.fat * 9)
                  : null;
                return (
                  <article key={m.id} className="dash-meal-card">
                    <div className="dash-meal-card__media">
                      {m.recipe_preview?.photo_url ? (
                        <img src={m.recipe_preview.photo_url} alt="" />
                      ) : (
                        <div className="dash-meal-card__ph" aria-hidden="true" />
                      )}
                      <span className="dash-meal-card__slot">
                        {SLOT_LABELS[m.slot_index] || `Slot ${m.slot_index}`}
                        {m.logged ? " · Logged" : ""}
                      </span>
                    </div>
                    <div className="dash-meal-card__body">
                      <h3 className="dash-meal-card__title">{mealTitle(m)}</h3>
                      {m.notes ? <p className="account-muted">{m.notes}</p> : null}
                      {mealMacros ? (
                        <dl className="dash-macro-row">
                          <div>
                            <dt>P</dt>
                            <dd>{formatG(mealMacros.protein)}</dd>
                          </div>
                          <div>
                            <dt>F</dt>
                            <dd>{formatG(mealMacros.fat)}</dd>
                          </div>
                          <div>
                            <dt>C</dt>
                            <dd>{formatG(mealMacros.carbs)}</dd>
                          </div>
                          {kcal != null ? (
                            <div>
                              <dt>kcal</dt>
                              <dd>{kcal}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : (
                        <p className="account-muted">Macros not attached to this planned meal.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <section className="dash-meals-plan" aria-labelledby="meals-plan-heading">
            <h2 id="meals-plan-heading" className="dash-section-title">
              Plan a meal
            </h2>
            <p className="account-muted">
              Minimal planner — date, slot, source type, and a recipe id or label.
            </p>
            <form className="account-form dash-meals-plan__form" onSubmit={onPlanMeal}>
              <div className="account-form-row">
                <label>
                  Date
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Slot
                  <select
                    value={planSlot}
                    onChange={(e) => setPlanSlot(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {SLOT_LABELS[n]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="account-form-row">
                <label>
                  Recipe source
                  <select
                    value={planSourceType}
                    onChange={(e) =>
                      setPlanSourceType(e.target.value as "custom_recipe" | "daily_mod")
                    }
                  >
                    <option value="custom_recipe">custom_recipe</option>
                    <option value="daily_mod">daily_mod</option>
                  </select>
                </label>
                <label>
                  Recipe source id
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Optional if label set"
                    value={planSourceId}
                    onChange={(e) => setPlanSourceId(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Label
                <input
                  type="text"
                  placeholder="Optional if recipe id set"
                  value={planLabel}
                  onChange={(e) => setPlanLabel(e.target.value)}
                />
              </label>
              <div className="dash-meals-plan__actions">
                <button type="submit" className="account-btn account-btn--accent" disabled={planning}>
                  {planning ? "Planning…" : "Plan meal"}
                </button>
                {planMessage ? <p className="account-muted">{planMessage}</p> : null}
              </div>
            </form>
          </section>

          <section className="dash-shopping" aria-labelledby="meals-shopping-heading">
            <div className="dash-locked-head">
              <div>
                <h2 id="meals-shopping-heading" className="dash-section-title">
                  Shopping list
                </h2>
                <p className="account-muted">
                  Build from this week’s planned meals, generate aisle items, then email yourself the list.
                </p>
              </div>
              <button
                type="button"
                className="account-btn account-btn--accent"
                disabled={shoppingBusy || weekMealCount === 0}
                onClick={() => void onBuildShoppingList()}
              >
                {shoppingBusy ? "Working…" : "Create list + generate"}
              </button>
            </div>

            {shoppingList ? (
              <div className="dash-shopping__panel">
                <p className="dash-kicker">
                  {shoppingList.title || `List #${shoppingList.id}`}
                  {shoppingList.status ? ` · ${shoppingList.status}` : ""}
                </p>
                {groceryItems.length === 0 ? (
                  <p className="account-muted">No grocery items yet — generate may still be pending.</p>
                ) : (
                  <ul className="dash-shopping__items">
                    {groceryItems.map((item) => (
                      <li key={`${item.id}-${item.item_name}`}>
                        <span>{item.item_name}</span>
                        <span className="dash-shopping__meta">
                          {[item.quantity, item.category].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="dash-shopping__actions">
                  <button
                    type="button"
                    className="account-btn"
                    disabled={shoppingBusy}
                    onClick={() => void onEmailShoppingList()}
                  >
                    Email me this list
                  </button>
                </div>
              </div>
            ) : (
              <p className="account-muted">
                {weekMealCount === 0
                  ? "Plan meals first, then create a shopping list here."
                  : `${weekMealCount} planned meal${weekMealCount === 1 ? "" : "s"} ready to turn into a list.`}
              </p>
            )}
            {shoppingMessage ? <p className="account-muted">{shoppingMessage}</p> : null}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
