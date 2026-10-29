import { describe, expect, it } from "vitest";
import type { DetailReaderModel } from "@shared/library";
import { primaryContentTypeVisual } from "./contentTypeVisual";

function baseModel(partial: Partial<DetailReaderModel> = {}): DetailReaderModel {
  return {
    id: 1,
    resourceType: "post",
    title: "T",
    date: "2026-01-01T00:00:00Z",
    author: null,
    image: null,
    video: null,
    categories: [],
    content_types: [],
    topics: [],
    locked: false,
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
    content: "",
    ...partial,
  };
}

describe("primaryContentTypeVisual (PL15)", () => {
  it("falls back to articles slug when content_types is empty", () => {
    const visual = primaryContentTypeVisual(baseModel({ resourceType: "post" }));
    expect(visual.slug).toBe("articles");
    expect(visual.label).toBe("Articles");
  });

  it("maps course resource type to courses slug", () => {
    const visual = primaryContentTypeVisual(baseModel({ resourceType: "course" }));
    expect(visual.slug).toBe("courses");
  });
});
