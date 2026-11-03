import type {
  Course,
  CourseCtaType,
  NavLink,
  SearchTopicSetting,
  SiteSettings,
} from "./contentTypes";
import { DEFAULT_COPYRIGHT_TEXT, DEFAULT_NAV_LINKS } from "./contentTypes";
import { FALLBACK_COURSES } from "@/data/fallbackCourses";
import { isSanityConfigured, sanityClient } from "./sanity";
import { sanityImageUrl } from "./sanityImage";

type SanityCourseDoc = {
  _id: string;
  title?: string;
  slug?: { current?: string };
  tag?: string;
  comingSoon?: boolean;
  ctaType?: CourseCtaType;
  landingPageUrl?: string;
  audience?: string;
  price?: string;
  stats?: { value?: string; label?: string }[];
  details?: string;
  modules?: { number?: string; title?: string; description?: string }[];
  isAffiliateFree?: boolean;
  requiredForAffiliation?: boolean;
  startButtonLabel?: string;
  notifyButtonLabel?: string;
  sortOrder?: number;
  bsiPostId?: number;
  image?: unknown;
};

type SanitySiteSettings = {
  copyrightText?: string;
  navLinks?: {
    label?: string;
    href?: string;
    openInNewTab?: boolean;
  }[];
  searchTopics?: {
    topic_id?: number;
    label?: string;
  }[];
};

const COURSES_QUERY = `*[_type == "course"] | order(sortOrder asc, title asc) {
  _id,
  title,
  slug,
  tag,
  comingSoon,
  ctaType,
  landingPageUrl,
  audience,
  price,
  stats[]{ value, label },
  details,
  modules[]{ number, title, description },
  isAffiliateFree,
  requiredForAffiliation,
  startButtonLabel,
  notifyButtonLabel,
  sortOrder,
  bsiPostId,
  image
}`;

export const SITE_SETTINGS_QUERY = `*[_type == "siteSettings"][0]{
  copyrightText,
  navLinks[]{ label, href, openInNewTab },
  searchTopics[]{ topic_id, label }
}`;

function mapSearchTopics(
  rows: SanitySiteSettings["searchTopics"],
): SearchTopicSetting[] {
  if (!Array.isArray(rows)) return [];
  const out: SearchTopicSetting[] = [];
  for (const row of rows) {
    if (
      !row ||
      typeof row.topic_id !== "number" ||
      !Number.isInteger(row.topic_id) ||
      row.topic_id < 1
    ) {
      continue;
    }
    const entry: SearchTopicSetting = { topic_id: row.topic_id };
    if (typeof row.label === "string" && row.label.trim()) {
      entry.label = row.label.trim();
    }
    out.push(entry);
  }
  return out;
}

/** Module-level memo (CQ B1): nav, footer, and /library/search share one request. */
let siteSettingsPromise: Promise<SiteSettings> | null = null;

function mapNavLinks(links: SanitySiteSettings["navLinks"]): readonly NavLink[] {
  const mapped = (links || [])
    .filter((l): l is { label: string; href: string; openInNewTab?: boolean } =>
      Boolean(l?.label && l?.href)
    )
    .map((l) => ({
      label: l.label,
      href: l.href,
      openInNewTab: Boolean(l.openInNewTab),
    }));
  return mapped.length > 0 ? mapped : DEFAULT_NAV_LINKS;
}

const FALLBACK_COURSE_BY_ID = new Map(
  FALLBACK_COURSES.map((course) => [course.id, course]),
);

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

function findFallbackCourse(id: string, title: string | undefined): Course | undefined {
  const byId = FALLBACK_COURSE_BY_ID.get(id);
  if (byId) return byId;
  if (!title) return undefined;
  return FALLBACK_COURSES.find((course) => courseTitlesAlign(title, course.title));
}

