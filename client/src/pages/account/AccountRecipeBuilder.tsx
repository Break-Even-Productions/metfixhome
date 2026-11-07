import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { basePath } from "@/const";
import {
  createCustomRecipe,
  deleteCustomRecipe,
  loadCustomRecipe,
  loadOverview,
  loadSubscriptions,
  updateCustomRecipe,
  type AccountOverview,
  type AccountSubscriptions,
  type CustomRecipe,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { ToolHero } from "./ToolHero";

type Step = 1 | 2 | 3 | 4;

function parseIdFromPath(path: string): number | null {
  const m = path.match(/\/account\/my-meals\/recipes\/(\d+)\/edit\/?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function stepsHtml(lines: string[]): string {
  if (lines.length === 0) return "";
  return `<ol>\n${lines.map((s) => `<li>${s.replace(/</g, "&lt;")}</li>`).join("\n")}\n</ol>`;
}

function recipeToForm(r: CustomRecipe) {
  const ingredients =
    Array.isArray(r.ingredients) && r.ingredients.length > 0
      ? r.ingredients.map(String)
      : typeof r.ingredients_text === "string"
        ? String(r.ingredients_text)
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [];
  const stepsRaw =
    Array.isArray(r.instructions)
      ? r.instructions.map(String)
      : typeof r.instructions === "string"
        ? String(r.instructions)
            .replace(/<\/?li>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [];
  const macros = (r.macros ?? r.macros_json ?? {}) as {
    protein?: number;
    fat?: number;
    carbs?: number;
  };
  return {
    title: r.title ?? "",
    description: String(r.description ?? r.excerpt ?? ""),
    ingredientsText: ingredients.join("\n"),
    stepsText: stepsRaw.join("\n"),
    protein: macros.protein != null ? String(macros.protein) : "",
    fat: macros.fat != null ? String(macros.fat) : "",
    carbs: macros.carbs != null ? String(macros.carbs) : "",
    imageUrl: String(r.image_url ?? r.photo_url ?? ""),
  };
}

export default function AccountRecipeBuilder() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const editId = useMemo(() => parseIdFromPath(location), [location]);
  const isEdit = editId != null;

  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [imageUrl, setImageUrl] = useState("");

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
        if (editId != null && metfixToolsUnlocked(su?.canonical_tier ?? ov?.canonical_tier ?? "free")) {
          const recipe = await loadCustomRecipe(editId, { force: true, signal: ac.signal });
          if (cancelled) return;
          const form = recipeToForm(recipe);
          setTitle(form.title);
          setDescription(form.description);
          setIngredientsText(form.ingredientsText);
          setStepsText(form.stepsText);
          setProtein(form.protein);
          setFat(form.fat);
          setCarbs(form.carbs);
          setImageUrl(form.imageUrl);
        }
        const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        if (params.get("mode") === "edit" && params.get("recipeId") && editId == null) {
          const id = Number(params.get("recipeId"));
          if (Number.isSafeInteger(id) && id > 0) {
            setLocation(basePath(`/account/my-meals/recipes/${id}/edit`));
          }
        }
      } catch {
        if (!cancelled) setError("Unable to load the recipe builder.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [editId, search, setLocation]);

  function ingredientLines(): string[] {
    return ingredientsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function stepLines(): string[] {
    return stepsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function parseMacro(v: string): number | undefined {
    const t = v.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  function validateStep(s: Step): string | null {
    if (s === 1 && !title.trim()) return "Give your recipe a name before continuing.";
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setMessage(err);
      return;
    }
    setMessage(null);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  function back() {
    setMessage(null);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const err = validateStep(1);
    if (err) {
      setMessage(err);
      setStep(1);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const lines = ingredientLines();
      const steps = stepLines();
      const p = parseMacro(protein);
      const f = parseMacro(fat);
      const c = parseMacro(carbs);
      const body = {
        title: title.trim(),
        excerpt: description.trim() || null,
        photo_url: imageUrl.trim().startsWith("https://") ? imageUrl.trim() : null,
        recipe_ingredients: lines.map((display_name) => ({ display_name })),
        ingredients_text: lines.join("\n"),
        recipe_steps: steps.map((instruction) => ({ instruction })),
        steps: stepsHtml(steps),
        protein_g: p ?? null,
        fat_g: f ?? null,
        carbs_g: c ?? null,
        macros_json:
          p != null || f != null || c != null
            ? { protein: p ?? 0, fat: f ?? 0, carbs: c ?? 0 }
            : undefined,
      };
      if (isEdit && editId != null) {
        await updateCustomRecipe(editId, body);
        setMessage("Recipe updated.");
      } else {
        await createCustomRecipe(body);
        setMessage("Recipe saved.");
        setLocation(basePath("/account/my-meals"));
      }
    } catch {
      setMessage("Could not save that recipe.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (editId == null) return;
    if (!window.confirm("Delete this recipe?")) return;
    setSaving(true);
    try {
      await deleteCustomRecipe(editId);
      setLocation(basePath("/account/my-meals"));
    } catch {
      setMessage("Could not delete that recipe.");
      setSaving(false);
    }
  }

  return (
    <DashboardLayout
      title={isEdit ? "Edit recipe" : "Create recipe"}
      description="Custom recipe builder — same fields as the MetFix app."
      hideChromeTitle
    >
      <ToolHero
        photo="/daily-fix/260930-cilantro-lime-steak.jpg"
        photoFallback="/Stills/athlete-bodyweight-sit-gym.jpg"
        chips={
          <>
            <Link href={basePath("/account/my-meals")} className="dash-chip">
              My Meals
            </Link>
            <span className="dash-chip">Belly · Recipe builder</span>
          </>
        }
        title={isEdit ? `${firstName}’s recipe.` : `${firstName}’s new recipe.`}
        lede="Basics → ingredients & steps → nutrition → review — matching the MetFix app builder."
        stats={[
          { label: "Step", value: `${step} / 4` },
          { label: "Mode", value: isEdit ? "Edit" : "Create" },
          { label: "Ingredients", value: String(ingredientLines().length) },
        ]}
      />
      {!unlocked ? <ProUnlockBanner introOffer={overview} /> : null}
      {loading ? <p className="account-muted">Loading…</p> : null}
      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p className="account-muted">{message}</p> : null}

      {unlocked && !loading ? (
        <form className="belly-panel" onSubmit={onSave}>
          <div className="belly-tabs" role="tablist" aria-label="Builder steps">
            {(["Basics", "Recipe", "Nutrition", "Review"] as const).map((label, i) => {
              const n = (i + 1) as Step;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={step === n}
                  className={step === n ? "belly-tabs__btn belly-tabs__btn--on" : "belly-tabs__btn"}
                  onClick={() => setStep(n)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {step === 1 ? (
            <div className="belly-builder-block">
              <label className="belly-field">
                <span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label className="belly-field">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="belly-field">
                <span>Photo URL (https)</span>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="belly-builder-block">
              <label className="belly-field">
                <span>Ingredients (one per line — quick mode)</span>
                <textarea
                  rows={8}
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  placeholder={"200 g chicken breast\n1 cup spinach"}
                />
              </label>
              <label className="belly-field">
                <span>Steps (one per line)</span>
                <textarea
                  rows={8}
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  placeholder={"Sear both sides\nRest 5 minutes"}
                />
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="belly-builder-block belly-builder-macros">
              <label className="belly-field">
                <span>Protein (g)</span>
                <input inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
              </label>
              <label className="belly-field">
                <span>Fat (g)</span>
                <input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
              </label>
              <label className="belly-field">
                <span>Carbs (g)</span>
                <input inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
              </label>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="belly-builder-block">
              <h3 className="dash-section-title">{title.trim() || "Untitled recipe"}</h3>
              {description.trim() ? <p className="account-muted">{description.trim()}</p> : null}
              <p className="account-muted">
                {ingredientLines().length} ingredients · {stepLines().length} steps
                {protein || fat || carbs
                  ? ` · ${protein || "0"}P / ${fat || "0"}F / ${carbs || "0"}C`
                  : ""}
              </p>
              {ingredientLines().length > 0 ? (
                <ul className="belly-plain-list">
                  {ingredientLines().map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="belly-builder-actions">
            {step > 1 ? (
              <button type="button" className="account-btn" onClick={back}>
                Back
              </button>
            ) : (
              <Link href={basePath("/account/my-meals")} className="account-btn">
                Cancel
              </Link>
            )}
            {step < 4 ? (
              <button type="button" className="account-btn account-btn--accent" onClick={next}>
                Continue
              </button>
            ) : (
              <button type="submit" className="account-btn account-btn--accent" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Update recipe" : "Save recipe"}
              </button>
            )}
            {isEdit ? (
              <button type="button" className="account-btn account-btn--ghost" disabled={saving} onClick={onDelete}>
                Delete
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </DashboardLayout>
  );
}
