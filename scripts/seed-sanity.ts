/**
 * Seed Sanity with homepage + courses (incl. home preview) + experts + testimonials + FAQs.
 *
 * Requires SANITY_API_WRITE_TOKEN in .env (Editor+).
 * Run: npm run sanity:seed
 */
import { createClient } from "@sanity/client";
import { config as loadEnv } from "dotenv";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FALLBACK_AFFILIATE_PAGE } from "../client/src/data/fallbackAffiliate";
import { FALLBACK_COURSES } from "../client/src/data/fallbackCourses";
import {
  FALLBACK_FAQS,
  FALLBACK_HOME,
  FALLBACK_HOME_COURSES,
  FALLBACK_TESTIMONIALS,
} from "../client/src/data/fallbackHome";
import { experts as FALLBACK_EXPERTS } from "../client/src/data/home/experts";
import { DEFAULT_COPYRIGHT_TEXT, DEFAULT_NAV_LINKS } from "../client/src/lib/contentTypes";
import type { LibraryResource } from "../client/src/lib/homeTypes";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.VITE_SANITY_PROJECT_ID ||
  "etg9lezr";
const dataset =
  process.env.SANITY_STUDIO_DATASET ||
  process.env.VITE_SANITY_DATASET ||
  "production";
const token = (process.env.SANITY_API_WRITE_TOKEN || "").trim();

if (!token || token === "paste_your_token_here" || !token.startsWith("sk")) {
  console.error(
    "Set a valid SANITY_API_WRITE_TOKEN in .env\n" +
      "https://www.sanity.io/manage/project/etg9lezr/api#tokens"
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2025-01-01",
  token,
  useCdn: false,
});

const HOME_PREVIEW_BY_ID: Record<
  string,
  { label: string; text: string; sort: number; show: boolean }
> = Object.fromEntries(
  FALLBACK_HOME_COURSES.map((c, i) => [
    c.id,
    { label: c.label, text: c.desc, sort: (i + 1) * 10, show: true },
  ])
);

async function uploadImageIfNeeded(
  absolutePath: string,
  filename: string
): Promise<{ _type: "image"; asset: { _type: "reference"; _ref: string } } | undefined> {
  try {
    const asset = await client.assets.upload("image", createReadStream(absolutePath), {
      filename,
    });
    return {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
    };
  } catch (err) {
    console.warn(
      `Could not upload ${filename}:`,
      err instanceof Error ? err.message : err
    );
    return undefined;
  }
}

function toSeedLibraryResource(
  item: LibraryResource,
  options?: {
    key?: string;
    image?: { _type: "image"; asset: { _type: "reference"; _ref: string } };
  }
) {
  return {
    _type: "libraryResource" as const,
    ...(options?.key ? { _key: options.key } : {}),
    category: item.category,
    title: item.title,
    description: item.description || undefined,
    author: item.author || undefined,
    tag: item.tag || undefined,
    badge: item.badge || "Free",
    href: item.href,
    mediaType: item.mediaType,
    ...(options?.image ? { image: options.image } : {}),
    videoUrl: item.videoUrl || undefined,
    showPlayButton: item.showPlayButton,
  };
}

