import type { DirectoryKind, DirectoryListing } from "@shared/directory/types";

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type KindFilter = "all" | DirectoryKind;

export type DirectoryFilters = {
  text: string;
  kind: KindFilter;
  communities: string[];
  bounds: MapBounds | null;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function haystack(listing: DirectoryListing): string {
  return normalize(
    [
      listing.name,
      listing.title,
      listing.summary ?? "",
      listing.city,
      listing.state,
      listing.address,
      ...listing.communities,
    ].join(" "),
  );
}

export function listingInBounds(
  listing: { lat: number; lng: number },
  bounds: MapBounds | null,
): boolean {
  if (!bounds) return true;
  if (!Number.isFinite(listing.lat) || !Number.isFinite(listing.lng)) return false;
  if (listing.lat > bounds.north || listing.lat < bounds.south) return false;
  if (bounds.west <= bounds.east) {
    return listing.lng >= bounds.west && listing.lng <= bounds.east;
  }
  return listing.lng >= bounds.west || listing.lng <= bounds.east;
}

export function filterDirectory(
  listings: readonly DirectoryListing[],
  filters: DirectoryFilters,
): DirectoryListing[] {
  const tokens = normalize(filters.text)
    .split(" ")
    .filter((token) => token.length > 1 || /^\d+$/.test(token));
  const wanted = new Set(filters.communities);
  return listings
    .filter((listing) => {
      if (filters.kind !== "all" && listing.kind !== filters.kind) return false;
      if (!listingInBounds(listing, filters.bounds)) return false;
      if (wanted.size > 0 && !listing.communities.some((label) => wanted.has(label))) return false;
      if (tokens.length === 0) return true;
      const hay = haystack(listing);
      return tokens.every((token) => hay.includes(token));
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function communityOptions(listings: readonly DirectoryListing[]): string[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    for (const label of listing.communities) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}
