import { FIND_A_GYM_PATH } from "@/const";

export type CourseStat = {
  value: string;
  label: string;
};

export type CourseModule = {
  number: string;
  title: string;
  description?: string;
};

export type CourseCtaType = "start" | "buy" | "notify" | "none";

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
  /** Card photo. Empty means the library rail may fill it from the matching BSI course. */
  image?: string;
  /** When set, the library Courses rail merges this course with that BSI LearnPress id. */
  bsiPostId?: number;
};

export type NavLink = {
  label: string;
  href: string;
  openInNewTab: boolean;
};

/** Optional search-tab override. The site leaves this empty and uses library API topics. */
export type SearchTopicSetting = {
  topic_id: number;
  label?: string;
};

export type SiteSettings = {
  copyrightText: string;
  navLinks: readonly NavLink[];
  searchTopics: SearchTopicSetting[];
};

export const DEFAULT_COPYRIGHT_TEXT =
  "© 2026 MetFix. The Metabolic Fix. All rights reserved.";

/**
 * Top-nav links. Courses, Programs, and About open mega menus
 * (see NavMega). Shop stays in the list so the audience strip can own it.
 */
export const DEFAULT_NAV_LINKS = [
  { label: "Library", href: "/library", openInNewTab: false },
  { label: "Courses", href: "/courses", openInNewTab: false },
  { label: "Programs", href: "/#membership-section", openInNewTab: false },
  { label: "Daily Fix", href: "/the-daily-fix", openInNewTab: false },
  {
    label: "Find a Gym",
    href: FIND_A_GYM_PATH,
    openInNewTab: false,
  },
  { label: "About", href: "/#about", openInNewTab: false },
  { label: "Shop", href: "https://brokenscience.org/shop/", openInNewTab: true },
] as const satisfies readonly NavLink[];
