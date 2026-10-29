import { describe, expect, it } from "vitest";
import type { LibraryResource } from "@shared/library";
import type { Course } from "@/lib/contentTypes";
import { courseTitlesAlign, mergeCourseRail } from "./mergeCourseRail";

function course(partial: Partial<Course> & Pick<Course, "id" | "title">): Course {
  return {
    tag: "",
    tagColor: "",
    comingSoon: false,
    ctaType: "start",
    audience: "",
    price: "",
    stats: [],
    details: "",
    modules: [],
    isAffiliateFree: false,
    requiredForAffiliation: false,
    sortOrder: 0,
    ...partial,
  };
}

function resource(
  partial: Partial<LibraryResource> & Pick<LibraryResource, "id" | "title">,
): LibraryResource {
  return {
    type: "course",
    excerpt: "",
    date: "2026-01-01T00:00:00Z",
    image: null,
    permalink: null,
    author: null,
    categories: [],
    topics: [],
    content_types: [],
    access: {
      access: "full",
      has_content_access: false,
      user_has_access: true,
      has_preview: false,
      is_exclusive: false,
      show_same: 0,
      show_video_in_preview: false,
      access_group_labels: [],
    },
    ...partial,
  };
}

describe("mergeCourseRail", () => {
  it("fills an empty Sanity photo and keeps a non-empty Sanity title", () => {
    const cards = mergeCourseRail(
      [
        course({
          id: "fit-for-duty",
          title: "Fit for Duty",
          tag: "VIEW COURSE",
          audience: "Law Enforcement · Fire",
          image: "",
        }),
      ],
      [
        resource({
          id: 28822,
          title: "Fit for Duty: Peak Performance Under Pressure",
          image: "https://brokenscience.org/uploads/fit.jpg",
          excerpt: "API blurb",
          permalink: "https://brokenscience.org/courses/fit-for-duty/",
        }),
      ],
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      title: "Fit for Duty",
      image: "https://brokenscience.org/uploads/fit.jpg",
      badge: "VIEW COURSE",
      excerpt: "Law Enforcement · Fire",
    });
  });

  it("uses the API excerpt when Sanity audience is empty, and does not duplicate the match", () => {
    const cards = mergeCourseRail(
      [course({ id: "missing-manual", title: "The Missing Manual", audience: "  " })],
      [
        resource({
          id: 29612,
          title: "The Missing Manual",
          image: "https://brokenscience.org/uploads/manual.jpg",
          excerpt: "Perimenopause · Menopause",
          permalink: "https://brokenscience.org/courses/womens-health-missing-manual/",
        }),
        resource({
          id: 22096,
          title: "MetFix Spark",
          image: "https://brokenscience.org/uploads/spark.jpg",
          excerpt: "Four weeks",
          permalink: "https://brokenscience.org/courses/spark/",
        }),
      ],
    );
    expect(cards.map((c) => c.title)).toEqual(["The Missing Manual", "MetFix Spark"]);
    expect(cards[0]?.excerpt).toBe("Perimenopause · Menopause");
    expect(cards[0]?.image).toBe("https://brokenscience.org/uploads/manual.jpg");
    expect(cards[1]?.image).toBe("https://brokenscience.org/uploads/spark.jpg");
    expect(cards[1]?.badge).toBe("Course");
  });

  it("matches bsiPostId even when titles differ, and keeps a Sanity photo", () => {
    const cards = mergeCourseRail(
      [
        course({
          id: "custom",
          title: "Sanity name",
          bsiPostId: 42,
          image: "https://cdn.sanity.io/photo.jpg",
        }),
      ],
      [
        resource({
          id: 42,
          title: "API name",
          image: "https://brokenscience.org/uploads/api.jpg",
          excerpt: "From API",
        }),
      ],
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe("Sanity name");
    expect(cards[0]?.image).toBe("https://cdn.sanity.io/photo.jpg");
    expect(cards[0]?.excerpt).toBe("From API");
  });

  it("does not treat a longer shared prefix as the same course", () => {
    expect(courseTitlesAlign("MetFix Essentials Advanced", "MetFix Essentials Course")).toBe(
      false,
    );
    expect(courseTitlesAlign("Fit for Duty", "Fit for Duty: Peak Performance Under Pressure")).toBe(
      true,
    );
  });
});
