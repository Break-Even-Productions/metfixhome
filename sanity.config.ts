import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schemaTypes";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || "etg9lezr";
const dataset = process.env.SANITY_STUDIO_DATASET || "production";

export default defineConfig({
  name: "metfix",
  title: "MetFix",
  projectId,
  dataset,
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Home Page")
              .id("homePage")
              .child(
                S.document()
                  .schemaType("homePage")
                  .documentId("homePage")
                  .title("Home Page")
              ),
            S.listItem()
              .title("Site Settings")
              .id("siteSettings")
              .child(
                S.document()
                  .schemaType("siteSettings")
                  .documentId("siteSettings")
                  .title("Site Settings")
              ),
            S.listItem()
              .title("Become an Affiliate")
              .id("affiliatePage")
              .child(
                S.document()
                  .schemaType("affiliatePage")
                  .documentId("affiliatePage")
                  .title("Become an Affiliate")
              ),
            S.divider(),
            S.documentTypeListItem("course").title("Courses"),
            S.documentTypeListItem("expert").title("Experts"),
            S.documentTypeListItem("testimonial").title("Testimonials"),
            S.documentTypeListItem("faqItem").title("FAQs"),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
});
