import type {
  LibraryFiltersBody,
  LibraryResource,
  LibrarySearchBody,
} from "./types";

/** Topic and category slug for the Glassman rail. */
export const GLASSMAN_ARCHIVE_SLUG = "glassman-archive";

/**
 * Content-type slug for Book Library. Omitted from the merge until BSI
 * publishes a term with this slug or the name "Book Library".
 */
export const BOOK_LIBRARY_CONTENT_TYPE_SLUG = "book-library";

export type ArchiveLeg =
  | { kind: "topic"; id: number }
  | { kind: "category"; id: number }
  | { kind: "content-type"; slug: string };

function isBookLibraryContentType(slug: string, name: string): boolean {
  if (slug === BOOK_LIBRARY_CONTENT_TYPE_SLUG) return true;
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "book library";
}

/**
 * Legs for one merged archive search.
 * Topic and category are separate because BSI ANDs `topics[]` with `categories[]`
 * and rejects slugs there. Book Library is included only once the content type exists.
 */
export function archiveSearchLegs(filters: LibraryFiltersBody): ArchiveLeg[] {
  const legs: ArchiveLeg[] = [];
  const seen = new Set<string>();
  const push = (leg: ArchiveLeg) => {
    const key =
      leg.kind === "content-type"
        ? `content-type:${leg.slug}`
        : `${leg.kind}:${leg.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    legs.push(leg);
  };

  for (const topic of filters.topics) {
    if (topic.slug === GLASSMAN_ARCHIVE_SLUG)
      push({ kind: "topic", id: topic.id });
  }
  for (const category of filters.categories) {
    if (category.slug === GLASSMAN_ARCHIVE_SLUG)
      push({ kind: "category", id: category.id });
  }
  for (const term of filters.content_type_terms) {
    if (isBookLibraryContentType(term.slug, term.name)) {
      push({ kind: "content-type", slug: term.slug });
    }
  }
  return legs;
}

/**
 * Union of one page from each leg. Dedupe by type+id, newest first.
 * `meta.total` is the sum of leg totals (an upper bound when items overlap).
 * `has_more` is true when any leg has another page.
 */
export function mergeArchivePages(
  pages: LibrarySearchBody[],
  opts: { limit: number; offset: number },
): LibrarySearchBody {
  const seen = new Set<string>();
  const merged: LibraryResource[] = [];
  for (const page of pages) {
    for (const resource of page.resources) {
      const key = `${resource.type}:${resource.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(resource);
    }
  }
  merged.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    return a.id - b.id;
  });
  const total = pages.reduce((sum, page) => sum + page.meta.total, 0);
  return {
    resources: merged,
    meta: {
      total,
      count: merged.length,
      limit: opts.limit,
      offset: opts.offset,
      has_more: pages.some((page) => page.meta.has_more),
    },
  };
}
