import { useEffect, useMemo, useState } from "react";
import type { ExclusiveAccessLevel, LibraryResource, LibrarySearchMeta } from "@shared/library";
import { retainExclusiveCatalog } from "@shared/library";
import { fetchExclusiveAccessLevels, fetchExclusiveFeed } from "@/pages/library/api";
import { JoinModal } from "@/pages/library/JoinModal";
import { LibraryRailSkeleton } from "@/pages/library/LibraryRailSkeleton";
import { ResourceCard } from "@/pages/library/ResourceCard";
import "@/pages/library/library.css";
import DashboardLayout from "./DashboardLayout";

const PAGE = 12;

export default function AccountExclusive() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [levels, setLevels] = useState<ExclusiveAccessLevel[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [meta, setMeta] = useState<LibrarySearchMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<LibraryResource | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void fetchExclusiveAccessLevels(ac.signal)
      .then((rows) => {
        if (!ac.signal.aborted) setLevels(rows);
      })
      .catch(() => {
        if (!ac.signal.aborted) setLevels([]);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const body = await fetchExclusiveFeed(
          {
            query: submitted || undefined,
            content_access: selected,
            limit: PAGE,
            offset: 0,
          },
          ac.signal,
        );
        if (cancelled) return;
        const kept = retainExclusiveCatalog(body);
        setResources(kept.resources);
        setMeta(kept.meta);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load exclusive posts.");
        setResources([]);
        setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [submitted, selected]);

  async function loadMore() {
    if (!meta?.has_more || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const body = await fetchExclusiveFeed({
        query: submitted || undefined,
        content_access: selected,
        limit: PAGE,
        offset: (meta.offset ?? 0) + (meta.limit ?? PAGE),
      });
      const kept = retainExclusiveCatalog(body);
      setResources((prev) => {
        const seen = new Set(prev.map((r) => `${r.type}:${r.id}`));
        return [...prev, ...kept.resources.filter((r) => !seen.has(`${r.type}:${r.id}`))];
      });
      setMeta(kept.meta);
    } catch {
      setError("Unable to load more exclusive posts.");
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleLevel(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  }

  const filterHint = useMemo(() => {
    if (selected.length === 0) {
      return "Every exclusive post across all access levels.";
    }
    const names = levels
      .filter((level) => selected.includes(level.id))
      .map((level) => level.name);
    if (names.length === 0) return "Filtered by selected access levels.";
    if (names.length === 1) return `Only posts exclusive to ${names[0]}.`;
    if (names.length === 2) return `Only posts exclusive to ${names[0]} or ${names[1]}.`;
    return `Only posts exclusive to ${names.slice(0, -1).join(", ")}, or ${names.at(-1)}.`;
  }, [levels, selected]);

  return (
    <DashboardLayout
      title="Exclusive feed"
      description="Posts and pages marked exclusive in the MetFix library."
    >
      <div className="library-embed">
        <form
          className="library-search"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <input
            id="exclusive-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exclusive posts"
            aria-label="Search exclusive posts"
            type="search"
          />
          <button type="submit">Search</button>
        </form>

        {levels.length > 0 ? (
          <>
            <div className="library-chips" role="toolbar" aria-label="Access level">
              <button
                type="button"
                className="library-chip"
                data-active={selected.length === 0 ? "true" : "false"}
                aria-pressed={selected.length === 0}
                onClick={() => setSelected([])}
              >
                All exclusive
              </button>
              {levels.map((level) => {
                const on = selected.includes(level.id);
                return (
                  <button
                    key={level.id}
                    type="button"
                    className="library-chip"
                    data-active={on ? "true" : "false"}
                    aria-pressed={on}
                    onClick={() => toggleLevel(level.id)}
                  >
                    {level.name}
                  </button>
                );
              })}
            </div>
            <p className="library-filter-hint">{filterHint}</p>
          </>
        ) : null}

        {error ? <p className="account-error">{error}</p> : null}
        {loading ? <LibraryRailSkeleton count={6} label="Loading exclusive posts" /> : null}

        {!loading && resources.length === 0 ? (
          <div className="library-stub">
            <strong>No exclusive posts</strong>
            Nothing in the exclusive catalog matches this search.
          </div>
        ) : null}

        {!loading && resources.length > 0 ? (
          <section className="library-section">
            <div className="library-section-head">
              <div>
                <div className="library-section-label">Members only</div>
                <h2 className="library-section-title">Exclusive posts</h2>
              </div>
            </div>
            <div className="library-rail">
              {resources.map((resource) => (
                <ResourceCard
                  key={`${resource.type}:${resource.id}`}
                  resource={resource}
                  libraryOnly
                  onOpenLocked={setLocked}
                />
              ))}
            </div>
          </section>
        ) : null}

        {meta?.has_more ? (
          <div className="library-search">
            <button
              type="button"
              className="library-btn library-btn-ghost"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}

        {loadingMore ? (
          <LibraryRailSkeleton count={3} label="Loading more exclusive posts" />
        ) : null}
      </div>

      <JoinModal
        open={locked != null}
        title={locked?.title}
        onClose={() => setLocked(null)}
      />
    </DashboardLayout>
  );
}
