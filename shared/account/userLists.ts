/**
 * MetFix app lists (`metfix/v1/lists`), distinct from shopping lists and favorites.
 * Field allowlist: never forward post HTML bodies.
 */

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;
const SHARE_TOKEN_RE = /^[a-f0-9]{32}$/;

export const LIST_VISIBILITIES = [
  "private",
  "public",
  "affiliate",
  "unlisted",
  "invite_only",
] as const;

export type ListVisibility = (typeof LIST_VISIBILITIES)[number];

export const LIST_SOURCE_TYPES = [
  "daily_mod",
  "custom_recipe",
  "daily_workout",
  "custom_workout",
  "daily_article",
  "post",
  "meal_plan",
  "plan",
] as const;

export type ListSourceType = (typeof LIST_SOURCE_TYPES)[number];

export type UserListDto = {
  id: number;
  title: string;
  description: string | null;
  excerpt: string | null;
  visibility: ListVisibility;
  cover_image_url: string | null;
  item_count: number;
  share_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  list_relationship: "owner" | "subscriber" | null;
  owner_display_name: string | null;
  owner_user_id: number | null;
  subscribed_at: string | null;
  access_mode: "free" | "paid" | null;
  price: number | null;
  currency: string | null;
  marketplace_listing_id: number | null;
  web_url: string | null;
  access_status: "owner" | "subscribed" | "available" | null;
};

export type UserListItemDto = {
  id: number;
  list_id: number;
  note: string | null;
  sort_order: number;
  content: {
    source_type: string;
    source_id: number;
    title: string;
    excerpt: string | null;
    photo_url: string | null;
    article_url: string | null;
    video_url: string | null;
    recipe_url: string | null;
    url: string | null;
  };
};

export type ListsPageDto = {
  lists: UserListDto[];
  meta: { count: number; total: number; limit: number; offset: number };
};

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false };

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

export function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t.startsWith("https://") || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function positiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) return v;
  if (typeof v === "string" && POSITIVE_INT.test(v)) return Number(v);
  return null;
}

function nonNegInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000) {
    return v;
  }
  return null;
}

function stamp(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > 40) return null;
  return t;
}

export function parseListIndexQuery(
  searchParams: URLSearchParams,
  opts?: { visibility?: boolean },
): Ok<string> | Fail {
  const limitRaw = searchParams.get("limit");
  let limit = 20;
  if (limitRaw != null && limitRaw !== "") {
    if (!/^[1-9][0-9]{0,2}$/.test(limitRaw)) return { ok: false };
    limit = Number(limitRaw);
    if (limit < 1 || limit > 100) return { ok: false };
  }
  const offsetRaw = searchParams.get("offset");
  let offset = 0;
  if (offsetRaw != null && offsetRaw !== "") {
    if (!/^(0|[1-9][0-9]{0,5})$/.test(offsetRaw)) return { ok: false };
    offset = Number(offsetRaw);
    if (offset > 10000) return { ok: false };
  }
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (opts?.visibility) {
    const vis = searchParams.get("visibility");
    if (vis != null && vis !== "") {
      if (!(LIST_VISIBILITIES as readonly string[]).includes(vis)) {
        return { ok: false };
      }
      params.set("visibility", vis);
    }
  }
  return { ok: true, value: params.toString() };
}

export function parseShareToken(raw: string | null): Ok<string | null> | Fail {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (!SHARE_TOKEN_RE.test(raw)) return { ok: false };
  return { ok: true, value: raw };
}

