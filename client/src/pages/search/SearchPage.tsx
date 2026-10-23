import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Search as SearchIcon } from "lucide-react";
import {
  QUERY_MAX,
  SEARCH_TYPE_PILLS,
  SEARCH_VISIBILITY_MODE,
  buildLibraryHead,
  filterSearchResultsForViewer,
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
  pushSearchUrl,
  selectAllTab,
  selectPill,
  selectTopicTab,
  stateToFetchParams,
  type SearchUrlState,
} from "./searchState";
import "./search.css";

function readUrlState(): SearchUrlState {
  return parseSearchUrl(window.location.search);
}

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
  const [urlState, setUrlState] = useState<SearchUrlState>(() =>
    typeof window !== "undefined" ? readUrlState() : { query: "", type: null, topic: null },
  );
  const [inputValue, setInputValue] = useState(urlState.query);
  const [tabs, setTabs] = useState<SearchTab[]>([]);
  const [locked, setLocked] = useState<LibraryResource | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const apply = () => {
      const next = readUrlState();
      setUrlState(next);
      setInputValue(next.query);
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);

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

  const commitState = useCallback((next: SearchUrlState) => {
    setUrlState(next);
    pushSearchUrl(next);
  }, []);

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

  const visibleItems = useMemo(
    () =>
      filterSearchResultsForViewer(infinite.items, {
        signedIn: false,
        mode: SEARCH_VISIBILITY_MODE,
      }),
    [infinite.items],
  );

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
    // SS17(c): identical submit must not refetch.
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
          <a href="/">HOME</a>
          <span className="search-breadcrumb-sep" aria-hidden>
            /
          </span>
          <a href="/library">RESOURCE LIBRARY</a>
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
                if (tabKey === "all") return;
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
                  if (
                    tabKey !== "all" &&
                    tabKey !== "none" &&
                    tabKey.topicId === t.topicId
                  ) {
                    return;
                  }
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
          <p className="search-count" data-testid="search-count">
            {countLineText({
              n: infinite.total,
              query: urlState.query,
              tabLabel,
            })}
          </p>
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
        {infinite.status === "data" && visibleItems.length === 0 ? (
          <div className="search-empty">
            <p className="search-empty-title">No results found</p>
            <p className="search-empty-lead">
              Try a different search term or browse by category above.
            </p>
          </div>
        ) : null}
        {infinite.status === "data" && visibleItems.length > 0 ? (
          <div className="search-grid">
            {visibleItems.map((r) => (
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
