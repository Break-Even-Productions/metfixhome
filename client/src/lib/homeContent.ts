import {
  FALLBACK_FAQS,
  FALLBACK_HOME,
  FALLBACK_HOME_COURSES,
  FALLBACK_TESTIMONIALS,
} from "@/data/fallbackHome";
import { experts as FALLBACK_EXPERTS, type Expert } from "@/data/home/experts";
import {
  FALLBACK_MEMBERSHIP_COMPARISON,
  type MembershipComparisonCell,
  type MembershipComparisonContent,
  type MembershipComparisonRow,
} from "@/data/home/membershipComparison";
import type {
  CtaLink,
  HighlightedHeadline,
  HomeCourseCard,
  HomeFaq,
  HomePageContent,
  HomeTestimonial,
  LibraryResource,
} from "@/lib/homeTypes";
import { isSanityConfigured, sanityClient } from "@/lib/sanity";
import { sanityImageUrl } from "@/lib/sanityImage";
import { assetUrl } from "@/const";

export type { Expert };

function asCta(value: Partial<CtaLink> | undefined, fallback: CtaLink): CtaLink {
  if (!value?.label || !value?.href) return fallback;
  return { label: value.label, href: value.href };
}

function asHeadline(
  value: Partial<HighlightedHeadline> | undefined,
  fallback: HighlightedHeadline
): HighlightedHeadline {
  if (!value?.text) return fallback;
  return {
    text: value.text,
    goldPhrase: value.goldPhrase || fallback.goldPhrase,
  };
}

function asComparisonCell(
  value: any,
  fallback: MembershipComparisonCell,
): MembershipComparisonCell {
  const kind = value?.kind;
  if (kind === "check") {
    const note =
      typeof value.note === "string" && value.note.trim()
        ? value.note.trim()
        : fallback.kind === "check"
          ? fallback.note
          : undefined;
    return note ? { kind: "check", note } : { kind: "check" };
  }
  if (kind === "cross") return { kind: "cross" };
  if (kind === "number" && typeof value.number === "number" && Number.isFinite(value.number)) {
    return {
      kind: "number",
      value: value.number,
      suffix: typeof value.suffix === "string" ? value.suffix : undefined,
    };
  }
  if (kind === "text" && typeof value.text === "string" && value.text.trim()) {
    return { kind: "text", value: value.text.trim() };
  }
  return fallback;
}

function asComparisonRow(
  value: any,
  fallback: MembershipComparisonRow,
): MembershipComparisonRow | null {
  if (!value?.feature || typeof value.feature !== "string") return null;
  return {
    feature: value.feature,
    pro: asComparisonCell(value.pro, fallback.pro),
    free: asComparisonCell(value.free, fallback.free),
    affiliate: value.affiliate
      ? asComparisonCell(value.affiliate, fallback.affiliate ?? { kind: "cross" })
      : fallback.affiliate,
  };
}

function asMembershipComparison(doc: any): MembershipComparisonContent {
  const f = FALLBACK_MEMBERSHIP_COMPARISON;
  if (!doc) return f;

  const rows =
    Array.isArray(doc.rows) && doc.rows.length
      ? doc.rows
          .map((row: any, i: number) => asComparisonRow(row, f.rows[i] ?? f.rows[0]!))
          .filter(Boolean)
      : f.rows;

  const affiliateExtraRows =
    Array.isArray(doc.affiliateExtraRows) && doc.affiliateExtraRows.length
      ? doc.affiliateExtraRows
          .map((row: any, i: number) =>
            asComparisonRow(row, f.affiliateExtraRows[i] ?? f.affiliateExtraRows[0]!),
          )
          .filter(Boolean)
      : f.affiliateExtraRows;

  return {
    featuresLabel: doc.featuresLabel || f.featuresLabel,
    proLabel: doc.proLabel || f.proLabel,
    proSublabel: doc.proSublabel || f.proSublabel,
    freeLabel: doc.freeLabel || f.freeLabel,
    affiliateLabel: doc.affiliateLabel || f.affiliateLabel,
    affiliateSublabel: doc.affiliateSublabel || f.affiliateSublabel,
    proCtaLabel: doc.proCtaLabel || f.proCtaLabel,
    affiliateCtaLabel: doc.affiliateCtaLabel || f.affiliateCtaLabel,
    affiliateCtaHref: doc.affiliateCtaHref || f.affiliateCtaHref,
    rows: rows.length ? rows : f.rows,
    affiliateExtraRows: affiliateExtraRows.length ? affiliateExtraRows : f.affiliateExtraRows,
  };
}

