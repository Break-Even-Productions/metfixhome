/**
 * Author rail for post/library readers (Emily ResourceDetail / LB12).
 * Uses the existing string `author` field only — no invented bio beyond the
 * static contributor line in the mockup.
 */
import { Link } from "wouter";

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
          <div className="post-author-copy">
            <p className="post-author-name">{trimmed}</p>
            <p className="post-author-blurb">Broken Science Initiative contributor.</p>
            <Link
              href={`/library?query=${encodeURIComponent(trimmed)}`}
              className="post-author-more"
            >
              More from this author →
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
