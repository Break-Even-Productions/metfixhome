import { useEffect, useMemo, useState } from "react";
import {
  loadInbox,
  type AccountInbox,
  type AccountInboxConversation,
  type AccountInboxNotification,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

function conversationTitle(c: AccountInboxConversation): string {
  return (c.name ?? "").trim() || `Conversation ${c.id}`;
}

function conversationPreview(c: AccountInboxConversation): string {
  const msg = (c.last_message ?? c.lastMessage ?? "").trim();
  return msg || "No messages yet.";
}

function conversationTime(c: AccountInboxConversation): string {
  const raw = c.last_message_time ?? c.lastMessageTime;
  if (!raw || typeof raw !== "string") return "";
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function unreadOf(c: AccountInboxConversation): number {
  const n = c.unread_count ?? c.unreadCount ?? 0;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function notificationTitle(n: AccountInboxNotification): string {
  return (n.title ?? "").trim() || "Notification";
}

function notificationBody(n: AccountInboxNotification): string {
  return ((n.message ?? n.content ?? "") as string).trim();
}

function notificationTime(n: AccountInboxNotification): string {
  const raw = n.created_at;
  if (!raw || typeof raw !== "string") return "";
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AccountInbox() {
  const [data, setData] = useState<AccountInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const inbox = await loadInbox({ force: true, signal: ac.signal });
        if (cancelled) return;
        setData(inbox);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setData(null);
        setError(
          "Unable to load inbox. Conversations and notifications may need the account worker proxy.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const conversations = useMemo(
    () => (Array.isArray(data?.conversations) ? data!.conversations! : []),
    [data],
  );
  const notifications = useMemo(() => {
    if (Array.isArray(data?.notifications)) return data!.notifications!;
    if (Array.isArray(data?.items)) return data!.items!;
    return [] as AccountInboxNotification[];
  }, [data]);

  const empty =
    !loading && !error && conversations.length === 0 && notifications.length === 0;

  return (
    <DashboardLayout
      title="Inbox"
      description="Conversations and in-app notifications."
    >
      {error ? <p className="account-error">{error}</p> : null}
      {loading ? (
        <p className="account-muted" aria-busy="true">
          Loading inbox…
        </p>
      ) : null}
      {empty ? (
        <p className="account-muted">No conversations or notifications yet.</p>
      ) : null}

      {!loading && conversations.length > 0 ? (
        <div className="account-card">
          <h2>Conversations</h2>
          <ul className="account-inbox-list">
            {conversations.map((c) => {
              const unread = unreadOf(c);
              return (
                <li key={String(c.id)} className="account-inbox-list__item">
                  <div>
                    <div className="account-inbox-list__title">
                      {conversationTitle(c)}
                      {unread > 0 ? (
                        <span className="account-inbox-list__badge account-mono">
                          {unread}
                        </span>
                      ) : null}
                    </div>
                    <div className="account-muted">{conversationPreview(c)}</div>
                  </div>
                  <div className="account-muted account-mono account-inbox-list__time">
                    {conversationTime(c)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!loading && notifications.length > 0 ? (
        <div className="account-card">
          <h2>Notifications</h2>
          <ul className="account-inbox-list">
            {notifications.map((n) => (
              <li
                key={String(n.id)}
                className="account-inbox-list__item"
                data-read={n.read === true ? "true" : "false"}
              >
                <div>
                  <div className="account-inbox-list__title">{notificationTitle(n)}</div>
                  {notificationBody(n) ? (
                    <div className="account-muted">{notificationBody(n)}</div>
                  ) : null}
                </div>
                <div className="account-muted account-mono account-inbox-list__time">
                  {notificationTime(n)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
