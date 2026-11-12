import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  QUERY_MAX,
} from "./constants";
import type { LibraryResource, LibrarySearchBody } from "./types";

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;
const OFFSET_RE = /^(0|[1-9][0-9]{0,4})$/;
const TERM_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export type ExclusiveAccessLevel = {
  id: number;
  name: string;
  slug: string;
};

/**
 * Upstream query for the BSI dashboard exclusive-only catalog.
 * Always asks for `exclusive_resource` (posts and pages with exclusive_content
 * set). Optional access-level ids match the dashboard control
 * "Show only resources exclusive to the selected access level(s)."
 */
export function buildExclusiveFeedQuery(
  searchParams: URLSearchParams,
): string | null {
  const out = new URLSearchParams();
  const query = searchParams.get("query");
  if (query != null) {
    const q = query.trim();
    if (q.length > QUERY_MAX) return null;
    if (q) out.set("query", q);
  }

  const limitRaw = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw != null) {
    if (!/^[1-9][0-9]{0,2}$/.test(limitRaw)) return null;
    limit = Number(limitRaw);
    if (limit < 1 || limit > MAX_LIMIT) return null;
  }
  out.set("limit", String(limit));

  const offsetRaw = searchParams.get("offset");
  let offset = 0;
  if (offsetRaw != null) {
    if (!OFFSET_RE.test(offsetRaw)) return null;
    offset = Number(offsetRaw);
    if (offset < 0 || offset > MAX_OFFSET) return null;
  }
  out.set("offset", String(offset));

  out.append("content_types[]", "exclusive_resource");

  const seen = new Set<string>();
  for (const v of [
    ...searchParams.getAll("content_access[]"),
    ...searchParams.getAll("content_access"),
  ]) {
    if (!POSITIVE_INT.test(v)) return null;
    if (seen.has(v)) continue;
    if (seen.size >= 24) return null;
    seen.add(v);
    out.append("content_access[]", v);
  }

  for (const v of [
    ...searchParams.getAll("content_type_terms[]"),
    ...searchParams.getAll("content_type_terms"),
  ]) {
    if (!TERM_RE.test(v)) return null;
    if (v.toLowerCase() === "daily_fix") return null;
    out.append("content_type_terms[]", v);
  }

  return out.toString();
}

/** Keep exclusive posts and pages. Drop Daily Fix, events, and courses. */
export function isExclusiveCatalogItem(resource: LibraryResource): boolean {
  if (resource.daily_fix_date) return false;
  if (
    resource.type === "daily_fix" ||
    resource.type === "event" ||
    resource.type === "course"
  ) {
    return false;
  }
  if (resource.type === "exclusive_resource") return true;
  if (resource.type === "post" || resource.type === "page") {
    return resource.access.is_exclusive === true;
  }
  return false;
}

export function retainExclusiveCatalog(
  body: LibrarySearchBody,
): LibrarySearchBody {
  const resources = body.resources.filter(isExclusiveCatalogItem);
  return {
    resources,
    meta: { ...body.meta, count: resources.length },
  };
}

export function mapExclusiveAccessLevels(raw: unknown): ExclusiveAccessLevel[] {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const list = Array.isArray(raw)
    ? raw
    : obj && Array.isArray(obj.access_levels)
      ? obj.access_levels
      : [];
  const out: ExclusiveAccessLevel[] = [];
  const seen = new Set<number>();
  for (const row of list) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const id =
      typeof r.id === "number" && Number.isSafeInteger(r.id) && r.id > 0
        ? r.id
        : null;
    const name =
      typeof r.name === "string"
        ? r.name
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80)
        : "";
    const slug =
      typeof r.slug === "string" && TERM_RE.test(r.slug) ? r.slug : "";
    if (id == null || !name || !slug || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, slug });
  }
  return out;
}
