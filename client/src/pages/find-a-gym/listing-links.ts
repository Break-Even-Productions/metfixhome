import type { DirectoryListing } from "@shared/directory/types";

const METFIX_HOSTS = new Set(["metfix.org", "www.metfix.org"]);

/** Prefer the MetFix affiliate/clinic profile over an external gym site. */
export function profileHref(listing: DirectoryListing): string | null {
  const url = listing.profileUrl;
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

/** External gym/clinic site with MetFix attribution query params. */
export function websiteHref(listing: DirectoryListing): string | null {
  if (!listing.website || !/^https?:\/\//i.test(listing.website)) return null;
  return withMetfixReferral(listing.website);
}

/** @deprecated Prefer profileHref / websiteHref. Kept for call sites that want any CTA. */
export function listingHref(listing: DirectoryListing): string | null {
  return profileHref(listing) ?? websiteHref(listing);
}

export function profileCtaLabel(listing: DirectoryListing): string {
  if (listing.kind === "coach") return "View coach";
  if (listing.kind === "doctor") return "View clinic";
  return "View profile";
}

/** Tag outbound traffic so destination analytics can credit metfix.org. */
export function withMetfixReferral(url: string): string {
  try {
    const parsed = new URL(url);
    if (METFIX_HOSTS.has(parsed.hostname.toLowerCase())) return parsed.toString();
    parsed.searchParams.set("utm_source", "metfix");
    parsed.searchParams.set("utm_medium", "referral");
    parsed.searchParams.set("utm_campaign", "find-a-gym");
    return parsed.toString();
  } catch {
    return url;
  }
}
