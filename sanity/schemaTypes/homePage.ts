import { defineArrayMember, defineField, defineType } from "sanity";
import { LockedSectionsField } from "../components/LockedSectionsInstructions";
import {
  ctaLink,
  highlightedHeadline,
  libraryCategoryTag,
  libraryResource,
  membershipComparisonRow,
  networkLocation,
} from "./objects";

export const homePage = defineType({
  name: "homePage",
  title: "Home Page",
  type: "document",
  groups: [
    { name: "hero", title: "1. Hero" },
    { name: "problem", title: "2. Problem Quote" },
    { name: "notes", title: "3. Locked Sections (instructions)" },
    { name: "playbook", title: "4. Playbook CTA" },
    { name: "specialty", title: "5. Specialty Tracks" },
    { name: "membership", title: "5b. Membership Comparison" },
    { name: "affiliation", title: "6. Affiliation" },
    { name: "foundations", title: "7. Foundations" },
    { name: "about", title: "8. Why MetFix Is Different" },
    { name: "library", title: "9. Resource Library" },
    { name: "gap", title: "10. The Gap" },
    { name: "testimonials", title: "11. Testimonials" },
    { name: "network", title: "12. Global Network" },
    { name: "weekly", title: "13. MetFix Weekly" },
    { name: "faq", title: "14. FAQ" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Internal Title",
      type: "string",
      initialValue: "Home Page",
      hidden: true,
    }),

    // ─── 1. HERO ───────────────────────────────────────────────
    defineField({
      name: "hero",
      title: "Hero (top of page)",
      type: "object",
      group: "hero",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({
          name: "eyebrow",
          title: "Eyebrow Label",
          type: "string",
          description: 'Small label above the headline, e.g. "The Metabolic Fix"',
        }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
          description: "Main hero headline. Mark which words should be gold italics.",
        }),
        defineField({
          name: "subtext",
          title: "Subtext",
          type: "text",
          rows: 3,
        }),
        defineField({
          name: "statText",
          title: "Stat Line",
          type: "string",
          description: 'e.g. "130+ affiliate gyms. Year one."',
        }),
        defineField({
          name: "primaryCta",
          title: "Primary Button (Take the Free Class)",
          type: ctaLink.name,
        }),
        defineField({
          name: "secondaryCta",
          title: "Secondary Button (Affiliate)",
          type: ctaLink.name,
        }),
        defineField({
          name: "tertiaryLink",
          title: "Text Link under buttons (optional)",
          type: ctaLink.name,
          description: 'e.g. "Not a coach? Start here"',
        }),
      ],
    }),

    // ─── 2. PROBLEM ────────────────────────────────────────────
    defineField({
      name: "problem",
      title: "Problem Quote",
      type: "object",
      group: "problem",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({
          name: "eyebrow",
          title: "Eyebrow Label",
          type: "string",
          initialValue: "The Problem",
        }),
        defineField({
          name: "quote",
          title: "Quote",
          type: "text",
          rows: 3,
          description: "Include quotation marks if you want them shown.",
        }),
        defineField({
          name: "sourceText",
          title: "Source Text",
          type: "string",
          description: "Attribution line next to the source link.",
        }),
        defineField({
          name: "sourceUrl",
          title: "Source Link URL",
          type: "url",
        }),
        defineField({
          name: "sourceLinkLabel",
          title: "Source Link Label",
          type: "string",
          description: 'Visible link text, e.g. "cdc.gov"',
        }),
      ],
    }),

    // ─── 3. NOTES (studio-only instructions; not site content) ─
    defineField({
      name: "lockedSectionsNote",
      title: "Instructions for editors",
      type: "string",
      group: "notes",
      components: {
        field: LockedSectionsField,
      },
    }),

    // ─── 4. PLAYBOOK CTA ───────────────────────────────────────
    defineField({
      name: "playbook",
      title: "Playbook CTA",
      type: "object",
      group: "playbook",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({
          name: "eyebrow",
          title: "Eyebrow Label",
          type: "string",
          description: 'e.g. "Start Now. Free Forever."',
        }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({
          name: "cta",
          title: "Button",
          type: ctaLink.name,
        }),
      ],
    }),

    // ─── 5. SPECIALTY ──────────────────────────────────────────
    defineField({
      name: "specialtyTracks",
      title: "Specialty Tracks Intro",
      type: "object",
      group: "specialty",
      description:
        "Course cards themselves come from Courses documents that have “Show on Home” enabled. Edit Home Preview fields on each Course.",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "subtext", title: "Supporting Text", type: "text", rows: 3 }),
      ],
    }),

    // ─── 5b. MEMBERSHIP COMPARISON ─────────────────────────────
    defineField({
      name: "membershipComparison",
      title: "Membership Comparison Table",
      type: "object",
      group: "membership",
      description:
        "Check / X / text / number cells. Most For-X pages show MetFix Pro vs Free. Gym Owners, Clinicians, and Organizations also get the Affiliate column plus the extra affiliate rows.",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({
          name: "featuresLabel",
          title: "Features Column Label",
          type: "string",
          initialValue: "Membership Features",
        }),
        defineField({
          name: "proLabel",
          title: "Pro Column Label",
          type: "string",
          initialValue: "MetFix Pro",
        }),
        defineField({
          name: "proSublabel",
          title: "Pro Column Sublabel",
          type: "string",
          description: 'e.g. "$30/mo · 1st month free" (not shown in the table header UI).',
        }),
        defineField({
          name: "freeLabel",
          title: "Free Column Label",
          type: "string",
          initialValue: "Free",
        }),
        defineField({
          name: "affiliateLabel",
          title: "Affiliate Column Label",
          type: "string",
          initialValue: "Affiliate",
        }),
        defineField({
          name: "affiliateSublabel",
          title: "Affiliate Column Sublabel",
          type: "string",
          description: 'e.g. "$170/mo" (not shown in the table header UI).',
        }),
        defineField({
          name: "proCtaLabel",
          title: "MetFix Pro CTA Label",
          type: "string",
          initialValue: "Join MetFix Pro",
        }),
        defineField({
          name: "affiliateCtaLabel",
          title: "Affiliate CTA Label",
          type: "string",
          initialValue: "Become an Affiliate",
          description: "Shown under the table when the Affiliate column is visible.",
        }),
        defineField({
          name: "affiliateCtaHref",
          title: "Affiliate CTA Href",
          type: "string",
          initialValue: "/become-an-affiliate",
        }),
        defineField({
          name: "rows",
          title: "Base Rows (all audiences)",
          type: "array",
          of: [membershipComparisonRow],
          description: "Shown for every For-X page (Pro vs Free; Affiliate cell used when that column is visible).",
        }),
        defineField({
          name: "affiliateExtraRows",
          title: "Affiliate-Only Extra Rows",
          type: "array",
          of: [membershipComparisonRow],
          description:
            "Inserted after The Daily Fix for Gym Owners, Clinicians, and Organizations (e.g. The Daily Fix Embed).",
        }),
      ],
    }),

    // ─── 6. AFFILIATION ────────────────────────────────────────
    defineField({
      name: "affiliation",
      title: "MetFix Affiliation",
      type: "object",
      group: "affiliation",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "body", title: "Body Paragraph", type: "text", rows: 4 }),
        defineField({ name: "supportingText", title: "Supporting Paragraph", type: "text", rows: 3 }),
        defineField({
          name: "monthlyPrice",
          title: "Monthly Price",
          type: "string",
          description: 'e.g. "$170"',
        }),
        defineField({
          name: "priceNote",
          title: "Price Note",
          type: "string",
          description: 'e.g. "/ month · annual commitment"',
        }),
        defineField({
          name: "benefits",
          title: "Benefit Bullets",
          type: "array",
          of: [defineArrayMember({ type: "string" })],
        }),
        defineField({
          name: "primaryCta",
          title: "Primary Button",
          type: ctaLink.name,
        }),
        defineField({
          name: "secondaryCta",
          title: "Secondary Button (Find a Gym)",
          type: ctaLink.name,
        }),
      ],
    }),

    // ─── 7. FOUNDATIONS ────────────────────────────────────────
    defineField({
      name: "foundations",
      title: "Foundations Seminar",
      type: "object",
      group: "foundations",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "body", title: "Body Paragraph", type: "text", rows: 4 }),
        defineField({ name: "supportingText", title: "Supporting Paragraph", type: "text", rows: 3 }),
        defineField({
          name: "cta",
          title: "Button",
          type: ctaLink.name,
        }),
        defineField({
          name: "videosLabel",
          title: "Videos Section Label",
          type: "string",
          description: 'e.g. "Hear From Coaches Who Attended"',
        }),
        defineField({
          name: "videoEmbedUrls",
          title: "Coach Videos (vertical)",
          type: "array",
          of: [
            defineArrayMember({
              type: "url",
              validation: (Rule) =>
                Rule.uri({ scheme: ["https"] }).custom((value) => {
                  if (!value) return true;
                  try {
                    const host = new URL(value).hostname.replace(/^www\./, "");
                    const ok =
                      host === "youtube.com" ||
                      host === "m.youtube.com" ||
                      host === "youtu.be" ||
                      host === "youtube-nocookie.com" ||
                      host === "vimeo.com" ||
                      host === "player.vimeo.com";
                    return ok
                      ? true
                      : "Use a YouTube or Vimeo https link (watch, Shorts, share, or embed).";
                  } catch {
                    return "Enter a valid https URL";
                  }
                }),
            }),
          ],
          description:
            "Vertical (9:16) coach testimonial videos for the Foundations carousel. Paste YouTube or Vimeo links — watch, Shorts, share, or embed URLs all work. Order here is the carousel order.",
        }),
      ],
    }),

    // ─── 8. ABOUT / WHY DIFFERENT ──────────────────────────────
    defineField({
      name: "whyDifferent",
      title: "Why MetFix Is Different",
      type: "object",
      group: "about",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({ name: "names", title: "Names Line", type: "string" }),
        defineField({ name: "roles", title: "Roles Line", type: "text", rows: 2 }),
        defineField({
          name: "photo",
          title: "Founders Photo",
          type: "image",
          options: { hotspot: true },
          description: "Upload or replace the founders photo shown in this section.",
          readOnly: false,
        }),
        defineField({ name: "photoCaptionLeft", title: "Photo Caption (left)", type: "string" }),
        defineField({ name: "photoCaptionRight", title: "Photo Caption (right)", type: "string" }),
        defineField({ name: "quote", title: "Pull Quote", type: "text", rows: 5 }),
        defineField({ name: "quoteAttribution", title: "Quote Name", type: "string" }),
        defineField({ name: "quoteRole", title: "Quote Role", type: "string" }),
        defineField({ name: "body", title: "Body Paragraphs", type: "array", of: [defineArrayMember({ type: "text" })] }),
        defineField({
          name: "link",
          title: "Bottom Link",
          type: ctaLink.name,
        }),
      ],
    }),

    // ─── 9. RESOURCE LIBRARY ───────────────────────────────────
    defineField({
      name: "resourceLibrary",
      title: "Resource Library Preview",
      type: "object",
      group: "library",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({
          name: "subtext",
          title: "Subtext",
          type: "text",
          rows: 3,
        }),
        defineField({
          name: "categoryTags",
          title: "Category Tags",
          type: "array",
          of: [defineArrayMember({ type: libraryCategoryTag.name })],
          description: "Small links under the intro (Videos, Articles, etc.).",
        }),
        defineField({
          name: "fullLibraryCta",
          title: "Full Library Link (top right)",
          type: ctaLink.name,
        }),
        defineField({
          name: "featured",
          title: "Large Featured Resource",
          type: libraryResource.name,
          description: "The big card on the left. Usually includes a photo or video.",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "items",
          title: "Three Secondary Resources",
          type: "array",
          of: [defineArrayMember({ type: libraryResource.name })],
          description: "Exactly three smaller cards stacked on the right.",
          validation: (Rule) => Rule.required().min(3).max(3),
        }),
        defineField({
          name: "bottomCta",
          title: "Bottom Button",
          type: ctaLink.name,
          description: 'e.g. "Access the Full Library"',
        }),
      ],
    }),

    // ─── 10. GAP ───────────────────────────────────────────────
    defineField({
      name: "gap",
      title: "The Gap",
      type: "object",
      group: "gap",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "body", title: "Body Paragraph", type: "text", rows: 3 }),
        defineField({
          name: "cta",
          title: "Button",
          type: ctaLink.name,
        }),
        defineField({ name: "listLabel", title: "List Label", type: "string" }),
        defineField({
          name: "statusQuoItems",
          title: "Status Quo Items",
          type: "array",
          of: [defineArrayMember({ type: "string" })],
        }),
        defineField({ name: "closingQuote", title: "Closing Quote", type: "text", rows: 3 }),
      ],
    }),

    // ─── 11. TESTIMONIALS INTRO ─────────────────────────────────
    defineField({
      name: "testimonialsSection",
      title: "What MetFix Coaches Say",
      type: "object",
      group: "testimonials",
      description: "Individual quotes are managed under Testimonials in the sidebar. Add/edit there.",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
      ],
    }),

    // ─── 12. NETWORK ───────────────────────────────────────────
    defineField({
      name: "network",
      title: "Global Network",
      type: "object",
      group: "network",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "body", title: "Body Paragraph", type: "text", rows: 3 }),
        defineField({
          name: "cta",
          title: "Button",
          type: ctaLink.name,
        }),
        defineField({
          name: "featuredLocations",
          title: "Featured Locations (max 8)",
          type: "array",
          of: [networkLocation],
          validation: (Rule) => Rule.max(8),
        }),
      ],
    }),

    // ─── 13. WEEKLY ────────────────────────────────────────────
    defineField({
      name: "weekly",
      title: "MetFix Weekly",
      type: "object",
      group: "weekly",
      description: "Email signup form fields are not editable here.",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "body", title: "Body Paragraph", type: "text", rows: 4 }),
      ],
    }),

    // ─── 14. FAQ INTRO ─────────────────────────────────────────
    defineField({
      name: "faqSection",
      title: "Common Questions",
      type: "object",
      group: "faq",
      description: "Individual Q&As are managed under FAQs in the sidebar. Add/edit there.",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Home Page" }),
  },
});
