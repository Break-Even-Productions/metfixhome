import type { LibraryFilterTerm } from "./types";

/** Optional ordered topic override. The site passes none; tabs come from the library API. */
export type SearchTopicRow = {
  topic_id?: number;
  label?: string;
};

/** Resolved topic tab (All is UI chrome, not in this list). */
export type SearchTab = {
  topicId: number;
  label: string;
};

function positiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/**
 * Optional override rows first (given order), then API topics (API order),
 * deduped by topic_id (first wins — an override label replaces the API name).
 * The site passes an empty override list. Both empty → []. No hardcoded defaults.
 */
export function resolveSearchTabs(
  overrideRows: SearchTopicRow[] | null | undefined,
  apiTopics: LibraryFilterTerm[] | null | undefined,
): SearchTab[] {
  const out: SearchTab[] = [];
  const seen = new Set<number>();

  for (const row of overrideRows ?? []) {
    if (!row || !positiveInt(row.topic_id)) continue;
    if (seen.has(row.topic_id)) continue;
    seen.add(row.topic_id);
    const label =
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : `Topic ${row.topic_id}`;
    out.push({ topicId: row.topic_id, label });
  }

  for (const t of apiTopics ?? []) {
    if (!t || !positiveInt(t.id)) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const label =
      typeof t.name === "string" && t.name.trim()
        ? t.name.trim()
        : typeof t.slug === "string" && t.slug.trim()
          ? t.slug.trim()
          : `Topic ${t.id}`;
    out.push({ topicId: t.id, label });
  }

  return out;
}

/** Search content-type pills (SR5) — slugs from CONTENT_TYPE_CHIPS, labels overridden. */
export const SEARCH_TYPE_PILLS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "videos", label: "Videos" },
  { slug: "articles", label: "Articles" },
  { slug: "webinars", label: "Live Streams" },
  { slug: "infographic", label: "Infographics" },
];

const PILL_SLUGS = new Set(SEARCH_TYPE_PILLS.map((p) => p.slug));

export function isSearchTypePillSlug(slug: string): boolean {
  return PILL_SLUGS.has(slug);
}
