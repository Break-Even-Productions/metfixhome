import type {
  DailyFixBelly,
  DailyFixBody,
  DailyFixBrain,
  DailyFixDay,
  RecipeIngredient,
  RecipeStep,
} from "./model";

/** Deployed Daily Fix BFF. No key, no VITE_ override, no WordPress call. */
export const DAILY_FIX_BFF_URL = "https://metfix-bff.wispy-mode-982d.workers.dev/daily-fix";

export type DailyFixLoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "loaded"; day: DailyFixDay };

export function dailyFixRequestUrl(isoDate: string): string {
  const url = new URL(DAILY_FIX_BFF_URL);
  url.searchParams.set("date", isoDate);
  return url.toString();
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
  return {
    title,
    body: asString(value.body),
    steps: asString(value.steps),
    fat: macros ? asNullableNumber(macros.fat) : null,
    carb: macros ? asNullableNumber(macros.carb) : null,
    protein: macros ? asNullableNumber(macros.protein) : null,
    has_structured_ingredients: hasStructuredIngredients,
    has_structured_steps: hasStructuredSteps,
    recipe_ingredients: hasStructuredIngredients ? mapIngredients(value.recipe_ingredients) : [],
    recipe_steps: hasStructuredSteps ? mapSteps(value.recipe_steps) : [],
  };
}

function mapBody(value: unknown): DailyFixBody | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  // BSI day content uses body.body for workout HTML; body.html is not present.
  const html = asString(value.body);
  if (title == null || html == null) return null;
  return { title, html };
}

function mapBrain(value: unknown): DailyFixBrain | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  // BSI day content uses brain.body, or brain.excerpt when body is empty.
  const bodyHtml = asString(value.body);
  const excerpt = asString(value.excerpt);
  const html = bodyHtml && bodyHtml.length > 0 ? bodyHtml : excerpt;
  if (title == null || html == null) return null;
  return {
    title,
    html,
    article_url: asString(value.article_url),
    button_text: asString(value.button_text),
  };
}

/** Map a Worker JSON body onto DailyFixDay, or null when the body is not a usable day. */
export function mapDailyFixDay(payload: unknown, requestedIso: string): DailyFixDay | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.error === "string") return null;
  const date = asString(payload.date);
  if (date == null) return null;
  const belly = mapBelly(payload.belly);
  const body = mapBody(payload.body);
  const brain = mapBrain(payload.brain);
  if (!belly || !body || !brain) return null;
  const day: DailyFixDay = { date, belly, body, brain };
  if (date !== requestedIso) {
    day.requested_date = requestedIso;
  }
  return day;
}

/**
 * Load one Daily Fix day from the BFF.
 * Never invents sample days. A 503 or unusable body is unavailable, not invalid.
 */
export async function fetchDailyFixDay(
  isoDate: string,
  signal?: AbortSignal,
): Promise<Exclude<DailyFixLoadState, { status: "invalid" | "loading" }>> {
  try {
    const response = await fetch(dailyFixRequestUrl(isoDate), {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { status: "unavailable" };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { status: "unavailable" };
    }
    const day = mapDailyFixDay(payload, isoDate);
    if (!day) return { status: "unavailable" };
    return { status: "loaded", day };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
}

/** ISO date to fetch for a resolved route. Invalid routes never fetch. */
export function fetchIsoForRoute(
  kind: "today" | "day" | "invalid",
  routeIso: string | null,
  todayIso: string,
): string | null {
  if (kind === "today") return todayIso;
  if (kind === "day" && routeIso) return routeIso;
  return null;
}
