/**
 * Single allowlist for Worker sanitizer (A13) and client DOMPurify (A14 / CQ14).
 * Import these exact objects from both sides (identity, not copies).
 */

export const ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "strong",
  "em",
  "b",
  "i",
  "a",
  "img",
  "figure",
  "figcaption",
  "br",
  "hr",
  "code",
  "pre",
] as const;

export type AllowedTag = (typeof ALLOWED_TAGS)[number];

/** Tags removed with all descendant content (A13). */
export const REMOVE_WITH_CONTENT_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "svg",
  "math",
  "link",
  "meta",
  "base",
  "noscript",
  "template",
] as const;

/** Void / self-closing among allowed tags. */
export const VOID_TAGS = new Set<string>(["br", "hr", "img"]);

/** Per-tag attribute allowlist before sanitizer-added attrs (Q10). */
export const ALLOWED_ATTR: Readonly<Record<string, readonly string[]>> = {
  a: ["href", "title"],
  img: ["src", "srcset", "alt", "width", "height"],
};

/** Attributes the sanitizer always adds on kept `img` elements. */
export const IMG_ADDED_ATTR = {
  loading: "lazy",
  referrerpolicy: "no-referrer",
} as const;

/** `rel` value written on every kept `a` (A13 / Q11). */
export const LINK_REL = "noopener noreferrer nofollow";

export const ALLOWED_TAG_SET: ReadonlySet<string> = new Set(ALLOWED_TAGS);
export const REMOVE_WITH_CONTENT_SET: ReadonlySet<string> = new Set(REMOVE_WITH_CONTENT_TAGS);

/** Base for resolving relative `href` / `src` / `srcset` candidates (G2). */
export const SANITIZE_BASE = "https://brokenscience.org/";

/** Same-origin for "external" link test (Q11): origin !== this → target=_blank. */
export const METFIX_ORIGIN = "https://metfix.org";
