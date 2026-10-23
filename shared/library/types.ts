import type { ResourceType } from "./constants";

/** BSI content_access_display (subset we forward). */
export type ContentAccessDisplay = {
  access: "full" | "preview" | "none";
  has_content_access: boolean;
  user_has_access: boolean;
  has_preview: boolean;
  is_exclusive: boolean;
  show_same: number;
  show_video_in_preview: boolean;
  access_group_labels: string[];
};

export type TermRef = {
  id: number;
  name: string;
  slug: string;
};

/** Daily Fix diagonal composite (BSI brain | mark | belly). URLs are allowlisted. */
export type LibraryCompositeThumbnail = {
  /** Left diagonal — brain / thought photo */
  brain: string | null;
  /** Right diagonal — belly / recipe photo */
  belly: string | null;
  /** Center layer — usually MetFix Daily Fix mark */
  body: string | null;
};

export type LibraryResource = {
  id: number;
  type: ResourceType;
  title: string;
  excerpt: string;
  date: string;
  image: string | null;
  permalink: string | null;
  author: string | null;
  categories: TermRef[];
  topics: TermRef[];
  content_types: TermRef[];
  access: ContentAccessDisplay;
  /** Daily Fix only */
  daily_fix_date?: string | null;
  /** Parsed from BSI composite_thumbnail_html (never raw HTML). */
  composite?: LibraryCompositeThumbnail | null;
};

export type LibraryDetail = LibraryResource & {
  content: string;
  video: string | null;
  /** When true, body is withheld; show locked / join UX. */
  locked: boolean;
};

export type LibrarySearchMeta = {
  total: number;
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type LibrarySearchBody = {
  resources: LibraryResource[];
  meta: LibrarySearchMeta;
};

export type LibraryDetailBody = {
  resource: LibraryDetail;
};

export type LibraryFilterTerm = {
  id: number;
  name: string;
  slug: string;
  count?: number;
};

export type LibraryFiltersBody = {
  topics: LibraryFilterTerm[];
  content_type_terms: LibraryFilterTerm[];
  categories: LibraryFilterTerm[];
};

export type LibraryHead = {
  title: string;
  description: string;
  robots: string;
  canonical: string | null;
  ogType: "website" | "article";
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
};

export type BuildLibraryHeadInput =
  | { kind: "hub" }
  | {
      kind: "detail";
      type: ResourceType;
      id: number;
      title: string;
      excerpt: string;
      permalink: string | null;
      image: string | null;
    };
