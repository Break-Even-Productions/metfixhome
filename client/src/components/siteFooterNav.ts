/**
 * PR E footer presentation (columns + newsletter action).
 * Allowlist source of truth remains F1-owned `siteFooterLinks.ts`.
 */
import { FOOTER_LINK_ALLOWLIST } from "@/components/siteFooterLinks";

export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

/** Byte-equal to staging Home.tsx:51 Mailchimp action (SI-E11 / LR-E1). */
export const NEWSLETTER_FORM_ACTION =
  "https://brokenscience.us13.list-manage.com/subscribe/post?u=473a65a0067d6101d3a6277c8&id=abdc550935&f_id=001a53eaf0";

/** @deprecated alias — prefer NEWSLETTER_FORM_ACTION */
export const MAILCHIMP_NEWSLETTER_ACTION = NEWSLETTER_FORM_ACTION;

/**
 * Footer link columns — absolute `/…` or `/#id` only (P-E-15g); no bare `#…`; no `#scholarship`.
 */
export const SITE_FOOTER_LINKS = {
  explore: [
    { label: "Classes", href: "/#classes" },
    { label: "Membership", href: "/#membership-section" },
    { label: "Find a Gym", href: "/#network" },
    { label: "Library", href: "/library" },
  ],
  company: [
    { label: "About", href: "/#about" },
    { label: "Become an Affiliate", href: "/become-an-affiliate" },
    { label: "Affiliate Seminars", href: "/affiliate-seminars" },
    { label: "Help", href: "/#faq" },
  ],
  legal: [
    {
      label: "Privacy Policy",
      href: "https://brokenscience.org/privacy-policy/",
      external: true,
    },
    {
      label: "Terms of Use",
      href: "https://brokenscience.org/terms-and-conditions/",
      external: true,
    },
  ],
} as const satisfies {
  explore: readonly FooterLink[];
  company: readonly FooterLink[];
  legal: readonly FooterLink[];
};

/** Beta social set is empty (LR-E8). */
export const SITE_FOOTER_SOCIAL_LINKS: readonly FooterLink[] = [];

/** Allowlist check against F1 `FOOTER_LINK_ALLOWLIST` (exact or Mailchimp prefix). */
export function isAllowedFooterHref(href: string): boolean {
  if ((FOOTER_LINK_ALLOWLIST as readonly string[]).includes(href)) return true;
  const mailchimp = (FOOTER_LINK_ALLOWLIST as readonly string[]).find((e) =>
    e.includes("list-manage.com/subscribe/post"),
  );
  if (mailchimp && href.startsWith(mailchimp)) return true;
  return false;
}
