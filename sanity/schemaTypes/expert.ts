import { defineField, defineType } from "sanity";

export const expert = defineType({
  name: "expert",
  title: "Expert",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role / Specialty",
      type: "string",
      description: 'e.g. "Emergency Medicine & Metabolic Health"',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
      rows: 6,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "initials",
      title: "Initials",
      type: "string",
      description:
        "Shown as a placeholder when no photo is set. Defaults from the name if left blank.",
      validation: (Rule) => Rule.max(4),
    }),
    defineField({
      name: "hue",
      title: "Avatar Color Hue",
      type: "number",
      description:
        "HSL hue (0–360) for the initials placeholder background. Optional; defaults to warm amber.",
      validation: (Rule) => Rule.min(0).max(360),
      initialValue: 22,
    }),
    defineField({
      name: "photo",
      title: "Photo (optional)",
      type: "image",
      options: { hotspot: true },
      description:
        "Upload a headshot if you have one. If empty, the site shows initials as a placeholder.",
    }),
    defineField({
      name: "sortOrder",
      title: "Sort Order",
      type: "number",
      initialValue: 100,
      description:
        "Default order on the homepage experts rail. Smaller numbers show first. Audience pages may still promote specific people to the front.",
    }),
  ],
  orderings: [
    {
      title: "Sort Order",
      name: "sortOrderAsc",
      by: [{ field: "sortOrder", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "name", subtitle: "role", media: "photo" },
  },
});
