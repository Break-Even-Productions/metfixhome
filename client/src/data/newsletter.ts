/**
 * Newsletter / Substack constants kept outside `components/home/**`
 * so home repo-scans stay free of Substack literals.
 */

export const SUBSTACK_ARCHIVE_URL =
  "https://letsstartwiththetruth.substack.com/archive";

export const NEWSLETTER_STORAGE_KEY = "metfix-newsletter";

export const NEWSLETTER_INTERESTS = [
  { id: "metabolic-health", label: "Metabolic health" },
  { id: "womens-health", label: "Women's health" },
  { id: "coaches", label: "Resources for coaches" },
  { id: "gym-owners", label: "Resources for gym owners" },
  { id: "first-responders", label: "First responders" },
  { id: "clinicians", label: "Clinicians" },
  { id: "athletes", label: "Athletes and performance" },
] as const;

export type NewsletterInterestId = (typeof NEWSLETTER_INTERESTS)[number]["id"];

/** Mailchimp honeypot field for audience abdc550935. */
export const MAILCHIMP_HONEYPOT_NAME = "b_473a65a0067d6101d3a6277c8_abdc550935";
