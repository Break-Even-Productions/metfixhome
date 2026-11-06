import type { MembershipComparisonContent } from "@/data/home/membershipComparison";

export type { MembershipComparisonContent };

export type CtaLink = {
  label: string;
  href: string;
};

export type HighlightedHeadline = {
  text: string;
  goldPhrase?: string;
};

export type HomeTestimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  gym: string;
  photoUrl?: string;
};

export type HomeFaq = {
  id: string;
  question: string;
  answer: string;
};

export type HomeCourseCard = {
  id: string;
  label: string;
  name: string;
  desc: string;
  href: string;
  tag: string;
  live: boolean;
  notify: boolean;
  /** Absolute URL or site-relative path (e.g. `/Stills/...`). */
  image?: string;
  /** BSI LearnPress post id — required for Whop Buy Now mint. */
  bsiPostId?: number;
  /** Display price for Buy Now cards (e.g. `$350`). */
  price?: string;
};

export type LibraryResource = {
  category: string;
  title: string;
  description: string;
  author: string;
  tag: string;
  badge: string;
  href: string;
  mediaType: "photo" | "video" | "none";
  imageUrl?: string;
  videoUrl?: string;
  showPlayButton: boolean;
};

export type HomePageContent = {
  hero: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
    statText: string;
    primaryCta: CtaLink;
    secondaryCta: CtaLink;
    tertiaryLink?: CtaLink;
  };
  problem: {
    eyebrow: string;
    quote: string;
    sourceText: string;
    sourceUrl: string;
    sourceLinkLabel: string;
  };
  playbook: {
    eyebrow: string;
    headline: HighlightedHeadline;
    cta: CtaLink;
  };
  specialtyTracks: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
  };
  membershipComparison: MembershipComparisonContent;
  affiliation: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string;
    supportingText: string;
    monthlyPrice: string;
    priceNote: string;
    benefits: string[];
    primaryCta: CtaLink;
    secondaryCta: CtaLink;
  };
  foundations: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string;
    supportingText: string;
    cta: CtaLink;
    videosLabel: string;
    videoEmbedUrls: string[];
  };
  whyDifferent: {
    eyebrow: string;
    names: string;
    roles: string;
    photoUrl?: string;
    photoCaptionLeft: string;
    photoCaptionRight: string;
    quote: string;
    quoteAttribution: string;
    quoteRole: string;
    body: string[];
    link: CtaLink;
  };
  gap: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string;
    cta: CtaLink;
    listLabel: string;
    statusQuoItems: string[];
    closingQuote: string;
  };
  resourceLibrary: {
    eyebrow: string;
    headline: HighlightedHeadline;
    subtext: string;
    categoryTags: { label: string; href: string }[];
    fullLibraryCta: CtaLink;
    featured: LibraryResource;
    items: LibraryResource[];
    bottomCta: CtaLink;
  };
  testimonialsSection: {
    eyebrow: string;
  };
  network: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string;
    cta: CtaLink;
    featuredLocations: { name: string; city: string }[];
  };
  weekly: {
    eyebrow: string;
    headline: HighlightedHeadline;
    body: string;
  };
  faqSection: {
    eyebrow: string;
    headline: HighlightedHeadline;
  };
};
