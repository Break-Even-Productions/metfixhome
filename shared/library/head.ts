import { DESC_MAX, IMAGE_HOST, METFIX_ORIGIN } from "./constants";
import type { BuildLibraryHeadInput, LibraryHead } from "./types";

const LIST_DESC =
  "MetFix Resource Library — articles, live streams, coach briefings, courses, and research.";
const OG_FALLBACK = "https://metfix.org/social-preview.jpg";
const TITLE_SUFFIX = " — MetFix";

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

export function buildLibraryHead(input: BuildLibraryHeadInput): LibraryHead {
  if (input.kind === "hub") {
    const title = `Resource Library${TITLE_SUFFIX}`;
    return {
      title,
      description: LIST_DESC,
      robots: "index, follow",
      canonical: `${METFIX_ORIGIN}/library`,
      ogType: "website",
      ogTitle: title,
      ogDescription: LIST_DESC,
      ogImage: OG_FALLBACK,
      ogUrl: `${METFIX_ORIGIN}/library`,
    };
  }

  const title = `${input.title}${TITLE_SUFFIX}`;
  const description = cutDescription(input.excerpt || LIST_DESC);
  const ogImage =
    input.image && isAllowlistedOgImage(input.image) ? input.image : OG_FALLBACK;
  // SEO: canonical → BSI permalink when present (product rule D4).
  const canonical = input.permalink;
  const ogUrl = `${METFIX_ORIGIN}/library/${input.type}/${input.id}`;

  return {
    title,
    description,
    robots: canonical ? "index, follow" : "noindex, follow",
    canonical,
    ogType: "article",
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogUrl,
  };
}
