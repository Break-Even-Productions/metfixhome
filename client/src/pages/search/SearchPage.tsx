import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search as SearchIcon } from "lucide-react";
import {
  QUERY_MAX,
  SEARCH_TYPE_PILLS,
  buildLibraryHead,
  resolveSearchTabs,
  type LibraryResource,
  type SearchTab,
} from "@shared/library";
import { BackToTop } from "@/components/BackToTop";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useSiteSettings } from "@/hooks/useSanityContent";
import { JoinModal } from "@/pages/library/JoinModal";
import { ResourceCard } from "@/pages/library/ResourceCard";
import { getLibraryFilters } from "@/pages/library/filtersCache";
import { useInfiniteArchive } from "@/pages/library/useInfiniteArchive";
import "@/pages/library/library.css";
import {
  activeTabKey,
  activeTabLabel,
  canonicalSearchResetKey,
  clearAllFilters,
  countLineText,
  isPillPressed,
  parseSearchUrl,
  searchStateToSearchParams,
  selectAllTab,
  selectPill,
  selectTopicTab,
  stateToFetchParams,
  type SearchUrlState,
} from "./searchState";
import "./search.css";

export default function SearchPage() {
  const head = useMemo(() => buildLibraryHead({ kind: "hub" }), []);
  usePageMeta({
    title: "Search All Resources | MetFix Resource Library",
    description: head.description,
    robots: head.robots,
    canonical: "https://metfix.org/library/search",
    ogType: head.ogType,
    ogImage: head.ogImage,
    ogUrl: "https://metfix.org/library/search",
  });

  const { settings } = useSiteSettings();
  const [, setLocation] = useLocation();
  // N2/N4: URL state from wouter (subscribes to push/replace); no second mount read.
  const search = useSearch();
  const urlState = useMemo(() => parseSearchUrl(search), [search]);
  const [inputValue, setInputValue] = useState(urlState.query);
  const [tabs, setTabs] = useState<SearchTab[]>([]);
  const [locked, setLocked] = useState<LibraryResource | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setInputValue(urlState.query);
  }, [urlState.query]);

  useEffect(() => {
    const c = new AbortController();
    void getLibraryFilters(c.signal)
      .then((f) => {
        if (c.signal.aborted) return;
        setTabs(resolveSearchTabs(settings.searchTopics, f.topics));
      })
      .catch(() => {
        if (c.signal.aborted) return;
        setTabs(resolveSearchTabs(settings.searchTopics, []));
      });
    return () => c.abort();
  }, [settings.searchTopics]);

  const commitState = useCallback(
    (next: SearchUrlState) => {
      const qs = searchStateToSearchParams(next).toString();
      setLocation(qs ? `/library/search?${qs}` : "/library/search");
    },
    [setLocation],
  );

  const fetchParams = useMemo(() => stateToFetchParams(urlState), [urlState]);
  const resetKey = useMemo(
    () => `${canonicalSearchResetKey(urlState)}|${refresh}`,
    [urlState, refresh],
  );
  const archive = useMemo(
    () => ({ kind: "search" as const, params: fetchParams }),
    [fetchParams],
  );
  const infinite = useInfiniteArchive(true, archive, resetKey);

  const tabKey = activeTabKey(urlState, tabs);
  const tabLabel = activeTabLabel(urlState, tabs);
  const filtersActive = Boolean(urlState.query || urlState.type || urlState.topic != null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!infinite.hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) infinite.loadMore();
      },
      { rootMargin: "480px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [infinite.hasMore, infinite.loadMore, infinite.items.length]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = inputValue.trim().slice(0, QUERY_MAX);
    if (q === urlState.query) return;
    commitState({ ...urlState, query: q });
  }

  function onClearInput() {
    setInputValue("");
  }

  function onClearFilters() {
    setInputValue("");
    commitState(clearAllFilters());
  }

  return (
    <div className="search-page">
      <div className="search-shell">
        <nav className="search-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">HOME</Link>
          <span className="search-breadcrumb-sep" aria-hidden>
            /
          </span>
          <Link href="/library">RESOURCE LIBRARY</Link>
          <span className="search-breadcrumb-sep" aria-hidden>
            /
          </span>
          <span aria-current="page">SEARCH</span>
        </nav>

        <h1 className="search-title">Search All Resources</h1>

        <form className="search-form" onSubmit={onSubmit} role="search">
          <div className="search-field">
            <SearchIcon className="search-field-icon" size={16} aria-hidden />
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, QUERY_MAX))}
              placeholder="What are you looking for?"
              aria-label="Search all resources"
              maxLength={QUERY_MAX}
            />
            {inputValue ? (
              <button
                type="button"
                className="search-field-clear"
                aria-label="Clear search text"
                onClick={onClearInput}
              >
                ×
              </button>
            ) : null}
          </div>
          <button type="submit" className="search-submit">
            Search
          </button>
        </form>

        <div className="search-pills" role="group" aria-label="Content types">
          <button
            type="button"
            className="search-pill"
            aria-pressed={isPillPressed(null, urlState)}
            onClick={() => {
              if (urlState.type == null) return;
              commitState(selectPill(urlState, null));
            }}
          >
            All Types
          </button>
          {SEARCH_TYPE_PILLS.map((p) => (
            <button
              key={p.slug}
              type="button"
              className="search-pill"
              aria-pressed={isPillPressed(p.slug, urlState)}
              onClick={() => {
                if (urlState.type === p.slug) return;
                commitState(selectPill(urlState, p.slug));
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="search-tabs-wrap">
        <div className="search-shell">
          <div className="search-tabs" role="tablist" aria-label="Topics">
            <button
              type="button"
              role="tab"
              className="search-tab"
              aria-selected={tabKey === "all"}
              onClick={() => {
                if (urlState.topic == null) return;
                commitState(selectAllTab(urlState));
              }}
            >
              All
            </button>
            {tabs.map((t) => (
              <button
                key={t.topicId}
                type="button"
                role="tab"
                className="search-tab"
                aria-selected={
                  tabKey !== "all" && tabKey !== "none" && tabKey.topicId === t.topicId
                }
                onClick={() => {
                  if (urlState.topic === t.topicId) return;
                  commitState(selectTopicTab(urlState, t.topicId));
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="search-shell">
        <div className="search-toolbar">
          {infinite.status === "loading" ? (
            <p className="search-count" data-testid="search-count" aria-busy="true">
              …
            </p>
          ) : (
            <p className="search-count" data-testid="search-count">
              {countLineText({
                n: infinite.total,
                query: urlState.query,
                tabLabel,
              })}
            </p>
          )}
          {filtersActive ? (
            <button
              type="button"
              className="search-clear-filters"
              onClick={onClearFilters}
            >
              × Clear filters
            </button>
          ) : null}
        </div>

        {infinite.status === "loading" ? (
          <p className="search-status">Loading…</p>
        ) : null}
        {infinite.status === "error" ? (
          <div className="search-error">
            <p>Something went wrong loading results.</p>
            <button type="button" onClick={() => setRefresh((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : null}
        {infinite.status === "data" && infinite.items.length === 0 ? (
          <div className="search-empty">
            <p className="search-empty-title">No results found</p>
            <p className="search-empty-lead">
              Try a different search term or browse by category above.
            </p>
          </div>
        ) : null}
        {infinite.status === "data" && infinite.items.length > 0 ? (
          <div className="search-grid">
            {infinite.items.map((r) => (
              <ResourceCard
                key={`${r.type}-${r.id}`}
                resource={r}
                onOpenLocked={setLocked}
              />
            ))}
          </div>
        ) : null}
        <div ref={sentinelRef} className="search-sentinel" aria-hidden />
        {infinite.loadingMore ? <p className="search-status">Loading more…</p> : null}
      </div>

      <JoinModal
        open={locked != null}
        title={locked?.title ?? ""}
        onClose={() => setLocked(null)}
      />
      <BackToTop mode="document" />
    </div>
  );
}
