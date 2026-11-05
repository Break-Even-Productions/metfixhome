import type { Course, SiteSettings } from "./contentTypes";
import { DEFAULT_COPYRIGHT_TEXT, DEFAULT_NAV_LINKS } from "./contentTypes";
import { FALLBACK_COURSES } from "@/data/fallbackCourses";

function normTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Exact title, or the shorter title is the start of the longer one. */
function courseTitlesAlign(left: string, right: string): boolean {
  const a = normTitle(left);
  const b = normTitle(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 8) return false;
  return longer.startsWith(`${shorter} `);
}

/**
 * Dedupe courses by id and aligned title (first wins).
 */
export function mergeCoursesWithFallback(serverCourses: Course[]): Course[] {
  const usedIds = new Set<string>();
  const out: Course[] = [];
  for (const course of serverCourses) {
    if (usedIds.has(course.id)) continue;
    if (out.some((existing) => courseTitlesAlign(existing.title, course.title))) continue;
    usedIds.add(course.id);
    out.push(course);
  }
  return out;
}

/** Local course catalog. The library rail still merges these with BSI courses. */
export function fetchCourses(): Promise<Course[]> {
  return Promise.resolve(FALLBACK_COURSES);
}

const SITE_SETTINGS: SiteSettings = {
  copyrightText: DEFAULT_COPYRIGHT_TEXT,
  navLinks: DEFAULT_NAV_LINKS,
  searchTopics: [],
};

let siteSettingsPromise: Promise<SiteSettings> | null = null;

/** Local nav and copyright. Search tabs come from the library API, not this list. */
export function fetchSiteSettings(): Promise<SiteSettings> {
  if (!siteSettingsPromise) {
    siteSettingsPromise = Promise.resolve(SITE_SETTINGS);
  }
  return siteSettingsPromise;
}
