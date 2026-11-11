import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { basePath } from "@/const";
import {
  createDirectChat,
  loadChatConversation,
  loadChatConversations,
  loadChatMessages,
  loadChatUsers,
  markChatConversationRead,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatUser,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

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

function formatStamp(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const time = `${hour}:${minute} ${ampm}`;
  if (sameDay) return time;
  const month = SHORT_MONTHS[d.getMonth()] ?? "";
  return `${month} ${d.getDate()}, ${time}`;
}

function conversationTitle(c: ChatConversation): string {
  return (c.name ?? "").trim() || `Conversation ${c.id}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
}) {
  return (
    <span className={`account-chat-avatar account-chat-avatar--${size}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

function MemberLookupSkeleton() {
  return (
    <ul
      className="account-chat-user-list account-chat-user-list--skel"
      aria-busy="true"
      aria-label="Loading members"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} aria-hidden="true">
          <div className="account-chat-user account-chat-user--skel">
            <span className="dash-skel account-chat-skel-avatar" />
            <span className="account-chat-user__body">
              <span className="dash-skel account-chat-skel-line" />
              <span className="dash-skel account-chat-skel-line account-chat-skel-line--short" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function useConversationId(): string | null {
  const [, messagesParams] = useRoute("/account/messages/:id");
  const [, chatParams] = useRoute("/account/chat/:id");
  const id = messagesParams?.id ?? chatParams?.id ?? null;
  if (!id || !/^[1-9][0-9]*$/.test(id)) return null;
  return id;
}

function useChatBasePath(): "/account/messages" | "/account/chat" {
  const [location] = useLocation();
  return location.startsWith("/account/chat") ? "/account/chat" : "/account/messages";
}

export default function AccountMessages() {
  const conversationId = useConversationId();
  const base = useChatBasePath();
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [listFilter, setListFilter] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const currentUserId = active?.currentUserId ?? conversations[0]?.currentUserId ?? null;

  async function refreshConversations(signal?: AbortSignal) {
    const res = await loadChatConversations({ force: true, signal });
    setConversations(Array.isArray(res.conversations) ? res.conversations : []);
  }

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setError(null);
      try {
        await refreshConversations(ac.signal);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load conversations.");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setActive(null);
      setMessages([]);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setThreadLoading(true);
      setError(null);
      try {
        const [detail, thread] = await Promise.all([
          loadChatConversation(conversationId, { force: true, signal: ac.signal }),
          loadChatMessages(conversationId, { limit: 80, offset: 0 }, {
            force: true,
            signal: ac.signal,
          }),
        ]);
        if (cancelled) return;
        setActive(detail.conversation);
        setMessages(Array.isArray(thread.messages) ? thread.messages : []);
        void markChatConversationRead(conversationId)
          .then(() => refreshConversations())
          .catch(() => undefined);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setActive(null);
        setMessages([]);
        setError("Unable to open that conversation.");
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [conversationId]);

  useEffect(() => {
    const el = threadEndRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, conversationId]);

  useEffect(() => {
    if (!composeOpen) return;
    const ac = new AbortController();
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setUsersLoading(true);
        try {
          const res = await loadChatUsers(searchQuery, {
            force: true,
            signal: ac.signal,
          });
          if (cancelled) return;
          setUsers(Array.isArray(res.users) ? res.users : []);
        } catch (err) {
          if (cancelled) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setUsers([]);
        } finally {
          if (!cancelled) setUsersLoading(false);
        }
      })();
    }, searchQuery.trim() ? 280 : 0);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(handle);
    };
  }, [composeOpen, searchQuery]);

  const filteredConversations = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${conversationTitle(c)} ${c.lastMessage ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, listFilter]);

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    if (!conversationId || !composer.trim() || sending) return;
    if (active?.isBlocked) {
      setError("Messaging is blocked for this conversation.");
      return;
    }
    const text = composer.trim();
    setSending(true);
    setError(null);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId,
      senderId: currentUserId ?? "me",
      senderName: "You",
      content: text,
      timestamp: new Date().toISOString(),
      isRead: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setComposer("");
    try {
      const res = await sendChatMessage(conversationId, text);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? res.message : m)),
      );
      await refreshConversations();
      composerRef.current?.focus();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setComposer(text);
      setError("Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function startWithUser(user: ChatUser) {
    setSending(true);
    setError(null);
    try {
      const existing = conversations.find(
        (c) =>
          c.type === "direct" &&
          Array.isArray(c.members) &&
          c.members.some((m) => m.id === user.id),
      );
      if (existing) {
        setComposeOpen(false);
        setSearchQuery("");
        setLocation(basePath(`${base}/${existing.id}`));
        return;
      }
      const created = await createDirectChat({ recipientId: user.id });
      setComposeOpen(false);
      setSearchQuery("");
      await refreshConversations();
      setLocation(basePath(`${base}/${created.conversation.id}`));
    } catch {
      setError("Could not start that chat.");
    } finally {
      setSending(false);
    }
  }

  const showThreadPane = Boolean(conversationId);
  const title = active ? conversationTitle(active) : "Messages";

  return (
    <DashboardLayout
      title="Messages"
      description="Chat with members and staff."
      hideChromeTitle
    >
      <div
        className="account-chat"
        data-pane={showThreadPane ? "thread" : "list"}
      >
        <aside className="account-chat-list" aria-label="Conversations">
          <header className="account-chat-list__header">
            <div>
              <p className="account-chat-kicker">MetFix</p>
              <h1 className="account-chat-title">Messages</h1>
            </div>
            <button
              type="button"
              className="account-btn account-btn--accent account-chat-compose-btn"
              onClick={() => setComposeOpen((v) => !v)}
              aria-expanded={composeOpen}
            >
              {composeOpen ? "Close" : "New"}
            </button>
          </header>

          {composeOpen ? (
            <div className="account-chat-compose">
              <label className="account-chat-search">
                <span className="sr-only">Search members</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members or staff"
                  autoFocus
                />
              </label>
              <p className="account-muted account-chat-compose__hint">
                {searchQuery.trim().length > 0 && searchQuery.trim().length < 3
                  ? "Type at least 3 characters to search."
                  : "Pick someone to start or continue a chat."}
              </p>
              {usersLoading ? (
                <MemberLookupSkeleton />
              ) : users.length === 0 ? (
                <p className="account-muted">No members found.</p>
              ) : (
                <ul className="account-chat-user-list">
                  {users.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="account-chat-user"
                        disabled={sending}
                        onClick={() => void startWithUser(user)}
                      >
                        <Avatar name={user.name} src={user.avatar} />
                        <span className="account-chat-user__body">
                          <span className="account-chat-user__name">{user.name}</span>
                          {user.secondary_text ? (
                            <span className="account-muted">{user.secondary_text}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <label className="account-chat-search">
                <span className="sr-only">Filter conversations</span>
                <input
                  type="search"
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  placeholder="Filter conversations"
                />
              </label>
              {listLoading ? (
                <p className="account-muted" aria-busy="true">
                  Loading conversations…
                </p>
              ) : filteredConversations.length === 0 ? (
                <p className="account-muted account-chat-empty">
                  No conversations yet. Start one with New.
                </p>
              ) : (
                <ul className="account-chat-conversations">
                  {filteredConversations.map((c) => {
                    const unread = c.unreadCount ?? 0;
                    const selected = c.id === conversationId;
                    return (
                      <li key={c.id}>
                        <Link
                          href={basePath(`${base}/${c.id}`)}
                          className={
                            selected
                              ? "account-chat-row account-chat-row--active"
                              : "account-chat-row"
                          }
                          aria-current={selected ? "page" : undefined}
                        >
                          <Avatar name={conversationTitle(c)} src={c.avatar} />
                          <span className="account-chat-row__body">
                            <span className="account-chat-row__top">
                              <span className="account-chat-row__name">
                                {conversationTitle(c)}
                              </span>
                              <span className="account-chat-row__time account-mono">
                                {formatStamp(c.lastMessageTime)}
                              </span>
                            </span>
                            <span className="account-chat-row__preview">
                              {(c.lastMessage ?? "").trim() || "No messages yet."}
                            </span>
                          </span>
                          {unread > 0 ? (
                            <span className="account-chat-row__badge account-mono">
                              {unread}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </aside>

        <section
          className="account-chat-thread"
          aria-label={showThreadPane ? title : "Conversation"}
        >
          {!showThreadPane ? (
            <div className="account-chat-thread__empty">
              <p className="account-chat-kicker">MetFix</p>
              <h2 className="account-chat-title">Select a conversation</h2>
              <p className="account-muted">
                Choose a thread from the list, or start a new chat with a member or
                staff.
              </p>
            </div>
          ) : (
            <>
              <header className="account-chat-thread__header">
                <Link
                  href={basePath(base)}
                  className="account-chat-back"
                  aria-label="Back to conversations"
                >
                  ←
                </Link>
                <Avatar name={title} src={active?.avatar} size="sm" />
                <div className="account-chat-thread__heading">
                  <h2 className="account-chat-thread__name">{title}</h2>
                  {active?.isBlocked ? (
                    <p className="account-muted">Messaging is blocked.</p>
                  ) : active?.type === "group" ? (
                    <p className="account-muted">
                      {(active.members?.length ?? 0)} members
                    </p>
                  ) : null}
                </div>
              </header>

              {error ? <p className="account-error account-chat-error">{error}</p> : null}

              <div className="account-chat-thread__scroll" role="log" aria-live="polite">
                {threadLoading ? (
                  <p className="account-muted" aria-busy="true">
                    Loading messages…
                  </p>
                ) : messages.length === 0 ? (
                  <p className="account-muted account-chat-empty">
                    No messages yet. Say hello below.
                  </p>
                ) : (
                  <ul className="account-chat-bubbles">
                    {messages.map((m) => {
                      const mine =
                        currentUserId != null && m.senderId === currentUserId;
                      return (
                        <li
                          key={m.id}
                          className={
                            mine
                              ? "account-chat-bubble account-chat-bubble--mine"
                              : "account-chat-bubble"
                          }
                        >
                          {!mine ? (
                            <span className="account-chat-bubble__meta">
                              {m.senderName}
                            </span>
                          ) : null}
                          <p className="account-chat-bubble__text">{m.content}</p>
                          <time
                            className="account-chat-bubble__time account-mono"
                            dateTime={m.timestamp}
                          >
                            {formatStamp(m.timestamp)}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div ref={threadEndRef} />
              </div>

              <form className="account-chat-composer" onSubmit={(e) => void onSend(e)}>
                <label className="sr-only" htmlFor="account-chat-input">
                  Message
                </label>
                <textarea
                  id="account-chat-input"
                  ref={composerRef}
                  rows={1}
                  value={composer}
                  disabled={sending || active?.isBlocked === true}
                  placeholder={
                    active?.isBlocked ? "Messaging blocked" : "Write a message…"
                  }
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                />
                <button
                  type="submit"
                  className="account-btn account-btn--accent"
                  disabled={
                    sending || !composer.trim() || active?.isBlocked === true
                  }
                >
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
      {error && !showThreadPane ? (
        <p className="account-error account-chat-error">{error}</p>
      ) : null}
    </DashboardLayout>
  );
}
