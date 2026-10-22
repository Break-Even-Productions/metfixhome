import { describe, expect, it } from "vitest";
import { isFreeOpen, isLockedCard, isProfessionalTagged, mapAccessDisplay } from "./access";
import { buildLibraryHead } from "./head";
import { mapLibraryResource, mapSearchResponse } from "./map";
import type { LibraryResource } from "./types";

describe("library access mapping", () => {
  it("maps false / none to none", () => {
    expect(mapAccessDisplay({ access: false }).access).toBe("none");
    expect(mapAccessDisplay({ access: "none" }).access).toBe("none");
    expect(mapAccessDisplay({ access: "preview" }).access).toBe("preview");
  });

  it("tags professional / locked / free correctly", () => {
    const locked = {
      access: mapAccessDisplay({ access: "none", is_exclusive: true, has_content_access: true }),
    } as LibraryResource;
    const preview = {
      access: mapAccessDisplay({ access: "preview", has_content_access: true, has_preview: true }),
    } as LibraryResource;
    const open = {
      access: mapAccessDisplay({ access: "full", is_exclusive: false, has_content_access: false }),
    } as LibraryResource;

    expect(isLockedCard({ ...locked, type: "post", id: 1 } as LibraryResource)).toBe(true);
    expect(isProfessionalTagged(preview)).toBe(true);
    expect(isFreeOpen({ ...open, type: "post", id: 2 } as LibraryResource)).toBe(true);
  });
});

describe("library search map", () => {
  it("maps search payload and skips bad rows", () => {
    const mapped = mapSearchResponse({
      resources: [
        {
          id: 10,
          type: "post",
          title: "Hello",
          excerpt: "Hi",
          date: "2026-01-02T00:00:00Z",
          featured_image: "https://brokenscience.org/wp-content/x.jpg",
          permalink: "https://brokenscience.org/hello/",
          author: { name: "Ada" },
          categories: [{ id: 1, name: "MetFix", slug: "metfix" }],
          topics: [],
          content_types: [{ id: 2, name: "Articles", slug: "articles" }],
          content_access_display: { access: "full", is_exclusive: false, has_content_access: false },
        },
        { id: "bad" },
      ],
      meta: { total: 1, count: 1, limit: 12, offset: 0, has_more: false },
    });
    expect(mapped?.resources).toHaveLength(1);
    expect(mapped?.resources[0]?.title).toBe("Hello");
    expect(mapped?.resources[0]?.image).toContain("brokenscience.org");
  });

  it("mapLibraryResource returns null without title", () => {
    expect(mapLibraryResource({ id: 1, type: "post", date: "2026-01-01T00:00:00Z" })).toBeNull();
  });
});

describe("library head", () => {
  it("hub canonical is metfix.org/library; detail canonical prefers BSI permalink", () => {
    const hub = buildLibraryHead({ kind: "hub" });
    expect(hub.canonical).toBe("https://metfix.org/library");

    const detail = buildLibraryHead({
      kind: "detail",
      type: "post",
      id: 9,
      title: "T",
      excerpt: "E",
      permalink: "https://brokenscience.org/t/",
      image: null,
    });
    expect(detail.canonical).toBe("https://brokenscience.org/t/");
    expect(detail.ogUrl).toBe("https://metfix.org/library/post/9");
  });
});
