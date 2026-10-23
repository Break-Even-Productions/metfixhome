import {
  QUERY_MAX,
  isSearchTypePillSlug,
  type SearchTab,
} from "@shared/library";

export type SearchUrlState = {
  query: string;
  /** One SR5 pill slug, or null (All Types). */
  type: string | null;
  /**
   * Topic id from URL. null = All / cleared.
   * Unknown-but-valid ids (not in tab list) stay set and are sent (SR13 / QA r1.3).
   */
  topic: number | null;
};

export function parsePositiveTopicId(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

export function parseSearchUrl(search: string): SearchUrlState {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const query = (sp.get("query") ?? "").slice(0, QUERY_MAX);
  const typeRaw = sp.get("type");
  // SS13: only SR5 pill slugs are valid (whiteboards / chip-only → All).
  const type = typeRaw && isSearchTypePillSlug(typeRaw) ? typeRaw : null;
  const topic = parsePositiveTopicId(sp.get("topic"));
  return { query, type, topic };
}

/** Canonical sorted query string for resetKey (query, type, topic). */
export function canonicalSearchResetKey(state: SearchUrlState): string {
  const parts: string[] = [];
  if (state.query) parts.push(`query=${encodeURIComponent(state.query)}`);
  if (state.type) parts.push(`type=${encodeURIComponent(state.type)}`);
  if (state.topic != null) parts.push(`topic=${state.topic}`);
  parts.sort();
  return parts.join("&");
}

export function searchStateToSearchParams(state: SearchUrlState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.query) sp.set("query", state.query.slice(0, QUERY_MAX));
  if (state.type) sp.set("type", state.type);
  if (state.topic != null) sp.set("topic", String(state.topic));
  return sp;
}

export function pushSearchUrl(state: SearchUrlState, pathname = "/library/search") {
  const qs = searchStateToSearchParams(state).toString();
  const next = qs ? `${pathname}?${qs}` : pathname;
  const cur = `${window.location.pathname}${window.location.search}`;
  if (cur !== next) {
    window.history.pushState(null, "", next);
  }
}

export type SearchFetchParams = {
  query?: string;
  content_type_terms?: string[];
  topics?: number[];
};

export function stateToFetchParams(state: SearchUrlState): SearchFetchParams {
  const out: SearchFetchParams = {};
  if (state.query) out.query = state.query.slice(0, QUERY_MAX);
  if (state.type) out.content_type_terms = [state.type];
  if (state.topic != null) out.topics = [state.topic];
  return out;
}

/**
 * Active tab for aria-selected.
 * QA r1.3 / SR13: unknown topic id → no tab selected (not All).
 */
export function activeTabKey(
  state: SearchUrlState,
  tabs: SearchTab[],
): "all" | "none" | { topicId: number } {
  if (state.topic == null) return "all";
  const hit = tabs.find((t) => t.topicId === state.topic);
  if (hit) return { topicId: hit.topicId };
  return "none";
}

export function isPillPressed(
  pillSlug: string | null,
  state: SearchUrlState,
): boolean {
  if (pillSlug == null) return state.type == null;
  return state.type === pillSlug;
}

export function countLineText(opts: {
  n: number;
  query: string;
  tabLabel: string | null;
}): string {
  const noun = opts.n === 1 ? "resource" : "resources";
  let text = `${opts.n} ${noun}`;
  if (opts.query) text += ` for "${opts.query}"`;
  if (opts.tabLabel) text += ` in ${opts.tabLabel}`;
  return text;
}

export function activeTabLabel(
  state: SearchUrlState,
  tabs: SearchTab[],
): string | null {
  const key = activeTabKey(state, tabs);
  if (key === "all" || key === "none") return null;
  return tabs.find((t) => t.topicId === key.topicId)?.label ?? null;
}

/** E3: tab keeps pill. */
export function selectTopicTab(prev: SearchUrlState, topicId: number): SearchUrlState {
  return { ...prev, topic: topicId };
}

export function selectAllTab(prev: SearchUrlState): SearchUrlState {
  return { ...prev, topic: null };
}

/** E3: pill keeps tab. */
export function selectPill(prev: SearchUrlState, slug: string | null): SearchUrlState {
  return { ...prev, type: slug };
}

export function clearAllFilters(): SearchUrlState {
  return { query: "", type: null, topic: null };
}
