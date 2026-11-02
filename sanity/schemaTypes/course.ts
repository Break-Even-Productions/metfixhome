import { defineArrayMember, defineField, defineType } from "sanity";

export const course = defineType({
  name: "course",
  title: "Course",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Class Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "tag",
      title: "Tag",
      type: "string",
      description: 'Shown above the title, e.g. "FREE FOREVER" or "COMING SOON".',
    }),
    defineField({
      name: "comingSoon",
      title: "Coming Soon",
      type: "boolean",
      description: "When enabled, the course is styled as upcoming (muted price, coming-soon treatment).",
      initialValue: false,
    }),
    defineField({
      name: "ctaType",
      title: "Primary Button",
      type: "string",
      description:
        "Controls the main action button. Start Here = active enroll/start CTA. Notify Me = waitlist/notify CTA.",
      options: {
        list: [
          { title: "Start Here (available)", value: "start" },
          { title: "Notify Me (coming soon / waitlist)", value: "notify" },
          { title: "No button", value: "none" },
        ],
        layout: "radio",
      },
      initialValue: "notify",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "landingPageUrl",
      title: "Landing Page URL",
      type: "url",
      description: "Where Start Here or Notify Me should send the visitor.",
      hidden: ({ parent }) => parent?.ctaType === "none",
      validation: (Rule) =>
        Rule.uri({ allowRelative: false, scheme: ["http", "https"] }).custom(
          (value, context) => {
            const parent = context.parent as { ctaType?: string } | undefined;
            if (parent?.ctaType && parent.ctaType !== "none" && !value) {
              return "Landing page URL is required when a button is shown";
            }
            return true;
          }
        ),
    }),
    defineField({
      name: "audience",
      title: "Audience",
      type: "string",
      description: 'e.g. "Coaches · Individuals"',
    }),
    defineField({
      name: "price",
      title: "Price Label",
      type: "string",
      description: 'e.g. "Free" or "Coming Soon"',
    }),
    defineField({
      name: "stats",
      title: "Stats (modules, runtime, etc.)",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "stat",
          fields: [
            defineField({
              name: "value",
              title: "Value",
              type: "string",
              description: 'e.g. "6", "~1hr", "11"',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              description: 'e.g. "Modules", "Runtime", "Chapters"',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: "value", subtitle: "label" },
          },
        }),
      ],
    }),
    defineField({
      name: "details",
      title: "Details",
      type: "text",
      rows: 6,
      description: "Course overview shown when Details is expanded.",
    }),
    defineField({
      name: "modules",
      title: "Curriculum",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "module",
          fields: [
            defineField({
              name: "number",
              title: "Module Number",
              type: "string",
              description: 'e.g. "01"',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "title",
              title: "Module Title",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 2,
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "number" },
          },
        }),
      ],
    }),
    defineField({
      name: "isAffiliateFree",
      title: "Included for Affiliates",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "requiredForAffiliation",
      title: "Required for Affiliation",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "sortOrder",
      title: "Sort Order",
      type: "number",
      description:
        "Controls where this course appears on the Classes page. Smaller numbers show first (1 before 2 before 10). Tip: use gaps like 10, 20, 30 so you can insert a course later without renumbering everything.",
      initialValue: 100,
    }),
    defineField({
      name: "image",
      title: "Card photo",
      type: "image",
      options: { hotspot: true },
      description:
        "Photo on the Resource Library Courses card. Leave empty to use the matching BSI course image.",
    }),
    defineField({
      name: "bsiPostId",
      title: "BSI course / post ID",
      type: "number",
      description:
        "Optional LearnPress / BSI post ID. The library Courses rail merges this Sanity course with that BSI course, filling any empty display field from the other source.",
      validation: (Rule) => Rule.integer().positive(),
    }),
    defineField({
      name: "startButtonLabel",
      title: "Start Button Label",
      type: "string",
      description: 'Defaults to "Start Here" on the card.',
      hidden: ({ parent }) => parent?.ctaType !== "start",
    }),
    defineField({
      name: "notifyButtonLabel",
      title: "Notify Button Label",
      type: "string",
      description: 'Defaults to "Notify Me" on the card.',
      hidden: ({ parent }) => parent?.ctaType !== "notify",
    }),
    defineField({
      name: "showOnHome",
      title: "Show on Home (Specialty Tracks)",
      type: "boolean",
      description: "When enabled, this course appears in the Specialty Tracks grid on the home page.",
      initialValue: false,
      group: "home",
    }),
    defineField({
      name: "homePreviewLabel",
      title: "Home Card Label",
      type: "string",
      description: 'Small label on the home card, e.g. "Specialty" or "Professional".',
      hidden: ({ parent }) => !parent?.showOnHome,
      group: "home",
    }),
    defineField({
      name: "homePreviewText",
      title: "Home Preview Text",
      type: "text",
      rows: 3,
      description: "Short description shown on the home Specialty Tracks card.",
      hidden: ({ parent }) => !parent?.showOnHome,
      group: "home",
    }),
    defineField({
      name: "homeSortOrder",
      title: "Home Sort Order",
      type: "number",
      description:
        "Controls where this card appears in Specialty Tracks on the home page. Smaller numbers show first (1 before 2 before 10). Tip: use gaps like 10, 20, 30 so you can insert a card later without renumbering everything.",
      initialValue: 100,
      hidden: ({ parent }) => !parent?.showOnHome,
      group: "home",
    }),
  ],
  groups: [
    { name: "home", title: "Home Page Preview" },
  ],
  orderings: [
    {
      title: "Sort Order",
      name: "sortOrderAsc",
      by: [{ field: "sortOrder", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      comingSoon: "comingSoon",
      ctaType: "ctaType",
    },
    prepare({ title, comingSoon, ctaType }) {
      const bits = [
        comingSoon ? "Coming soon" : "Live",
        ctaType === "start" ? "Start" : ctaType === "notify" ? "Notify" : "No CTA",
      ];
      return { title: title || "Untitled course", subtitle: bits.join(" · ") };
    },
  },
});
