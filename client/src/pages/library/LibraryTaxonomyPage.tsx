import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  buildLibraryHead,
  formatFromParam,
  humanizeSlug,
  type LibraryFilterTerm,
} from "@shared/library";
import { basePath } from "@/const";
import { BackToTop } from "@/components/BackToTop";
import { usePageMeta } from "@/hooks/usePageMeta";
import { JoinModal } from "./JoinModal";
import { ResourceCard } from "./ResourceCard";
import { getLibraryFilters, peekLibraryFilters } from "./filtersCache";
import { useInfiniteArchive, type ArchiveKind } from "./useInfiniteArchive";
import "./library.css";
import "./taxonomy.css";

export type TaxonomyKind = "topic" | "category" | "content-type";

type LibraryTaxonomyPageProps = {
  taxonomyKind: TaxonomyKind;
};

function termList(
  kind: TaxonomyKind,
  filters: {
    topics: LibraryFilterTerm[];
    categories: LibraryFilterTerm[];
    content_type_terms: LibraryFilterTerm[];
  },
): LibraryFilterTerm[] {
  if (kind === "topic") return filters.topics;
  if (kind === "category") return filters.categories;
  return filters.content_type_terms;
}

function splitParagraphs(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function LibraryTaxonomyPage({ taxonomyKind }: LibraryTaxonomyPageProps) {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug = slugParam ?? "";

  const [filtersReady, setFiltersReady] = useState(false);
  const [filtersError, setFiltersError] = useState(false);
  const [term, setTerm] = useState<LibraryFilterTerm | null>(null);
  const [contentTypeSlug, setContentTypeSlug] = useState<string | null>(null);
  const [readMore, setReadMore] = useState(false);
  const [joinResource, setJoinResource] = useState<null | { title: string }>(null);

  useEffect(() => {
    let cancelled = false;
    setFiltersReady(false);
    setFiltersError(false);
    setTerm(null);
    void getLibraryFilters()
      .then((body) => {
        if (cancelled) return;
        const list = termList(taxonomyKind, body);
        const found = list.find((t) => t.slug === slug) ?? null;
        setTerm(found);
        setFiltersReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFiltersError(true);
          setFiltersReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [taxonomyKind, slug]);

  const paragraphs = useMemo(() => splitParagraphs(term?.description ?? null), [term]);
  const visibleParagraphs =
    readMore || paragraphs.length <= 1 ? paragraphs : paragraphs.slice(0, 1);

  const archive: ArchiveKind | null = useMemo(() => {
    if (!filtersReady || !term) return null;
    const base =
      taxonomyKind === "topic"
        ? { topics: [term.id] }
        : taxonomyKind === "category"
          ? { categories: [term.id] }
          : { content_type_terms: [term.slug] };
    if (contentTypeSlug && taxonomyKind !== "content-type") {
      return {
        kind: "search",
        params: { ...base, content_type_terms: [contentTypeSlug] },
      };
    }
    return { kind: "search", params: base };
  }, [filtersReady, term, taxonomyKind, contentTypeSlug]);

  const resetKey = `${taxonomyKind}:${slug}:${contentTypeSlug ?? "all"}`;
  const archiveState = useInfiniteArchive(filtersReady && term != null, archive, resetKey);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !archiveState.hasMore || archiveState.loadingMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) archiveState.loadMore();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [archiveState.hasMore, archiveState.loadingMore, archiveState.loadMore]);

  const head = buildLibraryHead({
    kind: "hub",
  });
  usePageMeta({
    title: term ? `${term.name} · Resource Library` : head.title,
    description: head.description,
    robots: head.robots,
    canonical: head.canonical,
    ogType: head.ogType,
    ogImage: term?.image ?? head.ogImage,
    ogUrl: head.ogUrl,
  });

  if (filtersReady && !filtersError && slug && !term) {
    return (
      <div className="library-page taxonomy-page">
        <div className="library-shell">
          <p className="library-status">We couldn’t find that topic in the library.</p>
          <Link href="/library" className="library-reader-back">
            ← Back to Resource Library
          </Link>
        </div>
      </div>
    );
  }

  if (!filtersReady || !term) {
    return (
      <div className="library-page taxonomy-page">
        <div className="library-shell">
          <p className="library-status">Loading…</p>
        </div>
      </div>
    );
  }

  if (filtersError) {
    return (
      <div className="library-page taxonomy-page">
        <div className="library-shell">
          <p className="library-status">Filters are temporarily unavailable.</p>
          <Link href="/library" className="library-reader-back">
            ← Back to Resource Library
          </Link>
        </div>
      </div>
    );
  }

  const fromParam = formatFromParam(taxonomyKind, term.slug);
  const showTypeTabs = taxonomyKind === "topic" || taxonomyKind === "category";
  const activeTypeLabel =
    contentTypeSlug == null
      ? null
      : peekLibraryFilters()?.content_type_terms.find((t) => t.slug === contentTypeSlug)
          ?.name ?? humanizeSlug(contentTypeSlug);

  return (
    <div className="library-page taxonomy-page">
      <div className="library-shell">
        <nav className="taxonomy-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a href={basePath("/")}>Home</a></li>
            <li aria-hidden>›</li>
            <li><a href={basePath("/library")}>Resource Library</a></li>
            <li aria-hidden>›</li>
            <li aria-current="page">{term.name}</li>
          </ol>
        </nav>

        <div className="taxonomy-hero">
          <div className="taxonomy-hero-copy">
            <h1 className="taxonomy-hero-title">{term.name}</h1>
            <p className="taxonomy-hero-count" data-testid="taxonomy-resource-count">
              {archiveState.total} resources
            </p>
            {visibleParagraphs.map((p, i) => (
              <p key={i} className="taxonomy-hero-desc">{p}</p>
            ))}
            {paragraphs.length > 1 ? (
              <button
                type="button"
                className="taxonomy-read-more"
                onClick={() => setReadMore((v) => !v)}
              >
                {readMore ? "Show Less ↑" : "Read More ↓"}
              </button>
            ) : null}
          </div>
          {term.image ? (
            <div className="taxonomy-hero-media">
              <img src={term.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </div>
          ) : null}
        </div>

        {showTypeTabs ? (
          <div className="taxonomy-tabs" role="tablist" aria-label="Content type">
            <button
              type="button"
              role="tab"
              aria-selected={contentTypeSlug == null}
              className={contentTypeSlug == null ? "taxonomy-tab taxonomy-tab--active" : "taxonomy-tab"}
              onClick={() => setContentTypeSlug(null)}
            >
              All
            </button>
            {/* Populated after filters — use term names from first fetch via peek on next render */}
            <TaxonomyTypeTabs
              active={contentTypeSlug}
              onSelect={setContentTypeSlug}
            />
          </div>
        ) : null}

        {archiveState.status === "loading" ? (
          <p className="library-status">Loading resources…</p>
        ) : null}
        {archiveState.status === "error" ? (
          <p className="library-status">Could not load resources.</p>
        ) : null}

        {archiveState.status === "data" && archiveState.items.length === 0 ? (
          <div className="taxonomy-empty" data-testid="taxonomy-empty">
            {showTypeTabs && contentTypeSlug != null ? (
              <>
                <p>No {activeTypeLabel} resources yet</p>
                <button
                  type="button"
                  className="taxonomy-empty-reset"
                  onClick={() => setContentTypeSlug(null)}
                >
                  View all {term.name} content →
                </button>
              </>
            ) : (
              <>
                <p>No resources match this filter yet.</p>
                <Link href="/library">Browse the full library</Link>
              </>
            )}
          </div>
        ) : null}

        {archiveState.items.length > 0 ? (
          <div className="library-grid taxonomy-grid">
            {archiveState.items.map((resource) => (
              <ResourceCard
                key={`${resource.type}:${resource.id}`}
                resource={resource}
                from={fromParam}
                onOpenLocked={() => setJoinResource({ title: resource.title })}
              />
            ))}
          </div>
        ) : null}

        <div ref={sentinelRef} className="taxonomy-sentinel" aria-hidden />
        {archiveState.loadingMore ? (
          <p className="library-status">Loading more…</p>
        ) : null}
      </div>

      <JoinModal
        open={joinResource != null}
        title={joinResource?.title ?? ""}
        onClose={() => setJoinResource(null)}
      />
      <BackToTop mode="document" />
    </div>
  );
}

function TaxonomyTypeTabs({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const [terms, setTerms] = useState<LibraryFilterTerm[]>([]);
  useEffect(() => {
    void getLibraryFilters().then((body) => setTerms(body.content_type_terms));
  }, []);
  return (
    <>
      {terms.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.slug}
          className={active === t.slug ? "taxonomy-tab taxonomy-tab--active" : "taxonomy-tab"}
          onClick={() => onSelect(t.slug)}
        >
          {t.name}
        </button>
      ))}
    </>
  );
}
