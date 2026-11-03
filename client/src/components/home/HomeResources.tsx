import { useEffect, useState } from "react";
import { NewsletterModal } from "@/components/NewsletterModal";
import { SUBSTACK_ARCHIVE_URL } from "@/data/newsletter";
import {
  formatSubstackPostDate,
  loadSubstackPosts,
  substackImageUrl,
  type SubstackPost,
} from "@/lib/substack";
import type { HomePageContent } from "@/lib/homeTypes";

type HomeResourcesProps = {
  title: string;
  resourceLibrary?: HomePageContent["resourceLibrary"];
};

/** Max cards shown in the Substack rail (matches mia BlogFeed). */
export const HOME_RESOURCES_POST_COUNT = 6;

function PostCard({ post }: { post: SubstackPost }) {
  const [failed, setFailed] = useState(false);
  const image = post.image && !failed ? substackImageUrl(post.image) : null;

  return (
    <li className="w-[min(78vw,18.5rem)] shrink-0 snap-start">
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block h-full"
      >
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
                  {formatSubstackPostDate(post.date)}
                </time>
                <h4 className="mt-2 font-serif text-[1.05rem] leading-snug text-cream">
                  {post.title}
                </h4>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cream/60">
                    {post.excerpt}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </a>
    </li>
  );
}

export function HomeResources({ title, resourceLibrary }: HomeResourcesProps) {
  const [posts, setPosts] = useState<SubstackPost[]>([]);
  const [ready, setReady] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await loadSubstackPosts(controller.signal);
        if (cancelled) return;
        setPosts(next.slice(0, HOME_RESOURCES_POST_COUNT));
        setReady(true);
      } catch {
        if (cancelled) return;
        // AbortError only — loadSubstackPosts otherwise returns fallbacks.
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (!ready || posts.length === 0) return null;

  const heading = title || resourceLibrary?.headline?.text || "Let’s Start with the Truth";

  return (
    <section id="resources" className="section-card surface-ink bg-ink text-cream">
      <div className="px-5 py-12 md:px-8 md:py-16 lg:px-10 lg:py-20">
        <div className="mt-0 border-t border-cream/10 pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream md:text-[1.7rem]">{heading}</h3>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={SUBSTACK_ARCHIVE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cream/70 transition-colors duration-300 ease-out hover:text-cream"
              >
                Read the archive
              </a>
              <button
                type="button"
                onClick={() => setSignupOpen(true)}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-colors duration-300 ease-out hover:bg-accent-2"
              >
                Sign up for the newsletter
              </button>
            </div>
          </div>

          <ul className="course-rail mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-hide">
            {posts.map((post) => (
              <PostCard key={post.url} post={post} />
            ))}
          </ul>
        </div>
      </div>
      <NewsletterModal open={signupOpen} onClose={() => setSignupOpen(false)} />
    </section>
  );
}
