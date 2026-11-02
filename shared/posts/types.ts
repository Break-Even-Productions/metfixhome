import type {
  ContentAccessDisplay,
  ResourceVideo,
  TermRef,
} from "../library/types";

/** List-card post shape (A6). Exact key set. */
export type Post = {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  image: string | null;
  author: string | null;
  category: { name: string; slug: string } | null;
};

/** Detail post shape (A7 / PL14–PL16). Exact key set. */
export type DetailPost = Post & {
  content: string;
  permalink: string | null;
  video: ResourceVideo | null;
  categories: TermRef[];
  content_types: TermRef[];
  topics: TermRef[];
  locked: boolean;
  access: ContentAccessDisplay;
};

/** Mapped list API body (A6). Exact key set. */
export type PostListBody = {
  posts: Post[];
  page: number;
  per_page: number;
  has_more: boolean;
};

/** Mapped detail API body (A7). Exact key set. */
export type PostDetailBody = {
  post: DetailPost;
};

/** Shared head values for list + detail (CQ6 / A18). */
export type PostsHead = {
  title: string;
  description: string;
  robots: string;
  /** Absolute canonical href, or null when no canonical tag. */
  canonical: string | null;
  ogType: "website" | "article";
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
};

export type BuildPostsHeadListInput = {
  kind: "list";
  /** Presentational only; list title/description are fixed for every page. */
  page?: number;
};

export type BuildPostsHeadDetailInput = {
  kind: "detail";
  id: number;
  title: string;
  excerpt: string;
  permalink: string | null;
  image: string | null;
};

export type BuildPostsHeadInput = BuildPostsHeadListInput | BuildPostsHeadDetailInput;
