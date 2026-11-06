import { useEffect, useState } from "react";
import type { ExclusiveAccessLevel, LibraryResource, LibrarySearchMeta } from "@shared/library";
import { retainExclusiveCatalog } from "@shared/library";
import { fetchExclusiveAccessLevels, fetchExclusiveFeed } from "@/pages/library/api";
import { JoinModal } from "@/pages/library/JoinModal";
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

  return (
    <DashboardLayout
      title="Exclusive feed"
      description="Posts and pages marked exclusive in the MetFix library."
    >
      <form
        className="account-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <label className="account-search__label" htmlFor="exclusive-query">
          Search exclusive posts
        </label>
        <input
          id="exclusive-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exclusive posts"
        />
        <button type="submit" className="account-btn">
          Search
        </button>
      </form>

      <div className="account-exclusive__filters" role="group" aria-label="Access level">
        <button
          type="button"
          className={selected.length === 0 ? "account-chip account-chip--on" : "account-chip"}
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
              className={on ? "account-chip account-chip--on" : "account-chip"}
              aria-pressed={on}
              onClick={() => toggleLevel(level.id)}
            >
              {level.name}
            </button>
          );
        })}
      </div>
      <p className="account-muted">
        Showing only resources exclusive to the selected access level. An empty selection
        includes every exclusive post.
      </p>

      {error ? <p className="account-error">{error}</p> : null}
      {loading ? <p className="account-muted">Loading exclusive posts…</p> : null}

      {!loading && resources.length === 0 ? (
        <section className="account-empty" aria-labelledby="exclusive-empty-heading">
          <h2 id="exclusive-empty-heading">No exclusive posts</h2>
          <p className="account-muted">
            Nothing in the exclusive catalog matches this search.
          </p>
        </section>
      ) : null}

      {resources.length > 0 ? (
        <div className="account-exclusive-grid">
          {resources.map((resource) => (
            <ResourceCard
              key={`${resource.type}:${resource.id}`}
              resource={resource}
              libraryOnly
              onOpenLocked={setLocked}
            />
          ))}
        </div>
      ) : null}

      {meta?.has_more ? (
        <div className="account-list-item__actions">
          <button
            type="button"
            className="account-btn account-btn--ghost"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      <JoinModal
        open={locked != null}
        title={locked?.title}
        onClose={() => setLocked(null)}
      />
    </DashboardLayout>
  );
}