function youtubeThumbUrl(videoUrl?: string): string | undefined {
  if (!videoUrl) return undefined;
  const match = videoUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : undefined;
}

function mapLibraryResource(
  value: any,
  fallback: LibraryResource
): LibraryResource {
  if (!value?.title || !value?.href) return fallback;
  const mediaType =
    value.mediaType === "photo" || value.mediaType === "video" || value.mediaType === "none"
      ? value.mediaType
      : fallback.mediaType;
  const imageFromSanity = sanityImageUrl(value.image, 1400);
  const imageUrl =
    imageFromSanity ||
    (mediaType === "video" ? youtubeThumbUrl(value.videoUrl) : undefined) ||
    fallback.imageUrl;

  return {
    category: value.category || fallback.category,
    title: value.title,
    description: value.description || fallback.description || "",
    author: value.author || fallback.author || "",
    tag: value.tag || fallback.tag || "",
    badge: value.badge || fallback.badge || "Free",
    href: value.href,
    mediaType,
    imageUrl,
    videoUrl: value.videoUrl || fallback.videoUrl,
    showPlayButton:
      typeof value.showPlayButton === "boolean"
        ? value.showPlayButton
        : mediaType === "video" || fallback.showPlayButton,
  };
}

const HOME_QUERY = `*[_type == "homePage"][0]{
  hero{
    eyebrow,
    headline{text, goldPhrase},
    subtext,
    statText,
    primaryCta{label, href},
    secondaryCta{label, href},
    tertiaryLink{label, href}
  },
  problem,
  playbook{
    eyebrow,
    headline{text, goldPhrase},
    cta{label, href}
  },
  specialtyTracks{
    eyebrow,
    headline{text, goldPhrase},
    subtext
  },
  membershipComparison{
    featuresLabel,
    proLabel,
    proSublabel,
    freeLabel,
    affiliateLabel,
    affiliateSublabel,
    proCtaLabel,
    affiliateCtaLabel,
    affiliateCtaHref,
    rows[]{
      feature,
      pro{kind, text, number, suffix, note},
      free{kind, text, number, suffix, note},
      affiliate{kind, text, number, suffix, note}
    },
    affiliateExtraRows[]{
      feature,
      pro{kind, text, number, suffix, note},
      free{kind, text, number, suffix, note},
      affiliate{kind, text, number, suffix, note}
    }
  },
  affiliation{
    eyebrow,
    headline{text, goldPhrase},
    body,
    supportingText,
    monthlyPrice,
    priceNote,
    benefits,
    primaryCta{label, href},
    secondaryCta{label, href}
  },
  foundations{
    eyebrow,
    headline{text, goldPhrase},
    body,
    supportingText,
    cta{label, href},
    videosLabel,
    videoEmbedUrls
  },
  whyDifferent{
    eyebrow,
    names,
    roles,
    photo,
    photoCaptionLeft,
    photoCaptionRight,
    quote,
    quoteAttribution,
    quoteRole,
    body,
    link{label, href}
  },
  resourceLibrary{
    eyebrow,
    headline{text, goldPhrase},
    subtext,
    categoryTags[]{label, href},
    fullLibraryCta{label, href},
    featured{
      category,
      title,
      description,
      author,
      tag,
      badge,
      href,
      mediaType,
      image,
      videoUrl,
      showPlayButton
    },
    items[]{
      category,
      title,
      description,
      author,
      tag,
      badge,
      href,
      mediaType,
      image,
      videoUrl,
      showPlayButton
    },
    bottomCta{label, href}
  },
  gap{
    eyebrow,
    headline{text, goldPhrase},
    body,
    cta{label, href},
    listLabel,
    statusQuoItems,
    closingQuote
  },
  testimonialsSection{eyebrow},
  network{
    eyebrow,
    headline{text, goldPhrase},
    body,
    cta{label, href},
    featuredLocations[]{name, city}
  },
  weekly{
    eyebrow,
    headline{text, goldPhrase},
    body
  },
  faqSection{
    eyebrow,
    headline{text, goldPhrase}
  }
}`;

