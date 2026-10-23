export type CourseStat = {
  value: string;
  label: string;
};

export type CourseModule = {
  number: string;
  title: string;
  description?: string;
};

export type CourseCtaType = "start" | "notify" | "none";

export type Course = {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  comingSoon: boolean;
  ctaType: CourseCtaType;
  landingPageUrl?: string;
  audience: string;
  price: string;
  stats: CourseStat[];
  details: string;
  modules: CourseModule[];
  isAffiliateFree: boolean;
  requiredForAffiliation: boolean;
  startButtonLabel?: string;
  notifyButtonLabel?: string;
  sortOrder: number;
  /** When set, Library Courses rail prefers this Sanity course over the matching BSI LearnPress id. */
  bsiPostId?: number;
};

export type NavLink = {
  label: string;
  href: string;
  openInNewTab: boolean;
};

/** Sanity `searchTopics` row (E2: topic_id required; label optional). */
export type SearchTopicSetting = {
  topic_id: number;
  label?: string;
};

export type SiteSettings = {
  copyrightText: string;
  navLinks: NavLink[];
  searchTopics: SearchTopicSetting[];
};

export const DEFAULT_COPYRIGHT_TEXT =
  "© 2026 MetFix. The Metabolic Fix. All rights reserved.";

/** Fallback top-nav links when Sanity is unavailable or empty. */
export const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Classes", href: "/classes", openInNewTab: false },
  { label: "Library", href: "/library", openInNewTab: false },
  { label: "Daily Fix", href: "/the-daily-fix", openInNewTab: false },
  {
    label: "Seminars",
    href: "https://brokenscience.org/metfix/seminar-calendar/",
    openInNewTab: true,
  },
  { label: "Affiliate", href: "/become-an-affiliate", openInNewTab: false },
  { label: "About", href: "/#about", openInNewTab: false },
  { label: "Shop", href: "https://brokenscience.org/shop/", openInNewTab: true },
];
