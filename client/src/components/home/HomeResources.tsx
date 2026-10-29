import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { Post } from "@shared/posts";
import { fetchPostsPage } from "@/lib/fetchPostsPage";
import type { HomePageContent } from "@/lib/homeTypes";

type HomeResourcesProps = {
  title: string;
  resourceLibrary?: HomePageContent["resourceLibrary"];
};

/** Beta BlogFeed shows this many cards from page 1. */
export const HOME_RESOURCES_POST_COUNT = 8;

function formatPostDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PostCard({ post }: { post: Post }) {
  const [failed, setFailed] = useState(false);
  const image = post.image && !failed ? post.image : null;
  const href = `/posts/${post.id}`;

  return (
    <li className="w-[min(78vw,18.5rem)] shrink-0 snap-start">
      <Link href={href} className="group block h-full">
        <div className="relative h-full overflow-hidden rounded-[1.35rem] border border-cream/10 bg-ink-2 transition-[transform,translate,box-shadow,border-color] duration-300 ease-out group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          {image ? (
            <img
              src={image}
              alt=""
              decoding="async"
              loading="lazy"
              onError={() => setFailed(true)}
              className="course-photo pointer-events-none absolute inset-x-0 top-0 h-28 w-full object-cover transition-transform duration-700 ease-out will-change-transform"
            />
          ) : (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--color-accent)_38%,transparent),rgba(44,41,37,0.15)_70%)]" />
          )}
          <div className="relative z-10 h-full">
            <div className="relative z-[2] flex h-full flex-col">
              <div className="relative h-28 shrink-0">
                {image ? null : (
                  <span className="absolute bottom-4 left-4 font-serif text-sm text-accent-3">
                    Essay
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col bg-ink-2 p-4">
                <time
                  dateTime={post.date}
                  className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-3"
                >
                  {formatPostDate(post.date)}
                </time>
                <h4 className="mt-2 font-serif text-[1.05rem] leading-snug text-cream">{post.title}</h4>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cream/60">
                    {post.excerpt}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

type LoadState = "loading" | "ready" | "empty";

export function HomeResources({ title, resourceLibrary }: HomeResourcesProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const logged = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const body = await fetchPostsPage(1, controller.signal);
        if (cancelled) return;
        const next = body.posts.slice(0, HOME_RESOURCES_POST_COUNT);
        setPosts(next);
        if (next.length === 0) {
          setState("empty");
          if (!logged.current) {
            logged.current = true;
            console.info("[home/resources] empty posts page");
          }
        } else {
          setState("ready");
        }
      } catch {
        if (cancelled) return;
        setPosts([]);
        setState("empty");
        if (!logged.current) {
          logged.current = true;
          console.info("[home/resources] posts fetch unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // T-E-39: empty or error → section absent (no fallback posts).
  if (state === "empty") return null;
  if (state === "loading" && posts.length === 0) return null;

  const heading = title || resourceLibrary?.headline?.text || "Let’s Start with the Truth";
  const archiveLabel = resourceLibrary?.fullLibraryCta?.label ?? "Read the archive";

  return (
    <section id="resources" className="section-card surface-ink bg-ink text-cream">
      <div className="px-5 py-12 md:px-8 md:py-16 lg:px-10 lg:py-20">
        <div className="mt-0 border-t border-cream/10 pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream md:text-[1.7rem]">{heading}</h3>
              {resourceLibrary?.subtext ? (
                <p className="mt-2 max-w-xl text-sm text-cream/65">{resourceLibrary.subtext}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/posts"
                className="text-sm text-cream/70 transition-colors duration-300 ease-out hover:text-cream"
              >
                {archiveLabel}
              </Link>
              <Link
                href="/library"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-colors duration-300 ease-out hover:bg-accent-2"
              >
                Browse the library
              </Link>
            </div>
          </div>

          <ul className="course-rail mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-hide">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
