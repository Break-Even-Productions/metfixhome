import { describe, expect, it } from "vitest";
import { FOOTER_LINK_ALLOWLIST } from "./siteFooterLinks";

describe("FOOTER_LINK_ALLOWLIST (PR E §15b / T-F-59)", () => {
  it("includes legal links and Mailchimp form action", () => {
    expect(FOOTER_LINK_ALLOWLIST).toContain("https://brokenscience.org/privacy-policy/");
    expect(FOOTER_LINK_ALLOWLIST).toContain(
      "https://brokenscience.org/terms-and-conditions/",
    );
    expect(FOOTER_LINK_ALLOWLIST).toContain(
      "https://brokenscience.us13.list-manage.com/subscribe/post",
    );
  });

  it("has no social hosts and no wp-json", () => {
    for (const href of FOOTER_LINK_ALLOWLIST) {
      expect(href).not.toMatch(/wp-json/i);
      expect(href).not.toMatch(/facebook|instagram|twitter|x\.com|linkedin|youtube/i);
      expect(href).not.toMatch(/curie/i);
    }
  });

  it("uses absolute internal paths or /# anchors (no bare #)", () => {
    for (const href of FOOTER_LINK_ALLOWLIST) {
      if (href.startsWith("http")) continue;
      expect(href.startsWith("/")).toBe(true);
      expect(href.startsWith("/#") || !href.includes("#") || href.includes("/#")).toBe(true);
      expect(href).not.toMatch(/^#[^/]/);
      expect(href).not.toContain("scholarship");
    }
  });
});