export function shapeUserList(raw: unknown): UserListDto | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = positiveInt(obj.id);
  const title = plain(obj.title, 200);
  if (id == null || !title) return null;
  const visibilityRaw = typeof obj.visibility === "string" ? obj.visibility : "private";
  const visibility = (LIST_VISIBILITIES as readonly string[]).includes(visibilityRaw)
    ? (visibilityRaw as ListVisibility)
    : "private";
  const owner = asRecord(obj.owner);
  const relationship =
    obj.list_relationship === "owner" || obj.list_relationship === "subscriber"
      ? obj.list_relationship
      : obj.access_status === "owner"
        ? "owner"
        : obj.access_status === "subscribed"
          ? "subscriber"
          : null;
  const accessStatus =
    obj.access_status === "owner" ||
    obj.access_status === "subscribed" ||
    obj.access_status === "available"
      ? obj.access_status
      : null;
  const share =
    typeof obj.share_token === "string" && SHARE_TOKEN_RE.test(obj.share_token)
      ? obj.share_token
      : null;
  const accessMode =
    obj.access_mode === "free" || obj.access_mode === "paid" ? obj.access_mode : null;
  const currency =
    typeof obj.currency === "string" && /^[A-Za-z]{3}$/.test(obj.currency)
      ? obj.currency.toUpperCase()
      : null;
  return {
    id,
    title,
    description: plain(obj.description, 2000),
    excerpt: plain(obj.excerpt, 280),
    visibility,
    cover_image_url: httpsUrl(obj.cover_image_url),
    item_count: nonNegInt(obj.item_count) ?? 0,
    share_token: share,
    created_at: stamp(obj.created_at),
    updated_at: stamp(obj.updated_at),
    list_relationship: relationship,
    owner_display_name:
      plain(obj.owner_display_name, 120) ??
      plain(owner?.display_name, 120) ??
      plain(owner?.name, 120),
    owner_user_id: positiveInt(obj.owner_user_id),
    subscribed_at: stamp(obj.subscribed_at),
    access_mode: accessMode,
    price: typeof obj.price === "number" && Number.isFinite(obj.price) ? obj.price : null,
    currency,
    marketplace_listing_id: positiveInt(obj.marketplace_listing_id),
    web_url: httpsUrl(obj.web_url),
    access_status: accessStatus,
  };
}

export function shapeListsPayload(json: unknown): ListsPageDto | null {
  const obj = asRecord(json);
  if (!obj || !Array.isArray(obj.lists)) return null;
  const lists = obj.lists
    .map((row) => shapeUserList(row))
    .filter((row): row is UserListDto => row != null);
  const meta = asRecord(obj.meta) ?? {};
  return {
    lists,
    meta: {
      count: lists.length,
      total: nonNegInt(meta.total) ?? lists.length,
      limit: nonNegInt(meta.limit) ?? lists.length,
      offset: nonNegInt(meta.offset) ?? 0,
    },
  };
}

export function shapeListEnvelope(json: unknown): { list: UserListDto } | null {
  const obj = asRecord(json);
  const row = shapeUserList(obj?.list ?? json);
  if (!row) return null;
  return { list: row };
}

export function shapeListItem(raw: unknown): UserListItemDto | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = positiveInt(obj.id);
  if (id == null) return null;
  const content = asRecord(obj.content) ?? {};
  const sourceType =
    typeof content.source_type === "string" && /^[a-z_]{1,40}$/.test(content.source_type)
      ? content.source_type
      : "post";
  const sourceId = positiveInt(content.source_id) ?? positiveInt(obj.item_id);
  if (sourceId == null) return null;
  const title = plain(content.title, 300) ?? "Untitled";
  return {
    id,
    list_id: positiveInt(obj.list_id) ?? 0,
    note: plain(obj.note, 500),
    sort_order: nonNegInt(obj.sort_order) ?? 0,
    content: {
      source_type: sourceType,
      source_id: sourceId,
      title,
      excerpt: plain(content.excerpt, 280),
      photo_url: httpsUrl(content.photo_url),
      article_url: httpsUrl(content.article_url),
      video_url: httpsUrl(content.video_url),
      recipe_url: httpsUrl(content.recipe_url),
      url: httpsUrl(content.url),
    },
  };
}

export function shapeItemsPayload(
  json: unknown,
): { list_id: number | null; items: UserListItemDto[]; count: number } | null {
  const obj = asRecord(json);
  if (!obj || !Array.isArray(obj.items)) return null;
  const items = obj.items
    .map((row) => shapeListItem(row))
    .filter((row): row is UserListItemDto => row != null);
  return {
    list_id: positiveInt(obj.list_id),
    items,
    count: items.length,
  };
}

export function shapeListItemEnvelope(json: unknown): { list_item: UserListItemDto } | null {
  const obj = asRecord(json);
  const row = shapeListItem(obj?.list_item ?? json);
  if (!row) return null;
  return { list_item: row };
}

function visibilityOf(v: unknown): ListVisibility | null {
  if (typeof v !== "string") return null;
  if (!(LIST_VISIBILITIES as readonly string[]).includes(v)) return null;
  return v as ListVisibility;
}

