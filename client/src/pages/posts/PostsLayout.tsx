import type { ReactNode } from "react";
import "./posts.css";

type PostsLayoutProps = {
  children: ReactNode;
  /** Optional eyebrow above the main content (default: Posts). */
  kicker?: string;
};

/**
 * Shared shell for list, detail, loading, and error (B1 / CQ24).
 * Class-based styles only — no inline style props.
 */
export function PostsLayout({ children, kicker = "Posts" }: PostsLayoutProps) {
  return (
    <main className="posts-page">
      <div className="posts-shell">
        <div className="posts-kicker">
          <span className="posts-kicker-line" aria-hidden="true" />
          <span className="posts-kicker-label">{kicker}</span>
          <span className="posts-kicker-line" aria-hidden="true" />
        </div>
        {children}
      </div>
    </main>
  );
}

export function PostsLoading() {
  return (
    <p className="posts-status" role="status">
      Loading posts…
    </p>
  );
}

export function PostsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="posts-error">
      <p>Posts couldn&apos;t be loaded</p>
      <button type="button" className="posts-retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
