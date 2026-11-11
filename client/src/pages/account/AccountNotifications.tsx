import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dismissInboxNotification,
  loadInbox,
  markInboxNotificationRead,
  type AccountInbox,
  type AccountInboxNotification,
} from "@/lib/account";
import {
  externalNotificationHref,
  resolveNotificationHref,
} from "@shared/account/notificationDeepLinks";
import DashboardLayout from "./DashboardLayout";

const PAGE_SIZE = 50;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type InboxView = "focused" | "all";

function formatWhen(raw: string): string {
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return raw;
  const month = SHORT_MONTHS[d.getMonth()] ?? "";
  return `${month} ${d.getDate()}`;
}

function notificationId(n: AccountInboxNotification): number | null {
  const id = typeof n.id === "number" ? n.id : Number(n.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function notificationSource(n: AccountInboxNotification): "site" | "personal" | null {
  return n.source === "site" || n.source === "personal" ? n.source : null;
}

function notificationTitle(n: AccountInboxNotification): string {
  return (n.title ?? "").trim() || "Notification";
}

function notificationBody(n: AccountInboxNotification): string {
  return ((n.message ?? n.content ?? "") as string).trim();
}

function notificationHref(n: AccountInboxNotification): string | null {
  return resolveNotificationHref({
    type: n.type,
    link: n.link,
    post_id: n.post_id,
    href: n.href,
  });
}

function isUnread(n: AccountInboxNotification): boolean {
  if (n.read === true) return false;
  if (n.read === false) return true;
  return !(typeof n.read_at === "string" && n.read_at.trim() !== "");
}

function rowsOf(inbox: AccountInbox | null): AccountInboxNotification[] {
  if (!inbox) return [];
  if (Array.isArray(inbox.notifications)) return inbox.notifications;
  if (Array.isArray(inbox.items)) return inbox.items;
  return [];
}

export default function AccountNotifications() {
  const [view, setView] = useState<InboxView>("focused");
  const [items, setItems] = useState<AccountInboxNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [pendingDismiss, setPendingDismiss] = useState<AccountInboxNotification | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const inbox = await loadInbox({
          view,
          limit: PAGE_SIZE,
          offset: 0,
          force: true,
          signal: ac.signal,
        });
        if (cancelled) return;
        const list = rowsOf(inbox);
        setItems(list);
        setTotal(typeof inbox.total_count === "number" ? inbox.total_count : list.length);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load notifications.");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [view]);

  useEffect(() => {
    if (!menuKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuKey(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuKey(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuKey]);

  function markReadLocal(n: AccountInboxNotification) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === n.id && item.source === n.source
          ? { ...item, read: true, read_at: item.read_at || new Date().toISOString() }
          : item,
      ),
    );
  }

  async function markRead(n: AccountInboxNotification) {
    if (!isUnread(n)) return;
    const id = notificationId(n);
    if (id == null) return;
    const previous = n;
    markReadLocal(n);
    try {
      await markInboxNotificationRead(id);
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === previous.id && item.source === previous.source ? previous : item)),
      );
      setError("Couldn't mark that notification as read.");
    }
  }

  async function dismiss(n: AccountInboxNotification) {
    const id = notificationId(n);
    const source = notificationSource(n);
    if (id == null || !source) return;
    const previous = items;
    const previousTotal = total;
    setItems((prev) => prev.filter((item) => !(item.id === n.id && item.source === n.source)));
    setTotal((count) => Math.max(0, count - 1));
    setMenuKey(null);
    try {
      await dismissInboxNotification(id, source);
    } catch {
      setItems(previous);
      setTotal(previousTotal);
      setError("Couldn't dismiss that notification.");
    }
  }

  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    setError(null);
    try {
      const inbox = await loadInbox({
        view,
        limit: PAGE_SIZE,
        offset: items.length,
        force: true,
      });
      const list = rowsOf(inbox);
      setItems((prev) => [...prev, ...list]);
      if (typeof inbox.total_count === "number") setTotal(inbox.total_count);
    } catch {
      setError("Unable to load notifications.");
    } finally {
      setLoadingMore(false);
    }
  }

  const unread = useMemo(() => items.filter(isUnread).length, [items]);
  const hasMore = items.length < total;
  const badge = hasMore ? `${unread}+` : String(unread);

  return (
    <DashboardLayout
      title="Notifications"
      description="Recent alerts and how MetFix reaches you."
    >
      {error ? <p className="account-error">{error}</p> : null}

      <section className="account-card account-notif-feed">
        <div className="account-notif-feed__head">
          <h2>Inbox</h2>
          {unread > 0 ? (
            <span className="account-inbox-list__badge account-mono">{badge}</span>
          ) : null}
        </div>
        <div className="account-notif-tabs" role="group" aria-label="Notification view">
          <button
            type="button"
            aria-pressed={view === "focused"}
            onClick={() => setView("focused")}
          >
            Focused
          </button>
          <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>
            All
          </button>
        </div>
        {listLoading ? (
          <p className="account-muted" aria-busy="true">
            Loading…
          </p>
        ) : null}
        {!listLoading && items.length === 0 ? (
          <p className="account-muted">No notifications yet.</p>
        ) : null}
        {!listLoading && items.length > 0 ? (
          <ul className="account-inbox-list account-notif-feed__list">
            {items.map((n, index) => {
              const href = notificationHref(n);
              const external = href ? null : externalNotificationHref(n.link);
              const title = notificationTitle(n);
              const body = notificationBody(n);
              const when =
                typeof n.created_at === "string" && n.created_at ? formatWhen(n.created_at) : "";
              const unreadRow = isUnread(n);
              const key = `${n.source ?? "n"}-${String(n.id)}-${index}`;
              const menuOpen = menuKey === key;
              const copy = (
                <>
                  <div className="account-notif-row__headline">
                    <span className="account-inbox-list__title">{title}</span>
                    {unreadRow ? <span className="sr-only">Unread</span> : null}
                    {when ? <span className="account-notif-row__when">· {when}</span> : null}
                    {external ? (
                      <ExternalLink
                        className="account-notif-feed__external"
                        size={14}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  {body ? <p className="account-notif-row__body">{body}</p> : null}
                </>
              );
              return (
                <li
                  key={key}
                  className="account-inbox-list__item"
                  data-read={unreadRow ? "false" : "true"}
                >
                  {href ? (
                    <Link
                      href={href}
                      className="account-notif-feed__link"
                      data-notif-type={n.type ?? undefined}
                      onClick={() => void markRead(n)}
                    >
                      {copy}
                    </Link>
                  ) : external ? (
                    <a
                      href={external}
                      className="account-notif-feed__link"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-notif-type={n.type ?? undefined}
                      onClick={() => void markRead(n)}
                    >
                      {copy}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="account-notif-feed__static"
                      onClick={() => void markRead(n)}
                    >
                      {copy}
                    </button>
                  )}
                  <div
                    className="account-notif-row__more"
                    ref={menuOpen ? menuRef : undefined}
                  >
                    <button
                      type="button"
                      className="account-notif-row__more-btn"
                      aria-label="More"
                      title="More"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuKey(menuOpen ? null : key)}
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
                    {menuOpen ? (
                      <div className="account-notif-row__menu" role="menu">
                        {unreadRow ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuKey(null);
                              void markRead(n);
                            }}
                          >
                            Mark as read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuKey(null);
                            setPendingDismiss(n);
                            setConfirmOpen(true);
                          }}
                          disabled={notificationSource(n) == null}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {!listLoading && hasMore ? (
          <button
            type="button"
            className="account-btn"
            style={{ marginTop: "0.85rem" }}
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="account-notif-confirm">
          <DialogHeader>
            <DialogTitle>Dismiss this notification?</DialogTitle>
            <DialogDescription>
              This notification will be removed from your inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="account-notif-confirm__actions">
            <button
              type="button"
              className="account-btn account-btn--ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="account-btn"
              onClick={() => {
                const target = pendingDismiss;
                setConfirmOpen(false);
                if (target) void dismiss(target);
              }}
            >
              Dismiss
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