function mapCourse(doc: SanityCourseDoc): Course | null {
  const id = doc.slug?.current || doc._id;
  if (!id) return null;

  const fallback = findFallbackCourse(id, doc.title);
  const title = filled(doc.title, fallback?.title);
  if (!title) return null;

  const comingSoon =
    typeof doc.comingSoon === "boolean" ? doc.comingSoon : Boolean(fallback?.comingSoon);
  const ctaType: CourseCtaType =
    doc.ctaType === "start" || doc.ctaType === "notify" || doc.ctaType === "none"
      ? doc.ctaType
      : fallback?.ctaType
        ? fallback.ctaType
        : comingSoon
          ? "notify"
          : "start";

  const stats = (doc.stats || [])
    .filter((s): s is { value: string; label: string } => Boolean(s?.value && s?.label))
    .map((s) => ({ value: s.value, label: s.label }));
  const modules = (doc.modules || [])
    .filter((m): m is { number: string; title: string; description?: string } =>
      Boolean(m?.number && m?.title),
    )
    .map((m) => ({
      number: m.number,
      title: m.title,
      description: m.description || "",
    }));

  return {
    id,
    title,
    tag: filled(doc.tag, fallback?.tag, comingSoon ? "COMING SOON" : ""),
    tagColor: comingSoon
      ? filled(fallback?.tagColor, "var(--color-muted)")
      : filled(fallback?.tagColor, "var(--color-accent-text)"),
    comingSoon,
    ctaType,
    landingPageUrl:
      filled(doc.landingPageUrl, fallback?.landingPageUrl) || undefined,
    audience: filled(doc.audience, fallback?.audience),
    price: filled(doc.price, fallback?.price, comingSoon ? "Coming Soon" : ""),
    stats: stats.length > 0 ? stats : fallback?.stats || [],
    details: filled(doc.details, fallback?.details),
    modules: modules.length > 0 ? modules : fallback?.modules || [],
    isAffiliateFree:
      typeof doc.isAffiliateFree === "boolean"
        ? doc.isAffiliateFree
        : Boolean(fallback?.isAffiliateFree),
    requiredForAffiliation:
      typeof doc.requiredForAffiliation === "boolean"
        ? doc.requiredForAffiliation
        : Boolean(fallback?.requiredForAffiliation),
    startButtonLabel:
      filled(doc.startButtonLabel, fallback?.startButtonLabel) || undefined,
    notifyButtonLabel:
      filled(doc.notifyButtonLabel, fallback?.notifyButtonLabel) || undefined,
    sortOrder:
      typeof doc.sortOrder === "number"
        ? doc.sortOrder
        : typeof fallback?.sortOrder === "number"
          ? fallback.sortOrder
          : 100,
    image: sanityImageUrl(doc.image, 960) || fallback?.image,
    bsiPostId:
      typeof doc.bsiPostId === "number" && Number.isInteger(doc.bsiPostId) && doc.bsiPostId > 0
        ? doc.bsiPostId
        : fallback?.bsiPostId,
  };
}

/**
 * Dedupe server courses by id and aligned title (first wins). Empty fields
 * were already filled from the matching local fallback in mapCourse — same
 * pattern as the home classes widget (Sanity list + fallback field merge).
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

export async function fetchCourses(): Promise<Course[]> {
  if (!sanityClient || !isSanityConfigured) return FALLBACK_COURSES;

  try {
    const docs = await sanityClient.fetch<SanityCourseDoc[]>(COURSES_QUERY);
    const mapped = (docs || []).map(mapCourse).filter((c): c is Course => Boolean(c));
    if (mapped.length === 0) return FALLBACK_COURSES;
    return mergeCoursesWithFallback(mapped);
  } catch (err) {
    console.error("Failed to fetch courses from Sanity", err);
    return FALLBACK_COURSES;
  }
}

const EMPTY_SITE_SETTINGS: SiteSettings = {
  copyrightText: DEFAULT_COPYRIGHT_TEXT,
  navLinks: DEFAULT_NAV_LINKS,
  searchTopics: [],
};

async function loadSiteSettings(): Promise<SiteSettings> {
  if (!sanityClient || !isSanityConfigured) {
    return EMPTY_SITE_SETTINGS;
  }

  const doc = await sanityClient.fetch<SanitySiteSettings | null>(SITE_SETTINGS_QUERY);
  const copyrightText = doc?.copyrightText?.trim();
  return {
    copyrightText: copyrightText || DEFAULT_COPYRIGHT_TEXT,
    navLinks: mapNavLinks(doc?.navLinks),
    searchTopics: mapSearchTopics(doc?.searchTopics),
  };
}

/** Memoised settings read (SN3). On failure the memo clears so the next call retries (CQ N6). */
export function fetchSiteSettings(): Promise<SiteSettings> {
  if (!siteSettingsPromise) {
    siteSettingsPromise = loadSiteSettings().catch((err) => {
      siteSettingsPromise = null;
      console.error("Failed to fetch site settings from Sanity", err);
      return EMPTY_SITE_SETTINGS;
    });
  }
  return siteSettingsPromise;
}

