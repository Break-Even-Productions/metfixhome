import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BRAND_CATEGORY_SLUGS,
  CONTENT_TYPE_CHIPS,
  buildLibraryHead,
  isFreeOpen,
  isProfessionalTagged,
  type LibraryFilterTerm,
  type LibraryResource,
} from "@shared/library";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchCourses } from "@/lib/content";
import type { Course } from "@/lib/contentTypes";
import { JoinModal } from "./JoinModal";
import { ResourceCard } from "./ResourceCard";
import { fetchLibraryFilters, fetchLibrarySearch } from "./api";
import "./library.css";

type RailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "data"; items: LibraryResource[] };

function useRail(params: Parameters<typeof fetchLibrarySearch>[0], refreshKey: number): RailState {
  const [state, setState] = useState<RailState>({ status: "loading" });
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serialize params via refreshKey + JSON
  }, [refreshKey, JSON.stringify(params)]);
  return state;
}

function Rail({
  label,
  title,
  state,
  onLocked,
  emptyHint,
}: {
  label?: string;
  title: string;
  state: RailState;
  onLocked: (r: LibraryResource) => void;
  emptyHint?: string;
}) {
  return (
    <section className="library-section">
      <div className="library-section-head">
        <div>
          {label ? <div className="library-section-label">{label}</div> : null}
          <h2 className="library-section-title">{title}</h2>
        </div>
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
  const [locked, setLocked] = useState<LibraryResource | null>(null);
  const [categories, setCategories] = useState<LibraryFilterTerm[]>([]);
  const [sanityCourses, setSanityCourses] = useState<Course[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const c = new AbortController();
    void fetchLibraryFilters(c.signal)
      .then((f) => {
        if (!c.signal.aborted) setCategories(f.categories);
      })
      .catch(() => {
        /* filters optional */
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
        .filter((c) => BRAND_CATEGORY_SLUGS.includes(c.slug as "metfix" | "bsi") && c.slug === "metfix")
        .map((c) => c.id),
    [categories],
  );
  const bsiCatIds = useMemo(
    () => categories.filter((c) => c.slug === "bsi").map((c) => c.id),
    [categories],
  );

  const searchParams = useMemo(
    () => ({
      query: submittedQuery || undefined,
      content_type_terms: activeType ? [activeType] : undefined,
      limit: 24,
      offset: 0,
    }),
    [submittedQuery, activeType],
  );

  const catalog = useRail(searchParams, refresh);
  const featured = useRail({ limit: 6, offset: 0 }, refresh);
  const coursesRail = useRail({ content_types: ["course"], limit: 9, offset: 0 }, refresh);

  const freeItems = useMemo(() => {
    if (catalog.status !== "data") return [];
    return catalog.items.filter(isFreeOpen).slice(0, 9);
  }, [catalog]);

  const gatedItems = useMemo(() => {
    if (catalog.status !== "data") return [];
    return catalog.items.filter(isProfessionalTagged).slice(0, 9);
  }, [catalog]);

  const metfixRail = useRail(
    metfixCatIds.length
      ? { categories: metfixCatIds, limit: 9, offset: 0 }
      : { query: "metfix", limit: 9, offset: 0 },
    refresh + metfixCatIds.join(",").length,
  );
  const bsiRail = useRail(
    bsiCatIds.length
      ? { categories: bsiCatIds, limit: 9, offset: 0 }
      : { query: "broken science", limit: 9, offset: 0 },
    refresh + bsiCatIds.join(",").length,
  );

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
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query.trim());
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
            data-active={activeType == null ? "true" : "false"}
            onClick={() => setActiveType(null)}
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
                setActiveType((cur) => (cur === chip.slug ? null : chip.slug))
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        {submittedQuery || activeType ? (
          <Rail
            label="Search"
            title={submittedQuery ? `Results for “${submittedQuery}”` : "Filtered results"}
            state={catalog}
            onLocked={setLocked}
            emptyHint="No matches. Try another query or clear filters."
          />
        ) : (
          <>
            <Rail
              label="Featured"
              title="Top resources"
              state={featured}
              onLocked={setLocked}
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
            />
            <Rail label="MetFix" title="MetFix" state={metfixRail} onLocked={setLocked} />
            <Rail
              label="Broken Science Initiative"
              title="BSI"
              state={bsiRail}
              onLocked={setLocked}
            />

            <section className="library-section">
              <div className="library-section-head">
                <div>
                  <div className="library-section-label">Education first</div>
                  <h2 className="library-section-title">Courses</h2>
                </div>
                <a className="library-section-link" href="/classes">
                  View all →
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
