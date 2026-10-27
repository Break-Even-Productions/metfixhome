import { describe, expect, it } from "vitest";
import { isFreeOpen, isLockedCard, isProfessionalTagged, mapAccessDisplay } from "./access";
import { buildLibraryHead } from "./head";
import {
  mapCompositeThumbnail,
  mapFilterDescription,
  mapLibraryResource,
  mapPopularResponse,
  mapSearchResponse,
} from "./map";
import type { LibraryResource } from "./types";

describe("mapFilterDescription (TX5)", () => {
  it("preserves paragraph breaks from HTML", () => {
    const mapped = mapFilterDescription(
      "<p>Para 1</p><p>Para 2</p><p>Para 3</p>",
    );
    expect(mapped).toBe("Para 1\n\nPara 2\n\nPara 3");
  });
});

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

  it("coerces BSI Daily Fix rows labeled as post when daily_fix_date is set", () => {
    const mapped = mapLibraryResource({
      id: 235,
      type: "post",
      title: "Sizzling Steak Fajitas",
      excerpt: "Juicy seared steak",
      date: "2026-10-22T00:00:00Z",
      daily_fix_date: "2026-10-22",
      content_access_display: { access: "full", is_exclusive: false, has_content_access: false },
    });
    expect(mapped?.type).toBe("daily_fix");
    expect(mapped?.daily_fix_date).toBe("2026-10-22");
    expect(mapped?.date).toBe("2026-10-22T00:00:00.000Z");
  });

  it("maps popular payload (views order) into LibrarySearchBody", () => {
    const mapped = mapPopularResponse({
      resources: [
        {
          id: 1,
          type: "post",
          title: "Hot",
          excerpt: "x",
          date: "2025-01-01T00:00:00Z",
          view_count: 99,
          content_access_display: { access: "full", is_exclusive: false },
        },
      ],
      meta: { count: 1, limit: 6 },
    });
    expect(mapped?.resources).toHaveLength(1);
    expect(mapped?.resources[0]?.title).toBe("Hot");
    expect(mapped?.meta).toEqual({
      total: 1,
      count: 1,
      limit: 6,
      offset: 0,
      has_more: false,
    });
  });

  it("infers has_more from a full popular page and respects paginated meta", () => {
    const full = mapPopularResponse(
      {
        resources: Array.from({ length: 24 }, (_, i) => ({
          id: i + 1,
          type: "post",
          title: `P${i}`,
          excerpt: "x",
          date: "2025-01-01T00:00:00Z",
          content_access_display: { access: "full", is_exclusive: false },
        })),
        meta: { count: 24, limit: 24 },
      },
      { limit: 24, offset: 0 },
    );
    expect(full?.meta.has_more).toBe(true);
    expect(full?.meta.offset).toBe(0);

    const paged = mapPopularResponse({
      resources: [
        {
          id: 25,
          type: "post",
          title: "Next",
          excerpt: "x",
          date: "2025-01-01T00:00:00Z",
          content_access_display: { access: "full", is_exclusive: false },
        },
      ],
      meta: { count: 1, limit: 24, offset: 24, total: 50, has_more: true },
    });
    expect(paged?.meta).toEqual({
      total: 50,
      count: 1,
      limit: 24,
      offset: 24,
      has_more: true,
    });
  });

  it("parses composite_thumbnail_html into allowlisted brain/belly/body URLs", () => {
    const html = `<div class="bsi-dfx-composite-thumbnail"><div class="bsi-dfx-composite-layer bsi-dfx-composite-layer-middle"><img src="https://brokenscience.org/wp-content/uploads/2024/11/DailyFixMetFix.svg" alt="" loading="lazy" /></div><div class="bsi-dfx-composite-layer bsi-dfx-composite-layer-left"><img src="https://brokenscience.org/wp-content/uploads/brain.jpg" alt="" /></div><div class="bsi-dfx-composite-layer bsi-dfx-composite-layer-right"><img src="https://evil.example/x.jpg" alt="" /><img src="https://brokenscience.org/wp-content/uploads/belly.jpg" alt="" /></div></div>`;
    const composite = mapCompositeThumbnail(html);
    expect(composite?.body).toContain("DailyFixMetFix.svg");
    expect(composite?.brain).toContain("brain.jpg");
    // First src in the right layer wins; evil host is rejected → null for that capture path.
    // Our regex takes the first img src in the layer; if evil were first, belly would be null.
    expect(composite?.belly).toBeNull();

    const mapped = mapLibraryResource({
      id: 235,
      type: "daily_fix_mod",
      title: "Sizzling Steak Fajitas",
      excerpt: "Juicy",
      date: "2026-10-22T00:00:00Z",
      daily_fix_date: "2026-10-22",
      featured_image: "https://brokenscience.org/wp-content/uploads/belly.jpg",
      composite_thumbnail_html: `<div class="bsi-dfx-composite-thumbnail"><div class="bsi-dfx-composite-layer bsi-dfx-composite-layer-middle"><img src="https://brokenscience.org/wp-content/uploads/2024/11/DailyFixMetFix.svg" /></div><div class="bsi-dfx-composite-layer bsi-dfx-composite-layer-left"><img src="https://brokenscience.org/wp-content/uploads/brain.jpg" /></div><div class="bsi-dfx-composite-layer bsi-dfx-composite-layer-right"><img src="https://brokenscience.org/wp-content/uploads/belly.jpg" /></div></div>`,
      content_access_display: { access: "full", is_exclusive: false, has_content_access: false },
    });
    expect(mapped?.type).toBe("daily_fix");
    expect(mapped?.composite?.brain).toContain("brain.jpg");
    expect(mapped?.composite?.belly).toContain("belly.jpg");
    expect(mapped?.composite?.body).toContain("DailyFixMetFix.svg");
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