const HOME_COURSES_QUERY = `*[_type == "course" && showOnHome == true] | order(homeSortOrder asc, sortOrder asc) {
  _id,
  title,
  "slug": slug.current,
  tag,
  comingSoon,
  ctaType,
  landingPageUrl,
  homePreviewLabel,
  homePreviewText,
  image
}`;

const FALLBACK_HOME_COURSE_BY_ID = new Map(
  FALLBACK_HOME_COURSES.map((course) => [course.id, course]),
);

const TESTIMONIALS_QUERY = `*[_type == "testimonial"] | order(sortOrder asc) {
  _id, quote, name, role, gym, photo
}`;

const EXPERTS_QUERY = `*[_type == "expert"] | order(sortOrder asc) {
  _id, name, role, bio, initials, hue, photo
}`;

const FAQS_QUERY = `*[_type == "faqItem"] | order(sortOrder asc) {
  _id, question, answer
}`;

function initialsFromName(name: string): string {
  const parts = name
    .replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function mapHome(doc: any): HomePageContent {
  const f = FALLBACK_HOME;
  if (!doc) return f;

  return {
    hero: {
      eyebrow: doc.hero?.eyebrow || f.hero.eyebrow,
      headline: asHeadline(doc.hero?.headline, f.hero.headline),
      subtext: doc.hero?.subtext || f.hero.subtext,
      statText: doc.hero?.statText || f.hero.statText,
      primaryCta: asCta(doc.hero?.primaryCta, f.hero.primaryCta),
      secondaryCta: asCta(doc.hero?.secondaryCta, f.hero.secondaryCta),
      tertiaryLink: doc.hero?.tertiaryLink?.label
        ? asCta(doc.hero.tertiaryLink, f.hero.tertiaryLink!)
        : f.hero.tertiaryLink,
    },
    problem: {
      eyebrow: doc.problem?.eyebrow || f.problem.eyebrow,
      quote: doc.problem?.quote || f.problem.quote,
      sourceText: doc.problem?.sourceText || f.problem.sourceText,
      sourceUrl: doc.problem?.sourceUrl || f.problem.sourceUrl,
      sourceLinkLabel: doc.problem?.sourceLinkLabel || f.problem.sourceLinkLabel,
    },
    playbook: {
      eyebrow: doc.playbook?.eyebrow || f.playbook.eyebrow,
      headline: asHeadline(doc.playbook?.headline, f.playbook.headline),
      cta: asCta(doc.playbook?.cta, f.playbook.cta),
    },
    specialtyTracks: {
      eyebrow: doc.specialtyTracks?.eyebrow || f.specialtyTracks.eyebrow,
      headline: asHeadline(doc.specialtyTracks?.headline, f.specialtyTracks.headline),
      subtext: doc.specialtyTracks?.subtext || f.specialtyTracks.subtext,
    },
    membershipComparison: asMembershipComparison(doc.membershipComparison),
    affiliation: {
      eyebrow: doc.affiliation?.eyebrow || f.affiliation.eyebrow,
      headline: asHeadline(doc.affiliation?.headline, f.affiliation.headline),
      body: doc.affiliation?.body || f.affiliation.body,
      supportingText: doc.affiliation?.supportingText || f.affiliation.supportingText,
      monthlyPrice: doc.affiliation?.monthlyPrice || f.affiliation.monthlyPrice,
      priceNote: doc.affiliation?.priceNote || f.affiliation.priceNote,
      benefits:
        Array.isArray(doc.affiliation?.benefits) && doc.affiliation.benefits.length
          ? doc.affiliation.benefits
          : f.affiliation.benefits,
      primaryCta: asCta(doc.affiliation?.primaryCta, f.affiliation.primaryCta),
      secondaryCta: asCta(doc.affiliation?.secondaryCta, f.affiliation.secondaryCta),
    },
    foundations: {
      eyebrow: doc.foundations?.eyebrow || f.foundations.eyebrow,
      headline: asHeadline(doc.foundations?.headline, f.foundations.headline),
      body: doc.foundations?.body || f.foundations.body,
      supportingText: doc.foundations?.supportingText || f.foundations.supportingText,
      cta: asCta(doc.foundations?.cta, f.foundations.cta),
      videosLabel: doc.foundations?.videosLabel || f.foundations.videosLabel,
      videoEmbedUrls:
        Array.isArray(doc.foundations?.videoEmbedUrls) && doc.foundations.videoEmbedUrls.length
          ? doc.foundations.videoEmbedUrls.filter(Boolean)
          : f.foundations.videoEmbedUrls,
    },
    whyDifferent: {
      eyebrow: doc.whyDifferent?.eyebrow || f.whyDifferent.eyebrow,
      names: doc.whyDifferent?.names || f.whyDifferent.names,
      roles: doc.whyDifferent?.roles || f.whyDifferent.roles,
      photoUrl:
        sanityImageUrl(doc.whyDifferent?.photo, 1400) ||
        f.whyDifferent.photoUrl ||
        assetUrl("/founders.png"),
      photoCaptionLeft: doc.whyDifferent?.photoCaptionLeft || f.whyDifferent.photoCaptionLeft,
      photoCaptionRight: doc.whyDifferent?.photoCaptionRight || f.whyDifferent.photoCaptionRight,
      quote: doc.whyDifferent?.quote || f.whyDifferent.quote,
      quoteAttribution: doc.whyDifferent?.quoteAttribution || f.whyDifferent.quoteAttribution,
      quoteRole: doc.whyDifferent?.quoteRole || f.whyDifferent.quoteRole,
      body:
        Array.isArray(doc.whyDifferent?.body) && doc.whyDifferent.body.length
          ? doc.whyDifferent.body
          : f.whyDifferent.body,
      link: asCta(doc.whyDifferent?.link, f.whyDifferent.link),
    },
    resourceLibrary: {
      eyebrow: doc.resourceLibrary?.eyebrow || f.resourceLibrary.eyebrow,
      headline: asHeadline(doc.resourceLibrary?.headline, f.resourceLibrary.headline),
      subtext: doc.resourceLibrary?.subtext || f.resourceLibrary.subtext,
      categoryTags:
        Array.isArray(doc.resourceLibrary?.categoryTags) &&
        doc.resourceLibrary.categoryTags.length
          ? doc.resourceLibrary.categoryTags
              .filter((t: any) => t?.label && t?.href)
              .map((t: any) => ({ label: t.label, href: t.href }))
          : f.resourceLibrary.categoryTags,
      fullLibraryCta: asCta(
        doc.resourceLibrary?.fullLibraryCta,
        f.resourceLibrary.fullLibraryCta
      ),
      featured: mapLibraryResource(
        doc.resourceLibrary?.featured,
        f.resourceLibrary.featured
      ),
      items:
        Array.isArray(doc.resourceLibrary?.items) && doc.resourceLibrary.items.length
          ? [0, 1, 2].map((i) =>
              mapLibraryResource(
                doc.resourceLibrary.items[i],
                f.resourceLibrary.items[i] || f.resourceLibrary.items[0]
              )
            )
          : f.resourceLibrary.items,
      bottomCta: asCta(doc.resourceLibrary?.bottomCta, f.resourceLibrary.bottomCta),
    },
    gap: {
      eyebrow: doc.gap?.eyebrow || f.gap.eyebrow,
      headline: asHeadline(doc.gap?.headline, f.gap.headline),
      body: doc.gap?.body || f.gap.body,
      cta: asCta(doc.gap?.cta, f.gap.cta),
      listLabel: doc.gap?.listLabel || f.gap.listLabel,
      statusQuoItems:
        Array.isArray(doc.gap?.statusQuoItems) && doc.gap.statusQuoItems.length
          ? doc.gap.statusQuoItems
          : f.gap.statusQuoItems,
      closingQuote: doc.gap?.closingQuote || f.gap.closingQuote,
    },
    testimonialsSection: {
      eyebrow: doc.testimonialsSection?.eyebrow || f.testimonialsSection.eyebrow,
    },
    network: {
      eyebrow: doc.network?.eyebrow || f.network.eyebrow,
      headline: asHeadline(doc.network?.headline, f.network.headline),
      body: doc.network?.body || f.network.body,
      cta: asCta(doc.network?.cta, f.network.cta),
      featuredLocations:
        Array.isArray(doc.network?.featuredLocations) && doc.network.featuredLocations.length
          ? doc.network.featuredLocations.slice(0, 8)
          : f.network.featuredLocations,
    },
    weekly: {
      eyebrow: doc.weekly?.eyebrow || f.weekly.eyebrow,
      headline: asHeadline(doc.weekly?.headline, f.weekly.headline),
      body: doc.weekly?.body || f.weekly.body,
    },
    faqSection: {
      eyebrow: doc.faqSection?.eyebrow || f.faqSection.eyebrow,
      headline: asHeadline(doc.faqSection?.headline, f.faqSection.headline),
    },
  };
}

export async function fetchHomePage(): Promise<HomePageContent> {
  if (!sanityClient || !isSanityConfigured) return FALLBACK_HOME;
  try {
    const doc = await sanityClient.fetch(HOME_QUERY);
    return mapHome(doc);
  } catch (err) {
    console.error("Failed to fetch home page from Sanity", err);
    return FALLBACK_HOME;
  }
}

export async function fetchHomeCourses(): Promise<HomeCourseCard[]> {
  if (!sanityClient || !isSanityConfigured) return FALLBACK_HOME_COURSES;
  try {
    const docs = await sanityClient.fetch<any[]>(HOME_COURSES_QUERY);
    if (!docs?.length) return FALLBACK_HOME_COURSES;
    return docs.map((doc) => {
      const id = doc.slug || doc._id;
      const fallback = FALLBACK_HOME_COURSE_BY_ID.get(id);
      const comingSoon = Boolean(doc.comingSoon);
      const ctaType = doc.ctaType as string | undefined;
      return {
        id,
        label:
          doc.homePreviewLabel ||
          fallback?.label ||
          (comingSoon ? "Coming Soon" : "Specialty"),
        name: doc.title || fallback?.name || "Untitled",
        desc: doc.homePreviewText || fallback?.desc || "",
        href: doc.landingPageUrl || fallback?.href || "#",
        tag: doc.tag || fallback?.tag || (comingSoon ? "Coming Soon" : "Available"),
        // comingSoon wins over a premature "start" CTA in CMS drafts
        live: ctaType === "start" && !comingSoon,
        notify: ctaType === "notify",
        image: sanityImageUrl(doc.image, 960) || fallback?.image,
      };
    });
  } catch (err) {
    console.error("Failed to fetch home courses from Sanity", err);
    return FALLBACK_HOME_COURSES;
  }
}

export async function fetchTestimonials(): Promise<HomeTestimonial[]> {
  if (!sanityClient || !isSanityConfigured) return FALLBACK_TESTIMONIALS;
  try {
    const docs = await sanityClient.fetch<any[]>(TESTIMONIALS_QUERY);
    if (!docs?.length) return FALLBACK_TESTIMONIALS;
    return docs.map((doc) => ({
      id: doc._id,
      quote: doc.quote || "",
      name: doc.name || "",
      role: doc.role || "",
      gym: doc.gym || "",
      photoUrl: sanityImageUrl(doc.photo, 200),
    }));
  } catch (err) {
    console.error("Failed to fetch testimonials from Sanity", err);
    return FALLBACK_TESTIMONIALS;
  }
}

export async function fetchExperts(): Promise<Expert[]> {
  if (!sanityClient || !isSanityConfigured) return [...FALLBACK_EXPERTS];
  try {
    const docs = await sanityClient.fetch<any[]>(EXPERTS_QUERY);
    if (!docs?.length) return [...FALLBACK_EXPERTS];
    return docs
      .filter((doc) => doc?.name && doc?.role && doc?.bio)
      .map((doc) => {
        const name = String(doc.name);
        const hue =
          typeof doc.hue === "number" && Number.isFinite(doc.hue) ? doc.hue : 22;
        return {
          id: doc._id || name,
          name,
          role: String(doc.role),
          bio: String(doc.bio),
          initials:
            (typeof doc.initials === "string" && doc.initials.trim()) ||
            initialsFromName(name),
          hue,
          photoUrl: sanityImageUrl(doc.photo, 400),
        };
      });
  } catch (err) {
    console.error("Failed to fetch experts from Sanity", err);
    return [...FALLBACK_EXPERTS];
  }
}

export async function fetchFaqs(): Promise<HomeFaq[]> {
  if (!sanityClient || !isSanityConfigured) return FALLBACK_FAQS;
  try {
    const docs = await sanityClient.fetch<any[]>(FAQS_QUERY);
    if (!docs?.length) return FALLBACK_FAQS;
    return docs.map((doc) => ({
      id: doc._id,
      question: doc.question || "",
      answer: doc.answer || "",
    }));
  } catch (err) {
    console.error("Failed to fetch FAQs from Sanity", err);
    return FALLBACK_FAQS;
  }
}
