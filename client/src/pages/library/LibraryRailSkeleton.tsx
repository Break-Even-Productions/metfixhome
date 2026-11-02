/** Placeholder cards while a library rail is still fetching. */
export function LibraryRailSkeleton({
  count = 6,
  label = "Loading resources",
}: {
  count?: number;
  label?: string;
}) {
  const cards = Math.max(1, count);
  return (
    <div
      className="library-rail-skeleton"
      role="status"
      aria-busy="true"
      data-testid="library-rail-skeleton"
    >
      <p className="library-skel-status">{label}</p>
      <div className="library-rail">
        {Array.from({ length: cards }, (_, i) => (
          <div className="library-card library-card-skeleton" key={i} aria-hidden>
            <div className="library-card-media library-skel" />
            <div className="library-card-body">
              <div className="library-skel library-skel-meta" />
              <div className="library-skel library-skel-title" />
              <div className="library-skel library-skel-title library-skel-title-short" />
              <div className="library-skel library-skel-line" />
              <div className="library-skel library-skel-line library-skel-line-short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
