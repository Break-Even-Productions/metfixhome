import { useEffect, useMemo, useState } from "react";
import { loadMe } from "@/lib/session";
import { CommentThread } from "@/pages/the-daily-fix/CommentThread";
import type { CommentsLoadState } from "@/pages/the-daily-fix/comments";
import { fetchPostComments } from "@/pages/the-daily-fix/postComments";

type PostCommentsSectionProps = {
  postId: number;
  locked: boolean;
};

export function PostCommentsSection({ postId, locked }: PostCommentsSectionProps) {
  const returnPath = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/",
    [postId],
  );
  const [load, setLoad] = useState<CommentsLoadState>(
    locked ? { status: "unavailable" } : { status: "loading" },
  );
  const [viewerDisplayName, setViewerDisplayName] = useState<string | null>(null);
  const [moderator, setModerator] = useState(false);

  useEffect(() => {
    if (locked) return;
    void loadMe().then((me) => {
      if (me.status === "signed_in" && me.public_name) {
        setViewerDisplayName(me.public_name);
        setModerator(me.moderator === true);
      } else {
        setViewerDisplayName(null);
        setModerator(false);
      }
    });
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    setLoad({ status: "loading" });
    void fetchPostComments(postId).then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
    };
  }, [postId, locked]);

  return (
    <section className="post-detail-discussion" aria-labelledby="post-discussion-title">
      <p className="post-detail-discussion-label">Discussion</p>
      <h2 id="post-discussion-title" className="post-detail-discussion-title">
        Comments
      </h2>
      {locked ? (
        <p className="post-detail-discussion-locked" role="status">
          Sign in with full access to join the discussion on this resource.
        </p>
      ) : (
        <CommentThread
          target={{ kind: "post", postId, returnPath }}
          load={load}
          pillar="body"
          viewerDisplayName={viewerDisplayName}
          moderator={moderator}
          onCommentsChanged={setLoad}
          showHeader={false}
        />
      )}
    </section>
  );
}
