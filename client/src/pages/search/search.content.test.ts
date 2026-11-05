/**
 * Site settings and the course catalog are local. Search topic tabs come from
 * the library API (`resolveSearchTabs`), not from a CMS query.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("local site settings", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("content.ts does not query a CMS", () => {
    const contentSrc = readFileSync(join(ROOT, "client/src/lib/content.ts"), "utf8");
    expect(contentSrc).not.toMatch(/_type ==|@sanity|sanityClient|apicdn\.sanity\.io/);
  });

  it("fetchSiteSettings is the local nav and copyright, with no topic overrides", async () => {
    const { fetchSiteSettings } = await import("@/lib/content");
    const { DEFAULT_COPYRIGHT_TEXT, DEFAULT_NAV_LINKS } = await import("@/lib/contentTypes");
    const a = await fetchSiteSettings();
    const b = await fetchSiteSettings();
    expect(a.copyrightText).toBe(DEFAULT_COPYRIGHT_TEXT);
    expect([...a.navLinks]).toEqual([...DEFAULT_NAV_LINKS]);
    expect(a.searchTopics).toEqual([]);
    expect(b).toBe(a);
  });

  it("fetchCourses returns the local catalog", async () => {
    const { fetchCourses } = await import("@/lib/content");
    const { FALLBACK_COURSES } = await import("@/data/fallbackCourses");
    await expect(fetchCourses()).resolves.toBe(FALLBACK_COURSES);
  });
});
