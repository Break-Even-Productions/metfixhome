import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { basePath } from "@/const";
import {
  createMealPlan,
  hybridPlanIdFromCreate,
  loadCustomRecipes,
  loadOverview,
  loadPlan,
  loadSubscriptions,
  publishMealPlan,
  setMealPlanActive,
  updateMealPlan,
  type AccountOverview,
  type AccountSubscriptions,
  type CustomRecipe,
  type MealPlanSummary,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";

type KeptItem = {
  item_type: string;
  sort_order?: number;
  label?: string | null;
  workout_source?: string | null;
  workout_source_id?: number | null;
  brain_source_type?: string | null;
  brain_source_id?: number | null;
  relative_to_schedule_date?: boolean;
};

type DayDraft = {
  day_index: number;
  meals: Array<{ recipe_source_id: number; label: string; servings: number }>;
  kept: KeptItem[];
};

function parseIdFromPath(path: string): number | null {
  const m = path.match(/\/account\/meal-plans\/(\d+)\/edit\/?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function emptyDays(duration: number): DayDraft[] {
  return Array.from({ length: duration }, (_, i) => ({ day_index: i, meals: [], kept: [] }));
}

function planToDays(plan: MealPlanSummary): DayDraft[] {
  const duration = Math.max(1, Number(plan.duration_days) || 7);
  const days = emptyDays(duration);
  for (const day of plan.days ?? []) {
    const idx = typeof day.day_index === "number" ? day.day_index : 0;
    if (idx < 0 || idx >= days.length) continue;
    const meals = (day.items ?? [])
      .filter((it) => it.item_type === "meal" && typeof it.recipe_source_id === "number")
      .map((it) => ({
        recipe_source_id: it.recipe_source_id as number,
        label: String(it.label ?? ""),
        servings: typeof it.servings === "number" && it.servings > 0 ? it.servings : 1,
      }));
    const kept = (day.items ?? [])
      .filter((it) => it.item_type !== "meal")
      .map((it) => ({
        item_type: String(it.item_type),
        label: it.label ?? null,
        workout_source: (it as { workout_source?: string | null }).workout_source ?? null,
        workout_source_id: (it as { workout_source_id?: number | null }).workout_source_id ?? null,
        brain_source_type: (it as { brain_source_type?: string | null }).brain_source_type ?? null,
        brain_source_id: (it as { brain_source_id?: number | null }).brain_source_id ?? null,
        relative_to_schedule_date:
          (it as { relative_to_schedule_date?: boolean }).relative_to_schedule_date === true,
      }));
    days[idx] = { day_index: idx, meals, kept };
  }
  return days;
}

export default function AccountPlanBuilder() {
  const [location, setLocation] = useLocation();
  const editId = useMemo(() => parseIdFromPath(location), [location]);
  const isEdit = editId != null;

  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [recipes, setRecipes] = useState<CustomRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(7);
  const [visibility, setVisibility] = useState<"invite_only" | "unlisted" | "public">(
    "invite_only",
  );
  const [days, setDays] = useState<DayDraft[]>(() => emptyDays(7));
  const [selectedDay, setSelectedDay] = useState(0);

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const unlocked = metfixToolsUnlocked(tier);
  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";

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
        if (!metfixToolsUnlocked(nextTier)) return;
        const lib = await loadCustomRecipes({ force: true, signal: ac.signal, limit: 100 });
        if (cancelled) return;
        setRecipes(Array.isArray(lib.recipes) ? lib.recipes : []);
        if (editId != null) {
          const plan = await loadPlan(editId, { force: true, signal: ac.signal });
          if (cancelled) return;
          setTitle(plan.title ?? "");
          setDescription(String(plan.description ?? ""));
          const d = Math.max(1, Number(plan.duration_days) || 7);
          setDuration(d);
          const vis = plan.visibility;
          if (vis === "public" || vis === "unlisted" || vis === "invite_only") {
            setVisibility(vis);
          }
          setDays(planToDays({ ...plan, duration_days: d }));
        }
      } catch {
        if (!cancelled) setError("Unable to load the plan builder.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [editId]);

  function setDurationSafe(n: number) {
    setDuration(n);
    setDays((prev) => {
      const next = emptyDays(n);
      for (let i = 0; i < Math.min(prev.length, n); i++) {
        next[i] = { day_index: i, meals: prev[i]?.meals ?? [], kept: prev[i]?.kept ?? [] };
      }
      return next;
    });
    setSelectedDay((d) => Math.min(d, n - 1));
  }

  function addMeal(recipeId: number) {
    setDays((prev) =>
      prev.map((day) =>
        day.day_index === selectedDay
          ? {
              ...day,
              meals: [
                ...day.meals,
                {
                  recipe_source_id: recipeId,
                  label: "",
                  servings: 1,
                },
              ],
            }
          : day,
      ),
    );
  }

  function removeMeal(dayIndex: number, mealIndex: number) {
    setDays((prev) =>
      prev.map((day) =>
        day.day_index === dayIndex
          ? { ...day, meals: day.meals.filter((_, i) => i !== mealIndex) }
          : day,
      ),
    );
  }

  function buildPayload(status: "draft" | "published") {
    return {
      title: title.trim(),
      description: description.trim() || null,
      duration_days: duration,
      visibility,
      status,
      replace_days: true,
      days: days.map((day) => ({
        day_index: day.day_index,
        notes: null,
        items: [
          ...day.meals.map((m, sort_order) => ({
            item_type: "meal" as const,
            sort_order,
            recipe_source_type: "custom_recipe",
            recipe_source_id: m.recipe_source_id,
            servings: m.servings,
            label: m.label.trim() || null,
          })),
          ...day.kept.map((item, index) => ({
            ...item,
            sort_order: day.meals.length + index,
            relative_to_schedule_date: item.relative_to_schedule_date || undefined,
          })),
        ],
      })),
    };
  }

  async function persist(status: "draft" | "published") {
    if (!title.trim()) {
      setMessage("Give the plan a title first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = buildPayload(status);
      if (isEdit && editId != null) {
        await updateMealPlan(editId, payload);
        if (status === "published") {
          await publishMealPlan(editId);
        }
        await setMealPlanActive(editId, false);
        setMessage(status === "published" ? "Plan published." : "Draft saved.");
      } else {
        const created = await createMealPlan(payload);
        const id = hybridPlanIdFromCreate(created);
        if (id != null) {
          await setMealPlanActive(id, false);
        }
        setMessage(status === "published" ? "Plan published." : "Draft saved.");
        setLocation(basePath("/account/meal-plans"));
      }
    } catch {
      setMessage("Could not save that plan.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft(e: FormEvent) {
    e.preventDefault();
    await persist("draft");
  }

  const day = days[selectedDay] ?? { day_index: selectedDay, meals: [] };
  const recipeTitle = (id: number) =>
    recipes.find((r) => r.id === id)?.title ?? `Recipe #${id}`;

  return (
    <DashboardLayout
      title={isEdit ? "Edit meal plan" : "Create meal plan"}
      description="Hybrid plan editor — meals-first, matching the MetFix app."
      hideChromeTitle
    >
      <ToolHero
        photo="/daily-fix/260930-cilantro-lime-steak.jpg"
        photoFallback="/Stills/athlete-bodyweight-sit-gym.jpg"
        chips={
          <>
            <Link href={basePath("/account/meal-plans")} className="dash-chip">
              Meal Plans
            </Link>
            <span className="dash-chip">Belly · Plan builder</span>
          </>
        }
        title={isEdit ? `${firstName}’s plan.` : `${firstName}’s new plan.`}
        lede="Title, duration, visibility, and per-day meals from your custom recipes — same write path as the app."
        stats={[
          { label: "Days", value: String(duration) },
          {
            label: "Meals",
            value: String(days.reduce((n, d) => n + d.meals.length, 0)),
          },
          { label: "Recipes", value: String(recipes.length) },
        ]}
      />
      {!unlocked ? <ProUnlockBanner introOffer={overview} /> : null}
      {loading ? <p className="account-muted">Loading…</p> : null}
      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p className="account-muted">{message}</p> : null}

      {unlocked && !loading ? (
        <form className="belly-panel" onSubmit={onSaveDraft}>
          <label className="belly-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="belly-field">
            <span>Description</span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="belly-builder-macros">
            <label className="belly-field">
              <span>Duration</span>
              <select
                value={duration}
                onChange={(e) => setDurationSafe(Number(e.target.value))}
              >
                {[3, 7, 14, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
            <label className="belly-field">
              <span>Visibility</span>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "invite_only" | "unlisted" | "public")
                }
              >
                <option value="invite_only">Invite only</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>

          <div className="belly-panel__head">
            <h2 className="dash-section-title">Day timeline</h2>
            <div className="belly-tabs" role="tablist" aria-label="Plan days">
              {days.map((d) => (
                <button
                  key={d.day_index}
                  type="button"
                  role="tab"
                  aria-selected={selectedDay === d.day_index}
                  className={
                    selectedDay === d.day_index
                      ? "belly-tabs__btn belly-tabs__btn--on"
                      : "belly-tabs__btn"
                  }
                  onClick={() => setSelectedDay(d.day_index)}
                >
                  D{d.day_index + 1}
                </button>
              ))}
            </div>
          </div>

          <p className="account-muted">
            Day {selectedDay + 1} — add meals from your custom recipe library.
          </p>

          {day.meals.length === 0 ? (
            <p className="account-muted">No meals on this day yet.</p>
          ) : (
            <ul className="belly-plan-list">
              {day.meals.map((m, i) => (
                <li key={`${m.recipe_source_id}-${i}`} className="belly-plan-row">
                  <div>
                    <p className="belly-plan-row__title">{recipeTitle(m.recipe_source_id)}</p>
                    <p className="account-muted">
                      custom_recipe #{m.recipe_source_id} · {m.servings} serving
                      {m.servings === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="account-btn"
                    onClick={() => removeMeal(selectedDay, i)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="belly-field">
            <span>Add custom recipe</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (Number.isSafeInteger(id) && id > 0) addMeal(id);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Choose a recipe…
              </option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          {recipes.length === 0 ? (
            <p className="account-muted">
              No custom recipes yet.{" "}
              <Link href={basePath("/account/my-meals/recipes/new")}>Create one</Link> first.
            </p>
          ) : null}

          <div className="belly-builder-actions">
            <Link href={basePath("/account/meal-plans")} className="account-btn">
              Cancel
            </Link>
            <button type="submit" className="account-btn" disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="account-btn account-btn--accent"
              disabled={saving}
              onClick={() => void persist("published")}
            >
              Publish
            </button>
          </div>
        </form>
      ) : null}
    </DashboardLayout>
  );
}
