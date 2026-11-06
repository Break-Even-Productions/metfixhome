import { describe, expect, it } from "vitest";
import type { LibraryResource, LibrarySearchBody } from "./types";
import {
  buildExclusiveFeedQuery,
  mapExclusiveAccessLevels,
  retainExclusiveCatalog,
} from "./exclusiveFeed";

function resource(partial: Partial<LibraryResource>): LibraryResource {
  return {
    id: 1,
    type: "exclusive_resource",
    title: "Exclusive",
    excerpt: "",
    date: "2026-01-01T00:00:00.000Z",
    image: null,
    permalink: null,
    author: null,
    categories: [],
    topics: [],
    content_types: [],
    access: {
      access: "full",
      has_content_access: true,
      user_has_access: true,
      has_preview: false,
      is_exclusive: true,
      show_same: 0,
      show_video_in_preview: false,
      access_group_labels: [],
    },
    ...partial,
  };
}

describe("exclusive feed query", () => {
  it("always requests exclusive resources and forwards access levels", () => {
    const qs = buildExclusiveFeedQuery(
      new URLSearchParams("content_access[]=5&content_types[]=daily_fix&query=brief"),
    );
    expect(qs).toContain("content_types%5B%5D=exclusive_resource");
    expect(qs).toContain("content_access%5B%5D=5");
    expect(qs).toContain("query=brief");
    expect(qs).not.toContain("daily_fix");
  });

  it("rejects a daily fix term and a bad access id", () => {
    expect(
      buildExclusiveFeedQuery(new URLSearchParams("content_type_terms[]=daily_fix")),
    ).toBeNull();
    expect(buildExclusiveFeedQuery(new URLSearchParams("content_access[]=0"))).toBeNull();
    expect(buildExclusiveFeedQuery(new URLSearchParams("limit=99"))).toBeNull();
  });
});

describe("exclusive catalog filter", () => {
  it("drops Daily Fix, events, and non-exclusive posts", () => {
    const body: LibrarySearchBody = {
      resources: [
        resource({ id: 1, title: "Member briefing" }),
        resource({
          id: 2,
          type: "post",
          title: "Also exclusive",
          access: {
            access: "full",
            has_content_access: true,
            user_has_access: true,
            has_preview: false,
            is_exclusive: true,
            show_same: 0,
            show_video_in_preview: false,
            access_group_labels: [],
          },
        }),
        resource({ id: 3, type: "daily_fix", title: "Wednesday Fix", daily_fix_date: "2026-02-02" }),
        resource({ id: 4, type: "post", title: "Open post", access: { ...resource({}).access, is_exclusive: false } }),
        resource({ id: 5, type: "event", title: "Seminar" }),
      ],
      meta: { total: 5, count: 5, limit: 12, offset: 0, has_more: false },
    };
    const kept = retainExclusiveCatalog(body);
    expect(kept.resources.map((r) => r.title)).toEqual(["Member briefing", "Also exclusive"]);
    expect(kept.meta.count).toBe(2);
  });

  it("maps access level chips and drops incomplete rows", () => {
    expect(
      mapExclusiveAccessLevels({
        access_levels: [
          { id: 5, name: "MetFix Pro", slug: "metfix" },
          { id: 6, name: "<b>Society</b>", slug: "society" },
          { id: -1, name: "Bad", slug: "bad" },
        ],
      }),
    ).toEqual([
      { id: 5, name: "MetFix Pro", slug: "metfix" },
      { id: 6, name: "Society", slug: "society" },
    ]);
  });
});
