import type { Course, CourseCtaType, NavLink, SiteSettings } from "./contentTypes";
import { DEFAULT_COPYRIGHT_TEXT, DEFAULT_NAV_LINKS } from "./contentTypes";
import { FALLBACK_COURSES } from "@/data/fallbackCourses";
import { isSanityConfigured, sanityClient } from "./sanity";

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
};

type SanitySiteSettings = {
  copyrightText?: string;
  navLinks?: {
    label?: string;
    href?: string;
    openInNewTab?: boolean;
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
  bsiPostId
}`;

const SITE_SETTINGS_QUERY = `*[_type == "siteSettings"][0]{
  copyrightText,
  navLinks[]{ label, href, openInNewTab }
}`;

function mapNavLinks(links: SanitySiteSettings["navLinks"]): NavLink[] {
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

function mapCourse(doc: SanityCourseDoc): Course | null {
  const id = doc.slug?.current || doc._id;
  if (!doc.title || !id) return null;

  const comingSoon = Boolean(doc.comingSoon);
  const ctaType: CourseCtaType =
    doc.ctaType === "start" || doc.ctaType === "notify" || doc.ctaType === "none"
      ? doc.ctaType
      : comingSoon
        ? "notify"
        : "start";

  return {
    id,
    title: doc.title,
    tag: doc.tag || (comingSoon ? "COMING SOON" : ""),
    tagColor: comingSoon ? "rgba(239,239,239,0.35)" : "#C9A96E",
    comingSoon,
    ctaType,
    landingPageUrl: doc.landingPageUrl || undefined,
    audience: doc.audience || "",
    price: doc.price || (comingSoon ? "Coming Soon" : ""),
    stats: (doc.stats || [])
      .filter((s): s is { value: string; label: string } => Boolean(s?.value && s?.label))
      .map((s) => ({ value: s.value, label: s.label })),
    details: doc.details || "",
    modules: (doc.modules || [])
      .filter((m): m is { number: string; title: string; description?: string } =>
        Boolean(m?.number && m?.title)
      )
      .map((m) => ({
        number: m.number,
        title: m.title,
        description: m.description || "",
      })),
    isAffiliateFree: Boolean(doc.isAffiliateFree),
    requiredForAffiliation: Boolean(doc.requiredForAffiliation),
    startButtonLabel: doc.startButtonLabel || undefined,
    notifyButtonLabel: doc.notifyButtonLabel || undefined,
    sortOrder: typeof doc.sortOrder === "number" ? doc.sortOrder : 100,
    bsiPostId:
      typeof doc.bsiPostId === "number" && Number.isInteger(doc.bsiPostId) && doc.bsiPostId > 0
        ? doc.bsiPostId
        : undefined,
  };
}

export async function fetchCourses(): Promise<Course[]> {
  if (!sanityClient || !isSanityConfigured) return FALLBACK_COURSES;

  try {
    const docs = await sanityClient.fetch<SanityCourseDoc[]>(COURSES_QUERY);
    const mapped = (docs || []).map(mapCourse).filter((c): c is Course => Boolean(c));
    return mapped.length > 0 ? mapped : FALLBACK_COURSES;
  } catch (err) {
    console.error("Failed to fetch courses from Sanity", err);
    return FALLBACK_COURSES;
  }
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!sanityClient || !isSanityConfigured) {
    return { copyrightText: DEFAULT_COPYRIGHT_TEXT, navLinks: DEFAULT_NAV_LINKS };
  }

  try {
    const doc = await sanityClient.fetch<SanitySiteSettings | null>(SITE_SETTINGS_QUERY);
    const copyrightText = doc?.copyrightText?.trim();
    return {
      copyrightText: copyrightText || DEFAULT_COPYRIGHT_TEXT,
      navLinks: mapNavLinks(doc?.navLinks),
    };
  } catch (err) {
    console.error("Failed to fetch site settings from Sanity", err);
    return { copyrightText: DEFAULT_COPYRIGHT_TEXT, navLinks: DEFAULT_NAV_LINKS };
  }
}
