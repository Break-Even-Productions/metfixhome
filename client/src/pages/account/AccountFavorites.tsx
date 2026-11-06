import { useEffect, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  loadFavorites,
  setFavorite,
  type FavoriteItem,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

const FILTERS = ["all", "articles", "recipes", "workouts", "videos"] as const;

export default function AccountFavorites() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        // GET /api/account/favorites (optional ?type=) — same path the account Worker proxies.
        const data = await loadFavorites(filter, { force: true, signal: ac.signal });
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setLoaded(true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load favorites.");
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [filter]);

  async function onToggle(item: FavoriteItem) {
    const key = `${item.source_type}:${item.source_id}`;
    setBusyKey(key);
    setError(null);
    try {
      await setFavorite(item.source_type, item.source_id, false);
      setItems((prev) =>
        prev.filter((x) => !(x.source_type === item.source_type && x.source_id === item.source_id)),
      );
    } catch {
      setError("Could not update favorite.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DashboardLayout title="Saved / Favorites" description="Articles, recipes, workouts, and videos you saved.">
      {error ? <p className="account-error">{error}</p> : null}
      <div className="account-pills" style={{ marginBottom: "1rem" }} role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? "account-pill account-pill--accent" : "account-pill"}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {loaded && items.length === 0 ? (
        <section className="account-empty" aria-labelledby="favorites-empty-heading">
          <h2 id="favorites-empty-heading">Nothing saved yet</h2>
          <p className="account-muted">
            Save articles, recipes, workouts, and videos from the library. They show up here so you
            can return quickly.
          </p>
          <div className="account-course-card__actions">
            <Link href={basePath("/library")} className="account-btn">
              Browse the library
            </Link>
            <Link href={basePath("/courses")} className="account-btn account-btn--ghost">
              Explore courses
            </Link>
          </div>
        </section>
      ) : null}
      {items.length > 0 ? (
        <ul className="account-saved-list">
          {items.map((item) => {
            const key = `${item.source_type}:${item.source_id}`;
            const href = typeof item.url === "string" && item.url.startsWith("/") ? item.url : null;
            return (
              <li key={key} className="account-saved-item">
                <div className="account-saved-item__meta">
                  <span className="account-tag">{item.source_type}</span>
                  {href ? (
                    <Link href={basePath(href)} className="account-saved-item__title">
                      {item.title ?? `${item.source_type} ${item.source_id}`}
                    </Link>
                  ) : (
                    <div className="account-saved-item__title">
                      {item.title ?? `${item.source_type} ${item.source_id}`}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="account-btn account-btn--ghost"
                  disabled={busyKey === key}
                  onClick={() => void onToggle(item)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </DashboardLayout>
  );
}
