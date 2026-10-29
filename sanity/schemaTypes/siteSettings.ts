import { defineArrayMember, defineField, defineType } from "sanity";
import { NavLinksHelp } from "../components/NavLinksHelp";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  groups: [
    { name: "nav", title: "Navigation Bar", default: true },
    { name: "footer", title: "Footer" },
    { name: "search", title: "Search" },
  ],
  fields: [
    defineField({
      name: "navLinks",
      title: "Navigation Bar Links",
      type: "array",
      group: "nav",
      description:
        "Links shown in the top navigation (desktop and mobile). Order here = order on the site.",
      components: {
        field: NavLinksHelp,
      },
      of: [
        defineArrayMember({
          type: "object",
          name: "navLink",
          title: "Nav Link",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              description: "Text shown in the navigation bar, e.g. “Classes” or “Shop”.",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "href",
              title: "Link URL",
              type: "string",
              description:
                "Internal: start with / (example: /classes or /#about). External: full https:// address (example: https://brokenscience.org/shop/).",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "openInNewTab",
              title: "Open in new tab",
              type: "boolean",
              description:
                "On = opens a new browser tab and leaves this site open (target=_blank). Use for other websites. Off = same tab — use for MetFix pages.",
              initialValue: false,
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "href", openInNewTab: "openInNewTab" },
            prepare({ title, subtitle, openInNewTab }) {
              return {
                title: title || "Untitled link",
                subtitle: `${subtitle || ""}${openInNewTab ? " · new tab" : ""}`,
              };
            },
          },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "copyrightText",
      title: "Copyright Text",
      type: "text",
      rows: 4,
      group: "footer",
      description:
        "Footer copyright text. Supports longer paragraphs — the site layout wraps and scales to fit.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "searchTopics",
      title: "Search topic tabs",
      type: "array",
      group: "search",
      description:
        "Optional pinned topic tabs shown first on /library/search. Remaining BSI topics from /api/library/filters follow, deduped by topic_id. “All” is always shown and is not listed here. Empty is fine in production — API topics only.",
      of: [
        defineArrayMember({
          type: "object",
          name: "searchTopic",
          title: "Search topic",
          fields: [
            defineField({
              name: "topic_id",
              title: "BSI topic id",
              type: "number",
              description: "BSI term id used for dedupe and topics[] filter.",
              validation: (Rule) =>
                Rule.required()
                  .integer()
                  .positive()
                  .error("topic_id must be a positive integer"),
            }),
            defineField({
              name: "label",
              title: "Label override",
              type: "string",
              description: "Optional. Overrides the BSI topic name when set.",
            }),
          ],
          preview: {
            select: { title: "label", topic_id: "topic_id" },
            prepare({ title, topic_id }) {
              return {
                title: title || (topic_id != null ? `Topic ${topic_id}` : "Untitled"),
                subtitle: topic_id != null ? `id ${topic_id}` : "",
              };
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Site Settings" }),
  },
});
