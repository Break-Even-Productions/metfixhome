import { DESC_MAX, IMAGE_HOST } from "./constants";
import type { BuildPostsHeadInput, PostsHead } from "./types";

/** G7 / CQ6 — list description. Literal only in this file. */
const LIST_DESC = "Articles from Broken Science.";

/** Q13 / A18 — og:image fallback. Literal only in this file. */
const OG_FALLBACK = "https://metfix.org/social-preview.jpg";

/** Title suffix (U+2014). Literal only in this file. */
const TITLE_SUFFIX = " — MetFix";

/**
 * Collapse whitespace, trim, cut to ≤ DESC_MAX Unicode code points.
 * No ellipsis, no word-boundary search (CQ6).
 */
export function cutDescription(input: string): string {
  const collapsed = input.replace(/\s+/g, " ").trim();
  const chars = Array.from(collapsed);
  if (chars.length <= DESC_MAX) return collapsed;
  return chars.slice(0, DESC_MAX).join("");
}

function isAllowlistedOgImage(url: string): boolean {
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^/@]+@)?[^/:]+:\d+/.test(url)) return false;
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.username !== "" || u.password !== "") return false;
    if (u.port !== "") return false;
    return u.hostname === IMAGE_HOST;
  } catch {
    return false;
  }
}

/**
 * ONLY producer of posts head strings (PH15 / CQ6).
 * Called by Worker HTML rewrite and client `usePageMeta`.
 */
export function buildPostsHead(input: BuildPostsHeadInput): PostsHead {
  if (input.kind === "list") {
    const title = `Posts${TITLE_SUFFIX}`;
    return {
      title,
      description: LIST_DESC,
      robots: "noindex, follow",
      canonical: null,
      ogType: "website",
      ogTitle: title,
      ogDescription: LIST_DESC,
      ogImage: OG_FALLBACK,
      ogUrl: "https://metfix.org/posts",
    };
  }

  const title = `${input.title}${TITLE_SUFFIX}`;
  const description = cutDescription(input.excerpt);
  const hasPermalink = typeof input.permalink === "string" && input.permalink.length > 0;
  const ogImage =
    input.image && isAllowlistedOgImage(input.image) ? input.image : OG_FALLBACK;

  if (hasPermalink) {
    return {
      title,
      description,
      robots: "index, follow",
      canonical: input.permalink,
      ogType: "article",
      ogTitle: title,
      ogDescription: description,
      ogImage,
      ogUrl: input.permalink!,
    };
  }

  return {
    title,
    description,
    robots: "noindex, follow",
    canonical: null,
    ogType: "article",
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogUrl: `https://metfix.org/posts/${input.id}`,
  };
}

/** Re-export for callers that need the fallback URL without duplicating the literal. */
export { LIST_DESC, OG_FALLBACK };
