/** BSI Resource Library REST bases (prod). */
export const BSI_RESOURCES_BASE =
  "https://brokenscience.org/wp-json/bsi/v1/resources";
export const BSI_POSTS_DETAIL_BASE =
  "https://brokenscience.org/wp-json/bsi/v1/posts";
export const BSI_EXCLUSIVE_BASE =
  "https://brokenscience.org/wp-json/bsi/v1/exclusive-resources";

export const BSI_ORIGIN = "https://brokenscience.org";
export const IMAGE_HOST = "brokenscience.org";
export const METFIX_ORIGIN = "https://metfix.org";

/** Build REST bases for a non-prod BSI origin (LOCAL_AUTH / tests). Keep /wp-json here — not in worker/. */
export function resourcesBaseFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}/wp-json/bsi/v1/resources`;
}

export function postsDetailBaseFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}/wp-json/bsi/v1/posts`;
}

export function exclusiveBaseFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}/wp-json/bsi/v1/exclusive-resources`;
}

export function coursesBaseFromOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}/wp-json/bsi/v1/courses`;
}

export const BSI_COURSES_BASE = coursesBaseFromOrigin(BSI_ORIGIN);

export const MAX_UPSTREAM_BYTES = 1_500_000;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 48;
export const MAX_OFFSET = 5000;
export const TITLE_MAX = 300;
export const EXCERPT_MAX = 600;
export const DESC_MAX = 160;
export const QUERY_MAX = 120;

/** Resource type path segments allowed on /library/:type/:id */
export const RESOURCE_TYPES = [
  "post",
  "page",
  "event",
  "course",
  "daily_fix",
  "exclusive_resource",
  "infographic",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_RE = new RegExp(
  `^(${RESOURCE_TYPES.join("|")})$`,
);

export const RESOURCE_ID_RE = /^[1-9][0-9]{0,9}$/;
export const RESOURCE_ID_MAX = 2_147_483_647;

/** Taxonomy / term slug (TX2 / SEC13). */
export const SLUG_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** Browse chips (Emily IA → BSI content_type slugs). */
export const CONTENT_TYPE_CHIPS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "articles", label: "Articles" },
  { slug: "videos", label: "Videos" },
  { slug: "webinars", label: "Live Streams" },
  { slug: "whiteboards", label: "Coach Briefings" },
  { slug: "journal-clubs", label: "Journal Clubs" },
  { slug: "infographic", label: "Infographics" },
  { slug: "book-report", label: "Book Reports" },
];

/** Brand category slugs for section rails. */
export const BRAND_CATEGORY_SLUGS = ["metfix", "bsi"] as const;
