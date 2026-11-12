import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { BookOpen, Bookmark, Dumbbell, UtensilsCrossed } from "lucide-react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  loadFavorites,
  setFavorite,
  type FavoriteItem,
} from "@/lib/account";
import { decodeHtmlEntitiesOnce, stripTags } from "@shared/daily-fix/text";
import DashboardLayout from "./DashboardLayout";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "articles", label: "Articles" },
  { id: "recipes", label: "Recipes" },
  { id: "workouts", label: "Workouts" },
  { id: "videos", label: "Videos" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const TYPE_LABEL: Record<string, string> = {
  daily_mod: "Recipe",
  custom_recipe: "Recipe",
  recipes: "Recipe",
  recipe: "Recipe",
  daily_workout: "Workout",
  custom_workout: "Workout",
  workouts: "Workout",
  workout: "Workout",
  videos: "Workout",
  daily_article: "Article",
  articles: "Article",
  article: "Article",
  post: "Article",
  wp_post: "Article",
  meal_plan: "Meal plan",
  plan: "Meal plan",
};

function typeLabel(sourceType: string): string {
  return TYPE_LABEL[sourceType] ?? sourceType.replace(/_/g, " ");
}

function typeTone(sourceType: string): "recipe" | "workout" | "article" | "other" {
  const label = typeLabel(sourceType).toLowerCase();
  if (label === "recipe") return "recipe";
  if (label === "workout") return "workout";
  if (label === "article") return "article";
  return "other";
}

function plainField(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return decodeHtmlEntitiesOnce(stripTags(raw.replace(/<br\s*\/?>|<\/p>/gi, " ")))
    .replace(/\s+/g, " ")
    .trim();
}

function finiteMacro(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function formatMacro(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** Date-only label — strips times like `2026-09-30 07:00:13`. */
function formatFavoriteDate(raw: unknown): string {
  const text = plainField(raw);
  if (!text) return "";
  const ymd = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) {
    const [y, m, d] = ymd[1]!.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    }
    return ymd[1]!;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return text;
}

function itemHref(item: FavoriteItem): { kind: "internal" | "external"; href: string } | null {
  const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
  if (rawUrl.startsWith("/")) return { kind: "internal", href: rawUrl };
  if (rawUrl.startsWith("https://") || rawUrl.startsWith("http://")) {
    return { kind: "external", href: rawUrl };
  }
  for (const candidate of [item.article_url, item.recipe_url, item.video_url]) {
    if (typeof candidate === "string" && candidate.startsWith("https://")) {
      return { kind: "external", href: candidate };
    }
    if (typeof candidate === "string" && candidate.startsWith("/")) {
      return { kind: "internal", href: candidate };
    }
  }
  return null;
}

function PlaceholderIcon({ tone }: { tone: ReturnType<typeof typeTone> }) {
  const Icon =
    tone === "recipe" ? UtensilsCrossed : tone === "workout" ? Dumbbell : BookOpen;
  return <Icon className="account-fav-card__placeholder-icon" aria-hidden size={28} strokeWidth={1.75} />;
}

function FavoriteCardInner({
  item,
  tone,
  label,
}: {
  item: FavoriteItem;
  tone: ReturnType<typeof typeTone>;
  label: string;
}): ReactNode {
  const photo =
    typeof item.photo_url === "string" && item.photo_url.startsWith("https://")
      ? item.photo_url
      : null;
  const protein = finiteMacro(item.protein_g);
  const fat = finiteMacro(item.fat_g);
  const carbs = finiteMacro(item.carb_g);
  const hasMacros = protein != null || fat != null || carbs != null;
  const excerpt = plainField(item.excerpt);
  const scale = plainField(item.scale);
  const proteinName = plainField(item.protein_name);
  const servings =
    typeof item.servings_default === "number" && item.servings_default > 0
      ? item.servings_default
      : null;
  const when = formatFavoriteDate(item.date) || formatFavoriteDate(item.saved_at);

  return (
    <>
      <div className="account-fav-card__media" aria-hidden={photo ? undefined : true}>
        {photo ? (
          <img src={photo} alt="" className="account-fav-card__img" loading="lazy" />
        ) : (
          <div className={`account-fav-card__placeholder account-fav-card__placeholder--${tone}`}>
            <PlaceholderIcon tone={tone} />
          </div>
        )}
      </div>
      <div className="account-fav-card__body">
        <div className="account-fav-card__top">
          <span className={`account-fav-card__kind account-fav-card__kind--${tone}`}>
            {typeLabel(item.source_type)}
          </span>
          {when ? <span className="account-fav-card__when">{when}</span> : null}
        </div>
        <div className="account-fav-card__title">{label}</div>
        {excerpt ? <p className="account-fav-card__excerpt">{excerpt}</p> : null}
        {scale ? <p className="account-fav-card__scale">{scale}</p> : null}
        <div className="account-fav-card__facts">
          {proteinName ? <span className="account-fav-card__chip">{proteinName}</span> : null}
          {servings != null ? (
            <span className="account-fav-card__chip">
              {servings} serving{servings === 1 ? "" : "s"}
            </span>
          ) : null}
          {hasMacros ? (
            <span className="account-fav-card__macros" aria-label="Macros">
              {protein != null ? <span>P {formatMacro(protein)}g</span> : null}
              {fat != null ? <span>F {formatMacro(fat)}g</span> : null}
              {carbs != null ? <span>C {formatMacro(carbs)}g</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

function FavoriteCard({
  item,
  busy,
  onRemove,
}: {
  item: FavoriteItem;
  busy: boolean;
  onRemove: () => void;
}) {
  const tone = typeTone(item.source_type);
  const label =
    plainField(item.title) || `${typeLabel(item.source_type)} ${item.source_id}`;
  const href = itemHref(item);

  function onBookmarkClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  }

  const inner = <FavoriteCardInner item={item} tone={tone} label={label} />;

  return (
    <li
      className={[
        "account-fav-card",
        `account-fav-card--${tone}`,
        href ? "account-fav-card--linked" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="account-fav-card__bookmark"
        disabled={busy}
        aria-label={`Remove ${label} from saved`}
        title="Remove from saved"
        onClick={onBookmarkClick}
      >
        <Bookmark aria-hidden size={18} strokeWidth={2} fill="currentColor" />
      </button>
      {href?.kind === "internal" ? (
        <Link href={basePath(href.href)} className="account-fav-card__hit" aria-label={label}>
          {inner}
        </Link>
      ) : href?.kind === "external" ? (
        <a
          href={href.href}
          className="account-fav-card__hit"
          aria-label={label}
          target="_blank"
          rel="noreferrer"
        >
          {inner}
        </a>
      ) : (
        <div className="account-fav-card__hit account-fav-card__hit--static">{inner}</div>
      )}
    </li>
  );
}

export default function AccountFavorites() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const data = await loadFavorites(filter, { force: true, signal: ac.signal });
        if (cancelled) return;
        const rows = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.favorites)
            ? data.favorites
            : [];
        setItems(rows);
        setLoaded(true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load favorites.");
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [filter]);

  async function onToggle(item: FavoriteItem) {
    const key = `${item.source_type}:${item.source_id}`;
    setBusyKey(key);
    setError(null);
    try {
      await setFavorite(item.source_type, item.source_id, false);
      setItems((prev) =>
        prev.filter((x) => !(x.source_type === item.source_type && x.source_id === item.source_id)),
      );
    } catch {
      setError("Could not update favorite.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DashboardLayout title="Saved / Favorites" description="Articles, recipes, workouts, and videos you saved.">
      {error ? <p className="account-error">{error}</p> : null}
      <div className="account-pills" style={{ marginBottom: "1rem" }} role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? "account-pill account-pill--accent" : "account-pill"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loaded && items.length === 0 ? (
        <section className="account-empty" aria-labelledby="favorites-empty-heading">
          <h2 id="favorites-empty-heading">Nothing saved yet</h2>
          <p className="account-muted">
            Save articles, recipes, workouts, and videos from the library. They show up here so you
            can return quickly.
          </p>
          <div className="account-course-card__actions">
            <Link href={basePath("/library")} className="account-btn">
              Browse the library
            </Link>
            <Link href={basePath("/courses")} className="account-btn account-btn--ghost">
              Explore courses
            </Link>
          </div>
        </section>
      ) : null}
      {items.length > 0 ? (
        <ul className="account-fav-list">
          {items.map((item) => {
            const key = `${item.source_type}:${item.source_id}`;
            return (
              <FavoriteCard
                key={key}
                item={item}
                busy={busyKey === key}
                onRemove={() => void onToggle(item)}
              />
            );
          })}
        </ul>
      ) : null}
    </DashboardLayout>
  );
}
