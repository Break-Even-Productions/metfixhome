import {
  WHEEL_RECIPES_BFF_PATH,
  wheelRecipesQueryString,
  type WheelRecipe,
  type WheelRecipesQuery,
  type WheelRecipesResponse,
} from "@shared/daily-fix/wheel";

export { WHEEL_RECIPES_BFF_PATH, recipeHrefFromLastUsed } from "@shared/daily-fix/wheel";

export type WheelLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; recipes: WheelRecipe[]; proteins: { id: number; name: string }[] }
  | { status: "error" };

function adaptRecipe(raw: unknown): WheelRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "number" ? r.id : Number(r.id);
  if (!Number.isFinite(id)) return null;
  const proteinRaw = r.protein && typeof r.protein === "object" ? (r.protein as Record<string, unknown>) : null;
  const macrosRaw = r.macros && typeof r.macros === "object" ? (r.macros as Record<string, unknown>) : null;
  const assetsRaw = r.assets && typeof r.assets === "object" ? (r.assets as Record<string, unknown>) : null;
  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id,
    last_used: typeof r.last_used === "string" ? r.last_used : null,
    title: typeof r.title === "string" ? r.title : "",
    excerpt: typeof r.excerpt === "string" ? r.excerpt : "",
    protein: {
      id: proteinRaw ? numOrNull(proteinRaw.id) : null,
      name: proteinRaw && typeof proteinRaw.name === "string" ? proteinRaw.name : null,
    },
    macros: {
      fat: macrosRaw ? numOrNull(macrosRaw.fat) : null,
      carb: macrosRaw ? numOrNull(macrosRaw.carb ?? macrosRaw.carbs) : null,
      protein: macrosRaw ? numOrNull(macrosRaw.protein) : null,
    },
    assets: assetsRaw
      ? {
          low: typeof assetsRaw.low === "string" ? assetsRaw.low : null,
          high: typeof assetsRaw.high === "string" ? assetsRaw.high : null,
          alt: typeof assetsRaw.alt === "string" ? assetsRaw.alt : "",
        }
      : null,
  };
}

export function parseWheelRecipesPayload(json: unknown): WheelRecipesResponse {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const list = Array.isArray(root.recipes) ? root.recipes : [];
  const recipes = list.map(adaptRecipe).filter((r): r is WheelRecipe => r != null);
  const metaRaw = root.meta && typeof root.meta === "object" ? (root.meta as Record<string, unknown>) : {};
  return {
    recipes,
    meta: {
      count: typeof metaRaw.count === "number" ? metaRaw.count : recipes.length,
      limit: typeof metaRaw.limit === "number" ? metaRaw.limit : 12,
      excluded: typeof metaRaw.excluded === "number" ? metaRaw.excluded : null,
      protein_ids: Array.isArray(metaRaw.protein_ids)
        ? metaRaw.protein_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [],
      wheel_size: typeof metaRaw.wheel_size === "string" ? metaRaw.wheel_size : undefined,
    },
  };
}

export function proteinsFromRecipes(recipes: WheelRecipe[]): { id: number; name: string }[] {
  const byId = new Map<number, string>();
  for (const r of recipes) {
    const id = r.protein.id;
    const name = r.protein.name?.trim();
    if (id != null && id > 0 && name) byId.set(id, name);
  }
  return Array.from(byId.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeProteins(
  existing: { id: number; name: string }[],
  next: { id: number; name: string }[],
): { id: number; name: string }[] {
  const byId = new Map(existing.map((p) => [p.id, p.name]));
  for (const p of next) byId.set(p.id, p.name);
  return Array.from(byId.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadWheelRecipes(
  query: WheelRecipesQuery = {},
  signal?: AbortSignal,
): Promise<WheelRecipesResponse> {
  const qs = wheelRecipesQueryString(query);
  const res = await fetch(`${WHEEL_RECIPES_BFF_PATH}?${qs}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`wheel_recipes_${res.status}`);
  const json: unknown = await res.json();
  return parseWheelRecipesPayload(json);
}
