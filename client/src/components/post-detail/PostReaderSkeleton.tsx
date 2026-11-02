/**
 * Placeholder for the resource reader while the article request is in flight.
 * Matches the loaded grid (title, media, body, author rail) without comments.
 */
export function PostReaderSkeleton() {
  return (
    <div
      className="post-reader post-reader-skeleton"
      role="status"
      aria-busy="true"
      data-testid="post-reader-skeleton"
    >
      <p className="post-skel-status">Loading article</p>
      <div className="post-reader-grid">
        <div className="post-reader-main" aria-hidden="true">
          <div className="post-skel post-skel-crumb" />
          <div className="post-skel post-skel-title" />
          <div className="post-skel post-skel-title post-skel-title-short" />
          <div className="post-skel post-skel-meta" />
          <div className="post-skel post-skel-media" />
          <div className="post-skel post-skel-line" />
          <div className="post-skel post-skel-line" />
          <div className="post-skel post-skel-line" />
          <div className="post-skel post-skel-line post-skel-line-short" />
        </div>
        <aside className="post-reader-aside" aria-hidden="true">
          <div className="post-author-card post-skel-card">
            <div className="post-skel post-skel-label" />
            <div className="post-skel-author">
              <div className="post-skel post-skel-avatar" />
              <div className="post-skel-author-copy">
                <div className="post-skel post-skel-line" />
                <div className="post-skel post-skel-line post-skel-line-short" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
