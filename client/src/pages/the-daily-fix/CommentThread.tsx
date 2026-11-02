import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMetfixLoginUrl } from "@/const";
import { isAuthUiHost } from "./authHost";
import {
  clampClientRetryAfter,
  fetchDailyFixComments,
  invalidateCommentsCache,
  type CommentsLoadState,
  type DailyFixComment,
} from "./comments";
import { JoinModal } from "./JoinModal";
import { ensureRecaptchaScript } from "./recaptcha";
import { PILLARS, pillarLabel, type Pillar } from "./model";

/** Indirect binding so tests can stub `globalThis.fetch` (P7.2). */
const commentsHttp: typeof fetch = (...args) => globalThis.fetch(...args);

type CommentThreadProps = {
  load: CommentsLoadState;
  /** Active day tab; seeds the comment-type control. */
  pillar: Pillar;
  /** ISO date for POST body + cache invalidation. */
  dateIso?: string | null;
  /** From `/me` cache (R5); never from browser storage (CW12.1). */
  viewerDisplayName?: string | null;
  moderator?: boolean;
  onCommentsChanged?: (next: CommentsLoadState) => void;
  /**
   * When false, omit the Community/Comments chrome (parent owns the heading).
   * Default true for standalone mounts/tests.
   */
  showHeader?: boolean;
};

