import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  createShoppingListFromMeals,
  emailShoppingList,
  generateShoppingList,
  loadMealsWeek,
  loadOverview,
  loadShoppingGeneratedDates,
  loadShoppingList,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
  type PlannedMeal,
  type ShoppingList,
  type ShoppingListGroceryItem,
  type ShoppingListsPage,
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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function monthRange(cursor: Date): { start: string; end: string; days: string[] } {
  const start = startOfMonth(cursor);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    days.push(ymd(d));
  }
  return { start: ymd(start), end: ymd(end), days };
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
  return [];
}

export default function AccountShoppingCart() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [generatedDates, setGeneratedDates] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const unlocked = metfixToolsUnlocked(tier);
  const range = useMemo(() => monthRange(cursor), [cursor]);

  const mealCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of meals) {
      map.set(m.date, (map.get(m.date) ?? 0) + 1);
    }
    return map;
  }, [meals]);

  const selectedMeals = useMemo(
    () => meals.filter((m) => selected.has(m.date)),
    [meals, selected],
  );

  const groceryItems = useMemo(() => flattenGroceryItems(activeList), [activeList]);

  async function refreshMonth(signal?: AbortSignal) {
    const [week, gen, index] = await Promise.all([
      loadMealsWeek(range.start, range.end, { force: true, signal }),
      loadShoppingGeneratedDates(range.start, range.end, { force: true, signal }).catch(() => ({
        dates: [] as string[],
      })),
      loadShoppingList(undefined, { force: true, signal }).catch(() => ({ lists: [] })),
    ]);
    setMeals(week.meals ?? []);
    setGeneratedDates(new Set(gen.dates ?? []));
    const page = index as ShoppingListsPage;
    setLists(Array.isArray(page.lists) ? page.lists : []);
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
          await refreshMonth(ac.signal);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load shopping cart.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when month changes
  }, [range.start, range.end]);

  function toggleDay(date: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function onBuild() {
    setMessage(null);
    if (selectedMeals.length === 0) {
      setMessage("Select days that have planned meals first.");
      return;
    }
    setBusy(true);
    try {
      const dates = [...selected].sort();
      const created = await createShoppingListFromMeals({
        title: `Cart ${dates[0]}${dates.length > 1 ? `–${dates[dates.length - 1]}` : ""}`,
        dates,
        meals: selectedMeals.map((m) => ({ planned_meal_id: m.id, servings: 1 })),
        other_considerations: notes.trim() || undefined,
      });
      const generated = await generateShoppingList(created.id);
      setActiveList(generated.list);
      setMessage("Shopping list generated from selected planned meals.");
      await refreshMonth();
    } catch {
      setMessage("Could not build the shopping list.");
    } finally {
      setBusy(false);
    }
  }

  async function onEmail() {
    if (!activeList?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await emailShoppingList(activeList.id);
      setMessage(res.emailed_to ? `Sent to ${res.emailed_to}.` : res.message || "List emailed.");
    } catch {
      setMessage("Could not email this list.");
    } finally {
      setBusy(false);
    }
  }

  async function onOpenList(id: number) {
    setBusy(true);
    setMessage(null);
    try {
      const list = (await loadShoppingList(id, { force: true })) as ShoppingList;
      setActiveList(list);
    } catch {
      setMessage("Could not load that list.");
    } finally {
      setBusy(false);
    }
  }

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ] as const;
  const monthLabel = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";

  return (
    <DashboardLayout
      title={`${firstName}’s shopping cart`}
      description="Build grocery lists from planned meals and email them to yourself."
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
            <span className="dash-chip">Belly · Shopping Cart</span>
          </>
        }
        title={`${firstName}’s grocery lists.`}
        lede="Pick calendar days with meals, generate aisle items, and email yourself the list — same path as the MetFix app cart."
        stats={[
          {
            label: "Selected meals",
            value: String(selectedMeals.length),
          },
          {
            label: "Lists",
            value: String(lists.length),
          },
          {
            label: "Active list",
            value: activeList ? String(activeList.id) : "—",
            note: activeList?.status || "Generate to email",
          },
        ]}
      />
      {!unlocked ? <ProUnlockBanner /> : null}

      {unlocked ? (
        <div className="belly-subnav" aria-label="Belly sections">
          <Link href={basePath("/account/meal-plans")} className="belly-subnav__link">
            Meal Plans
          </Link>
          <Link
            href={basePath("/account/shopping-cart")}
            className="belly-subnav__link belly-subnav__link--active"
          >
            Shopping Cart
          </Link>
          <Link href={basePath("/account/my-meals")} className="belly-subnav__link">
            My Meals
          </Link>
        </div>
      ) : null}

      {loading ? <p className="account-muted">Loading cart…</p> : null}
      {error ? <p className="account-error">{error}</p> : null}

      {unlocked && !loading ? (
        <>
          <section className="belly-panel" aria-labelledby="cart-cal-heading">
            <div className="belly-panel__head">
              <h2 id="cart-cal-heading" className="dash-section-title">
                Select meal days
              </h2>
              <div className="belly-month-nav">
                <button
                  type="button"
                  className="account-btn"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  }
                >
                  Prev
                </button>
                <span>{monthLabel}</span>
                <button
                  type="button"
                  className="account-btn"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
            <div className="belly-day-grid" role="list">
              {range.days.map((date) => {
                const count = mealCountByDate.get(date) ?? 0;
                const on = selected.has(date);
                const generated = generatedDates.has(date);
                return (
                  <button
                    key={date}
                    type="button"
                    role="listitem"
                    className={
                      on
                        ? "belly-day belly-day--on"
                        : count > 0
                          ? "belly-day belly-day--meals"
                          : "belly-day"
                    }
                    disabled={count === 0}
                    onClick={() => toggleDay(date)}
                    aria-pressed={on}
                    title={
                      count === 0
                        ? "No planned meals"
                        : `${count} meal${count === 1 ? "" : "s"}${generated ? " · list exists" : ""}`
                    }
                  >
                    <span className="belly-day__n">{Number(date.slice(8))}</span>
                    <span className="belly-day__meta">
                      {count > 0 ? `${count} meal${count === 1 ? "" : "s"}` : "—"}
                      {generated ? " · list" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="belly-field">
              <span>Other considerations</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, preferred brands, skip garlic…"
              />
            </label>
            <div className="dash-shopping__actions">
              <button
                type="button"
                className="account-btn account-btn--accent"
                disabled={busy || selectedMeals.length === 0}
                onClick={onBuild}
              >
                {busy ? "Working…" : `Create list + generate (${selectedMeals.length} meals)`}
              </button>
            </div>
          </section>

          <section className="belly-panel" aria-labelledby="cart-list-heading">
            <h2 id="cart-list-heading" className="dash-section-title">
              Active list
            </h2>
            {activeList ? (
              <div className="dash-shopping__panel">
                <p className="account-muted">
                  {activeList.title || `List #${activeList.id}`}
                  {activeList.status ? ` · ${activeList.status}` : ""}
                </p>
                {groceryItems.length > 0 ? (
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
                ) : (
                  <p className="account-muted">No grocery rows yet — generate first.</p>
                )}
                <div className="dash-shopping__actions">
                  <button
                    type="button"
                    className="account-btn"
                    disabled={busy || groceryItems.length === 0}
                    onClick={onEmail}
                  >
                    Email list
                  </button>
                </div>
              </div>
            ) : (
              <p className="account-muted">
                Select days and generate a list, or open a prior list below.
              </p>
            )}
          </section>

          <section className="belly-panel" aria-labelledby="cart-history-heading">
            <h2 id="cart-history-heading" className="dash-section-title">
              Recent lists
            </h2>
            {lists.length === 0 ? (
              <p className="account-muted">No shopping lists yet.</p>
            ) : (
              <ul className="belly-plan-list">
                {lists.map((list) => (
                  <li key={list.id} className="belly-plan-card">
                    <div className="belly-plan-card__main">
                      <div>
                        <h3 className="belly-plan-card__title">
                          {list.title || `List #${list.id}`}
                        </h3>
                        <p className="account-muted">{list.status ?? "created"}</p>
                      </div>
                      <button
                        type="button"
                        className="account-btn"
                        disabled={busy}
                        onClick={() => onOpenList(list.id)}
                      >
                        Open
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {message ? <p className="account-muted">{message}</p> : null}
          </section>
        </>
      ) : null}
    </DashboardLayout>
  );
}
