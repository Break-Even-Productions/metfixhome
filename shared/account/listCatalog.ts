/**
 * Picker rows for custom recipes and owned custom workouts.
 * Titles only — recipe lines and workout structure stay upstream.
 */

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false };

export type CatalogHit = {
  id: number;
  title: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function plain(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const text = v
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.slice(0, max);
}

function positiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 1_000_000_000) {
    return v;
  }
  return null;
}

export function parseCatalogQuery(params: URLSearchParams): Ok<string> | Fail {
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");
  let limit = 50;
  let offset = 0;
  if (limitRaw != null) {
    if (!/^[1-9][0-9]{0,2}$/.test(limitRaw)) return { ok: false };
    limit = Number(limitRaw);
    if (limit < 1 || limit > 100) return { ok: false };
  }
  if (offsetRaw != null) {
    if (!/^(0|[1-9][0-9]{0,4})$/.test(offsetRaw)) return { ok: false };
    offset = Number(offsetRaw);
    if (offset > 10000) return { ok: false };
  }
  return { ok: true, value: `limit=${limit}&offset=${offset}` };
}

export function shapeCatalog(
  json: unknown,
  key: "recipes" | "workouts",
): { items: CatalogHit[] } | null {
  const obj = asRecord(json);
  if (!obj || !Array.isArray(obj[key])) return null;
  const items: CatalogHit[] = [];
  for (const row of obj[key]) {
    const rec = asRecord(row);
    if (!rec) continue;
    const id = positiveInt(rec.id);
    const title = plain(rec.title, 300);
    if (id == null || !title) continue;
    items.push({ id, title });
  }
  return { items };
}
