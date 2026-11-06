import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  createUserList,
  loadPublicLists,
  loadUserLists,
  type UserList,
} from "@/lib/account";
import type { ListVisibility } from "@shared/account/userLists";
import DashboardLayout from "./DashboardLayout";

const VISIBILITY_OPTIONS: Array<{
  value: Exclude<ListVisibility, "invite_only">;
  label: string;
  helper: string;
}> = [
  { value: "private", label: "Private", helper: "Only you can see this list." },
  {
    value: "public",
    label: "Public",
    helper: "Anyone can view and subscribe. Subscribers see your updates.",
  },
  {
    value: "affiliate",
    label: "Affiliate",
    helper: "Affiliate members can view and subscribe.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    helper: "Share via link. Others can subscribe and receive your updates.",
  },
];

function visibilityLabel(list: UserList): string {
  if (list.list_relationship === "subscriber" || list.access_status === "subscribed") {
    return "Subscribed";
  }
  switch (list.visibility) {
    case "public":
      return "Public";
    case "unlisted":
      return "Unlisted";
    case "affiliate":
      return "Affiliate";
    case "invite_only":
      return "Invite only";
    default:
      return "Private";
  }
}

export default function AccountLists() {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [lists, setLists] = useState<UserList[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] =
    useState<Exclude<ListVisibility, "invite_only">>("private");

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = tab === "mine" ? loadUserLists : loadPublicLists;
    (async () => {
      try {
        const page = await load({ force: true, signal: ac.signal });
        if (cancelled) return;
        setLists(Array.isArray(page.lists) ? page.lists : []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load lists.");
        setLists([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [tab]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((list) => {
      const hay = `${list.title} ${list.description ?? ""} ${list.owner_display_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [lists, query]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createUserList({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      setTitle("");
      setDescription("");
      setVisibility("private");
      setShowCreate(false);
      setTab("mine");
      const page = await loadUserLists({ force: true });
      setLists(Array.isArray(page.lists) ? page.lists : []);
    } catch {
      setError("Unable to create that list.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <DashboardLayout
      title="Lists"
      description="Collections of posts, recipes, workouts, and articles. Separate from saved favorites."
    >
      <div className="account-tabs" role="tablist" aria-label="Lists">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          className={tab === "mine" ? "account-chip account-chip--on" : "account-chip"}
          onClick={() => setTab("mine")}
        >
          My lists
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "public"}
          className={tab === "public" ? "account-chip account-chip--on" : "account-chip"}
          onClick={() => setTab("public")}
        >
          Public lists
        </button>
        <button
          type="button"
          className="account-btn"
          onClick={() => setShowCreate((v) => !v)}
        >
          Create list
        </button>
      </div>

      {showCreate ? (
        <form className="account-list-form account-card" onSubmit={(e) => void onCreate(e)}>
          <label htmlFor="list-title">
            Title
            <input
              id="list-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label htmlFor="list-description">
            Description
            <textarea
              id="list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>
          <fieldset>
            <legend>Visibility</legend>
            {VISIBILITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="account-check">
                <input
                  type="radio"
                  name="list-visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                />
                <span>
                  <strong>{opt.label}</strong>
                  <span className="account-muted"> {opt.helper}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="account-btn" disabled={creating || !title.trim()}>
            {creating ? "Creating…" : "Save list"}
          </button>
        </form>
      ) : null}

      <form
        className="account-search"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="account-search__label" htmlFor="list-search">
          Search lists
        </label>
        <input
          id="list-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lists"
        />
      </form>

      {error ? <p className="account-error">{error}</p> : null}
      {loading ? <p className="account-muted">Loading lists…</p> : null}

      {!loading && visible.length === 0 ? (
        <section className="account-empty" aria-labelledby="lists-empty-heading">
          <h2 id="lists-empty-heading">
            {lists.length === 0 ? "No lists yet" : "No lists match"}
          </h2>
          <p className="account-muted">
            {tab === "mine"
              ? "Create a list to collect posts, recipes, workouts, and articles."
              : "No public lists are available right now."}
          </p>
        </section>
      ) : null}

      {visible.length > 0 ? (
        <ul className="account-lists-grid">
          {visible.map((list) => (
            <li key={list.id}>
              <Link href={basePath(`/account/lists/${list.id}`)} className="account-list-card">
                {list.cover_image_url ? (
                  <img
                    className="account-list-card__cover"
                    src={list.cover_image_url}
                    alt=""
                  />
                ) : null}
                <div className="account-list-card__body">
                  <span className="account-tag">{visibilityLabel(list)}</span>
                  <span className="account-saved-item__title">{list.title}</span>
                  {list.description ? (
                    <span className="account-muted">{list.description}</span>
                  ) : null}
                  <span className="account-muted">
                    {list.item_count} {list.item_count === 1 ? "item" : "items"}
                    {list.list_relationship === "subscriber" && list.owner_display_name
                      ? ` · ${list.owner_display_name}`
                      : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardLayout>
  );
}
