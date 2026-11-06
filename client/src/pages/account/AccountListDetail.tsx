import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { basePath } from "@/const";
import { fetchLibrarySearch } from "@/pages/library/api";
import {
  addUserListItem,
  deleteUserList,
  inviteListSubscriber,
  loadCustomRecipes,
  loadFavorites,
  loadOwnedCustomWorkouts,
  loadSubscriptions,
  loadUserList,
  loadUserListByToken,
  loadUserListItems,
  removeListSubscriber,
  removeUserListItem,
  reorderUserListItems,
  submitContentReport,
  subscribeToUserList,
  unsubscribeFromUserList,
  updateUserList,
  updateUserListItem,
  type FavoriteItem,
  type UserList,
  type UserListItem,
} from "@/lib/account";
import {
  CONTENT_REPORT_REASONS,
  type ContentReportReason,
} from "@shared/account/contentReports";
import type { CatalogHit } from "@shared/account/listCatalog";
import { dailyFixPicks, recentDailyFixDates, type DailyFixPick } from "@shared/daily-fix/picks";
import type { LibraryResource } from "@shared/library";
import type { ListSourceType, ListVisibility } from "@shared/account/userLists";
import { metfixToolsUnlocked } from "./metfixAppTools";
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
    helper: "Anyone can view and subscribe.",
  },
  {
    value: "affiliate",
    label: "Affiliate",
    helper: "Affiliate members can view and subscribe.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    helper: "Share via link.",
  },
];

const SOURCE_LABEL: Record<string, string> = {
  post: "Post",
  daily_mod: "Recipe",
  custom_recipe: "Recipe",
  daily_workout: "Workout",
  custom_workout: "Workout",
  daily_article: "Article",
  meal_plan: "Meal plan",
  plan: "Meal plan",
};

const FAVORITE_SOURCE: Record<string, ListSourceType> = {
  post: "post",
  wp_post: "post",
  daily_mod: "daily_mod",
  recipe: "daily_mod",
  recipes: "daily_mod",
  custom_recipe: "custom_recipe",
  daily_workout: "daily_workout",
  workout: "daily_workout",
  workouts: "daily_workout",
  custom_workout: "custom_workout",
  daily_article: "daily_article",
  article: "daily_article",
  articles: "daily_article",
  meal_plan: "meal_plan",
  plan: "meal_plan",
};

function itemHref(item: UserListItem): string | null {
  if (item.content.source_type === "post") {
    return `/posts/${item.content.source_id}`;
  }
  const url =
    item.content.article_url ||
    item.content.video_url ||
    item.content.recipe_url ||
    item.content.url;
  if (url && (url.startsWith("https://") || url.startsWith("/"))) return url;
  return null;
}

function sharePath(list: UserList): string | null {
  if (list.visibility === "unlisted" && list.share_token) {
    return `/account/lists/share/${list.share_token}`;
  }
  if (list.visibility === "public") return `/account/lists/${list.id}`;
  return null;
}

function paymentUrl(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: number; body?: unknown };
  if (e.status !== 402 || !e.body || typeof e.body !== "object") return null;
  const web = (e.body as { web_url?: unknown }).web_url;
  return typeof web === "string" && web.startsWith("https://") ? web : null;
}

const PILLAR_SOURCE = {
  belly: "daily_mod",
  body: "daily_workout",
  brain: "daily_article",
} as const;

function userIdFromInput(raw: string): number | null {
  const text = raw.trim();
  if (!/^[1-9][0-9]{0,9}$/.test(text)) return null;
  return Number(text);
}

function mutateErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("body" in err)) return null;
  const body = (err as { body?: unknown }).body;
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const code = (body as { error?: unknown }).error;
  return typeof code === "string" ? code : null;
}

function numericFavorite(item: FavoriteItem): { source_type: ListSourceType; source_id: number } | null {
  const mapped = FAVORITE_SOURCE[item.source_type];
  const id = Number(item.source_id);
  if (!mapped || !Number.isSafeInteger(id) || id <= 0) return null;
  return { source_type: mapped, source_id: id };
}

type Props = { token?: string; id?: string };

