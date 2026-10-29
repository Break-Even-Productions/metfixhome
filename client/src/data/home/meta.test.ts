/**
 * T-E-25 audience meta pairs (LR-15 / §3d).
 */
import { describe, expect, it } from "vitest";
import { audienceLinks, type AudienceHref } from "./audience";
import { AUDIENCE_META, HOME_CANONICAL, metaForAudience } from "./meta";

describe("T-E-25 audience meta", () => {
  it("has pairs for every audience; title ≤60, description ≤160", () => {
    for (const link of audienceLinks) {
      const meta = metaForAudience(link.href);
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.title.length).toBeLessThanOrEqual(60);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("pairs are pairwise distinct except / and #for-individuals share individuals", () => {
    const titles = new Set(Object.values(AUDIENCE_META).map((m) => m.title));
    expect(titles.size).toBe(audienceLinks.length);
    expect(AUDIENCE_META["#for-individuals"]).toEqual(
      metaForAudience("#for-individuals" as AudienceHref),
    );
  });

  it("canonical constant is https://metfix.org/", () => {
    expect(HOME_CANONICAL).toBe("https://metfix.org/");
  });

  it("matches §3d pinned titles", () => {
    expect(AUDIENCE_META["#for-individuals"].title).toBe(
      "MetFix — Metabolic Health Classes for Real Life",
    );
    expect(AUDIENCE_META["#for-coaches"].title).toBe(
      "MetFix for Coaches — Become a Certified MetFix Coach",
    );
    expect(AUDIENCE_META["#for-athletes"].title).toBe(
      "MetFix for Athletes — Fuel for Optimal Performance",
    );
  });
});
