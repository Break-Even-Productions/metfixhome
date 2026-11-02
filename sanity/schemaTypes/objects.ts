import { defineArrayMember, defineField } from "sanity";

/** Button / link used across homepage CTAs */
export const ctaLinkFields = [
  defineField({
    name: "label",
    title: "Button Text",
    type: "string",
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: "href",
    title: "Link URL",
    type: "string",
    description: "Full URL (https://…) or on-site path (/become-an-affiliate).",
    validation: (Rule) => Rule.required(),
  }),
];

export const ctaLink = {
  name: "ctaLink",
  title: "Button / Link",
  type: "object" as const,
  fields: ctaLinkFields,
};

/**
 * Headline with an optional gold italic phrase.
 * Editors paste the full headline, then type the exact words that should appear in gold.
 */
export const highlightedHeadline = {
  name: "highlightedHeadline",
  title: "Headline with Gold Phrase",
  type: "object" as const,
  fields: [
    defineField({
      name: "text",
      title: "Full Headline",
      type: "text",
      rows: 4,
      description: "Use line breaks where the site should break lines.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "goldPhrase",
      title: "Gold Italic Phrase",
      type: "string",
      description:
        'Exact words from the headline that should render in gold italics (e.g. "metabolic health."). Must match the headline text exactly.',
    }),
  ],
};

export const networkLocation = defineArrayMember({
  type: "object",
  name: "networkLocation",
  title: "Featured Location",
  fields: [
    defineField({ name: "name", title: "Gym Name", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "city", title: "City / Region", type: "string", validation: (Rule) => Rule.required() }),
  ],
  preview: {
    select: { title: "name", subtitle: "city" },
  },
});

/** Category chip under the Resource Library intro */
export const libraryCategoryTag = {
  name: "libraryCategoryTag",
  title: "Library Category Tag",
  type: "object" as const,
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "href",
      title: "Link URL",
      type: "url",
      validation: (Rule) => Rule.required().uri({ allowRelative: false, scheme: ["http", "https"] }),
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "href" },
  },
};

/**
 * One Resource Library card (featured or secondary).
 * Editors pick a link, then choose photo, video, or link-only.
 */
export const libraryResource = {
  name: "libraryResource",
  title: "Library Resource",
  type: "object" as const,
  fields: [
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      description: 'e.g. "Journal Club", "Whiteboard", "Unbreakable Keynote"',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 4,
      description: "Shown on the large featured card. Optional for the three smaller cards.",
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "string",
    }),
    defineField({
      name: "tag",
      title: "Duration / Format Tag",
      type: "string",
      description: 'e.g. "42 min", "22 min", or "Read"',
    }),
    defineField({
      name: "badge",
      title: "Badge",
      type: "string",
      options: {
        list: [
          { title: "Free", value: "Free" },
          { title: "Pro", value: "Pro" },
        ],
        layout: "radio",
      },
      initialValue: "Free",
    }),
    defineField({
      name: "href",
      title: "Link URL",
      type: "url",
      description: "Where the card goes when clicked.",
      validation: (Rule) => Rule.required().uri({ allowRelative: false, scheme: ["http", "https"] }),
    }),
    defineField({
      name: "mediaType",
      title: "Media",
      type: "string",
      description:
        "Choose how this resource shows media. Link-only is fine for the three smaller cards.",
      options: {
        list: [
          { title: "Photo", value: "photo" },
          { title: "Video", value: "video" },
          { title: "Link only (no media)", value: "none" },
        ],
        layout: "radio",
      },
      initialValue: "none",
    }),
    defineField({
      name: "image",
      title: "Photo / Video Poster",
      type: "image",
      options: { hotspot: true },
      readOnly: false,
      description: "Required for Photo. For Video, optional poster image (otherwise YouTube thumbnail is used when possible).",
      hidden: ({ parent }) => parent?.mediaType === "none" || !parent?.mediaType,
    }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description: "YouTube or Vimeo link. Used when Media is Video.",
      hidden: ({ parent }) => parent?.mediaType !== "video",
    }),
    defineField({
      name: "showPlayButton",
      title: "Show Play Button Overlay",
      type: "boolean",
      description: "Usually on for the large featured card when the link opens a talk or video.",
      initialValue: false,
      hidden: ({ parent }) => parent?.mediaType === "none" || !parent?.mediaType,
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "category",
      media: "image",
      mediaType: "mediaType",
    },
    prepare({ title, subtitle, media, mediaType }) {
      return {
        title: title || "Untitled resource",
        subtitle: [subtitle, mediaType].filter(Boolean).join(" · "),
        media,
      };
    },
  },
};

/** One cell in the home Membership comparison (check / X / text / number). */
export const membershipComparisonCell = {
  name: "membershipComparisonCell",
  title: "Comparison Cell",
  type: "object" as const,
  fields: [
    defineField({
      name: "kind",
      title: "Display",
      type: "string",
      options: {
        list: [
          { title: "Check mark", value: "check" },
          { title: "X (not included)", value: "cross" },
          { title: "Text", value: "text" },
          { title: "Number (e.g. courses/mo)", value: "number" },
        ],
        layout: "radio",
      },
      initialValue: "check",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "text",
      title: "Text",
      type: "string",
      description: 'Shown when Display is Text (e.g. "All included").',
      hidden: ({ parent }) => parent?.kind !== "text",
    }),
    defineField({
      name: "number",
      title: "Number",
      type: "number",
      description: "Shown when Display is Number (e.g. 4 for courses per month).",
      hidden: ({ parent }) => parent?.kind !== "number",
    }),
    defineField({
      name: "suffix",
      title: "Number Suffix",
      type: "string",
      description: 'Optional suffix after the number, e.g. "/mo".',
      hidden: ({ parent }) => parent?.kind !== "number",
    }),
  ],
  preview: {
    select: { kind: "kind", text: "text", number: "number", suffix: "suffix" },
    prepare({ kind, text, number, suffix }) {
      if (kind === "check") return { title: "✓ Included" };
      if (kind === "cross") return { title: "✕ Not included" };
      if (kind === "number") return { title: `${number ?? "?"}${suffix ?? ""}` };
      return { title: text || "Text" };
    },
  },
};

export const membershipComparisonRow = defineArrayMember({
  type: "object",
  name: "membershipComparisonRow",
  title: "Comparison Row",
  fields: [
    defineField({
      name: "feature",
      title: "Feature",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "pro",
      title: "MetFix Pro",
      type: membershipComparisonCell.name,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "free",
      title: "Free",
      type: membershipComparisonCell.name,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "affiliate",
      title: "Affiliate",
      type: membershipComparisonCell.name,
      description:
        "Shown for Gym Owners, Clinicians, and Organizations. Defaults to X if empty.",
    }),
  ],
  preview: {
    select: { title: "feature" },
    prepare({ title }) {
      return { title: title || "Feature row" };
    },
  },
});
