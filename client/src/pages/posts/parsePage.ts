import { MAX_PAGE, PAGE_RE } from "@shared/posts";

export type ParsedListPage = {
  /** Page number to fetch (always 1..MAX_PAGE; invalid → 1). */
  page: number;
  /** True when the raw `page` query was present but invalid (Q16). */
  invalid: boolean;
};

/**
 * Parse `?page=` from a search string (with or without leading `?`).
 * Absent → page 1. Invalid → page 1 + invalid flag (client fetches 1, replaceState).
 */
export function parseListPage(search: string): ParsedListPage {
  const rawSearch = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(rawSearch);
  const raw = params.get("page");
  if (raw == null) {
    return { page: 1, invalid: false };
  }
  if (!PAGE_RE.test(raw)) {
    return { page: 1, invalid: true };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE) {
    return { page: 1, invalid: true };
  }
  return { page: n, invalid: false };
}
