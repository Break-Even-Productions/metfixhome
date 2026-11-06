import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import type { Post } from "@shared/posts";
import { NewsletterModal } from "@/components/NewsletterModal";
import { fetchPostsPage } from "@/lib/fetchPostsPage";
import {
  formatSubstackPostDate,
  loadSubstackPosts,
  SUBSTACK_ARCHIVE_URL,
  substackImageUrl,
  type SubstackPost,
} from "@/lib/substack";
import type { HomePageContent } from "@/lib/homeTypes";

type HomeResourcesProps = {
  title: string;
  resourceLibrary?: HomePageContent["resourceLibrary"];
};

/** Newest BSI posts shown above the Substack divider. */
export const HOME_BSI_POST_COUNT = 8;

/** Max cards shown in the Substack rail (matches mia BlogFeed). */
export const HOME_RESOURCES_POST_COUNT = 6;

function formatBsiPostDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

function RailCardShell({
  image,
  fallbackLabel,
  date,
  dateTime,
  title,
  excerpt,
  exclusive,
  previewAvailable,
  onImageError,
}: {
  image: string | null;
  fallbackLabel: string;
  date: string;
  dateTime: string;
  title: string;
  excerpt: string;
  exclusive?: boolean;
  previewAvailable?: boolean;
  onImageError: () => void;
}) {
  return (
    <div className="relative h-full overflow-hidden rounded-[1.35rem] border border-cream/10 bg-ink-2 transition-[transform,translate,box-shadow,border-color] duration-300 ease-out group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
      {image ? (
        <img
          src={image}
          alt=""
          decoding="async"
          loading="lazy"
          onError={onImageError}
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
                {fallbackLabel}
              </span>
            )}
            {previewAvailable ? (
              <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-3 ring-1 ring-accent-3/40">
                Preview available
              </span>
            ) : null}
            {exclusive ? (
              <span
                className="absolute right-3 top-3 z-[3] grid h-7 w-7 place-items-center rounded-full bg-ink/75 text-cream"
                aria-label="Exclusive content"
              >
                <Lock size={12} strokeWidth={2.25} aria-hidden />
              </span>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col bg-ink-2 p-4">
            <time
              dateTime={dateTime}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-3"
            >
              {date}
            </time>
            <h4 className="mt-2 font-serif text-[1.05rem] leading-snug text-cream">{title}</h4>
            {excerpt ? (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cream/60">{excerpt}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BsiPostCard({ post }: { post: Post }) {
  const [failed, setFailed] = useState(false);
  const image = post.image && !failed ? post.image : null;

  return (
    <li className="w-[min(78vw,18.5rem)] shrink-0 snap-start">
      <Link href={`/posts/${post.id}`} className="group block h-full">
        <RailCardShell
          image={image}
          fallbackLabel={post.category?.name || "Post"}
          date={formatBsiPostDate(post.date)}
          dateTime={post.date}
          title={post.title}
          excerpt={post.excerpt}
          exclusive={post.exclusive}
          previewAvailable={post.preview_available}
          onImageError={() => setFailed(true)}
        />
      </Link>
    </li>
  );
}

function SubstackPostCard({ post }: { post: SubstackPost }) {
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
        <RailCardShell
          image={image}
          fallbackLabel="Essay"
          date={formatSubstackPostDate(post.date)}
          dateTime={post.date}
          title={post.title}
          excerpt={post.excerpt}
          onImageError={() => setFailed(true)}
        />
      </a>
    </li>
  );
}

export function HomeResources({ title, resourceLibrary }: HomeResourcesProps) {
  const [bsiPosts, setBsiPosts] = useState<Post[]>([]);
  const [bsiReady, setBsiReady] = useState(false);
  const [substackPosts, setSubstackPosts] = useState<SubstackPost[]>([]);
  const [substackReady, setSubstackReady] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const body = await fetchPostsPage(1, controller.signal);
        if (cancelled) return;
        setBsiPosts(body.posts.slice(0, HOME_BSI_POST_COUNT));
      } catch {
        if (cancelled) return;
        setBsiPosts([]);
      } finally {
        if (!cancelled) setBsiReady(true);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await loadSubstackPosts(controller.signal);
        if (cancelled) return;
        setSubstackPosts(next.slice(0, HOME_RESOURCES_POST_COUNT));
        setSubstackReady(true);
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

  // Wait for both loads so the BSI rail does not pop in above Substack and shift layout.
  if (!bsiReady || !substackReady) return null;

  const showBsi = bsiPosts.length > 0;
  const showSubstack = substackPosts.length > 0;
  if (!showBsi && !showSubstack) return null;

  const bsiHeading = resourceLibrary?.eyebrow || "Resource Library";
  const substackHeading =
    title || resourceLibrary?.headline?.text || "Let’s Start with the Truth";

  return (
    <section id="resources" className="section-card surface-ink bg-ink text-cream">
      <div className="px-5 py-12 md:px-8 md:py-16 lg:px-10 lg:py-20">
        {showBsi ? (
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-serif text-2xl text-cream md:text-[1.7rem]">{bsiHeading}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/library"
                  className="text-sm text-cream/70 transition-colors duration-300 ease-out hover:text-cream"
                >
                  Explore Resource Library
                </Link>
                <a
                  href="#membership-section"
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-colors duration-300 ease-out hover:bg-accent-2"
                >
                  Join MetFix Pro
                </a>
              </div>
            </div>

            <ul className="course-rail mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-hide">
              {bsiPosts.map((post) => (
                <BsiPostCard key={post.id} post={post} />
              ))}
            </ul>
          </div>
        ) : null}

        {showSubstack ? (
          <div className={showBsi ? "mt-12 border-t border-cream/10 pt-10" : "mt-0 border-t border-cream/10 pt-10"}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-serif text-2xl text-cream md:text-[1.7rem]">{substackHeading}</h3>
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
              {substackPosts.map((post) => (
                <SubstackPostCard key={post.url} post={post} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <NewsletterModal open={signupOpen} onClose={() => setSignupOpen(false)} />
    </section>
  );
}
