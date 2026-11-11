/**
 * Map BSI in-app notification payloads to MetFix.org routes.
 *
 * Upstream `link` values (examples):
 * - messaging: `/messages/{conversationId}`
 * - daily fix: `/fix/YY/MM/DD` (optionally with query/hash)
 * - posts: WP permalink or empty with `post_id`
 *
 * Chat UI may land later on `/account/messages/:id` (and `/account/chat`).
 */

export type NotificationDeepLinkInput = {
  type?: string | null;
  link?: string | null;
  post_id?: number | string | null;
  /** Worker-shaped web href, if already resolved upstream. */
  href?: string | null;
};

const FIX_PATH_RE = /\/fix\/(\d{2})\/(\d{2})\/(\d{2})(?:\/|$|\?|#)/i;
const MESSAGES_PATH_RE = /\/messages\/([0-9A-Za-z_-]+)(?:\/|$|\?|#)/i;
const POSTS_PATH_RE = /\/posts\/([1-9][0-9]*)(?:\/|$|\?|#)/i;

function trimStr(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function typeSlug(type: string | null): string {
  return (type ?? "").trim().toLowerCase();
}

function isChatType(slug: string): boolean {
  return (
    slug === "messaging" ||
    slug === "message" ||
    slug === "messages" ||
    slug === "chat" ||
    slug === "inbox_message"
  );
}

function isPostType(slug: string): boolean {
  return slug === "new_post" || slug === "post" || slug === "event";
}

function isDailyFixType(slug: string): boolean {
  return (
    slug === "dfx_daily" ||
    slug === "daily_fix" ||
    slug === "dfx" ||
    slug === "the_daily_fix"
  );
}

function pathFromLink(link: string): string {
  if (link.startsWith("/")) return link;
  try {
    const url = new URL(link);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return link;
  }
}

function conversationIdFrom(link: string | null, postId: string | null): string | null {
  if (link) {
    const path = pathFromLink(link);
    const match = path.match(MESSAGES_PATH_RE);
    if (match?.[1]) return match[1];
  }
  return postId;
}

function dailyFixHrefFromLink(link: string | null): string | null {
  if (!link) return null;
  const path = pathFromLink(link);
  const match = path.match(FIX_PATH_RE);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  let href = `/the-daily-fix/${yy}/${mm}/${dd}`;
  try {
    const url = link.startsWith("/")
      ? new URL(link, "https://metfix.org")
      : new URL(link);
    if (url.search) href += url.search;
    if (url.hash) href += url.hash;
  } catch {
    /* keep date-only href */
  }
  return href;
}

function postHrefFrom(link: string | null, postId: string | null): string | null {
  if (postId && /^[1-9][0-9]*$/.test(postId)) {
    return `/posts/${postId}`;
  }
  if (link) {
    const path = pathFromLink(link);
    const match = path.match(POSTS_PATH_RE);
    if (match?.[1]) return `/posts/${match[1]}`;
  }
  return null;
}

/**
 * Resolve a MetFix.org href for a notification. Returns null when no safe
 * in-app destination can be derived (caller may leave the row non-clickable).
 */
/** http(s) destination when the row has no in-app route. Rejects credentials and other schemes. */
export function externalNotificationHref(link: string | null | undefined): string | null {
  const raw = trimStr(link);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveNotificationHref(input: NotificationDeepLinkInput): string | null {
  const existing = trimStr(input.href);
  if (existing?.startsWith("/") && !existing.startsWith("//")) {
    return existing;
  }

  const type = typeSlug(trimStr(input.type));
  const link = trimStr(input.link);
  const postId = trimStr(input.post_id);

  if (isChatType(type) || (link && MESSAGES_PATH_RE.test(pathFromLink(link)))) {
    const id = conversationIdFrom(link, isChatType(type) ? postId : null);
    if (id) return `/account/messages/${encodeURIComponent(id)}`;
    return "/account/chat";
  }

  if (isDailyFixType(type) || (link && FIX_PATH_RE.test(pathFromLink(link)))) {
    return dailyFixHrefFromLink(link) ?? "/the-daily-fix";
  }

  if (isPostType(type)) {
    return postHrefFrom(link, postId);
  }

  // Fall back: known path shapes in `link` even when type is unfamiliar.
  if (link) {
    const path = pathFromLink(link);
    if (FIX_PATH_RE.test(path)) return dailyFixHrefFromLink(link);
    if (MESSAGES_PATH_RE.test(path)) {
      const id = conversationIdFrom(link, null);
      return id ? `/account/messages/${encodeURIComponent(id)}` : "/account/chat";
    }
    if (POSTS_PATH_RE.test(path)) return postHrefFrom(link, postId);
    if (postId && /^[1-9][0-9]*$/.test(postId)) return `/posts/${postId}`;
    if (path.startsWith("/") && !path.startsWith("//")) {
      // Relative upstream links that already match this site (e.g. /the-daily-fix/…).
      if (
        path.startsWith("/the-daily-fix") ||
        path.startsWith("/posts/") ||
        path.startsWith("/account/")
      ) {
        return path;
      }
    }
  }

  return null;
}
