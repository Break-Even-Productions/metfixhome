/** Page size for list upstream + response. Literal `12` appears only here in non-test posts source. */
export const PAGE_SIZE = 12;

/** Detail path id: positive decimal, no leading zeros, at most 10 digits. */
export const POST_ID_RE = /^[1-9][0-9]{0,9}$/;

/** Max accepted post id (signed 32-bit). */
export const POST_ID_MAX = 2147483647;

/** Raw `page` query value: positive decimal, no leading zeros. */
export const PAGE_RE = /^[1-9][0-9]*$/;

/** Max list page (inclusive). */
export const MAX_PAGE = 50;

/** BSI site origin (image / relative URL resolve). No `/wp-json` here — see `bsi.ts`. */
export const BSI_ORIGIN = "https://brokenscience.org";

/** Exact image host allowlist (DR6). */
export const IMAGE_HOST = "brokenscience.org";

/** Whole upstream response body size cap (UTF-8 bytes). */
export const MAX_UPSTREAM_BYTES = 1048576;

/** Excerpt plain-text max (Unicode code points). */
export const EXCERPT_MAX = 500;

/** Title max after trim (Unicode code points / chars). */
export const TITLE_MAX = 200;

/** Head description max (Unicode code points). */
export const DESC_MAX = 160;

/** Synthetic cache origin for Cache API keys. */
export const CACHE_ORIGIN = "https://metfix.org";
