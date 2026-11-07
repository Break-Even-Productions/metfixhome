import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  loadInbox,
  loadNotifications,
  updateNotifications,
  type AccountInboxNotification,
  type NotificationsPayload,
} from "@/lib/account";
import { resolveNotificationHref } from "@shared/account/notificationDeepLinks";
import DashboardLayout from "./DashboardLayout";
import { humanSettingLabel } from "./settingLabels";

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

function formatStamp(raw: string): string {
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return raw;
  const month = SHORT_MONTHS[d.getMonth()] ?? "";
  const day = d.getDate();
  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${month} ${day}, ${hour}:${minute} ${ampm}`;
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

export default function AccountNotifications() {
  const [prefsData, setPrefsData] = useState<NotificationsPayload | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [newsletter, setNewsletter] = useState(false);
  const [items, setItems] = useState<AccountInboxNotification[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const [n, inbox] = await Promise.all([
          loadNotifications({ signal: ac.signal }),
          loadInbox({ force: true, signal: ac.signal }).catch(() => null),
        ]);
        if (cancelled) return;
        setPrefsData(n);
        setPrefs({ ...(n.preferences ?? {}) });
        setNewsletter(n.newsletter === true);
        const list = Array.isArray(inbox?.notifications)
          ? inbox!.notifications!
          : Array.isArray(inbox?.items)
            ? inbox!.items!
            : [];
        setItems(list);
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
  }, []);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const next = await updateNotifications({
        preferences: prefs,
        newsletter,
      });
      setPrefsData(next);
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const keys =
    Object.keys(prefs).length > 0 ? Object.keys(prefs) : ["email_digest", "product_updates"];
  const rows = keys.flatMap((key) => {
    const label = humanSettingLabel(key);
    return label ? [{ key, label }] : [];
  });

  const unread = useMemo(() => items.filter(isUnread).length, [items]);

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
            <span className="account-inbox-list__badge account-mono">{unread}</span>
          ) : null}
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
          <ul className="account-inbox-list">
            {items.map((n) => {
              const href = notificationHref(n);
              const title = notificationTitle(n);
              const body = notificationBody(n);
              const time =
                typeof n.created_at === "string" && n.created_at
                  ? formatStamp(n.created_at)
                  : "";
              const unreadRow = isUnread(n);
              const inner = (
                <>
                  <div className="account-notif-feed__main">
                    <div className="account-inbox-list__title">
                      {title}
                      {unreadRow ? (
                        <span className="account-notif-feed__dot" aria-label="Unread" />
                      ) : null}
                    </div>
                    {body ? <div className="account-muted">{body}</div> : null}
                  </div>
                  {time ? (
                    <div className="account-muted account-mono account-inbox-list__time">
                      {time}
                    </div>
                  ) : null}
                </>
              );
              return (
                <li
                  key={String(n.id)}
                  className="account-inbox-list__item"
                  data-read={unreadRow ? "false" : "true"}
                >
                  {href ? (
                    <Link
                      href={href}
                      className="account-notif-feed__link"
                      data-notif-type={n.type ?? undefined}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="account-notif-feed__static">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="account-card account-notif-prefs">
        <h2>Preferences</h2>
        <p className="account-muted account-notif-prefs__lede">
          Choose email updates and the newsletter. In-app alerts stay in the list above.
        </p>
        {rows.map((row) => (
          <label className="account-toggle-row" key={row.key}>
            <span>{row.label}</span>
            <input
              type="checkbox"
              checked={prefs[row.key] === true}
              onChange={(e) => setPrefs((p) => ({ ...p, [row.key]: e.target.checked }))}
            />
          </label>
        ))}
        <label className="account-toggle-row">
          <span>Newsletter</span>
          <input
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
          />
        </label>
        <button
          type="button"
          className="account-btn"
          style={{ marginTop: "1rem" }}
          disabled={busy}
          onClick={() => void onSave()}
        >
          Save preferences
        </button>
        {prefsData ? null : null}
      </section>
    </DashboardLayout>
  );
}