async function fetchCsrf(): Promise<string | null> {
  try {
    const res = await commentsHttp("/api/auth/csrf", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { csrf?: unknown };
    return typeof json.csrf === "string" && json.csrf ? json.csrf : null;
  } catch {
    return null;
  }
}

function commentUrl(id: number, dateIso: string): string {
  return `/api/daily-fix/comments/${id}?date=${encodeURIComponent(dateIso)}`;
}

function likeUrl(id: number, dateIso: string): string {
  return `/api/daily-fix/comments/${id}/like?date=${encodeURIComponent(dateIso)}`;
}

function patchComments(
  load: CommentsLoadState,
  id: number,
  pillar: Pillar,
  patch: Partial<DailyFixComment> | null,
): CommentsLoadState {
  if (load.status !== "loaded") return load;
  if (patch === null) {
    return {
      status: "loaded",
      comments: load.comments.filter((c) => c.id !== id || c.pillar !== pillar),
    };
  }
  return {
    status: "loaded",
    comments: load.comments.map((c) =>
      c.id === id && c.pillar === pillar ? { ...c, ...patch } : c,
    ),
  };
}

export function CommentThread({
  load,
  pillar,
  dateIso = null,
  viewerDisplayName = null,
  moderator = false,
  onCommentsChanged,
  showHeader = true,
}: CommentThreadProps) {
  const authHost = isAuthUiHost();
  const loggedIn = Boolean(viewerDisplayName?.trim());
  const [body, setBody] = useState("");
  const [commentType, setCommentType] = useState<Pillar>(pillar);
  const [joinOpen, setJoinOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<DailyFixComment | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [retryUntilByKey, setRetryUntilByKey] = useState<Record<string, number>>({});
  const [, setRetryTick] = useState(0);
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCommentType(pillar);
  }, [pillar]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setRetryUntilByKey((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [key, until] of Object.entries(prev)) {
          if (until > now) next[key] = until;
          else changed = true;
        }
        if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
        return next;
      });
      setRetryTick((n) => n + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  function retryLeft(key: string): number {
    const until = retryUntilByKey[key];
    if (!until) return 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  function isLocked(key: string): boolean {
    return retryLeft(key) > 0;
  }

  function applyRateLimit(key: string, res: Response): void {
    const wait = clampClientRetryAfter(res.headers.get("Retry-After"));
    setRetryUntilByKey((prev) => ({ ...prev, [key]: Date.now() + wait * 1000 }));
  }

  const postLocked = isLocked("post");

  async function postComment(parent?: DailyFixComment | null) {
    if (!dateIso || posting) return;
    const isReply = parent != null;
    const lockKey = isReply ? `reply:${parent.id}` : "post";
    if (isLocked(lockKey)) return;
    const content = body.trim();
    if (!content) return;
    setPosting(true);
    setStatusMsg(null);
    const previous = body;
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
        return;
      }
      const payload: Record<string, unknown> = {
        date: dateIso,
        type: commentType,
        content,
      };
      if (isReply) payload.parent_comment_id = parent.id;
      const res = await commentsHttp("/api/daily-fix/comments", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) {
        applyRateLimit(lockKey, res);
        setBody(previous);
        return;
      }
      if (res.status === 201) {
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        const comment =
          json &&
          typeof json === "object" &&
          json !== null &&
          "comment" in json &&
          (json as { comment: unknown }).comment;
        if (
          comment &&
          typeof comment === "object" &&
          comment !== null &&
          typeof (comment as { id?: unknown }).id === "number"
        ) {
          invalidateCommentsCache(dateIso);
          const c = comment as {
            id: number;
            content?: string;
            timestamp?: string | null;
            user?: { display_name?: string };
            parent_id?: number | null;
          };
          const mapped: DailyFixComment = {
            id: c.id,
            pillar: commentType,
            author:
              typeof c.user?.display_name === "string" && c.user.display_name.trim()
                ? c.user.display_name.trim()
                : viewerDisplayName?.trim() || "Member",
            content: typeof c.content === "string" ? c.content : content,
            timestamp: typeof c.timestamp === "string" ? c.timestamp : null,
            own: true,
            parent_id: isReply ? parent.id : c.parent_id == null ? null : Number(c.parent_id),
          };
          if (load.status === "loaded") {
            onCommentsChanged?.({ status: "loaded", comments: [...load.comments, mapped] });
          }
          setBody("");
          setReplyTo(null);
          return;
        }
      }
      // CT-P1: one refetch, no auto-retry of POST.
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } catch {
      // CT-P1 (c)(d): network/sync throw → one bypass GET, no second POST.
      invalidateCommentsCache(dateIso);
      try {
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
      } catch {
        /* message still shown */
      }
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } finally {
      setPosting(false);
    }
  }

  async function editComment(comment: DailyFixComment) {
    if (!dateIso || load.status !== "loaded") return;
    const lockKey = `edit:${comment.id}`;
    if (isLocked(lockKey) || inFlightRef.current.has(lockKey)) return;
    const next = window.prompt("Edit comment", comment.content);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === comment.content) return;
    inFlightRef.current.add(lockKey);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) return;
      const res = await commentsHttp(commentUrl(comment.id, dateIso), {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 429) {
        applyRateLimit(lockKey, res);
        return;
      }
      if (res.ok) {
        invalidateCommentsCache(dateIso);
        onCommentsChanged?.(
          patchComments(load, comment.id, comment.pillar, { content: trimmed, edited: 1 }),
        );
        return;
      }
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
    } finally {
      inFlightRef.current.delete(lockKey);
    }
  }

  async function deleteComment(comment: DailyFixComment) {
    if (!dateIso || load.status !== "loaded") return;
    const lockKey = `delete:${comment.id}`;
    if (isLocked(lockKey) || inFlightRef.current.has(lockKey)) return;
    if (!window.confirm("Delete this comment?")) return;
    inFlightRef.current.add(lockKey);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) return;
      const res = await commentsHttp(commentUrl(comment.id, dateIso), {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": csrf,
        },
      });
      if (res.status === 429) {
        applyRateLimit(lockKey, res);
        return;
      }
      if (res.status === 204) {
        // CW16.3: one cache-bypassing fresh list GET; no client cache purge (CW16.2b).
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
        return;
      }
      if (res.status === 200) {
        invalidateCommentsCache(dateIso);
        onCommentsChanged?.(patchComments(load, comment.id, comment.pillar, null));
        return;
      }
      invalidateCommentsCache(dateIso);
      const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
      onCommentsChanged?.(refetched);
    } finally {
      inFlightRef.current.delete(lockKey);
    }
  }

  async function toggleLike(comment: DailyFixComment) {
    if (!dateIso || load.status !== "loaded") return;
    const lockKey = `like:${comment.id}`;
    if (isLocked(lockKey) || inFlightRef.current.has(lockKey)) return;
    const wasLiked = comment.liked === true;
    const prevCount = typeof comment.like_count === "number" ? comment.like_count : 0;
    const nextLiked = !wasLiked;
    const optimisticCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    inFlightRef.current.add(lockKey);
    onCommentsChanged?.(
      patchComments(load, comment.id, comment.pillar, {
        liked: nextLiked,
        like_count: optimisticCount,
      }),
    );
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        onCommentsChanged?.(
          patchComments(load, comment.id, comment.pillar, {
            liked: wasLiked,
            like_count: prevCount,
          }),
        );
        return;
      }
      const res = await commentsHttp(likeUrl(comment.id, dateIso), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ liked: nextLiked, date: dateIso }),
      });
      if (res.status === 429) {
        onCommentsChanged?.(
          patchComments(load, comment.id, comment.pillar, {
            liked: wasLiked,
            like_count: prevCount,
          }),
        );
        applyRateLimit(lockKey, res);
        return;
      }
      if (res.status === 403 || res.status === 503) {
        onCommentsChanged?.(
          patchComments(load, comment.id, comment.pillar, {
            liked: wasLiked,
            like_count: prevCount,
          }),
        );
        return;
      }
      if (!res.ok) {
        onCommentsChanged?.(
          patchComments(load, comment.id, comment.pillar, {
            liked: wasLiked,
            like_count: prevCount,
          }),
        );
        invalidateCommentsCache(dateIso);
        const refetched = await fetchDailyFixComments(dateIso, undefined, { bypassCache: true });
        onCommentsChanged?.(refetched);
        return;
      }
      invalidateCommentsCache(dateIso);
    } finally {
      inFlightRef.current.delete(lockKey);
    }
  }

  function canModerate(comment: DailyFixComment): boolean {
    if (comment.own === true) return true;
    return moderator === true;
  }

  function likeLabel(comment: DailyFixComment): string {
    const count = typeof comment.like_count === "number" ? comment.like_count : 0;
    const base = comment.liked === true ? "Unlike" : "Like";
    return `${base} (${count})`;
  }

  function likeCount(comment: DailyFixComment): number {
    return typeof comment.like_count === "number" ? comment.like_count : 0;
  }

  /** Same gate as Post comment: join modal on AUTH-HOST, login URL elsewhere. */
  function promptSignIn() {
    if (!authHost) {
      window.location.assign(getMetfixLoginUrl("/the-daily-fix"));
      return;
    }
    setJoinOpen(true);
  }

  const Shell = showHeader ? "section" : "div";

  return (
    <Shell
      className={showHeader ? "df-comments" : "df-comments df-comments-embedded"}
      {...(showHeader
        ? { "aria-labelledby": "df-comments-title" }
        : { "aria-label": "Comments" })}
    >
      {showHeader ? (
        <div className="df-comments-head">
          <p className="df-kicker">Community</p>
          <h3 id="df-comments-title" className="df-heading">
            Comments
          </h3>
          {loggedIn ? (
            <p className="df-muted df-comments-viewer" data-testid="df-comments-viewer">
              Signed in as {viewerDisplayName}
            </p>
          ) : null}
        </div>
      ) : loggedIn ? (
        <p className="df-muted df-comments-viewer" data-testid="df-comments-viewer">
          Signed in as {viewerDisplayName}
        </p>
      ) : null}

      {load.status === "loading" ? (
        <p className="df-muted" role="status">
          Loading comments…
        </p>
      ) : null}

      {load.status === "unavailable" ? (
        <p className="df-muted" role="status">
          Comments are unavailable right now.
        </p>
      ) : null}

      {load.status === "loaded" && load.comments.length === 0 ? (
        <p className="df-muted" role="status">
          No comments yet.
        </p>
      ) : null}

      {load.status === "loaded" && load.comments.length > 0 ? (
        <ul className="df-comment-list">
          {load.comments.map((comment) => (
            <li key={`${comment.pillar}-${comment.id}`} className="df-comment">
              <div className="df-comment-meta">
                <span className="df-comment-author">{comment.author}</span>
                <span className="df-comment-pillar">{pillarLabel(comment.pillar)}</span>
              </div>
              <p className="df-comment-body">{comment.content}</p>
              {comment.deleted === 0 ? (
                <div className="df-comment-actions">
                  <div className="df-comment-actions-main">
                    {comment.parent_id == null || comment.parent_id === 0 ? (
                      <button
                        type="button"
                        className="df-comment-action"
                        disabled={loggedIn && isLocked(`reply:${comment.id}`)}
                        onClick={() => {
                          if (!loggedIn) {
                            promptSignIn();
                            return;
                          }
                          setReplyTo(comment);
                          setCommentType(comment.pillar);
                        }}
                      >
                        {loggedIn && isLocked(`reply:${comment.id}`) ? (
                          `Try again in ${retryLeft(`reply:${comment.id}`)}s`
                        ) : (
                          <>
                            <MessageCircle className="df-comment-action-icon" aria-hidden="true" />
                            Reply
                          </>
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={
                        loggedIn && comment.liked === true
                          ? "df-comment-action df-comment-action-liked"
                          : "df-comment-action"
                      }
                      disabled={loggedIn && isLocked(`like:${comment.id}`)}
                      aria-label={
                        loggedIn && isLocked(`like:${comment.id}`)
                          ? undefined
                          : likeLabel(comment)
                      }
                      onClick={() => {
                        if (!loggedIn) {
                          promptSignIn();
                          return;
                        }
                        void toggleLike(comment);
                      }}
                    >
                      {loggedIn && isLocked(`like:${comment.id}`) ? (
                        `Try again in ${retryLeft(`like:${comment.id}`)}s`
                      ) : (
                        <>
                          <Heart
                            className="df-comment-action-icon"
                            aria-hidden="true"
                            fill={loggedIn && comment.liked === true ? "currentColor" : "none"}
                          />
                          <span aria-hidden="true">{likeCount(comment)}</span>
                        </>
                      )}
                    </button>
                  </div>
                  {loggedIn && canModerate(comment) ? (
                    <div className="df-comment-actions-mod">
                      <button
                        type="button"
                        className="df-comment-action"
                        disabled={isLocked(`edit:${comment.id}`)}
                        onClick={() => void editComment(comment)}
                      >
                        {isLocked(`edit:${comment.id}`) ? (
                          `Try again in ${retryLeft(`edit:${comment.id}`)}s`
                        ) : (
                          <>
                            <Pencil className="df-comment-action-icon" aria-hidden="true" />
                            Edit
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="df-comment-action df-comment-action-danger"
                        disabled={isLocked(`delete:${comment.id}`)}
                        onClick={() => void deleteComment(comment)}
                      >
                        {isLocked(`delete:${comment.id}`) ? (
                          `Try again in ${retryLeft(`delete:${comment.id}`)}s`
                        ) : (
                          <>
                            <Trash2 className="df-comment-action-icon" aria-hidden="true" />
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {statusMsg ? (
        <p className="df-muted" role="status">
          {statusMsg}
        </p>
      ) : null}

      {!authHost ? (
        <a
          className="df-btn df-btn-accent df-signin-to-comment"
          href={getMetfixLoginUrl("/the-daily-fix")}
        >
          Sign In To Comment
        </a>
      ) : (
        <>
          <form
            className="df-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (!loggedIn) {
                setJoinOpen(true);
                return;
              }
              void postComment(replyTo);
            }}
          >
            <div className="df-composer-meta">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="df-comment-type" aria-label="Comment type">
                  {pillarLabel(commentType)}
                  <ChevronDown className="df-comment-type-caret" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="df-share-menu df-comment-type-menu"
                >
                  <DropdownMenuRadioGroup
                    value={commentType}
                    onValueChange={(value) => setCommentType(value as Pillar)}
                  >
                    {PILLARS.map((item) => (
                      <DropdownMenuRadioItem key={item} value={item}>
                        {pillarLabel(item)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {replyTo ? (
                <p className="df-muted" data-testid="df-replying-to">
                  Replying to {replyTo.author}{" "}
                  <button
                    type="button"
                    className="df-comment-action df-comment-action-inline"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel reply
                  </button>
                </p>
              ) : null}
            </div>
            <label>
              <span className="sr-only">{replyTo ? "Reply" : "Comment"}</span>
              <textarea
                name="comment"
                rows={3}
                placeholder={
                  replyTo ? "Write a reply" : "Share a thought on today’s fix"
                }
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onFocus={() => {
                  if (loggedIn) ensureRecaptchaScript();
                }}
              />
            </label>
            <button
              type="submit"
              className="df-btn df-btn-ink"
              disabled={
                posting ||
                (replyTo ? isLocked(`reply:${replyTo.id}`) : postLocked)
              }
            >
              {replyTo
                ? isLocked(`reply:${replyTo.id}`)
                  ? `Try again in ${retryLeft(`reply:${replyTo.id}`)}s`
                  : posting
                    ? "Posting…"
                    : "Post reply"
                : postLocked
                  ? `Try again in ${retryLeft("post")}s`
                  : posting
                    ? "Posting…"
                    : "Post comment"}
            </button>
          </form>

          <JoinModal
            open={joinOpen}
            onClose={() => setJoinOpen(false)}
            onSignedIn={() => {
              /* parent reloads /me via shared cache */
            }}
          />
        </>
      )}
    </Shell>
  );
}
