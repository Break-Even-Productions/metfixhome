/**
 * @vitest-environment node
 * SN-T2 — SITE_SETTINGS_QUERY + fetchSiteSettings memoisation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const { sanityFetch } = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
}));

vi.mock("@/lib/sanity", () => ({
  isSanityConfigured: true,
  sanityClient: {
    fetch: (...args: unknown[]) => sanityFetch(...args),
  },
}));

describe("SN-T2 SITE_SETTINGS_QUERY + memoisation", () => {
  beforeEach(() => {
    vi.resetModules();
    sanityFetch.mockReset();
    sanityFetch.mockResolvedValue({
      copyrightText: "© test",
      navLinks: [{ label: "Library", href: "/library", openInNewTab: false }],
      searchTopics: [
        { topic_id: 13, label: "Women's Health & Hormones" },
        { topic_id: 99, label: "Professional Library" },
      ],
    });
  });

  it("SITE_SETTINGS_QUERY contains searchTopics[]{topic_id,label}", async () => {
    const { SITE_SETTINGS_QUERY } = await import("@/lib/content");
    expect(SITE_SETTINGS_QUERY.replace(/\s+/g, " ")).toMatch(
      /searchTopics\[\]\{\s*topic_id,\s*label\s*\}/,
    );
    expect(SITE_SETTINGS_QUERY).not.toMatch(/typeSlug|bsiTermId/);
  });

  it("GROQ searchTopics projection appears once in content.ts", () => {
    const contentSrc = readFileSync(join(ROOT, "client/src/lib/content.ts"), "utf8");
    const groqHits = contentSrc.match(
      /searchTopics\[\]\{\s*topic_id,\s*label\s*\}/g,
    );
    expect(groqHits).toHaveLength(1);
  });

  it("two fetchSiteSettings share one sanityClient.fetch", async () => {
    const { fetchSiteSettings } = await import("@/lib/content");
    const a = await fetchSiteSettings();
    const b = await fetchSiteSettings();
    expect(sanityFetch).toHaveBeenCalledTimes(1);
    expect(a.searchTopics).toEqual([
      { topic_id: 13, label: "Women's Health & Hormones" },
      { topic_id: 99, label: "Professional Library" },
    ]);
    expect(b).toBe(a);
  });

  it("N6: Sanity failure does not memoize forever — next call retries", async () => {
    sanityFetch
      .mockRejectedValueOnce(new Error("cdn down"))
      .mockResolvedValueOnce({
        copyrightText: "© recovered",
        navLinks: [],
        searchTopics: [{ topic_id: 11, label: "A" }],
      });
    const { fetchSiteSettings } = await import("@/lib/content");
    const first = await fetchSiteSettings();
    expect(first.searchTopics).toEqual([]);
    const second = await fetchSiteSettings();
    expect(sanityFetch).toHaveBeenCalledTimes(2);
    expect(second.searchTopics).toEqual([{ topic_id: 11, label: "A" }]);
  });
});
