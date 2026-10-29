/**
 * Shared footer link allowlist (PR E rev1.0.7 §15b / PR F LR-F19).
 * Single source — never redefine elsewhere. SiteFooter (PR E) imports this.
 */
export const FOOTER_LINK_ALLOWLIST = [
  "/",
  "/login",
  "/become-an-affiliate",
  "/classes",
  "/courses",
  "/affiliate-seminars",
  "/the-daily-fix",
  "/posts",
  "/library",
  "/account",
  "/account/billing",
  "/account/profile",
  "/account/courses",
  "/account/favorites",
  "/account/referrals",
  "/account/notifications",
  "/account/privacy",
  "/404",
  "/#membership-section",
  "/#classes",
  "/#foundations",
  "/#testimonials",
  "/#faq",
  "https://brokenscience.us13.list-manage.com/subscribe/post",
  "https://brokenscience.org/privacy-policy/",
  "https://brokenscience.org/terms-and-conditions/",
] as const;

export type FooterLinkAllowlistEntry = (typeof FOOTER_LINK_ALLOWLIST)[number];