function ListDetail({ token, id }: Props) {
  const [, setLocation] = useLocation();
  const [list, setList] = useState<UserList | null>(null);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ListVisibility>("private");
  const [pro, setPro] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [dailyQuery, setDailyQuery] = useState("");
  const [libraryHits, setLibraryHits] = useState<LibraryResource[]>([]);
  const [savedHits, setSavedHits] = useState<FavoriteItem[]>([]);
  const [dailyHits, setDailyHits] = useState<DailyFixPick[]>([]);
  const [recipeHits, setRecipeHits] = useState<CatalogHit[]>([]);
  const [workoutHits, setWorkoutHits] = useState<CatalogHit[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ContentReportReason>("spam");
  const [reportNote, setReportNote] = useState("");
  const [inviteId, setInviteId] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [shareToken, setShareToken] = useState<string | undefined>(token);

  const owner = list?.list_relationship === "owner";
  const subscriber = list?.list_relationship === "subscriber";
  const external = list != null && !owner && !subscriber;

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const subs = await loadSubscriptions({ signal: ac.signal }).catch(() => null);
        if (!cancelled) setPro(subs ? metfixToolsUnlocked(subs.canonical_tier) : false);
        let loaded: UserList;
        let tokenForItems = token;
        if (token) {
          const page = await loadUserListByToken(token, { force: true, signal: ac.signal });
          loaded = page.list;
          tokenForItems = token;
        } else {
          const numeric = Number(id);
          if (!Number.isSafeInteger(numeric) || numeric <= 0) {
            throw new Error("invalid");
          }
          const page = await loadUserList(numeric, { force: true, signal: ac.signal });
          loaded = page.list;
        }
        if (cancelled) return;
        setList(loaded);
        setShareToken(tokenForItems);
        setTitle(loaded.title);
        setDescription(loaded.description ?? "");
        setVisibility(loaded.visibility);
        const itemPage = await loadUserListItems(loaded.id, {
          force: true,
          signal: ac.signal,
          shareToken: tokenForItems,
        });
        if (cancelled) return;
        setItems(Array.isArray(itemPage.items) ? itemPage.items : []);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load this list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [token, id]);

  async function refresh(nextId = list?.id) {
    if (nextId == null) return;
    const page = token
      ? await loadUserListByToken(token, { force: true })
      : await loadUserList(nextId, { force: true, shareToken });
    setList(page.list);
    const itemPage = await loadUserListItems(page.list.id, {
      force: true,
      shareToken: token ?? shareToken,
    });
    setItems(Array.isArray(itemPage.items) ? itemPage.items : []);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!list || !owner) return;
    setBusy(true);
    setError(null);
    try {
      await updateUserList(list.id, {
        title: title.trim(),
        description: description.trim(),
        visibility,
      });
      setEditing(false);
      await refresh(list.id);
    } catch {
      setError("Unable to update this list.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!list || !owner) return;
    if (!window.confirm("Delete this list?")) return;
    setBusy(true);
    try {
      await deleteUserList(list.id);
      setLocation(basePath("/account/lists"));
    } catch {
      setError("Unable to delete this list.");
      setBusy(false);
    }
  }

  async function onSubscribe() {
    if (!list) return;
    setBusy(true);
    setError(null);
    setPayUrl(null);
    try {
      await subscribeToUserList(list.id, shareToken);
      await refresh(list.id);
    } catch (err) {
      const url = paymentUrl(err);
      if (url) setPayUrl(url);
      setError(url ? "This list requires a purchase before you can subscribe." : "Unable to subscribe.");
    } finally {
      setBusy(false);
    }
  }

  async function onUnsubscribe() {
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromUserList(list.id);
      await refresh(list.id);
    } catch {
      setError("Unable to unsubscribe.");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!list) return;
    const path = sharePath(list);
    if (!path) return;
    const absolute = new URL(basePath(path), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      setError("Unable to copy the link.");
    }
  }

  async function onRemove(itemId: number) {
    if (!list || !owner) return;
    setBusy(true);
    setError(null);
    try {
      await removeUserListItem(list.id, itemId);
      await refresh(list.id);
    } catch {
      setError("Unable to remove that item.");
    } finally {
      setBusy(false);
    }
  }

  async function onMove(index: number, dir: -1 | 1) {
    if (!list || !owner) return;
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const ordered = items.slice();
    const [row] = ordered.splice(index, 1);
    if (!row) return;
    ordered.splice(next, 0, row);
    setBusy(true);
    setError(null);
    try {
      await reorderUserListItems(
        list.id,
        ordered.map((item, sort_order) => ({ id: item.id, sort_order })),
      );
      await refresh(list.id);
    } catch {
      setError("Unable to reorder items.");
    } finally {
      setBusy(false);
    }
  }

  async function onNote(item: UserListItem, note: string) {
    if (!list || !owner) return;
    setBusy(true);
    setError(null);
    try {
      await updateUserListItem(list.id, item.id, { note });
      await refresh(list.id);
    } catch {
      setError("Unable to save that note.");
    } finally {
      setBusy(false);
    }
  }

  async function addItem(source_type: ListSourceType | string, source_id: number) {
    if (!list || !owner) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const added = await addUserListItem(list.id, { source_type, source_id });
      await refresh(list.id);
      if (added.listed === false) {
        setNotice("Saved. The list catalog did not return this item.");
      }
    } catch {
      setError("Unable to add that item.");
    } finally {
      setBusy(false);
    }
  }

  async function searchDaily(e: FormEvent) {
    e.preventDefault();
    const query = dailyQuery.trim();
    setError(null);
    if (!query) {
      await loadRecentDaily();
      return;
    }
    try {
      const page = await fetchLibrarySearch({
        query,
        content_types: ["daily_fix"],
        limit: 12,
      });
      const hits: DailyFixPick[] = [];
      for (const hit of page.resources) {
        const pillar = hit.daily_fix_pillar;
        if (!pillar) continue;
        hits.push({
          source_type: PILLAR_SOURCE[pillar],
          source_id: hit.id,
          title: hit.title,
          date: hit.daily_fix_date ?? "",
        });
      }
      setDailyHits(hits);
    } catch {
      setError("Unable to search Daily Fix.");
    }
  }

  async function loadRecentDaily() {
    setError(null);
    try {
      const pages = await Promise.all(
        recentDailyFixDates(7).map(async (date) => {
          const res = await fetch(`/api/daily-fix?date=${date}`, {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
          });
          if (!res.ok) return [];
          return dailyFixPicks(await res.json());
        }),
      );
      const seen = new Set<string>();
      const hits: DailyFixPick[] = [];
      for (const pick of pages.flat()) {
        const key = `${pick.source_type}:${pick.source_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(pick);
      }
      setDailyHits(hits);
    } catch {
      setError("Unable to load recent Daily Fix days.");
    }
  }

  async function loadMyRecipes() {
    setError(null);
    try {
      const page = await loadCustomRecipes({ force: true });
      setRecipeHits(
        (page.recipes ?? [])
          .filter((row) => Number.isInteger(row.id) && row.id > 0 && row.title.trim().length > 0)
          .map((row) => ({ id: row.id, title: row.title.trim() })),
      );
    } catch {
      setError("Unable to load your recipes.");
    }
  }

  async function loadMyWorkouts() {
    setError(null);
    try {
      const page = await loadOwnedCustomWorkouts({ force: true });
      setWorkoutHits(Array.isArray(page.items) ? page.items : []);
    } catch {
      setError("Unable to load your workouts.");
    }
  }

  async function onReport(e: FormEvent) {
    e.preventDefault();
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      await submitContentReport({
        content_type: "user_list",
        content_id: list.id,
        reason_code: reason,
        note: reportNote,
      });
      setReporting(false);
      setReportNote("");
      setNotice("Report submitted. Thank you.");
    } catch (err) {
      if (mutateErrorCode(err) === "duplicate_report") {
        setReporting(false);
        setNotice("You already have an open report for this list.");
      } else {
        setError("Unable to submit that report.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!list || !owner) return;
    const userId = userIdFromInput(inviteId);
    if (userId == null) {
      setError("Enter a user ID.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await inviteListSubscriber(list.id, userId);
      setInviteId("");
      setNotice(`Invited user ${userId}.`);
    } catch {
      setError("Unable to invite that user.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveSubscriber(e: FormEvent) {
    e.preventDefault();
    if (!list || !owner) return;
    const userId = userIdFromInput(removeId);
    if (userId == null) {
      setError("Enter a user ID.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await removeListSubscriber(list.id, userId);
      setRemoveId("");
      setNotice(`Removed user ${userId}.`);
    } catch {
      setError("Unable to remove that subscriber.");
    } finally {
      setBusy(false);
    }
  }

  async function searchLibrary(e: FormEvent) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    setError(null);
    try {
      const page = await fetchLibrarySearch({
        query: addQuery.trim(),
        content_types: ["post", "exclusive_resource"],
        limit: 8,
      });
      setLibraryHits(page.resources);
    } catch {
      setError("Unable to search the library.");
    }
  }

  async function loadSaved() {
    setError(null);
    try {
      const page = await loadFavorites("all", { force: true });
      setSavedHits(Array.isArray(page.items) ? page.items : []);
    } catch {
      setError("Unable to load saved items.");
    }
  }

  const canShare =
    owner && (list?.visibility === "public" || list?.visibility === "unlisted");
  const link = list ? sharePath(list) : null;

  return (
    <DashboardLayout
      title={list?.title ?? "List"}
      description={list?.description ?? "A MetFix list."}
    >
      <p>
        <Link href={basePath("/account/lists")}>Back to lists</Link>
      </p>
      {error ? <p className="account-error">{error}</p> : null}
      {notice ? <p className="account-muted">{notice}</p> : null}
      {payUrl ? (
        <p>
          <a className="account-btn" href={payUrl}>
            Purchase this list
          </a>
        </p>
      ) : null}
      {loading ? <p className="account-muted">Loading list…</p> : null}

      {list ? (
        <section className="account-card">
          <p className="account-tag">
            {list.list_relationship === "subscriber"
              ? "Subscribed"
              : list.visibility.replace("_", " ")}
          </p>
          {list.owner_display_name && !owner ? (
            <p className="account-muted">By {list.owner_display_name}</p>
          ) : null}
          {list.description ? <p>{list.description}</p> : null}
          <p className="account-muted">
            {list.item_count} {list.item_count === 1 ? "item" : "items"}
          </p>
          <div className="account-list-item__actions">
            {owner ? (
              <button type="button" className="account-btn account-btn--ghost" onClick={() => setEditing((v) => !v)}>
                Edit
              </button>
            ) : null}
            {owner ? (
              <button type="button" className="account-btn account-btn--ghost" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </button>
            ) : null}
            {subscriber ? (
              <button type="button" className="account-btn account-btn--ghost" disabled={busy} onClick={() => void onUnsubscribe()}>
                Unsubscribe
              </button>
            ) : null}
            {external && list.visibility !== "private" && list.visibility !== "invite_only" ? (
              <button type="button" className="account-btn" disabled={busy} onClick={() => void onSubscribe()}>
                Subscribe
              </button>
            ) : null}
            {external && list.visibility === "invite_only" ? (
              <p className="account-muted">This list is invite only.</p>
            ) : null}
            {canShare && link && pro ? (
              <button type="button" className="account-btn account-btn--ghost" onClick={() => void onCopy()}>
                {copied ? "Link copied" : "Copy link"}
              </button>
            ) : null}
            {canShare && !pro ? (
              <Link href={basePath("/join")} className="account-btn account-btn--ghost">
                Sharing is included with Pro
              </Link>
            ) : null}
            <button
              type="button"
              className="account-btn account-btn--ghost"
              onClick={() => setReporting((open) => !open)}
            >
              Report
            </button>
          </div>
          {reporting ? (
            <form className="account-list-form" onSubmit={(e) => void onReport(e)}>
              <label htmlFor="report-reason">
                Why are you reporting this?
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ContentReportReason)}
                >
                  {CONTENT_REPORT_REASONS.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="report-note">
                Note
                <textarea
                  id="report-note"
                  rows={3}
                  maxLength={2000}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                />
              </label>
              <button type="submit" className="account-btn" disabled={busy}>
                Submit report
              </button>
            </form>
          ) : null}
          {editing && owner ? (
            <form className="account-list-form" onSubmit={(e) => void onSaveEdit(e)}>
              <label htmlFor="edit-list-title">
                Title
                <input id="edit-list-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label htmlFor="edit-list-description">
                Description
                <textarea
                  id="edit-list-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label htmlFor="edit-list-visibility">
                Visibility
                <select
                  id="edit-list-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ListVisibility)}
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.helper}
                    </option>
                  ))}
                  {visibility === "invite_only" ? (
                    <option value="invite_only">Invite only</option>
                  ) : null}
                </select>
              </label>
              <button type="submit" className="account-btn" disabled={busy}>
                Save changes
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {items.length > 0 ? (
        <ol className="account-list-items">
          {items.map((item, index) => {
            const href = itemHref(item);
            const titleNode = href ? (
              href.startsWith("/") ? (
                <Link href={basePath(href)}>{item.content.title}</Link>
              ) : (
                <a href={href} rel="noopener noreferrer">
                  {item.content.title}
                </a>
              )
            ) : (
              <span>{item.content.title}</span>
            );
            return (
              <li key={item.id} className="account-list-item">
                <div className="account-saved-item__meta">
                  <span className="account-tag">
                    {SOURCE_LABEL[item.content.source_type] ?? item.content.source_type}
                  </span>
                  <div className="account-saved-item__title">{titleNode}</div>
                  {item.note ? <p className="account-muted">{item.note}</p> : null}
                </div>
                {owner ? (
                  <div className="account-list-item__actions">
                    <button
                      type="button"
                      className="account-btn account-btn--ghost"
                      disabled={busy || index === 0}
                      onClick={() => void onMove(index, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="account-btn account-btn--ghost"
                      disabled={busy || index === items.length - 1}
                      onClick={() => void onMove(index, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="account-btn account-btn--ghost"
                      disabled={busy}
                      onClick={() => void onRemove(item.id)}
                    >
                      Remove
                    </button>
                    <NoteEditor
                      note={item.note ?? ""}
                      disabled={busy}
                      onSave={(note) => void onNote(item, note)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {!loading && list && items.length === 0 ? (
        <p className="account-muted">This list has no items yet.</p>
      ) : null}

      {owner && list ? (
        <section className="account-card" aria-labelledby="subscribers-heading">
          <h2 id="subscribers-heading" className="account-section-title">
            Subscribers
          </h2>
          <p className="account-muted">Invite or remove someone by their user ID.</p>
          <form className="account-search" onSubmit={(e) => void onInvite(e)}>
            <label className="account-search__label" htmlFor="invite-user-id">
              Invite user
            </label>
            <input
              id="invite-user-id"
              inputMode="numeric"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              placeholder="User ID"
            />
            <button type="submit" className="account-btn" disabled={busy}>
              Invite
            </button>
          </form>
          <form className="account-search" onSubmit={(e) => void onRemoveSubscriber(e)}>
            <label className="account-search__label" htmlFor="remove-user-id">
              Remove subscriber
            </label>
            <input
              id="remove-user-id"
              inputMode="numeric"
              value={removeId}
              onChange={(e) => setRemoveId(e.target.value)}
              placeholder="User ID"
            />
            <button type="submit" className="account-btn account-btn--ghost" disabled={busy}>
              Remove subscriber
            </button>
          </form>
        </section>
      ) : null}

      {owner && list ? (
        <section className="account-card" aria-labelledby="add-item-heading">
          <h2 id="add-item-heading" className="account-section-title">
            Add items
          </h2>
          <form className="account-search" onSubmit={(e) => void searchDaily(e)}>
            <label className="account-search__label" htmlFor="add-daily-query">
              Daily Fix
            </label>
            <input
              id="add-daily-query"
              value={dailyQuery}
              onChange={(e) => setDailyQuery(e.target.value)}
              placeholder="Search recipes, workouts, and articles"
            />
            <button type="submit" className="account-btn account-btn--ghost">
              Search Daily Fix
            </button>
            <button type="button" className="account-btn account-btn--ghost" onClick={() => void loadRecentDaily()}>
              Recent Daily Fix
            </button>
          </form>
          <PickList
            hits={dailyHits.map((hit) => ({
              key: `${hit.source_type}:${hit.source_id}`,
              title: hit.date ? `${hit.title} (${hit.date})` : hit.title,
              source_type: hit.source_type,
              source_id: hit.source_id,
            }))}
            busy={busy}
            onAdd={(source_type, source_id) => void addItem(source_type, source_id)}
          />
          <div className="account-list-item__actions">
            <button type="button" className="account-btn account-btn--ghost" onClick={() => void loadMyRecipes()}>
              My recipes
            </button>
            <button type="button" className="account-btn account-btn--ghost" onClick={() => void loadMyWorkouts()}>
              My workouts
            </button>
          </div>
          <PickList
            hits={recipeHits.map((hit) => ({
              key: `custom_recipe:${hit.id}`,
              title: hit.title,
              source_type: "custom_recipe",
              source_id: hit.id,
            }))}
            busy={busy}
            onAdd={(source_type, source_id) => void addItem(source_type, source_id)}
          />
          <PickList
            hits={workoutHits.map((hit) => ({
              key: `custom_workout:${hit.id}`,
              title: hit.title,
              source_type: "custom_workout",
              source_id: hit.id,
            }))}
            busy={busy}
            onAdd={(source_type, source_id) => void addItem(source_type, source_id)}
          />
          <form className="account-search" onSubmit={(e) => void searchLibrary(e)}>
            <label className="account-search__label" htmlFor="add-library-query">
              Search library posts
            </label>
            <input
              id="add-library-query"
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Search posts"
            />
            <button type="submit" className="account-btn account-btn--ghost">
              Search library
            </button>
            <button type="button" className="account-btn account-btn--ghost" onClick={() => void loadSaved()}>
              From saved
            </button>
          </form>
          <PickList
            hits={libraryHits.map((hit) => ({
              key: `${hit.type}:${hit.daily_fix_pillar ?? ""}:${hit.id}`,
              title: hit.title,
              source_type: "post",
              source_id: hit.id,
            }))}
            busy={busy}
            onAdd={(source_type, source_id) => void addItem(source_type, source_id)}
          />
          {savedHits.length > 0 ? (
            <ul className="account-saved-list">
              {savedHits.map((hit) => {
                const mapped = numericFavorite(hit);
                const label = hit.title ?? hit.source_id;
                return (
                  <li key={`${hit.source_type}:${hit.source_id}`} className="account-saved-item">
                    <span>{label}</span>
                    {mapped ? (
                      <button
                        type="button"
                        className="account-btn account-btn--ghost"
                        disabled={busy}
                        onClick={() => void addItem(mapped.source_type, mapped.source_id)}
                      >
                        Add {label}
                      </button>
                    ) : (
                      <span className="account-muted">Not addable</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </DashboardLayout>
  );
}

function PickList({
  hits,
  busy,
  onAdd,
}: {
  hits: Array<{ key: string; title: string; source_type: string; source_id: number }>;
  busy: boolean;
  onAdd: (source_type: string, source_id: number) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <ul className="account-saved-list">
      {hits.map((hit) => (
        <li key={hit.key} className="account-saved-item">
          <span>{hit.title}</span>
          <button
            type="button"
            className="account-btn account-btn--ghost"
            disabled={busy}
            onClick={() => onAdd(hit.source_type, hit.source_id)}
          >
            Add {hit.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

function NoteEditor({
  note,
  disabled,
  onSave,
}: {
  note: string;
  disabled: boolean;
  onSave: (note: string) => void;
}) {
  const [value, setValue] = useState(note);
  return (
    <form
      className="account-note"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value.trim());
      }}
    >
      <label>
        Note
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={500} />
      </label>
      <button type="submit" className="account-btn account-btn--ghost" disabled={disabled}>
        Save note
      </button>
    </form>
  );
}

export function AccountListSharePage() {
  const [, params] = useRoute<{ token: string }>("/account/lists/share/:token");
  return <ListDetail token={params?.token ?? ""} />;
}

export default function AccountListDetail() {
  const [, params] = useRoute<{ id: string }>("/account/lists/:id");
  return <ListDetail id={params?.id ?? ""} />;
}
