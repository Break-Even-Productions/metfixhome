import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  /** From `/me` cache (R5); never from localStorage (CW12.1). */
  viewerDisplayName?: string | null;
  moderator?: boolean;
  onCommentsChanged?: (next: CommentsLoadState) => void;
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

export function CommentThread({
  load,
  pillar,
  dateIso = null,
  viewerDisplayName = null,
  moderator = false,
  onCommentsChanged,
}: CommentThreadProps) {
  const authHost = isAuthUiHost();
  const loggedIn = Boolean(viewerDisplayName?.trim());
  const [body, setBody] = useState("");
  const [commentType, setCommentType] = useState<Pillar>(pillar);
  const [joinOpen, setJoinOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [retryLeft, setRetryLeft] = useState(0);

  useEffect(() => {
    setCommentType(pillar);
  }, [pillar]);

  useEffect(() => {
    if (retryUntil == null) {
      setRetryLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetryLeft(left);
      if (left <= 0) setRetryUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [retryUntil]);

  const locked = retryLeft > 0;

  async function postComment() {
    if (!dateIso || posting || locked) return;
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
      const res = await commentsHttp("/api/daily-fix/comments", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ date: dateIso, type: commentType, content }),
      });
      if (res.status === 429) {
        const wait = clampClientRetryAfter(res.headers.get("Retry-After"));
        setRetryUntil(Date.now() + wait * 1000);
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
          };
          if (load.status === "loaded") {
            onCommentsChanged?.({ status: "loaded", comments: [...load.comments, mapped] });
          }
          setBody("");
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
      setStatusMsg("We couldn't confirm your comment. Check the thread before posting again.");
      setBody(previous);
    } finally {
      setPosting(false);
    }
  }

  function canModerate(comment: DailyFixComment): boolean {
    if (comment.own === true) return true;
    return moderator === true;
  }

  return (
    <section className="df-comments" aria-labelledby="df-comments-title">
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
              {loggedIn && comment.deleted === 0 && canModerate(comment) ? (
                <div className="df-comment-controls">
                  <button type="button" className="df-comment-control" disabled={locked}>
                    Edit
                  </button>
                  <button type="button" className="df-comment-control" disabled={locked}>
                    Delete
                  </button>
                </div>
              ) : null}
              {loggedIn && comment.deleted === 0 ? (
                <button type="button" className="df-comment-control" disabled={locked}>
                  Like{typeof comment.like_count === "number" ? ` (${comment.like_count})` : ""}
                </button>
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
        <p className="df-muted" role="status">
          Sign in on metfix.org to comment.
        </p>
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
              void postComment();
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
            </div>
            <label>
              <span className="sr-only">Comment</span>
              <textarea
                name="comment"
                rows={3}
                placeholder="Share a thought on today’s fix"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onFocus={() => {
                  if (loggedIn) ensureRecaptchaScript();
                }}
              />
            </label>
            <button type="submit" className="df-btn df-btn-ink" disabled={posting || locked}>
              {locked ? `Try again in ${retryLeft}s` : posting ? "Posting…" : "Post comment"}
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
    </section>
  );
}
