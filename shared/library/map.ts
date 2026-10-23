import { decodeHtmlEntitiesOnce, stripTags } from "../daily-fix/text";
import { sanitizeHtml } from "../posts/sanitize";
import {
  BSI_ORIGIN,
  EXCERPT_MAX,
  IMAGE_HOST,
  RESOURCE_TYPES,
  TITLE_MAX,
  type ResourceType,
} from "./constants";
import { mapAccessDisplay } from "./access";
import type {
  LibraryCompositeThumbnail,
  LibraryDetail,
  LibraryDetailBody,
  LibraryFilterTerm,
  LibraryFiltersBody,
  LibraryResource,
  LibrarySearchBody,
  TermRef,
} from "./types";

const DAILY_FIX_UPSTREAM_TYPES = new Set([
  "daily_fix",
  "daily_fix_mod",
  "daily_fix_workout",
  "daily_fix_thought",
]);

function truncateCodePoints(input: string, max: number): string {
  const chars = Array.from(input);
  if (chars.length <= max) return input;
  return chars.slice(0, max).join("");
}

function mapTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (Array.from(trimmed).length > TITLE_MAX) return null;
  return trimmed;
}

function mapExcerpt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const plain = decodeHtmlEntitiesOnce(stripTags(raw));
  return truncateCodePoints(plain, EXCERPT_MAX);
}

function mapDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function mapId(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) return null;
  return raw;
}

function hasExplicitPort(raw: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^/@]+@)?[^/:]+:\d+/.test(raw);
}