async function seed() {
  console.log(`Seeding ${projectId}/${dataset}…`);

  try {
    await client.request({ uri: `/projects/${projectId}`, method: "GET" });
  } catch (err) {
    console.error("Token rejected:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Preserve existing copyright if already customized
  let copyrightText = DEFAULT_COPYRIGHT_TEXT;
  try {
    const existing = await client.getDocument("siteSettings");
    if (existing?.copyrightText) copyrightText = existing.copyrightText;
  } catch {
    /* create fresh */
  }

  await client.createOrReplace({
    _id: "siteSettings",
    _type: "siteSettings",
    copyrightText,
    navLinks: DEFAULT_NAV_LINKS.map((link, i) => ({
      _type: "navLink",
      _key: `nav-${i}-${link.label.toLowerCase().replace(/\s+/g, "-")}`,
      label: link.label,
      href: link.href,
      openInNewTab: link.openInNewTab,
    })),
  });
  console.log("✓ Site Settings (copyright + nav links)");

  const featuredImage = await uploadImageIfNeeded(
    path.join(ROOT, "client/public/emily-kaplan-keynote.png"),
    "emily-kaplan-keynote.png"
  );
  if (featuredImage) console.log("✓ Uploaded featured library image");

  const foundersImage = await uploadImageIfNeeded(
    path.join(ROOT, "client/public/founders.png"),
    "founders.png"
  );
  if (foundersImage) console.log("✓ Uploaded founders photo");

  const h = FALLBACK_HOME;
  const library = h.resourceLibrary;
  await client.createOrReplace({
    _id: "homePage",
    _type: "homePage",
    title: "Home Page",
    hero: {
      eyebrow: h.hero.eyebrow,
      headline: h.hero.headline,
      subtext: h.hero.subtext,
      statText: h.hero.statText,
      primaryCta: h.hero.primaryCta,
      secondaryCta: h.hero.secondaryCta,
      tertiaryLink: h.hero.tertiaryLink,
    },
    problem: h.problem,
    playbook: {
      eyebrow: h.playbook.eyebrow,
      headline: h.playbook.headline,
      cta: h.playbook.cta,
    },
    specialtyTracks: {
      eyebrow: h.specialtyTracks.eyebrow,
      headline: h.specialtyTracks.headline,
      subtext: h.specialtyTracks.subtext,
    },
    affiliation: {
      eyebrow: h.affiliation.eyebrow,
      headline: h.affiliation.headline,
      body: h.affiliation.body,
      supportingText: h.affiliation.supportingText,
      monthlyPrice: h.affiliation.monthlyPrice,
      priceNote: h.affiliation.priceNote,
      benefits: h.affiliation.benefits,
      primaryCta: h.affiliation.primaryCta,
      secondaryCta: h.affiliation.secondaryCta,
    },
    foundations: {
      eyebrow: h.foundations.eyebrow,
      headline: h.foundations.headline,
      body: h.foundations.body,
      supportingText: h.foundations.supportingText,
      cta: h.foundations.cta,
      videosLabel: h.foundations.videosLabel,
      videoEmbedUrls: h.foundations.videoEmbedUrls,
    },
    whyDifferent: {
      eyebrow: h.whyDifferent.eyebrow,
      names: h.whyDifferent.names,
      roles: h.whyDifferent.roles,
      ...(foundersImage ? { photo: foundersImage } : {}),
      photoCaptionLeft: h.whyDifferent.photoCaptionLeft,
      photoCaptionRight: h.whyDifferent.photoCaptionRight,
      quote: h.whyDifferent.quote,
      quoteAttribution: h.whyDifferent.quoteAttribution,
      quoteRole: h.whyDifferent.quoteRole,
      body: h.whyDifferent.body,
      link: h.whyDifferent.link,
    },
    resourceLibrary: {
      eyebrow: library.eyebrow,
      headline: library.headline,
      subtext: library.subtext,
      categoryTags: library.categoryTags.map((tag, i) => ({
        _type: "libraryCategoryTag",
        _key: `tag-${i}`,
        label: tag.label,
        href: tag.href,
      })),
      fullLibraryCta: library.fullLibraryCta,
      featured: toSeedLibraryResource(library.featured, {
        image: featuredImage,
      }),
      items: library.items.map((item, i) =>
        toSeedLibraryResource(item, { key: `item-${i}` })
      ),
      bottomCta: library.bottomCta,
    },
    gap: {
      eyebrow: h.gap.eyebrow,
      headline: h.gap.headline,
      body: h.gap.body,
      cta: h.gap.cta,
      listLabel: h.gap.listLabel,
      statusQuoItems: h.gap.statusQuoItems,
      closingQuote: h.gap.closingQuote,
    },
    testimonialsSection: h.testimonialsSection,
    network: {
      eyebrow: h.network.eyebrow,
      headline: h.network.headline,
      body: h.network.body,
      cta: h.network.cta,
      featuredLocations: h.network.featuredLocations.map((loc, i) => ({
        _type: "networkLocation",
        _key: `loc-${i}`,
        name: loc.name,
        city: loc.city,
      })),
    },
    weekly: {
      eyebrow: h.weekly.eyebrow,
      headline: h.weekly.headline,
      body: h.weekly.body,
    },
    faqSection: {
      eyebrow: h.faqSection.eyebrow,
      headline: h.faqSection.headline,
    },
  });
  console.log("✓ Home Page (incl. Resource Library)");

  const a = FALLBACK_AFFILIATE_PAGE;
  await client.createOrReplace({
    _id: "affiliatePage",
    _type: "affiliatePage",
    title: "Become an Affiliate",
    hero: {
      eyebrow: a.hero.eyebrow,
      headline: a.hero.headline,
      subtext: a.hero.subtext,
      primaryCta: a.hero.primaryCta,
      secondaryCta: a.hero.secondaryCta,
      stats: a.hero.stats.map((s, i) => ({
        _type: "heroStat",
        _key: `stat-${i}`,
        value: s.value,
        label: s.label,
      })),
    },
    whatItMeans: {
      eyebrow: a.whatItMeans.eyebrow,
      headline: a.whatItMeans.headline,
      body: a.whatItMeans.body,
      price: a.whatItMeans.price,
      pricePeriod: a.whatItMeans.pricePeriod,
      priceNote: a.whatItMeans.priceNote,
      priceDescription: a.whatItMeans.priceDescription,
      includesLabel: a.whatItMeans.includesLabel,
      includes: a.whatItMeans.includes,
    },
    benefits: {
      eyebrow: a.benefits.eyebrow,
      headline: a.benefits.headline,
      subtext: a.benefits.subtext,
      items: a.benefits.items.map((item, i) => ({
        _type: "benefitItem",
        _key: `benefit-${i}`,
        icon: item.icon,
        title: item.title,
        description: item.description,
      })),
    },
    whoQualifies: {
      eyebrow: a.whoQualifies.eyebrow,
      headline: a.whoQualifies.headline,
      body: a.whoQualifies.body,
      primaryCta: a.whoQualifies.primaryCta,
      secondaryCta: a.whoQualifies.secondaryCta,
      requirements: a.whoQualifies.requirements.map((item, i) => ({
        _type: "requirementItem",
        _key: `req-${i}`,
        title: item.title,
        description: item.description,
      })),
    },
    process: {
      eyebrow: a.process.eyebrow,
      headline: a.process.headline,
      subtext: a.process.subtext,
      steps: a.process.steps.map((item, i) => ({
        _type: "processStep",
        _key: `step-${i}`,
        title: item.title,
        description: item.description,
      })),
    },
    networkQuote: a.networkQuote,
    application: {
      eyebrow: a.application.eyebrow,
      headline: a.application.headline,
      subtext: a.application.subtext,
      buttonLabel: a.application.buttonLabel,
      url: a.application.url,
      stickyButtonLabel: a.application.stickyButtonLabel,
    },
  });
  console.log("✓ Become an Affiliate page");

  // Courses from classes page + home-only cards
  const courseIds = Array.from(
    new Set([
      ...FALLBACK_COURSES.map((c) => c.id),
      ...FALLBACK_HOME_COURSES.map((c) => c.id),
    ])
  );

  for (const id of courseIds) {
    const base = FALLBACK_COURSES.find((c) => c.id === id);
    const homeCard = FALLBACK_HOME_COURSES.find((c) => c.id === id);
    const preview = HOME_PREVIEW_BY_ID[id];

    if (base) {
      await client.createOrReplace({
        _id: `course.${id}`,
        _type: "course",
        title: base.title,
        slug: { _type: "slug", current: id },
        tag: base.tag || undefined,
        comingSoon: base.comingSoon,
        ctaType: base.ctaType,
        landingPageUrl: base.landingPageUrl || undefined,
        audience: base.audience || undefined,
        price: base.price || undefined,
        stats: base.stats.map((s) => ({
          _type: "stat",
          _key: `${s.label}-${s.value}`.replace(/\s+/g, "-").toLowerCase(),
          value: s.value,
          label: s.label,
        })),
        details: base.details || undefined,
        modules: base.modules.map((m) => ({
          _type: "module",
          _key: m.number,
          number: m.number,
          title: m.title,
          description: m.description || undefined,
        })),
        isAffiliateFree: base.isAffiliateFree,
        requiredForAffiliation: base.requiredForAffiliation,
        startButtonLabel: base.startButtonLabel || undefined,
        notifyButtonLabel: base.notifyButtonLabel || undefined,
        sortOrder: base.sortOrder,
        showOnHome: Boolean(preview?.show),
        homePreviewLabel: preview?.label,
        homePreviewText: preview?.text,
        homeSortOrder: preview?.sort ?? 100,
      });
    } else if (homeCard) {
      // Home-only specialty cards (e.g. Coaching GLPs)
      await client.createOrReplace({
        _id: `course.${id}`,
        _type: "course",
        title: homeCard.name,
        slug: { _type: "slug", current: id },
        tag: homeCard.tag,
        comingSoon: true,
        ctaType: homeCard.notify ? "notify" : homeCard.live ? "start" : "none",
        landingPageUrl:
          homeCard.href && homeCard.href !== "#" ? homeCard.href : undefined,
        details: homeCard.desc,
        modules: [],
        stats: [],
        isAffiliateFree: false,
        requiredForAffiliation: false,
        sortOrder: 200 + (preview?.sort ?? 0),
        showOnHome: true,
        homePreviewLabel: homeCard.label,
        homePreviewText: homeCard.desc,
        homeSortOrder: preview?.sort ?? 100,
      });
    }
    console.log(`✓ Course: ${id}`);
  }

  for (let i = 0; i < FALLBACK_EXPERTS.length; i++) {
    const e = FALLBACK_EXPERTS[i];
    await client.createOrReplace({
      _id: `expert.${e.id}`,
      _type: "expert",
      name: e.name,
      role: e.role,
      bio: e.bio,
      initials: e.initials,
      hue: e.hue,
      sortOrder: (i + 1) * 10,
    });
    console.log(`✓ Expert: ${e.name}`);
  }

  for (let i = 0; i < FALLBACK_TESTIMONIALS.length; i++) {
    const t = FALLBACK_TESTIMONIALS[i];
    await client.createOrReplace({
      _id: `testimonial.${t.id}`,
      _type: "testimonial",
      quote: t.quote,
      name: t.name,
      role: t.role,
      gym: t.gym || undefined,
      sortOrder: (i + 1) * 10,
    });
    console.log(`✓ Testimonial: ${t.name}`);
  }

  for (let i = 0; i < FALLBACK_FAQS.length; i++) {
    const f = FALLBACK_FAQS[i];
    await client.createOrReplace({
      _id: `faq.${f.id}`,
      _type: "faqItem",
      question: f.question,
      answer: f.answer,
      sortOrder: (i + 1) * 10,
    });
    console.log(`✓ FAQ: ${f.question.slice(0, 48)}…`);
  }

  console.log("\nDone. Redeploy studio if schemas changed: npm run sanity:deploy");
  console.log("Studio: https://metfix.sanity.studio");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
