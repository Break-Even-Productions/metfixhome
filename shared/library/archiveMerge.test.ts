import { describe, expect, it } from "vitest";
import { archiveSearchLegs, mergeArchivePages } from "./archiveMerge";
import type {
  ContentAccessDisplay,
  LibraryFilterTerm,
  LibraryFiltersBody,
  LibraryResource,
  LibrarySearchBody,
} from "./types";

const access: ContentAccessDisplay = {
  access: "full",
  has_content_access: false,
  user_has_access: true,
  has_preview: false,
  is_exclusive: false,
  show_same: 0,
  show_video_in_preview: false,
  access_group_labels: [],
};

function term(id: number, slug: string, name = slug): LibraryFilterTerm {
  return { id, name, slug, description: null, image: null };
}

function filters(
  partial: Partial<LibraryFiltersBody> = {},
): LibraryFiltersBody {
  return {
    topics: partial.topics ?? [],
    categories: partial.categories ?? [],
    content_type_terms: partial.content_type_terms ?? [],
  };
}

function resource(id: number, title: string, date: string): LibraryResource {
  return {
    id,
    type: "post",
    title,
    excerpt: "",
    date,
    image: null,
    permalink: null,
    author: null,
    categories: [],
    topics: [],
    content_types: [],
    access,
  };
}

function page(
  resources: LibraryResource[],
  total = resources.length,
  hasMore = false,
): LibrarySearchBody {
  return {
    resources,
    meta: {
      total,
      count: resources.length,
      limit: 9,
      offset: 0,
      has_more: hasMore,
    },
  };
}

describe("archiveSearchLegs", () => {
  it("searches the glassman topic and category, and skips a missing book library", () => {
    expect(
      archiveSearchLegs(
        filters({
          topics: [
            term(43889, "glassman-archive", "Glassman Archive"),
            term(1, "event", "Event"),
          ],
          categories: [
            term(400, "glassman-archive", "Glassman Archive"),
            term(43863, "metfix", "MetFix"),
          ],
          content_type_terms: [term(43874, "articles", "Articles")],
        }),
      ),
    ).toEqual([
      { kind: "topic", id: 43889 },
      { kind: "category", id: 400 },
    ]);
  });

  it("adds book library by slug or by name once the content type exists", () => {
    expect(
      archiveSearchLegs(
        filters({
          topics: [term(43889, "glassman-archive")],
          categories: [term(400, "glassman-archive")],
          content_type_terms: [term(50, "book-library", "Book Library")],
        }),
      ),
    ).toEqual([
      { kind: "topic", id: 43889 },
      { kind: "category", id: 400 },
      { kind: "content-type", slug: "book-library" },
    ]);

    expect(
      archiveSearchLegs(
        filters({
          content_type_terms: [term(51, "books", "Book Library")],
        }),
      ),
    ).toEqual([{ kind: "content-type", slug: "books" }]);
  });

  it("returns no legs when neither archive term is published", () => {
    expect(archiveSearchLegs(filters())).toEqual([]);
  });
});

describe("mergeArchivePages", () => {
  it("dedupes overlapping items and orders the union newest first", () => {
    const shared = resource(1, "Shared", "2024-01-02T00:00:00.000Z");
    const merged = mergeArchivePages(
      [
        page(
          [shared, resource(2, "Topic only", "2024-06-01T00:00:00.000Z")],
          1,
        ),
        page(
          [shared, resource(3, "Category only", "2024-03-01T00:00:00.000Z")],
          137,
          true,
        ),
      ],
      { limit: 9, offset: 0 },
    );
    expect(merged.resources.map((r) => r.title)).toEqual([
      "Topic only",
      "Category only",
      "Shared",
    ]);
    expect(merged.meta).toMatchObject({
      total: 138,
      count: 3,
      limit: 9,
      offset: 0,
      has_more: true,
    });
  });
});
