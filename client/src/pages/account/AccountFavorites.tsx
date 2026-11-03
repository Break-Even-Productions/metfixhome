import { useEffect, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const data = await loadFavorites(filter, { force: true, signal: ac.signal });
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load favorites.");
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
      {items.length === 0 ? (
        <p className="account-muted">No saved items.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
          {items.map((item) => {
            const key = `${item.source_type}:${item.source_id}`;
            return (
              <li key={key} className="account-card" style={{ marginBottom: 0 }}>
                <div>{item.title ?? `${item.source_type} ${item.source_id}`}</div>
                <div className="account-muted">{item.source_type}</div>
                <button
                  type="button"
                  className="account-btn account-btn--ghost"
                  style={{ marginTop: "0.65rem" }}
                  disabled={busyKey === key}
                  onClick={() => void onToggle(item)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardLayout>
  );
}
