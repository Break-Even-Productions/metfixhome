/**
 * @vitest-environment jsdom
 * T-E-29…32, T-E-31/47 FOOTER_LINK_ALLOWLIST (rev1.0.10).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FOOTER_LINK_ALLOWLIST } from "./siteFooterLinks";
import {
  isAllowedFooterHref,
  NEWSLETTER_FORM_ACTION,
  SITE_FOOTER_LINKS,
  SITE_FOOTER_SOCIAL_LINKS,
} from "./siteFooterNav";
import { SiteFooter } from "./SiteFooter";

vi.mock("@/hooks/useSanityContent", () => ({
  useSiteSettings: () => ({
    settings: { copyrightText: `© ${new Date().getFullYear()} MetFix`, navLinks: [] },
    loading: false,
  }),
}));

afterEach(() => cleanup());

const HOME_TSX_51_ACTION =
  "https://brokenscience.us13.list-manage.com/subscribe/post?u=473a65a0067d6101d3a6277c8&id=abdc550935&f_id=001a53eaf0";

describe("T-E-30 showNewsletter", () => {
  it("default hides newsletter; true shows Mailchimp", () => {
    const { container, rerender } = render(<SiteFooter />);
    expect(container.querySelector("#newsletter")).toBeNull();
    rerender(<SiteFooter showNewsletter />);
    expect(container.querySelector(`form[action="${NEWSLETTER_FORM_ACTION}"]`)).toBeTruthy();
    expect(screen.getByLabelText("Explore")).toBeTruthy();
  });
});

describe("T-E-31 / T-E-47 FOOTER_LINK_ALLOWLIST", () => {
  it("NEWSLETTER_FORM_ACTION is byte-equal to Home.tsx:51", () => {
    expect(NEWSLETTER_FORM_ACTION).toBe(HOME_TSX_51_ACTION);
  });

  it("exports FOOTER_LINK_ALLOWLIST with legal + mailchimp from siteFooterLinks.ts", () => {
    expect(FOOTER_LINK_ALLOWLIST).toContain("https://brokenscience.org/privacy-policy/");
    expect(FOOTER_LINK_ALLOWLIST).toContain(
      "https://brokenscience.org/terms-and-conditions/",
    );
    expect(FOOTER_LINK_ALLOWLIST).not.toContain(
      "https://brokenscience.org/terms-of-use/",
    );
    expect(isAllowedFooterHref(NEWSLETTER_FORM_ACTION)).toBe(true);
  });

  it("every SITE_FOOTER_LINKS href is absolute and allowlisted; no bare hash; no scholarship; no #top", () => {
    const all = [
      ...SITE_FOOTER_LINKS.explore,
      ...SITE_FOOTER_LINKS.company,
      ...SITE_FOOTER_LINKS.legal,
    ];
    for (const link of all) {
      expect(link.href.startsWith("#"), link.href).toBe(false);
      expect(link.href === "/#top" || link.href === "#top", link.href).toBe(false);
      expect(link.href.startsWith("/") || link.href.startsWith("https://"), link.href).toBe(true);
      expect(isAllowedFooterHref(link.href), link.href).toBe(true);
      expect(link.href.toLowerCase()).not.toMatch(/scholarship/);
    }
    expect(isAllowedFooterHref(NEWSLETTER_FORM_ACTION)).toBe(true);
  });

  it("external legal links have rel=noopener noreferrer", () => {
    const { container } = render(<SiteFooter />);
    const legal = [...container.querySelectorAll('a[href*="brokenscience.org"]')];
    expect(legal.length).toBeGreaterThanOrEqual(2);
    for (const a of legal) {
      expect(a.getAttribute("rel")).toMatch(/noopener/);
      expect(a.getAttribute("rel")).toMatch(/noreferrer/);
    }
  });
});

describe("T-E-32 / SI-E17 no year harness markup", () => {
  it("footer year renders without harness mask attributes", () => {
    const { container } = render(<SiteFooter />);
    const attr = ["data", "visual", "mask"].join("-");
    expect(container.querySelectorAll(`[${attr}]`)).toHaveLength(0);
    expect(container.textContent).toContain(String(new Date().getFullYear()));
  });

  it("repo-scan: VISUAL_HOOK_PATTERN = 0 in non-test client/src", async () => {
    const { VISUAL_HOOK_PATTERN } = await import("../../../tests/visual/hookPattern");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?|css)$/.test(name) && !/\.(test|spec)\./.test(name)) {
          const text = readFileSync(p, "utf8");
          if (VISUAL_HOOK_PATTERN.test(text)) hits.push(p);
        }
      }
    };
    walk(join(process.cwd(), "client/src"));
    expect(hits).toEqual([]);
  });
});

describe("T-E-42 zero social", () => {
  it("SITE_FOOTER_SOCIAL_LINKS empty", () => {
    expect(SITE_FOOTER_SOCIAL_LINKS).toEqual([]);
  });
});

describe("T-E-57 allowlist home", () => {
  it("FOOTER_LINK_ALLOWLIST defined only in siteFooterLinks.ts; SiteFooter exports component only", () => {
    const linksSrc = readFileSync(
      join(process.cwd(), "client/src/components/siteFooterLinks.ts"),
      "utf8",
    );
    const footerSrc = readFileSync(
      join(process.cwd(), "client/src/components/SiteFooter.tsx"),
      "utf8",
    );
    expect(linksSrc).toMatch(/export const FOOTER_LINK_ALLOWLIST/);
    expect(footerSrc).not.toMatch(/export const FOOTER_LINK_ALLOWLIST/);
    expect(footerSrc).not.toMatch(/export const NEWSLETTER_FORM_ACTION/);
    expect(footerSrc).toMatch(/export function SiteFooter|export default SiteFooter/);
  });
});

describe("T-E-33 / E-T-FOOT5 SiteFooter importers", () => {
  it("only Home.tsx (non-test) imports SiteFooter", () => {
    const importRe = /import\s+[^;]*SiteFooter[^;]*from\s+['\"][^'\"]*SiteFooter['\"]/;
    const home = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(home).toMatch(importRe);
    for (const rel of [
      "client/src/pages/account/DashboardLayout.tsx",
      "client/src/pages/posts/PostsLayout.tsx",
      "client/src/App.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toMatch(importRe);
    }
  });
});
