import { RESOURCE_TYPES, type ResourceType } from "./constants";
import { isResourceVideo } from "./video";
import type {
  LibraryDetailBody,
  LibraryFilterTerm,
  LibraryFiltersBody,
  LibrarySearchBody,
} from "./types";

export function isResourceType(raw: string): raw is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(raw);
}

export function isLibrarySearchBody(raw: unknown): raw is LibrarySearchBody {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const b = raw as Record<string, unknown>;
  if (!Array.isArray(b.resources)) return false;
  if (!b.meta || typeof b.meta !== "object" || Array.isArray(b.meta)) return false;
  const m = b.meta as Record<string, unknown>;
  return (
    typeof m.total === "number" &&
    typeof m.count === "number" &&
    typeof m.limit === "number" &&
    typeof m.offset === "number" &&
    typeof m.has_more === "boolean"
  );
}

function isTermArray(raw: unknown): boolean {
  return Array.isArray(raw);
}

export function isLibraryDetailBody(raw: unknown): raw is LibraryDetailBody {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const b = raw as Record<string, unknown>;
  if (!b.resource || typeof b.resource !== "object" || Array.isArray(b.resource)) {
    return false;
  }
  const r = b.resource as Record<string, unknown>;
  if (
    typeof r.id !== "number" ||
    typeof r.type !== "string" ||
    typeof r.title !== "string" ||
    typeof r.content !== "string" ||
    typeof r.locked !== "boolean"
  ) {
    return false;
  }
  if (!(r.video === null || typeof r.video === "string" || isResourceVideo(r.video))) {
    return false;
  }
  if (!isTermArray(r.topics) || !isTermArray(r.categories) || !isTermArray(r.content_types)) {
    return false;
  }
  return true;
}

function isFilterTerm(raw: unknown): raw is LibraryFilterTerm {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== "number" || typeof t.name !== "string" || typeof t.slug !== "string") {
    return false;
  }
  if (!(t.description === null || typeof t.description === "string")) return false;
  if (!(t.image === null || typeof t.image === "string")) return false;
  return true;
}

export function isLibraryFiltersBody(raw: unknown): raw is LibraryFiltersBody {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const b = raw as Record<string, unknown>;
  if (
    !Array.isArray(b.topics) ||
    !Array.isArray(b.content_type_terms) ||
    !Array.isArray(b.categories)
  ) {
    return false;
  }
  return (
    b.topics.every(isFilterTerm) &&
    b.content_type_terms.every(isFilterTerm) &&
    b.categories.every(isFilterTerm)
  );
}