function allowlistedHttpsUrl(
  raw: string,
  opts: { resolveRelative: boolean; host?: string },
): string | null {
  if (hasExplicitPort(raw)) return null;
  if (raw.startsWith("//")) return null;
  if (opts.resolveRelative && !raw.startsWith("/") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    return null;
  }
  const host = opts.host ?? IMAGE_HOST;
  try {
    const url = opts.resolveRelative ? new URL(raw, `${BSI_ORIGIN}/`) : new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    if (url.port !== "") return null;
    if (url.hostname !== host) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function mapImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return allowlistedHttpsUrl(raw, { resolveRelative: true });
}

export function mapPermalink(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  return allowlistedHttpsUrl(raw, { resolveRelative: false });
}

function mapAuthor(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const name = (raw as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function mapTerms(raw: unknown): TermRef[] {
  if (!Array.isArray(raw)) return [];
  const out: TermRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id = mapId(rec.id);
    if (id == null) continue;
    if (typeof rec.name !== "string" || typeof rec.slug !== "string") continue;
    out.push({ id, name: rec.name, slug: rec.slug });
  }
  return out;
}

function mapType(raw: unknown): ResourceType | null {
  if (typeof raw !== "string") return null;
  return (RESOURCE_TYPES as readonly string[]).includes(raw)
    ? (raw as ResourceType)
    : null;
}

/** BSI Daily Fix rows often arrive as type "post" with daily_fix_date set. */
function mapDailyFixDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const ms = Date.parse(`${raw}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return raw;
}

/**
 * Pull allowlisted img srcs from BSI's composite_thumbnail_html.
 * Never forward the HTML itself — rebuild the layout in React/CSS.
 */
export function mapCompositeThumbnail(raw: unknown): LibraryCompositeThumbnail | null {
  if (typeof raw !== "string" || !raw.includes("bsi-dfx-composite-thumbnail")) {
    return null;
  }
  const layerSrc = (layer: "left" | "right" | "middle"): string | null => {
    const re = new RegExp(
      `bsi-dfx-composite-layer-${layer}[^>]*>\\s*<img\\b[^>]*\\bsrc=["']([^"']+)["']`,
      "i",
    );
    const m = raw.match(re);
    return m?.[1] ? mapImageUrl(m[1]) : null;
  };
  const brain = layerSrc("left");
  const belly = layerSrc("right");
  const body = layerSrc("middle");
  if (!brain && !belly && !body) return null;
  return { brain, belly, body };
}

/** Map one BSI search / list resource. */
export function mapLibraryResource(raw: unknown): LibraryResource | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;

  const id = mapId(item.id);
  if (id == null) return null;
  const dailyFixDate = mapDailyFixDate(item.daily_fix_date);
  const upstreamType = typeof item.type === "string" ? item.type : "";
  // Prefer Daily Fix when the day key / DF subtype is present — upstream often labels these as post.
  let type = mapType(item.type) ?? (item.post_type === "page" ? "page" : "post");
  if (
    dailyFixDate ||
    item.post_type === "daily_fix" ||
    type === "daily_fix" ||
    DAILY_FIX_UPSTREAM_TYPES.has(upstreamType)
  ) {
    type = "daily_fix";
  }
  const title = mapTitle(item.title);
  if (title == null) return null;
  const date =
    mapDate(item.date) ??
    (dailyFixDate ? `${dailyFixDate}T12:00:00.000Z` : null) ??
    new Date(0).toISOString();

  const access = mapAccessDisplay(item.content_access_display);
  if (item.is_exclusive === true) {
    access.is_exclusive = true;
    access.has_content_access = true;
  }

  const composite = mapCompositeThumbnail(item.composite_thumbnail_html);

  const resource: LibraryResource = {
    id,
    type,
    title,
    excerpt: mapExcerpt(item.excerpt),
    date,
    image: mapImageUrl(item.featured_image),
    permalink: mapPermalink(item.permalink),
    author: mapAuthor(item.author),
    categories: mapTerms(item.categories),
    topics: mapTerms(item.topics),
    content_types: mapTerms(item.content_types),
    access,
  };

  if (dailyFixDate) {
    resource.daily_fix_date = dailyFixDate;
  }
  if (composite) {
    resource.composite = composite;
  }

  return resource;
}

function mapResourceList(list: unknown[]): LibraryResource[] {
  const seen = new Set<string>();
  const resources: LibraryResource[] = [];
  for (const item of list) {
    const mapped = mapLibraryResource(item);
    if (!mapped) continue;
    const key = `${mapped.type}:${mapped.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resources.push(mapped);
  }
  return resources;
}

export function mapSearchResponse(raw: unknown): LibrarySearchBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const list = Array.isArray(body.resources)
    ? body.resources
    : Array.isArray(body.items)
      ? body.items
      : null;
  if (!list) return null;
  if (!body.meta || typeof body.meta !== "object" || Array.isArray(body.meta)) return null;
  const meta = body.meta as Record<string, unknown>;

  const total =
    typeof meta.total === "number" && Number.isInteger(meta.total) && meta.total >= 0
      ? meta.total
      : typeof meta.count === "number" && Number.isInteger(meta.count) && meta.count >= 0
        ? meta.count
        : null;
  if (total == null) return null;

  const limit =
    typeof meta.limit === "number" && Number.isInteger(meta.limit) && meta.limit > 0
      ? meta.limit
      : 20;
  const offset =
    typeof meta.offset === "number" && Number.isInteger(meta.offset) && meta.offset >= 0
      ? meta.offset
      : 0;

  const resources = mapResourceList(list);

  const has_more =
    typeof meta.has_more === "boolean"
      ? meta.has_more
      : offset + resources.length < total;

  return {
    resources,
    meta: {
      total,
      count: resources.length,
      limit,
      offset,
      has_more,
    },
  };
}

/**
 * BSI GET /resources/popular — by avada_post_views_count (then date).
 * Prefers paginated meta (`offset`, `total`, `has_more`) when present; otherwise
 * treats a full page as possibly having more (client stops if a page adds nothing).
 */
export function mapPopularResponse(
  raw: unknown,
  opts?: { offset?: number; limit?: number },
): LibrarySearchBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.resources)) return null;
  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : {};
  const resources = mapResourceList(body.resources);
  const limit =
    typeof meta.limit === "number" && Number.isInteger(meta.limit) && meta.limit > 0
      ? meta.limit
      : opts?.limit && opts.limit > 0
        ? opts.limit
        : resources.length || 20;
  const offset =
    typeof meta.offset === "number" && Number.isInteger(meta.offset) && meta.offset >= 0
      ? meta.offset
      : opts?.offset && opts.offset >= 0
        ? opts.offset
        : 0;
  const total =
    typeof meta.total === "number" && Number.isInteger(meta.total) && meta.total >= 0
      ? meta.total
      : null;
  const has_more =
    typeof meta.has_more === "boolean"
      ? meta.has_more
      : total != null
        ? offset + resources.length < total
        : resources.length >= limit;
  return {
    resources,
    meta: {
      total: total ?? offset + resources.length,
      count: resources.length,
      limit,
      offset,
      has_more,
    },
  };
}

