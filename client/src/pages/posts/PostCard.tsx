import { Lock } from "lucide-react";
import { Link } from "wouter";
import type { Post } from "@shared/posts";

function formatPostDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type PostCardProps = {
  post: Post;
};

/**
 * Shared list card (CQ24). Parent must set `key={post.id}`.
 * Title and excerpt are text nodes only (A15).
 */
export function PostCard({ post }: PostCardProps) {
  return (
    <Link href={`/posts/${post.id}`} className="posts-card">
      {post.image ? (
        <div className="posts-card-media">
          <img
            className="posts-card-image"
            src={post.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {post.exclusive ? (
            <span className="posts-card-lock" aria-label="Exclusive content">
              <Lock size={12} strokeWidth={2.25} aria-hidden />
            </span>
          ) : null}
        </div>
      ) : post.exclusive ? (
        <div className="posts-card-media posts-card-media-empty">
          <span className="posts-card-lock" aria-label="Exclusive content">
            <Lock size={12} strokeWidth={2.25} aria-hidden />
          </span>
        </div>
      ) : null}
      <div className="posts-card-body">
        <div className="posts-card-meta">
          {post.category ? (
            <span className="posts-card-category">{post.category.name}</span>
          ) : null}
          {post.preview_available ? (
            <span className="posts-card-tag posts-card-tag-preview">Preview available</span>
          ) : null}
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          {post.author ? <span>{post.author}</span> : null}
        </div>
        <h2 className="posts-card-title">{post.title}</h2>
        {post.excerpt ? <p className="posts-card-excerpt">{post.excerpt}</p> : null}
      </div>
    </Link>
  );
}
