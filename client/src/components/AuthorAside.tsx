/**
 * Author rail for post/library readers (Emily ResourceDetail composition).
 * Uses the existing string `author` field only — no invented bio/title/image.
 */
type AuthorAsideProps = {
  name: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function AuthorAside({ name }: AuthorAsideProps) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  return (
    <aside className="post-reader-aside" aria-label="About the author">
      <div className="post-author-card">
        <p className="post-author-label">About the Author</p>
        <div className="post-author-identity">
          <div className="post-author-avatar" aria-hidden="true">
            {initialsFromName(trimmed)}
          </div>
          <p className="post-author-name">{trimmed}</p>
        </div>
      </div>
    </aside>
  );
}
