/** Types for BSI `GET /metfix/v1/wheel/recipes` (proxied at `/api/daily-fix/wheel/recipes`). */

export type WheelProtein = {
  id: number | null;
  name: string | null;
};

export type WheelRecipeAssets = {
  low: string | null;
  high: string | null;
  alt: string;
};

export type WheelRecipe = {
  id: number;
  last_used: string | null;
  title: string;
  excerpt: string;
  protein: WheelProtein;
  macros: {
    fat: number | null;
    carb: number | null;
    protein: number | null;
  };
  assets: WheelRecipeAssets | null;
};

export type WheelRecipesResponse = {
  recipes: WheelRecipe[];
  meta: {
    count: number;
    limit: number;
    excluded: number | null;
    protein_ids: number[];
    wheel_size?: string;
  };
};

export type WheelRecipesQuery = {
  limit?: number;
  excludeId?: number | null;
  proteinIds?: number[];
};

/** Public BFF path (same-origin). */
export const WHEEL_RECIPES_BFF_PATH = "/api/daily-fix/wheel/recipes";

/** Dedicated Daily Fix wheel page. */
export const DAILY_FIX_WHEEL_PATH = "/the-daily-fix/wheel";

export function wheelRecipesQueryString(query: WheelRecipesQuery = {}): string {
  const params = new URLSearchParams();
  const limit = query.limit ?? 12;
  params.set("limit", String(Math.max(1, Math.min(40, limit))));
  if (query.excludeId != null && query.excludeId > 0) {
    params.set("exclude_id", String(query.excludeId));
  }
  if (query.proteinIds && query.proteinIds.length > 0) {
    params.set("protein_ids", query.proteinIds.join(","));
  }
  return params.toString();
}

/** Map YYMMDD from wheel `last_used` → Daily Fix belly URL on metfix.org. */
export function recipeHrefFromLastUsed(lastUsed: string | null | undefined): string | null {
  if (!lastUsed || !/^\d{6}$/.test(lastUsed)) return null;
  return `/the-daily-fix/${lastUsed}?tab=belly`;
}

export function isWheelPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
  return path === DAILY_FIX_WHEEL_PATH;
}
