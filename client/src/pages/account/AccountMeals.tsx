import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  deriveMembershipStatus,
  loadMacrosDaily,
  loadMealsWeek,
  loadOverview,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
  type MacrosDaily,
  type MealsWeek,
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

export default function AccountMeals() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [week, setWeek] = useState<MealsWeek | null>(null);
  const [macros, setMacros] = useState<MacrosDaily | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => ymd(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => {
    const start = startOfWeekMonday(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { date: ymd(d), label: d.toLocaleDateString(undefined, { weekday: "short" }) };
    });
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const start = weekDates[0]!.date;
        const end = weekDates[6]!.date;
        const [ov, su, meals, mac] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
          loadMealsWeek(start, end, { signal: ac.signal }),
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
  }, [weekDates]);

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
          value: weekMealCount > 0 ? "Build from planned meals" : "Add meals to unlock list",
          note: "Shopping-list generation stays in the MetFix app for now",
        },
      ]
    : [
        {
          label: "Daily metabolic target",
          value: "165g P · 112g F · 24g C",
          note: "🔒 Custom macro dial with Pro",
        },
        {
          label: "Weekly structure",
          value: "21 meals · 45m prep",
          note: "🔒 Sunday batch timeline with Pro",
        },
        {
          label: "Smart grocery list",
          value: "24 whole-food items",
          note: "🔒 1-click grocery export with Pro",
        },
      ];

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
                <p className="dash-kicker">Sample preview</p>
                <h2 id="meals-locked-menu" className="dash-section-title">
                  This week’s metabolic menu
                </h2>
              </div>
              <Link href={basePath("/join")} className="account-btn account-btn--accent">
                Unlock full week
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
                    {i === 0 ? "SAMPLE" : <span className="dash-day-tab__lock">Locked</span>}
                  </span>
                </span>
              ))}
            </div>
            <p className="account-muted dash-sample-note">
              Monday · Heavy Lower &amp; Conditioning — sample macros only.
            </p>
            <div className="dash-meal-grid">
              {[
                {
                  slot: "First meal",
                  title: "Cilantro-Lime Grilled Steak & Greens",
                  p: 48,
                  f: 28,
                  c: 6,
                },
                {
                  slot: "Post-training",
                  title: "Greek Yogurt Bowl with Berries",
                  p: 36,
                  f: 12,
                  c: 22,
                },
                {
                  slot: "Dinner",
                  title: "Chicken-Wrapped Asparagus in Garlic Ghee",
                  p: 42,
                  f: 24,
                  c: 8,
                },
              ].map((sample) => {
                const kcal = Math.round(sample.p * 4 + sample.c * 4 + sample.f * 9);
                return (
                  <article key={sample.slot} className="dash-meal-card dash-meal-card--locked">
                    <div className="dash-meal-card__media">
                      <div className="dash-meal-card__ph" aria-hidden="true" />
                      <span className="dash-meal-card__slot">{sample.slot} · Sample</span>
                    </div>
                    <div className="dash-meal-card__body">
                      <h3 className="dash-meal-card__title">{sample.title}</h3>
                      <dl className="dash-macro-row">
                        <div>
                          <dt>P</dt>
                          <dd>{formatG(sample.p)}</dd>
                        </div>
                        <div>
                          <dt>F</dt>
                          <dd>{formatG(sample.f)}</dd>
                        </div>
                        <div>
                          <dt>C</dt>
                          <dd>{formatG(sample.c)}</dd>
                        </div>
                        <div>
                          <dt>kcal</dt>
                          <dd>{kcal}</dd>
                        </div>
                      </dl>
                      <div className="dash-meal-card__actions">
                        <Link href={basePath("/join")} className="account-btn account-btn--accent">
                          Unlock recipe &amp; steps
                        </Link>
                        <span className="dash-lock-pill">Swap</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="dash-locked-grid">
            <section className="dash-locked-panel" aria-labelledby="meals-locked-grocery">
              <h2 id="meals-locked-grocery" className="dash-section-title">
                Every ingredient for the week
              </h2>
              <p className="account-muted">Grouped by aisle — preview only.</p>
              <div className="dash-locked-fade">
                <ul className="dash-locked-fade__list">
                  <li>2.25 lb grass-fed flank steak</li>
                  <li>Greek yogurt, full-fat (32 oz)</li>
                  <li>Asparagus · garlic · ghee</li>
                  <li>Berries · spinach · eggs</li>
                  <li>Extra-virgin olive oil</li>
                </ul>
                <div className="dash-locked-fade__veil">
                  <span>+ 20 more whole-food ingredients locked</span>
                  <Link href={basePath("/join")} className="account-btn account-btn--accent">
                    Unlock full grocery list
                  </Link>
                </div>
              </div>
            </section>
            <section className="dash-locked-panel" aria-labelledby="meals-locked-prep">
              <h2 id="meals-locked-prep" className="dash-section-title">
                Cook once on Sunday
              </h2>
              <p className="account-muted">Batch prep timeline — locked with Pro.</p>
              <div className="dash-locked-fade">
                <ul className="dash-locked-fade__list">
                  <li>Whisk the two weekly sauces — 00:08</li>
                  <li>Portion proteins into containers — 00:15</li>
                  <li>Roast vegetables for midweek — 00:25</li>
                  <li>Label fridge shelves for grab-and-go</li>
                </ul>
                <div className="dash-locked-fade__veil">
                  <span>Prep steps locked</span>
                  <Link href={basePath("/join")} className="account-btn account-btn--accent">
                    Unlock prep mode
                  </Link>
                </div>
              </div>
            </section>
          </div>

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
                  onClick={() => setSelectedDate(d.date)}
                >
                  <span className="dash-day-tab__dow">{d.label}</span>
                  <span className="dash-day-tab__count">
                    {count > 0 ? `${count} meal${count === 1 ? "" : "s"}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="account-muted">Loading your planned meals…</p>
          ) : dayMeals.length === 0 ? (
            <div className="dash-empty">
              <h2 className="dash-section-title">No meals planned for this day</h2>
              <p className="account-muted">
                Plan meals in the MetFix app calendar — they’ll sync here automatically.
              </p>
            </div>
          ) : (
            <div className="dash-meal-grid">
              {dayMeals.map((m) => {
                const macros = m.recipe_preview?.macros;
                const kcal = macros
                  ? Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fat * 9)
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
                      {macros ? (
                        <dl className="dash-macro-row">
                          <div>
                            <dt>P</dt>
                            <dd>{formatG(macros.protein)}</dd>
                          </div>
                          <div>
                            <dt>F</dt>
                            <dd>{formatG(macros.fat)}</dd>
                          </div>
                          <div>
                            <dt>C</dt>
                            <dd>{formatG(macros.carbs)}</dd>
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
        </div>
      )}
    </DashboardLayout>
  );
}