export function parseCreateListBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  const obj = asRecord(json);
  if (!obj) return { ok: false };
  const title = plain(obj.title, 200);
  if (!title) return { ok: false };
  const visibility = visibilityOf(obj.visibility ?? "private");
  if (!visibility) return { ok: false };
  const body: Record<string, unknown> = { title, visibility };
  const description = plain(obj.description, 2000);
  if (description) body.description = description;
  return { ok: true, value: body };
}

export function parseUpdateListBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  const obj = asRecord(json);
  if (!obj) return { ok: false };
  const body: Record<string, unknown> = {};
  if ("title" in obj) {
    const title = plain(obj.title, 200);
    if (!title) return { ok: false };
    body.title = title;
  }
  if ("description" in obj) {
    body.description = plain(obj.description, 2000) ?? "";
  }
  if ("visibility" in obj) {
    const visibility = visibilityOf(obj.visibility);
    if (!visibility) return { ok: false };
    body.visibility = visibility;
  }
  if (Object.keys(body).length === 0) return { ok: false };
  return { ok: true, value: body };
}

export function parseAddListItemBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  const obj = asRecord(json);
  if (!obj) return { ok: false };
  const sourceType = obj.source_type;
  if (
    typeof sourceType !== "string" ||
    !(LIST_SOURCE_TYPES as readonly string[]).includes(sourceType)
  ) {
    return { ok: false };
  }
  const sourceId = positiveInt(obj.source_id);
  if (sourceId == null) return { ok: false };
  const body: Record<string, unknown> = {
    source_type: sourceType,
    source_id: sourceId,
  };
  if ("note" in obj && obj.note != null && obj.note !== "") {
    const note = plain(obj.note, 500);
    if (!note) return { ok: false };
    body.note = note;
  }
  if ("sort_order" in obj && obj.sort_order != null) {
    const sort = nonNegInt(obj.sort_order);
    if (sort == null) return { ok: false };
    body.sort_order = sort;
  }
  return { ok: true, value: body };
}

export function parseReorderBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  const obj = asRecord(json);
  if (!obj || !Array.isArray(obj.item_orders)) return { ok: false };
  if (obj.item_orders.length < 1 || obj.item_orders.length > 200) return { ok: false };
  const item_orders: Array<{ id: number; sort_order: number }> = [];
  for (const row of obj.item_orders) {
    const rec = asRecord(row);
    if (!rec) return { ok: false };
    const id = positiveInt(rec.id);
    const sort = nonNegInt(rec.sort_order);
    if (id == null || sort == null) return { ok: false };
    item_orders.push({ id, sort_order: sort });
  }
  return { ok: true, value: { item_orders } };
}

export function parseItemUpdateBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  const obj = asRecord(json);
  if (!obj) return { ok: false };
  const body: Record<string, unknown> = {};
  if ("note" in obj) {
    if (obj.note == null || obj.note === "") body.note = "";
    else {
      const note = plain(obj.note, 500);
      if (!note) return { ok: false };
      body.note = note;
    }
  }
  if ("sort_order" in obj) {
    const sort = nonNegInt(obj.sort_order);
    if (sort == null) return { ok: false };
    body.sort_order = sort;
  }
  if (Object.keys(body).length === 0) return { ok: false };
  return { ok: true, value: body };
}

export function parseSubscribeBody(json: unknown): Ok<Record<string, unknown>> | Fail {
  if (json == null) return { ok: true, value: {} };
  const obj = asRecord(json);
  if (!obj) return { ok: false };
  if (obj.share_token == null || obj.share_token === "") {
    return { ok: true, value: {} };
  }
  if (typeof obj.share_token !== "string" || !SHARE_TOKEN_RE.test(obj.share_token)) {
    return { ok: false };
  }
  return { ok: true, value: { share_token: obj.share_token } };
}

export function shapeListPaymentRequired(json: unknown): {
  error: "payment_required";
  web_url: string | null;
  marketplace_listing_id: number | null;
} {
  const obj = asRecord(json);
  return {
    error: "payment_required",
    web_url: httpsUrl(obj?.web_url),
    marketplace_listing_id: positiveInt(obj?.marketplace_listing_id),
  };
}
