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

export type SiteSettings = {
  copyrightText: string;
  navLinks: NavLink[];
};

export const DEFAULT_COPYRIGHT_TEXT =
  "© 2026 MetFix. The Metabolic Fix. All rights reserved.";

/** Fallback top-nav links when Sanity is unavailable or empty (§3a route map). */
export const DEFAULT_NAV_LINKS = [
  { label: "Library", href: "/library", openInNewTab: false },
  { label: "Courses", href: "/courses", openInNewTab: false },
  { label: "Programs", href: "/#membership-section", openInNewTab: false },
  { label: "Daily Fix", href: "/the-daily-fix", openInNewTab: false },
  { label: "Affiliate Seminars", href: "/affiliate-seminars", openInNewTab: false },
  { label: "Become an Affiliate", href: "/become-an-affiliate", openInNewTab: false },
  {
    label: "Find a Gym",
    href: "https://brokenscience.org/metfix/metfix-map/",
    openInNewTab: true,
  },
  { label: "About", href: "https://whatis.metfix.org/", openInNewTab: true },
  { label: "Shop", href: "https://brokenscience.org/shop/", openInNewTab: true },
] as const satisfies readonly NavLink[];
