import type { LibraryResource } from "@shared/library";
import { isLockedCard } from "@shared/library";
import type { Course } from "@/lib/contentTypes";

/** One Courses-rail card. Display strings are filled from Sanity, then BSI. */
export type CourseRailCard = {
  key: string;
  title: string;
  image: string | null;
  badge: string;
  excerpt: string;
  href: string;
  /** Set when the card should open the join modal instead of navigating. */
  lockedResource: LibraryResource | null;
};

function filled(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Exact title, or the shorter title is the start of the longer one ("Fit for Duty"). */
export function courseTitlesAlign(sanityTitle: string, apiTitle: string): boolean {
  const left = normTitle(sanityTitle);
  const right = normTitle(apiTitle);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 8) return false;
  return longer.startsWith(`${shorter} `);
}

function slugMatchesPermalink(slug: string, permalink: string | null): boolean {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(slug) || slug.length < 8) return false;
  if (slug.toLowerCase() === "courses") return false;
  if (!permalink) return false;
  return permalink.toLowerCase().includes(slug.toLowerCase());
}

function matchResource(
  course: Course,
  resources: LibraryResource[],
  used: Set<number>,
): LibraryResource | undefined {
  if (typeof course.bsiPostId === "number") {
    const byId = resources.find((r) => r.id === course.bsiPostId && !used.has(r.id));
    if (byId) return byId;
  }
  const byTitle = resources.find(
    (r) => !used.has(r.id) && courseTitlesAlign(course.title, r.title),
  );
  if (byTitle) return byTitle;
  return resources.find(
    (r) => !used.has(r.id) && slugMatchesPermalink(course.id, r.permalink),
  );
}

function toCard(course: Course | null, resource: LibraryResource | null): CourseRailCard {
  const image = filled(course?.image, resource?.image) || null;
  const title = filled(course?.title, resource?.title) || "Course";
  const badge = filled(course?.tag, resource?.content_types[0]?.name, "Course");
  const excerpt = filled(course?.audience, resource?.excerpt, course?.details, course?.price);
  const href = filled(
    course?.landingPageUrl,
    resource?.permalink,
    resource ? `/library/${resource.type}/${resource.id}` : "",
    "/classes",
  );
  const lockedResource =
    resource && isLockedCard(resource) && !filled(course?.landingPageUrl) ? resource : null;
  const key = course ? `course-${course.id}` : `bsi-${resource!.type}-${resource!.id}`;
  return { key, title, image, badge, excerpt, href, lockedResource };
}

/**
 * One card per course. Sanity order first, then BSI courses that did not match.
 * Matching uses bsiPostId, then title, then a distinctive slug inside the permalink.
 * Each display field uses the first non-empty value (Sanity, then BSI).
 */
export function mergeCourseRail(
  sanityCourses: Course[],
  bsiCourses: LibraryResource[],
): CourseRailCard[] {
  const used = new Set<number>();
  const cards: CourseRailCard[] = [];
  for (const course of sanityCourses) {
    const resource = matchResource(course, bsiCourses, used);
    if (resource) used.add(resource.id);
    cards.push(toCard(course, resource ?? null));
  }
  for (const resource of bsiCourses) {
    if (used.has(resource.id)) continue;
    cards.push(toCard(null, resource));
  }
  return cards;
}
