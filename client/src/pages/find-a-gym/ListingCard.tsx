import type { DirectoryListing } from "@shared/directory/types";
import { directionsHref } from "./directions";
import { profileCtaLabel, profileHref, websiteHref } from "./listing-links";

const KIND_LABEL = {
  gym: "Gym",
  coach: "Coach",
  doctor: "Doctor",
} as const;

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "M").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

type ListingCardProps = {
  listing: DirectoryListing;
  selected: boolean;
  activeCommunities: readonly string[];
  onSelect: (id: string) => void;
};

export function ListingCard({ listing, selected, activeCommunities, onSelect }: ListingCardProps) {
  const profile = profileHref(listing);
  const website = websiteHref(listing);
  const active = new Set(activeCommunities);
  const place = [listing.city, listing.state].filter(Boolean).join(", ");
  const directions = directionsHref(listing);

  return (
    <article
      id={`listing-${listing.id}`}
      className={`gym-card ${selected ? "is-selected" : ""}`}
    >
      <button type="button" onClick={() => onSelect(listing.id)} className="gym-card__main">
        {listing.image ? (
          <img src={listing.image} alt="" className="gym-card__logo" />
        ) : (
          <span className="gym-card__logo gym-card__logo--fallback" aria-hidden="true">
            {initials(listing.name)}
          </span>
        )}
        <span className="gym-card__meta">
          <span className="gym-card__kind">{KIND_LABEL[listing.kind]}</span>
          <span className="gym-card__name">{listing.name}</span>
          <span className="gym-card__title">{listing.title}</span>
          {place ? <span className="gym-card__place">{place}</span> : null}
        </span>
      </button>
      {listing.address ? (
        <div className="gym-card__address">
          <p>{listing.address}</p>
          <a href={directions} target="_blank" rel="noopener noreferrer">
            Get directions
          </a>
        </div>
      ) : (
        <div className="gym-card__address">
          <a href={directions} target="_blank" rel="noopener noreferrer">
            Get directions
          </a>
        </div>
      )}
      {listing.communities.length > 0 ? (
        <>
          <p className="gym-card__works-label">Works with</p>
          <ul className="gym-card__tags">
            {listing.communities.map((label) => (
              <li key={label}>
                <span className={active.has(label) ? "is-active" : undefined}>{label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {profile || website ? (
        <div className="gym-card__cta">
          {profile ? (
            <a href={profile} target="_blank" rel="noopener noreferrer">
              {profileCtaLabel(listing)}
            </a>
          ) : null}
          {website ? (
            <a href={website} target="_blank" rel="noopener noreferrer">
              Visit website
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