function mapFilterTerms(raw: unknown): LibraryFilterTerm[] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryFilterTerm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id = mapId(rec.id);
    if (id == null) continue;
    if (typeof rec.name !== "string" || typeof rec.slug !== "string") continue;
    const term: LibraryFilterTerm = { id, name: rec.name, slug: rec.slug };
    if (typeof rec.count === "number" && Number.isInteger(rec.count)) {
      term.count = rec.count;
    }
    out.push(term);
  }
  return out;
}

/** Flatten categories-for-filter / topics / content-type-terms payloads. */
export function mapFiltersPayload(parts: {
  topics?: unknown;
  content_type_terms?: unknown;
  categories?: unknown;
}): LibraryFiltersBody {
  const topicsRaw =
    parts.topics && typeof parts.topics === "object" && !Array.isArray(parts.topics)
      ? (parts.topics as Record<string, unknown>).topics ?? parts.topics
      : parts.topics;
  const ctRaw =
    parts.content_type_terms &&
    typeof parts.content_type_terms === "object" &&
    !Array.isArray(parts.content_type_terms)
      ? (parts.content_type_terms as Record<string, unknown>).content_type_terms ??
        (parts.content_type_terms as Record<string, unknown>).terms ??
        parts.content_type_terms
      : parts.content_type_terms;
  const catRaw =
    parts.categories && typeof parts.categories === "object" && !Array.isArray(parts.categories)
      ? (parts.categories as Record<string, unknown>).categories ?? parts.categories
      : parts.categories;

  let categories: LibraryFilterTerm[] = [];
  if (Array.isArray(catRaw)) {
    categories = mapFilterTerms(catRaw);
  } else if (catRaw && typeof catRaw === "object") {
    for (const v of Object.values(catRaw as Record<string, unknown>)) {
      categories = categories.concat(mapFilterTerms(v));
    }
  }

  return {
    topics: mapFilterTerms(topicsRaw),
    content_type_terms: mapFilterTerms(ctRaw),
    categories,
  };
}

/**
 * Map BSI post / exclusive detail into LibraryDetail.
 * When access is none / upstream omitted body → locked.
 */
export function mapDetailFromPostLike(
  raw: unknown,
  fallbackType: ResourceType,
): LibraryDetail | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const base = mapLibraryResource({ ...item, type: item.type ?? fallbackType });
  if (!base) return null;

  const access = base.access;
  const locked = access.access === "none";
  const contentRaw = typeof item.content === "string" ? item.content : "";
  const content = locked ? "" : sanitizeHtml(contentRaw);
  const video =
    !locked && typeof item.video === "string" && item.video
      ? allowlistedHttpsUrl(item.video, { resolveRelative: true })
      : null;

  return {
    ...base,
    content,
    video,
    locked,
  };
}

export function mapDetailBody(
  raw: unknown,
  fallbackType: ResourceType,
): LibraryDetailBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const postLike = body.post ?? body.resource ?? body;
  const mapped = mapDetailFromPostLike(postLike, fallbackType);
  if (!mapped) return null;
  return { resource: mapped };
}

/** Locked shell when BSI returns 404 for access:none (list still had the card). */
export function lockedDetailShell(
  partial: Pick<LibraryResource, "id" | "type" | "title"> &
    Partial<Omit<LibraryResource, "id" | "type" | "title">>,
): LibraryDetail {
  const access = partial.access ?? mapAccessDisplay({ access: "none", is_exclusive: true, has_content_access: true });
  return {
    id: partial.id,
    type: partial.type,
    title: partial.title,
    excerpt: partial.excerpt ?? "",
    date: partial.date ?? new Date(0).toISOString(),
    image: partial.image ?? null,
    permalink: partial.permalink ?? null,
    author: partial.author ?? null,
    categories: partial.categories ?? [],
    topics: partial.topics ?? [],
    content_types: partial.content_types ?? [],
    access: { ...access, access: "none" },
    content: "",
    video: null,
    locked: true,
  };
}
