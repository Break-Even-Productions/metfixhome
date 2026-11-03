import { defineArrayMember, defineField, defineType } from "sanity";
import { ctaLink, highlightedHeadline } from "./objects";

const benefitIconOptions = [
  { title: "Book / Education", value: "book" },
  { title: "People / Community", value: "users" },
  { title: "Award / Badge", value: "award" },
  { title: "Dumbbell / Training", value: "dumbbell" },
  { title: "Globe / Network", value: "globe" },
  { title: "Map Pin / Location", value: "map-pin" },
  { title: "Checkmark", value: "check" },
  { title: "Shield", value: "shield" },
  { title: "Star", value: "star" },
  { title: "Heart", value: "heart" },
];

export const affiliatePage = defineType({
  name: "affiliatePage",
  title: "Become an Affiliate",
  type: "document",
  groups: [
    { name: "hero", title: "1. Hero" },
    { name: "means", title: "2. What It Means + Membership Includes" },
    { name: "benefits", title: "3. What You Get (benefit boxes)" },
    { name: "qualifies", title: "4. Who Qualifies" },
    { name: "process", title: "5. The Process" },
    { name: "testimonial", title: "6. Quote from the Network" },
    { name: "application", title: "7. Application Button & Link" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Internal Title",
      type: "string",
      initialValue: "Become an Affiliate",
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
          description: 'Small label above the headline, e.g. "MetFix Affiliate Program"',
        }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
          description: "Main headline. Mark which words should appear in gold italics.",
        }),
        defineField({ name: "subtext", title: "Subtext", type: "text", rows: 4 }),
        defineField({
          name: "primaryCta",
          title: "Primary Button (usually Apply)",
          type: ctaLink.name,
          description:
            "Button text + link. For the application form, use the same URL as in tab 7, or a different link if needed.",
        }),
        defineField({
          name: "secondaryCta",
          title: "Secondary Button",
          type: ctaLink.name,
          description: 'e.g. "See the Benefits" linking to #what-you-get on this page.',
        }),
        defineField({
          name: "stats",
          title: "Hero Stats (optional)",
          type: "array",
          of: [
            defineArrayMember({
              type: "object",
              name: "heroStat",
              fields: [
                defineField({ name: "value", title: "Value", type: "string" }),
                defineField({ name: "label", title: "Label", type: "string" }),
              ],
              preview: {
                select: { title: "value", subtitle: "label" },
              },
            }),
          ],
          description: "Small stats under the hero buttons (e.g. Global / Network).",
          validation: (Rule) => Rule.max(4),
        }),
      ],
    }),

    // ─── 2. WHAT IT MEANS + INCLUDES ───────────────────────────
    defineField({
      name: "whatItMeans",
      title: "What It Means",
      type: "object",
      group: "means",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({
          name: "body",
          title: "Body Paragraphs",
          type: "array",
          of: [defineArrayMember({ type: "text" })],
          description: "One paragraph per item. Add or remove as needed.",
        }),
        defineField({
          name: "price",
          title: "Price Amount",
          type: "string",
          description: 'Shown large, e.g. "$170"',
        }),
        defineField({
          name: "pricePeriod",
          title: "Price Period",
          type: "string",
          description: 'e.g. "per month"',
        }),
        defineField({
          name: "priceNote",
          title: "Price Note",
          type: "string",
          description: 'e.g. "annual commitment"',
        }),
        defineField({
          name: "priceDescription",
          title: "Price Description",
          type: "text",
          rows: 3,
        }),
        defineField({
          name: "includesLabel",
          title: "Includes List Label",
          type: "string",
          description: 'Heading above the checklist, e.g. "What Affiliate Membership Includes"',
        }),
        defineField({
          name: "includes",
          title: "What Affiliate Membership Includes",
          type: "array",
          of: [defineArrayMember({ type: "string" })],
          description:
            "Checklist items on the right. Add, edit, reorder, or remove freely. Each item is one line with a checkmark on the site.",
        }),
      ],
    }),

    // ─── 3. BENEFITS ───────────────────────────────────────────
    defineField({
      name: "benefits",
      title: "What You Get (benefit boxes)",
      type: "object",
      group: "benefits",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "subtext", title: "Subtext", type: "text", rows: 3 }),
        defineField({
          name: "items",
          title: "Benefit Boxes",
          type: "array",
          description:
            "Square cards under “What you get when you join the network.” Maximum 10 (that is how many fit the layout). Tip: 6 looks balanced.",
          validation: (Rule) =>
            Rule.max(10).error("Maximum 10 benefit boxes — that is all the layout can fit."),
          of: [
            defineArrayMember({
              type: "object",
              name: "benefitItem",
              title: "Benefit Box",
              fields: [
                defineField({
                  name: "icon",
                  title: "Icon",
                  type: "string",
                  options: { list: benefitIconOptions },
                  description: "Pick an icon that matches the benefit.",
                  initialValue: "book",
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
                  validation: (Rule) => Rule.required(),
                }),
              ],
              preview: {
                select: { title: "title", subtitle: "description" },
              },
            }),
          ],
        }),
      ],
    }),

    // ─── 4. WHO QUALIFIES ──────────────────────────────────────
    defineField({
      name: "whoQualifies",
      title: "Who Qualifies",
      type: "object",
      group: "qualifies",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({
          name: "body",
          title: "Body Paragraphs",
          type: "array",
          of: [defineArrayMember({ type: "text" })],
        }),
        defineField({
          name: "primaryCta",
          title: "Primary Button",
          type: ctaLink.name,
          description: 'e.g. "Enroll in MetFix Essentials"',
        }),
        defineField({
          name: "secondaryCta",
          title: "Secondary Button",
          type: ctaLink.name,
          description: 'e.g. "Take the Free Class First"',
        }),
        defineField({
          name: "requirements",
          title: "Qualification Checklist",
          type: "array",
          description:
            "Checkmark items on the right. Looks best with 3–4. Maximum 5 (that is all that fits cleanly).",
          validation: (Rule) =>
            Rule.max(5).error("Maximum 5 qualification items — the page looks best with 3–4."),
          of: [
            defineArrayMember({
              type: "object",
              name: "requirementItem",
              title: "Requirement",
              fields: [
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
                  validation: (Rule) => Rule.required(),
                }),
              ],
              preview: {
                select: { title: "title", subtitle: "description" },
              },
            }),
          ],
        }),
      ],
    }),

    // ─── 5. PROCESS ────────────────────────────────────────────
    defineField({
      name: "process",
      title: "The Process",
      type: "object",
      group: "process",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({
          name: "headline",
          title: "Headline",
          type: highlightedHeadline.name,
        }),
        defineField({ name: "subtext", title: "Subtext", type: "text", rows: 3 }),
        defineField({
          name: "steps",
          title: "Steps",
          type: "array",
          description:
            "Numbered steps (01, 02, …) are assigned automatically from the order below. Looks best with 4–5. Maximum 5.",
          validation: (Rule) =>
            Rule.max(5).error("Maximum 5 process steps — the page looks best with 4–5."),
          of: [
            defineArrayMember({
              type: "object",
              name: "processStep",
              title: "Step",
              fields: [
                defineField({
                  name: "title",
                  title: "Step Title",
                  type: "string",
                  validation: (Rule) => Rule.required(),
                }),
                defineField({
                  name: "description",
                  title: "Step Description",
                  type: "text",
                  rows: 4,
                  validation: (Rule) => Rule.required(),
                }),
              ],
              preview: {
                select: { title: "title", subtitle: "description" },
              },
            }),
          ],
        }),
      ],
    }),

    // ─── 6. TESTIMONIAL ────────────────────────────────────────
    defineField({
      name: "networkQuote",
      title: "Quote from the Network",
      type: "object",
      group: "testimonial",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: "eyebrow", title: "Eyebrow Label", type: "string" }),
        defineField({ name: "quote", title: "Quote", type: "text", rows: 5 }),
        defineField({
          name: "attribution",
          title: "Attribution",
          type: "string",
          description: 'e.g. "MetFix Affiliate, CrossFit Gym Owner"',
        }),
      ],
    }),

    // ─── 7. APPLICATION ────────────────────────────────────────
    defineField({
      name: "application",
      title: "Application Button & Link",
      type: "object",
      group: "application",
      options: { collapsible: true, collapsed: false },
      description:
        "This controls the application section at the bottom, and is also a good place to keep the official application URL used across the page.",
      fields: [
        defineField({
          name: "eyebrow",
          title: "Section Eyebrow",
          type: "string",
          description: 'e.g. "Affiliate Application"',
        }),
        defineField({
          name: "headline",
          title: "Section Headline",
          type: highlightedHeadline.name,
        }),
        defineField({
          name: "subtext",
          title: "Section Subtext",
          type: "text",
          rows: 2,
        }),
        defineField({
          name: "buttonLabel",
          title: "Application Button Text",
          type: "string",
          description: 'Text on the button in this section, e.g. "Application" or "Apply Now".',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "url",
          title: "Application Link URL",
          type: "url",
          description:
            "Where the Apply / Application buttons go. Must be a full https:// link. Opens in a new tab.",
          validation: (Rule) =>
            Rule.required().uri({ allowRelative: false, scheme: ["http", "https"] }),
        }),
        defineField({
          name: "stickyButtonLabel",
          title: "Mobile Sticky Button Text",
          type: "string",
          description:
            "Optional. Button on the sticky bar at the bottom of mobile screens. Defaults to the hero Apply button text if empty.",
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Become an Affiliate" }),
  },
});
