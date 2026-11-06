import type { DirectoryListing } from "@shared/directory/types";

/** Google Maps directions — opens the app on mobile, site on desktop. No API key. */
export function directionsHref(listing: DirectoryListing): string {
  const query =
    listing.address.trim() ||
    [listing.name, listing.city, listing.state].filter(Boolean).join(", ") ||
    `${listing.lat},${listing.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
