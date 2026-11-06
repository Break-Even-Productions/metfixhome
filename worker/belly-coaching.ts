/**
 * Minimal coaching shapers for Belly plan-share (compatible with Body #41 hub shape).
 * Includes affiliate `role` so coach/delegate/owner gates work on web.
 */

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function finiteNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function posInt(v: unknown): number | null {
  const n = finiteNum(v);
  if (n == null || !Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function httpsOrNull(v: unknown): string | null {
  const s = clip(v, 500);
  if (!s || !s.startsWith("https://")) return null;
  return s;
}

function firstArray(obj: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!obj) return [];
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function personFrom(
  row: Record<string, unknown>,
  viewerIsCoach: boolean,
): { user_id: string; name: string | null; display_name: string | null } {
  const coach = asRecord(row.coach);
  const client = asRecord(row.client);
  const other = viewerIsCoach ? client : coach;
  const cp = asRecord(row.counterparty) ?? other ?? {};
  const uid =
    posInt(cp.user_id) ??
    posInt(cp.id) ??
    posInt(other?.user_id) ??
    posInt(other?.id) ??
    posInt(row.counterparty_user_id);
  const display =
    clip(cp.display_name, 120) ??
    clip(other?.display_name, 120) ??
    clip(row.display_name, 120);
  const name =
    clip(cp.name, 120) ?? display ?? clip(other?.name, 120) ?? clip(row.name, 120);
  return {
    user_id: uid != null ? String(uid) : "",
    name,
    display_name: display,
  };
}

const RELATIONSHIP_STATUS = new Set(["pending", "active", "declined", "ended"]);

function shapeRelationship(
  row: unknown,
  viewerIsCoach: boolean,
): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.id ?? r.relationship_id);
  if (!id) return null;
  const statusRaw = typeof r.status === "string" ? r.status : "active";
  const status = RELATIONSHIP_STATUS.has(statusRaw) ? statusRaw : "active";
  const invited = r.invited_by === "coach" || r.invited_by === "client" ? r.invited_by : null;
  return {
    id,
    status,
    invited_by: invited,
    viewer_is_coach: viewerIsCoach,
    counterparty: personFrom(r, viewerIsCoach),
  };
}

function shapeAffiliate(row: unknown): Record<string, unknown> | null {
  const r = asRecord(row);
  if (!r) return null;
  const id = posInt(r.affiliate_id ?? r.id);
  if (!id) return null;
  const name = clip(r.name, 160) ?? clip(r.display_name, 160) ?? "Gym";
  const count = finiteNum(r.member_count);
  const roleRaw = clip(r.role, 40);
  const role = roleRaw ? roleRaw.toLowerCase() : null;
  return {
    affiliate_id: id,
    name,
    role,
    logo: httpsOrNull(r.logo ?? r.logo_url),
    member_count: count != null && Number.isSafeInteger(count) && count >= 0 ? count : null,
    group_conversation_id: posInt(r.group_conversation_id),
  };
}

/** Same outer shape as Body #41 `shapeCoachingCoach`, plus affiliate.role. */
export function shapeBellyCoachingCoach(raw: unknown): Record<string, unknown> {
  const obj = asRecord(raw) ?? {};
  const affiliates = firstArray(obj, ["affiliates"])
    .map(shapeAffiliate)
    .filter((row): row is Record<string, unknown> => row != null)
    .slice(0, 40);
  const clients = firstArray(obj, ["clients", "relationships", "items", "data"])
    .map((row) => shapeRelationship(row, true))
    .filter((row): row is Record<string, unknown> => row != null)
    .slice(0, 80);
  return { affiliates, clients };
}

export function validatePlanWriteBody(
  raw: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const title = clip(obj.title, 200);
  if (!title) return { ok: false };
  const body: Record<string, unknown> = { title };
  const description = clip(obj.description, 4000);
  if (description != null) body.description = description;
  const duration = finiteNum(obj.duration_days);
  if (duration != null && Number.isSafeInteger(duration) && duration > 0 && duration <= 90) {
    body.duration_days = duration;
  }
  if (obj.visibility === "invite_only" || obj.visibility === "unlisted" || obj.visibility === "public") {
    body.visibility = obj.visibility;
  }
  if (obj.status === "draft" || obj.status === "published") {
    body.status = obj.status;
  }
  if (obj.replace_days === true || obj.replace_days === 1) {
    body.replace_days = true;
  }
  if (Array.isArray(obj.days)) {
    body.days = obj.days.slice(0, 90);
  }
  return { ok: true, body };
}

export function validateCustomRecipeBody(
  raw: unknown,
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false };
  const title = clip(obj.title, 200);
  if (!title) return { ok: false };
  const body: Record<string, unknown> = { title };
  const excerpt = clip(obj.excerpt ?? obj.description, 4000);
  if (excerpt != null) body.excerpt = excerpt;
  const photo = httpsOrNull(obj.photo_url ?? obj.image_url);
  if (photo != null) body.photo_url = photo;
  if (Array.isArray(obj.recipe_ingredients)) {
    body.recipe_ingredients = obj.recipe_ingredients.slice(0, 80);
  }
  if (typeof obj.ingredients_text === "string") {
    body.ingredients_text = obj.ingredients_text.slice(0, 8000);
  }
  if (Array.isArray(obj.recipe_steps)) {
    body.recipe_steps = obj.recipe_steps.slice(0, 60);
  }
  if (typeof obj.steps === "string") {
    body.steps = obj.steps.slice(0, 12000);
  }
  for (const key of ["protein_g", "fat_g", "carbs_g", "calories"] as const) {
    const n = finiteNum(obj[key]);
    if (n != null && n >= 0 && n <= 20000) body[key] = n;
  }
  const macros = asRecord(obj.macros_json ?? obj.macros);
  if (macros) {
    const shaped: Record<string, number> = {};
    for (const key of ["protein", "fat", "carbs", "calories"] as const) {
      const n = finiteNum(macros[key]);
      if (n != null && n >= 0 && n <= 20000) shaped[key] = n;
    }
    if (Object.keys(shaped).length > 0) body.macros_json = shaped;
  }
  return { ok: true, body };
}
