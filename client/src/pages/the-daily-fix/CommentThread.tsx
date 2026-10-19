import { useState } from "react";
import type { CommentsLoadState } from "./comments";
import { JoinModal } from "./JoinModal";
import { pillarLabel } from "./model";

type CommentThreadProps = {
  load: CommentsLoadState;
};

export function CommentThread({ load }: CommentThreadProps) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <section className="df-comments" aria-labelledby="df-comments-title">
      <div className="df-comments-head">
        <p className="df-kicker">Community</p>
        <h3 id="df-comments-title" className="df-heading">
          Comments
        </h3>
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
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="df-composer"
        onSubmit={(event) => {
          event.preventDefault();
          // Logged-out: do not POST a comment and do not create a session.
          setJoinOpen(true);
        }}
      >
        <label>
          <span className="sr-only">Name</span>
          <input
            type="text"
            name="name"
            autoComplete="nickname"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Comment</span>
          <textarea
            name="comment"
            rows={3}
            placeholder="Share a thought on today’s fix"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button type="submit" className="df-btn df-btn-ink">
          Post comment
        </button>
      </form>

      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </section>
  );
}
