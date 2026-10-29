import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BRAND_CATEGORY_SLUGS,
  CONTENT_TYPE_CHIPS,
  buildLibraryHead,
  isFreeOpen,
  isProfessionalTagged,
  type LibraryFilterTerm,
  type LibraryResource,
} from "@shared/library";
import { BackToTop } from "@/components/BackToTop";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchCourses } from "@/lib/content";
import type { Course } from "@/lib/contentTypes";
import { JoinModal } from "./JoinModal";
import { ResourceCard } from "./ResourceCard";
import { fetchLibraryFilters, fetchLibraryPopular, fetchLibrarySearch } from "./api";
import {
  useInfiniteArchive,
  type ArchiveKind,
} from "./useInfiniteArchive";
import "./library.css";

type SearchParams = Parameters<typeof fetchLibrarySearch>[0];

type RailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "data"; items: LibraryResource[] };

type BrandSlug = "metfix" | "bsi";
type SectionSlug = "featured" | "free" | "gated";

const FEATURED_LIMIT = 6;

/** Pass `null` to skip the network call (keeps loading until params are ready). */
function useRail(params: SearchParams | null, refreshKey: number): RailState {
  const [state, setState] = useState<RailState>({ status: "loading" });
  const paramsKey = params == null ? "" : JSON.stringify(params);
  useEffect(() => {
    if (params == null) {
      setState({ status: "loading" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const body = await fetchLibrarySearch(params, controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: "data", items: body.resources });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params serialized in paramsKey
  }, [refreshKey, paramsKey]);
  return state;
}

/** Popular-by-views rail (BSI /resources/popular). Pass null limit to skip. */
function usePopular(limit: number | null, refreshKey: number): RailState {
  const [state, setState] = useState<RailState>({ status: "loading" });
  useEffect(() => {
    if (limit == null) {
      setState({ status: "loading" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    void (async () => {
      try {
        const body = await fetchLibraryPopular({ limit }, controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: "data", items: body.resources });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [limit, refreshKey]);
  return state;
}

function syncLibraryUrl(opts: {
  query: string;
  type: string | null;
  category: BrandSlug | null;
  section: SectionSlug | null;
}) {
  const sp = new URLSearchParams();
  if (opts.query) sp.set("query", opts.query);
  if (opts.type) sp.set("content_type_terms[]", opts.type);
  if (opts.category) sp.set("category", opts.category);
  if (opts.section) sp.set("section", opts.section);
  const qs = sp.toString();
  const next = qs ? `/library?${qs}` : "/library";
  const cur = `${window.location.pathname}${window.location.search}`;
  if (cur !== next) {
    window.history.replaceState(null, "", next);
  }
}

function Rail({
  label,
  title,
  state,
  onLocked,
  emptyHint,
  browseAllHref,
  onBrowseAll,
}: {
  label?: string;
  title: string;
  state: RailState;
  onLocked: (r: LibraryResource) => void;
  emptyHint?: string;
  browseAllHref?: string;
  onBrowseAll?: () => void;
}) {
  return (
    <section className="library-section">
      <div className="library-section-head">
        <div>
          {label ? <div className="library-section-label">{label}</div> : null}
          <h2 className="library-section-title">{title}</h2>
        </div>
        {browseAllHref ? (
          <a className="library-section-link" href={browseAllHref}>
            Browse all →
          </a>
        ) : onBrowseAll ? (
          <button type="button" className="library-section-link" onClick={onBrowseAll}>
            Browse all →
          </button>
        ) : null}
      </div>
      {state.status === "loading" ? (
        <p className="library-status">Loading…</p>
      ) : state.status === "error" ? (
        <p className="library-status">Couldn’t load this section. Try again later.</p>
      ) : state.items.length === 0 ? (
        <div className="library-stub">
          <strong>{title}</strong>
          {emptyHint ?? "No items from BSI for this rail yet."}
        </div>
      ) : (
        <div className="library-rail">
          {state.items.map((r) => (
            <ResourceCard key={`${r.type}-${r.id}`} resource={r} onOpenLocked={onLocked} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function LibraryPage() {
  const head = useMemo(() => buildLibraryHead({ kind: "hub" }), []);
  usePageMeta({
    title: head.title,
    description: head.description,
    robots: head.robots,
    canonical: head.canonical,
    ogType: head.ogType,
    ogImage: head.ogImage,
    ogUrl: head.ogUrl,
  });

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<BrandSlug | null>(null);
  const [activeSection, setActiveSection] = useState<SectionSlug | null>(null);
  const [locked, setLocked] = useState<LibraryResource | null>(null);
  const [categories, setCategories] = useState<LibraryFilterTerm[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sanityCourses, setSanityCourses] = useState<Course[]>([]);
  const [refresh, setRefresh] = useState(0);

  const archiveMode = Boolean(submittedQuery || activeType || activeCategory || activeSection);
  const browseMode = !archiveMode;

  useEffect(() => {
    const c = new AbortController();
    void fetchLibraryFilters(c.signal)
      .then((f) => {
        if (c.signal.aborted) return;
        setCategories(f.categories);
        setFiltersReady(true);
      })
      .catch(() => {
        if (c.signal.aborted) return;
        setFiltersReady(true);
      });
    void fetchCourses()
      .then((courses) => {
        if (!c.signal.aborted) setSanityCourses(courses);
      })
      .catch(() => {
        /* optional */
      });
    return () => c.abort();
  }, []);

  const metfixCatIds = useMemo(
    () =>
      categories
        .filter((c) => BRAND_CATEGORY_SLUGS.includes(c.slug as BrandSlug) && c.slug === "metfix")
        .map((c) => c.id),
    [categories],
  );
  const bsiCatIds = useMemo(
    () => categories.filter((c) => c.slug === "bsi").map((c) => c.id),
    [categories],
  );

  const hubCatalogParams = useMemo(
    (): SearchParams => ({ limit: 24, offset: 0 }),
    [],
  );

  const archiveKind = useMemo((): ArchiveKind | null => {
    if (!archiveMode) return null;
    if (activeSection === "featured") return { kind: "popular" };
    const base: Omit<SearchParams, "limit" | "offset"> = {
      query: submittedQuery || undefined,
      content_type_terms: activeType ? [activeType] : undefined,
    };
    if (activeCategory === "metfix") {
      if (metfixCatIds.length) base.categories = metfixCatIds;
      else base.query = submittedQuery || "metfix";
    } else if (activeCategory === "bsi") {
      if (bsiCatIds.length) base.categories = bsiCatIds;
      else base.query = submittedQuery || "broken science";
    }
    if (activeSection === "free") return { kind: "free", params: base };
    if (activeSection === "gated") return { kind: "gated", params: base };
    return { kind: "search", params: base };
  }, [
    archiveMode,
    activeSection,
    submittedQuery,
    activeType,
    activeCategory,
    metfixCatIds,
    bsiCatIds,
  ]);

  const archiveResetKey = useMemo(
    () =>
      JSON.stringify({
        section: activeSection,
        type: activeType,
        category: activeCategory,
        q: submittedQuery,
        metfix: metfixCatIds,
        bsi: bsiCatIds,
        refresh,
      }),
    [
      activeSection,
      activeType,
      activeCategory,
      submittedQuery,
      metfixCatIds,
      bsiCatIds,
      refresh,
    ],
  );

  const infinite = useInfiniteArchive(archiveMode, archiveKind, archiveResetKey);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!archiveMode || !infinite.hasMore) return;
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
  }, [archiveMode, infinite.hasMore, infinite.loadMore, infinite.items.length]);

  // Catalog powers free/gated hub rails only.
  const catalog = useRail(browseMode ? hubCatalogParams : null, refresh);

  // Top resources: BSI popular-by-views (not newest-by-date).
  const popular = usePopular(browseMode ? FEATURED_LIMIT : null, refresh);

  const coursesRail = useRail(
    browseMode ? { content_types: ["course"], limit: 9, offset: 0 } : null,
    refresh,
  );

  const metfixRail = useRail(
    browseMode && filtersReady
      ? metfixCatIds.length
        ? { categories: metfixCatIds, limit: 9, offset: 0 }
        : { query: "metfix", limit: 9, offset: 0 }
      : null,
    refresh,
  );
  const bsiRail = useRail(
    browseMode && filtersReady
      ? bsiCatIds.length
        ? { categories: bsiCatIds, limit: 9, offset: 0 }
        : { query: "broken science", limit: 9, offset: 0 }
      : null,
    refresh,
  );

  const freeItems = useMemo(() => {
    if (catalog.status !== "data") return [];
    return catalog.items.filter(isFreeOpen).slice(0, 9);
  }, [catalog]);

  const gatedItems = useMemo(() => {
    if (catalog.status !== "data") return [];
    return catalog.items.filter(isProfessionalTagged).slice(0, 9);
  }, [catalog]);

  const archiveTitle = useMemo(() => {
    if (submittedQuery) return `Results for “${submittedQuery}”`;
    if (activeType) {
      return CONTENT_TYPE_CHIPS.find((c) => c.slug === activeType)?.label ?? "Filtered results";
    }
    if (activeCategory === "metfix") return "MetFix";
    if (activeCategory === "bsi") return "Broken Science Initiative";
    if (activeSection === "featured") return "Top resources";
    if (activeSection === "free") return "Free / open";
    if (activeSection === "gated") return "Gated & exclusive";
    return "Filtered results";
  }, [submittedQuery, activeType, activeCategory, activeSection]);

  /** Sanity wins on dedupe when bsiPostId matches a BSI course id. */
  const courseCards = useMemo(() => {
    const bsiCourses = coursesRail.status === "data" ? coursesRail.items : [];
    const byBsiId = new Map<number, Course>();
    for (const c of sanityCourses) {
      const id = (c as Course & { bsiPostId?: number }).bsiPostId;
      if (typeof id === "number" && id > 0) byBsiId.set(id, c);
    }
    const used = new Set<number>();
    const merged: Array<
      | { kind: "sanity"; course: Course }
      | { kind: "bsi"; resource: LibraryResource }
    > = [];
    for (const sc of sanityCourses) {
      merged.push({ kind: "sanity", course: sc });
      const id = (sc as Course & { bsiPostId?: number }).bsiPostId;
      if (typeof id === "number") used.add(id);
    }
    for (const r of bsiCourses) {
      if (used.has(r.id) || byBsiId.has(r.id)) continue;
      merged.push({ kind: "bsi", resource: r });
    }
    return merged.slice(0, 9);
  }, [coursesRail, sanityCourses]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("query");
    if (q) {
      setQuery(q);
      setSubmittedQuery(q.trim());
    }
    const term =
      sp.get("content_type_terms[]") ||
      sp.get("content_type_terms") ||
      sp.getAll("content_type_terms[]")[0];
    if (term && CONTENT_TYPE_CHIPS.some((c) => c.slug === term)) {
      setActiveType(term);
    }
    const cat = sp.get("category");
    if (cat === "metfix" || cat === "bsi") setActiveCategory(cat);
    const section = sp.get("section");
    if (section === "featured" || section === "free" || section === "gated") {
      setActiveSection(section);
    }
  }, []);

  useEffect(() => {
    syncLibraryUrl({
      query: submittedQuery,
      type: activeType,
      category: activeCategory,
      section: activeSection,
    });
  }, [submittedQuery, activeType, activeCategory, activeSection]);

  function clearArchiveFilters() {
    setActiveType(null);
    setActiveCategory(null);
    setActiveSection(null);
    setSubmittedQuery("");
    setQuery("");
  }

  function openArchive(opts: {
    type?: string | null;
    category?: BrandSlug | null;
    section?: SectionSlug | null;
  }) {
    setSubmittedQuery("");
    setQuery("");
    setActiveType(opts.type ?? null);
    setActiveCategory(opts.category ?? null);
    setActiveSection(opts.section ?? null);
    setRefresh((n) => n + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = query.trim();
    setSubmittedQuery(next);
    setActiveType(null);
    setActiveCategory(null);
    setActiveSection(null);
    setRefresh((n) => n + 1);
  }

  return (
    <div className="library-page">
      <div className="library-shell">
        <div className="library-kicker">
          <span className="library-kicker-line" />
          <span className="library-kicker-label">MetFix / Resource Library</span>
        </div>
        <h1 className="library-hero-title">Resource Library</h1>
        <p className="library-hero-lead">
          A repository of metabolic health education — articles, live streams, coach
          briefings, courses, and research. Read on metfix.org.
        </p>

        <form className="library-search" onSubmit={onSearch}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources"
            aria-label="Search resources"
            type="search"
          />
          <button type="submit">Search resources</button>
        </form>

        <div className="library-chips" role="list">
          <button
            type="button"
            className="library-chip"
            data-active={!activeType && !activeCategory && !activeSection ? "true" : "false"}
            onClick={() => clearArchiveFilters()}
          >
            All
          </button>
          {CONTENT_TYPE_CHIPS.map((chip) => (
            <button
              key={chip.slug}
              type="button"
              className="library-chip"
              data-active={activeType === chip.slug ? "true" : "false"}
              onClick={() =>
                openArchive({
                  type: activeType === chip.slug ? null : chip.slug,
                })
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        {archiveMode ? (
          <>
            <Rail
              label="Archive"
              title={archiveTitle}
              state={
                infinite.status === "data"
                  ? { status: "data", items: infinite.items }
                  : infinite.status === "error"
                    ? { status: "error" }
                    : { status: "loading" }
              }
              onLocked={setLocked}
              emptyHint="No matches. Clear filters with All, or try another search."
            />
            {infinite.status === "data" && infinite.hasMore ? (
              <div ref={sentinelRef} className="library-infinite-sentinel" aria-hidden>
                {infinite.loadingMore ? (
                  <p className="library-status">Loading more…</p>
                ) : null}
              </div>
            ) : null}
            {infinite.status === "data" && !infinite.hasMore && infinite.items.length > 0 ? (
              <p className="library-status">You’re caught up.</p>
            ) : null}
            <BackToTop mode="items" itemSelector=".library-card" cycleEvery={40} />
          </>
        ) : (
          <>
            <Rail
              label="Featured"
              title="Top resources"
              state={popular}
              onLocked={setLocked}
              onBrowseAll={() => openArchive({ section: "featured" })}
            />
            <Rail
              label="No membership required"
              title="Free / open"
              state={
                freeItems.length
                  ? { status: "data", items: freeItems }
                  : catalog.status === "loading"
                    ? { status: "loading" }
                    : catalog.status === "error"
                      ? { status: "error" }
                      : { status: "data", items: [] }
              }
              onLocked={setLocked}
              onBrowseAll={() => openArchive({ section: "free" })}
            />
            <Rail
              label="Professional"
              title="Gated & exclusive"
              state={
                gatedItems.length
                  ? { status: "data", items: gatedItems }
                  : catalog.status === "loading"
                    ? { status: "loading" }
                    : { status: "data", items: [] }
              }
              onLocked={setLocked}
              emptyHint="Exclusive items appear here with a Professional tag when BSI returns them for your session."
              onBrowseAll={() => openArchive({ section: "gated" })}
            />
            <Rail
              label="MetFix"
              title="MetFix"
              state={metfixRail}
              onLocked={setLocked}
              onBrowseAll={() => openArchive({ category: "metfix" })}
            />
            <Rail
              label="Broken Science Initiative"
              title="BSI"
              state={bsiRail}
              onLocked={setLocked}
              onBrowseAll={() => openArchive({ category: "bsi" })}
            />

            <section className="library-section">
              <div className="library-section-head">
                <div>
                  <div className="library-section-label">Education first</div>
                  <h2 className="library-section-title">Courses</h2>
                </div>
                <a className="library-section-link" href="/classes">
                  Browse all →
                </a>
              </div>
              {courseCards.length === 0 ? (
                <div className="library-stub">
                  <strong>Courses</strong>
                  BSI LearnPress and Sanity classes will appear here. Dedupe prefers Sanity
                  when <code>bsiPostId</code> is set.
                </div>
              ) : (
                <div className="library-rail">
                  {courseCards.map((item) =>
                    item.kind === "sanity" ? (
                      <a
                        key={`sanity-${item.course.id}`}
                        className="library-card"
                        href={item.course.landingPageUrl || "/classes"}
                      >
                        <div className="library-card-media">
                          <span className="library-card-badge">
                            {item.course.tag || "Course"}
                          </span>
                        </div>
                        <h3 className="library-card-title">{item.course.title}</h3>
                        <p className="library-card-excerpt">
                          {item.course.audience || item.course.details || item.course.price}
                        </p>
                      </a>
                    ) : (
                      <ResourceCard
                        key={`bsi-${item.resource.id}`}
                        resource={item.resource}
                        onOpenLocked={setLocked}
                      />
                    ),
                  )}
                </div>
              )}
            </section>

            <section className="library-section">
              <div className="library-section-head">
                <div>
                  <div className="library-section-label">Source material</div>
                  <h2 className="library-section-title">MetFix Source Material</h2>
                </div>
              </div>
              <div className="library-stub">
                <strong>Browse source material</strong>
                Stub until BSI exposes a dedicated source-material surface. Use topic filters
                above in the meantime.
              </div>
            </section>

            <section className="library-section">
              <div className="library-section-head">
                <div>
                  <div className="library-section-label">Archives</div>
                  <h2 className="library-section-title">Glassman &amp; Book Library</h2>
                </div>
              </div>
              <div className="library-stub">
                <strong>Coming later</strong>
                No first-party BSI Glassman or Book Library rails in this PR — stubs only so
                IA stays aligned with the mockup.
              </div>
            </section>
          </>
        )}
      </div>

      <JoinModal
        open={locked != null}
        title={locked?.title}
        onClose={() => setLocked(null)}
      />
    </div>
  );
}
