import { isIsoDate } from "./dates";

export type RecipeIngredient = {
  display: string;
  sort_order: number;
};

export type RecipeStep = {
  instruction: string;
  sort_order: number;
};

export type DailyFixBelly = {
  title: string;
  body?: string | null;
  steps?: string | null;
  fat: number | null;
  carb: number | null;
  protein: number | null;
  /** Non-empty https URL, or null when absent/invalid. */
  photo_url: string | null;
  /** Parsed 11-char YouTube id from watch/youtu.be/embed/shorts/live, or null. */
  yt_id: string | null;
  has_structured_ingredients: boolean;
  has_structured_steps: boolean;
  recipe_ingredients: RecipeIngredient[];
  recipe_steps: RecipeStep[];
  /** Recipe (structured or body/steps text) present. */
  hasContent: boolean;
};

export type DailyFixBody = {
  title: string;
  html: string;
  photo_url: string | null;
  /**
   * True when upstream `body.body` is a non-empty string before excerpt fallback.
   * Rest day (`body` null) → false while `html` may still show the excerpt.
   */
  hasContent: boolean;
};

export type DailyFixBrain = {
  title: string;
  html: string;
  photo_url: string | null;
  article_url?: string | null;
  button_text?: string | null;
  /** True when upstream article `body` is a non-empty string before excerpt fallback. */
  hasContent: boolean;
};

export type DailyFixDay = {
  date: string;
  requested_date?: string | null;
  belly: DailyFixBelly;
  body: DailyFixBody;
  brain: DailyFixBrain;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Trim; keep http(s) URLs, upgrading http→https (W28 / Spec §6.2).
 * Other schemes and relative paths → null.
 */
export function mapHttpsPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Extract a strict 11-char YouTube id from watch / youtu.be / embed / shorts / live URLs.
 * Bare ids are rejected. Returns null when no usable id is present.
 */
export function extractYoutubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return YT_ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && YT_ID.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
        const id = parts[1] ?? "";
        return YT_ID.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapIngredients(value: unknown): RecipeIngredient[] {
  if (!Array.isArray(value)) return [];
  const items: RecipeIngredient[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const display = asString(entry.display);
    const sortOrder = entry.sort_order;
    if (display == null || typeof sortOrder !== "number") continue;
    items.push({ display, sort_order: sortOrder });
  }
  return items;
}

function mapSteps(value: unknown): RecipeStep[] {
  if (!Array.isArray(value)) return [];
  const items: RecipeStep[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const instruction = asString(entry.instruction);
    const sortOrder = entry.sort_order;
    if (instruction == null || typeof sortOrder !== "number") continue;
    items.push({ instruction, sort_order: sortOrder });
  }
  return items;
}

function mapBelly(value: unknown): DailyFixBelly | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  if (title == null) return null;
  const macros = isRecord(value.macros) ? value.macros : null;
  const hasStructuredIngredients = Boolean(value.has_structured_ingredients);
  const hasStructuredSteps = Boolean(value.has_structured_steps);
  const recipeIngredients = hasStructuredIngredients ? mapIngredients(value.recipe_ingredients) : [];
  const recipeSteps = hasStructuredSteps ? mapSteps(value.recipe_steps) : [];
  const body = asString(value.body);
  const steps = asString(value.steps);
  const hasRecipe =
    recipeIngredients.length > 0 ||
    recipeSteps.length > 0 ||
    (body != null && body.length > 0) ||
    (steps != null && steps.length > 0);
  return {
    title,
    body,
    steps,
    fat: macros ? asNullableNumber(macros.fat) : null,
    carb: macros ? asNullableNumber(macros.carb) : null,
    protein: macros ? asNullableNumber(macros.protein) : null,
    photo_url: mapHttpsPhotoUrl(value.photo_url),
    yt_id: extractYoutubeId(value.yt_url),
    has_structured_ingredients: hasStructuredIngredients,
    has_structured_steps: hasStructuredSteps,
    recipe_ingredients: recipeIngredients,
    recipe_steps: recipeSteps,
    hasContent: hasRecipe,
  };
}

/**
 * Prefer non-empty body.body; if null or "", use body.excerpt.
 * Whitespace-only body.body is kept (no excerpt fallback).
 * hasContent uses the raw body field before excerpt fallback.
 */
function mapBody(value: unknown): DailyFixBody | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  const bodyHtml = asString(value.body);
  const excerpt = asString(value.excerpt);
  const html = bodyHtml && bodyHtml.length > 0 ? bodyHtml : excerpt;
  if (title == null || html == null) return null;
  return {
    title,
    html,
    photo_url: mapHttpsPhotoUrl(value.photo_url),
    hasContent: bodyHtml != null && bodyHtml.length > 0,
  };
}

function mapBrain(value: unknown): DailyFixBrain | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  const bodyHtml = asString(value.body);
  const excerpt = asString(value.excerpt);
  const html = bodyHtml && bodyHtml.length > 0 ? bodyHtml : excerpt;
  if (title == null || html == null) return null;
  return {
    title,
    html,
    photo_url: mapHttpsPhotoUrl(value.photo_url),
    article_url: asString(value.article_url),
    button_text: asString(value.button_text),
    hasContent: bodyHtml != null && bodyHtml.length > 0,
  };
}

/**
 * Map a Worker JSON body onto DailyFixDay, or null when unusable.
 * Requires a valid top-level ISO `date`. Drops `comment_counts`.
 * Does not set `requested_date` — the client stamps that for bare closer-day display.
 */
export function mapDailyFixDay(payload: unknown, _requestedIso?: string): DailyFixDay | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.error === "string") return null;
  const date = asString(payload.date);
  if (date == null || !isIsoDate(date)) return null;
  const belly = mapBelly(payload.belly);
  const body = mapBody(payload.body);
  const brain = mapBrain(payload.brain);
  if (!belly || !body || !brain) return null;
  return { date, belly, body, brain };
}
