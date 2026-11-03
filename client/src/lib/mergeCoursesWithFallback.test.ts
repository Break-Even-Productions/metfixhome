import { describe, expect, it } from "vitest";
import type { Course } from "@/lib/contentTypes";
import { mergeCoursesWithFallback } from "./content";

function stubCourse(partial: Partial<Course> & Pick<Course, "id" | "title">): Course {
  return {
    tag: "",
    tagColor: "var(--color-accent-text)",
    comingSoon: false,
    ctaType: "none",
    audience: "",
    price: "",
    stats: [],
    details: "",
    modules: [],
    isAffiliateFree: false,
    requiredForAffiliation: false,
    sortOrder: 10,
    ...partial,
  };
}

describe("mergeCoursesWithFallback", () => {
  it("keeps server order and drops duplicate ids (first wins)", () => {
    const server = [
      stubCourse({ id: "fit-for-duty", title: "Fit for Duty (CMS)", details: "From Sanity" }),
      stubCourse({ id: "fit-for-duty", title: "Duplicate", details: "Should drop" }),
      stubCourse({ id: "brand-new", title: "Brand New Course" }),
    ];

    const merged = mergeCoursesWithFallback(server);

    expect(merged.map((c) => c.id)).toEqual(["fit-for-duty", "brand-new"]);
    expect(merged[0]?.title).toBe("Fit for Duty (CMS)");
    expect(merged[0]?.details).toBe("From Sanity");
  });

  it("drops title-aligned duplicates even when ids differ", () => {
    const merged = mergeCoursesWithFallback([
      stubCourse({ id: "medical-nutrition", title: "MetFix Medical Nutrition" }),
      stubCourse({ id: "mf-med-nut", title: "MetFix Medical Nutrition" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("medical-nutrition");
  });

  it("returns an empty list when the server list is empty", () => {
    expect(mergeCoursesWithFallback([])).toEqual([]);
  });
});
