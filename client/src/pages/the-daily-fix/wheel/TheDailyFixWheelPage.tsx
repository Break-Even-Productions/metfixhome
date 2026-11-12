import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { DAILY_FIX_WHEEL_PATH } from "@shared/daily-fix/wheel";
import type { WheelRecipe } from "@shared/daily-fix/wheel";
import {
  loadWheelRecipes,
  mergeProteins,
  proteinsFromRecipes,
  recipeHrefFromLastUsed,
} from "./data";
import { baseAnglesForCount, itemTransform, measureOrbitRadius, planSpin } from "./spin";
import "./wheel.css";

const JAKARTA_ID = "daily-fix-jakarta-font";
const JAKARTA_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap";

const PRE_SPIN_SRC =
  "https://brokenscience.org/wp-content/uploads/2025/10/nutritionPlateNoBG.png";

function loadJakartaSans() {
  if (document.getElementById(JAKARTA_ID)) return;
  const link = document.createElement("link");
  link.id = JAKARTA_ID;
  link.rel = "stylesheet";
  link.href = JAKARTA_HREF;
  document.head.appendChild(link);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function capitalize(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function macroLabel(grams: number | null): string {
  if (grams == null || !Number.isFinite(grams)) return "—";
  return `${Math.round(grams)}g`;
}

export default function TheDailyFixWheelPage() {
  usePageMeta({
    title: "Spin the Wheel — The Daily Fix | MetFix",
    description: "Spin the Daily Fix recipe wheel for a random MetFix meal.",
    canonical: `https://metfix.org${DAILY_FIX_WHEEL_PATH}`,
    ogUrl: `https://metfix.org${DAILY_FIX_WHEEL_PATH}`,
  });

  const [recipes, setRecipes] = useState<WheelRecipe[]>([]);
  const [proteins, setProteins] = useState<{ id: number; name: string }[]>([]);
  const [selectedProteins, setSelectedProteins] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState<WheelRecipe | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [itemsVisible, setItemsVisible] = useState(false);

  const ringRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const anglesRef = useRef<number[]>([]);
  const radiusRef = useRef(280);
  const lastIdRef = useRef<number | null>(null);
  const hasSpunRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadJakartaSans();
  }, []);

  const applyItemTransforms = useCallback((angles: number[], radius: number) => {
    const ring = ringRef.current;
    if (!ring) return;
    const nodes = ring.querySelectorAll<HTMLElement>(".df-wheel-item");
    nodes.forEach((el, i) => {
      const a = angles[i] ?? 0;
      el.style.transform = itemTransform(a, radius);
    });
  }, []);

  const layoutRing = useCallback(() => {
    const ring = ringRef.current;
    if (!ring) return;
    radiusRef.current = measureOrbitRadius(ring.getBoundingClientRect().width);
    applyItemTransforms(anglesRef.current, radiusRef.current);
  }, [applyItemTransforms]);

  const fetchRecipes = useCallback(
    async (opts: { excludeId?: number | null; proteinIds?: number[] } = {}) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setError(null);
      setRevealed(null);
      setItemsVisible(false);
      try {
        const payload = await loadWheelRecipes(
          {
            limit: 12,
            excludeId: opts.excludeId ?? null,
            proteinIds: opts.proteinIds ?? selectedProteins,
          },
          ac.signal,
        );
        if (ac.signal.aborted) return [];
        const next = payload.recipes.slice(0, 12);
        setRecipes(next);
        setProteins((prev) => mergeProteins(prev, proteinsFromRecipes(next)));
        anglesRef.current = baseAnglesForCount(next.length);
        rotationRef.current = 0;
        if (ringRef.current) {
          ringRef.current.style.transition = "none";
          ringRef.current.style.transform = "rotate(0deg)";
        }
        requestAnimationFrame(() => {
          layoutRing();
          if (!prefersReducedMotion()) {
            requestAnimationFrame(() => setItemsVisible(true));
          } else {
            setItemsVisible(true);
          }
        });
        setLoading(false);
        return next;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return [];
        setLoading(false);
        setRecipes([]);
        setError("Couldn’t load recipes. Try again in a moment.");
        return [];
      }
    },
    [layoutRing, selectedProteins],
  );

  useEffect(() => {
    void fetchRecipes({ proteinIds: [] });
    return () => {
      abortRef.current?.abort();
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => layoutRing();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layoutRing]);

  const spinTo = useCallback(
    (index: number, fullSpin: boolean) => {
      const ring = ringRef.current;
      if (!ring || spinning || recipes.length === 0) return;
      const plan = planSpin(index, anglesRef.current, rotationRef.current, {
        fullSpin,
        reduceMotion: prefersReducedMotion(),
      });
      setSpinning(true);
      setRevealed(null);
      rotationRef.current = plan.nextRotation;
      if (plan.durationMs <= 0) {
        ring.style.transition = "none";
        ring.style.transform = `rotate(${plan.nextRotation}deg)`;
        setSpinning(false);
        const winner = recipes[index] ?? null;
        setRevealed(winner);
        if (winner) {
          lastIdRef.current = winner.id;
          hasSpunRef.current = true;
        }
        return;
      }
      ring.style.transition = `transform ${Math.round(plan.durationMs)}ms cubic-bezier(.05,.85,.1,1)`;
      ring.style.transform = `rotate(${plan.nextRotation}deg)`;
      const onEnd = (event: TransitionEvent) => {
        if (event.target !== ring || event.propertyName !== "transform") return;
        ring.removeEventListener("transitionend", onEnd);
        ring.style.transition = "";
        setSpinning(false);
        const winner = recipes[index] ?? null;
        setRevealed(winner);
        if (winner) {
          lastIdRef.current = winner.id;
          hasSpunRef.current = true;
        }
      };
      ring.addEventListener("transitionend", onEnd);
    },
    [recipes, spinning],
  );

  const onSpin = async () => {
    if (spinning) return;
    let pool = recipes;
    if (hasSpunRef.current && lastIdRef.current) {
      pool = await fetchRecipes({ excludeId: lastIdRef.current, proteinIds: selectedProteins });
    } else if (!pool.length) {
      pool = await fetchRecipes({ proteinIds: selectedProteins });
    }
    if (!pool.length) return;
    // Always land on index 0 of the server-randomized set (BSI parity).
    requestAnimationFrame(() => spinTo(0, true));
  };

  const toggleProtein = (id: number) => {
    setSelectedProteins((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
      filterTimerRef.current = setTimeout(() => {
        lastIdRef.current = null;
        hasSpunRef.current = false;
        void fetchRecipes({ proteinIds: next });
      }, 120);
      return next;
    });
  };

  const shareWinner = async () => {
    if (!revealed) return;
    const href = recipeHrefFromLastUsed(revealed.last_used);
    if (!href) return;
    const absolute = `${window.location.origin}${href}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setToast("Recipe link copied");
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2200);
    } catch {
      setToast("Couldn’t copy link");
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2200);
    }
  };

  const recipeHref = revealed ? recipeHrefFromLastUsed(revealed.last_used) : null;
  const heroSrc = revealed?.assets?.high || revealed?.assets?.low || PRE_SPIN_SRC;
  const heroAlt = revealed?.assets?.alt || revealed?.title || "MetFix nutrition plate";

  return (
    <main className="df-wheel-page">
      <div className="df-wheel-shell">
        <div className="df-wheel-top">
          <Link href="/the-daily-fix" className="df-wheel-back">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Daily Fix
          </Link>
        </div>

        <div className="df-wheel-hero">
          <section className="df-wheel-copy" aria-labelledby="df-wheel-title">
            <p className="df-wheel-kicker">The Daily Fix</p>
            <h1 id="df-wheel-title">
              Spin the <em>Wheel</em>
            </h1>
            <p className="df-wheel-lede">
              A liquid-glass spin through Daily Fix recipes. Land on a meal, open the day, cook.
            </p>

            {proteins.length > 0 ? (
              <div className="df-wheel-filters">
                <p className="df-wheel-filters-label" id="df-wheel-protein-label">
                  Protein
                </p>
                <div
                  className="df-wheel-chips"
                  role="group"
                  aria-labelledby="df-wheel-protein-label"
                >
                  {proteins.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="df-wheel-chip"
                      aria-pressed={selectedProteins.includes(p.id)}
                      onClick={() => toggleProtein(p.id)}
                      disabled={spinning}
                    >
                      {capitalize(p.name)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="df-wheel-spin"
              onClick={() => void onSpin()}
              disabled={spinning || (loading && recipes.length === 0)}
            >
              {spinning ? "Spinning…" : "Spin the wheel"}
            </button>
            <p className="df-wheel-status" role="status">
              {error ? error : loading && recipes.length === 0 ? "Loading recipes…" : null}
            </p>
          </section>

          <section
            className="df-wheel-stage"
            aria-label="Recipe wheel"
            aria-busy={spinning || loading}
          >
            <span className="df-wheel-target" aria-hidden="true" />
            <span className="df-wheel-target-ray" aria-hidden="true" />

            <div className="df-wheel-plate-wrap">
              <div className="df-wheel-plate">
                <img
                  src={heroSrc}
                  alt={heroAlt}
                  className={revealed ? "is-reveal" : "is-pre"}
                  loading="eager"
                />
              </div>
            </div>

            <div
              ref={ringRef}
              className="df-wheel-ring"
              aria-hidden={recipes.length === 0}
            >
              {recipes.map((recipe, index) => {
                const src = recipe.assets?.low || recipe.assets?.high || PRE_SPIN_SRC;
                const alt = recipe.assets?.alt || recipe.title || "Recipe";
                return (
                  <button
                    key={`${recipe.id}-${index}`}
                    type="button"
                    className={itemsVisible ? "df-wheel-item is-in" : "df-wheel-item"}
                    style={{
                      transitionDelay: prefersReducedMotion() ? "0ms" : `${index * 28}ms`,
                    }}
                    aria-label={`Select ${recipe.title || "recipe"}`}
                    disabled={spinning}
                    onClick={() => spinTo(index, false)}
                  >
                    <img src={src} alt={alt} loading="lazy" decoding="async" />
                  </button>
                );
              })}
            </div>

            <div
              className={revealed ? "df-wheel-meta is-show" : "df-wheel-meta"}
              aria-live="polite"
            >
              {revealed ? (
                <>
                  <h2>{revealed.title || "—"}</h2>
                  <div className="df-wheel-macros">
                    <div>
                      <b>{macroLabel(revealed.macros.fat)}</b>
                      Fat
                    </div>
                    <div>
                      <b>{macroLabel(revealed.macros.protein)}</b>
                      Protein
                    </div>
                    <div>
                      <b>{macroLabel(revealed.macros.carb)}</b>
                      Carbs
                    </div>
                  </div>
                  <div className="df-wheel-meta-actions">
                    {recipeHref ? (
                      <Link href={recipeHref}>View recipe</Link>
                    ) : (
                      <span aria-disabled="true">No day link</span>
                    )}
                    {recipeHref ? (
                      <button type="button" onClick={() => void shareWinner()}>
                        Share
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <h2>
                  The
                  <br />
                  Daily
                  <br />
                  Fix
                </h2>
              )}
            </div>
          </section>
        </div>
      </div>

      {toast ? (
        <div className="df-wheel-toast" role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
