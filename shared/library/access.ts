import type { ContentAccessDisplay, LibraryResource } from "./types";

const EMPTY_ACCESS: ContentAccessDisplay = {
  access: "full",
  has_content_access: false,
  user_has_access: true,
  has_preview: false,
  is_exclusive: false,
  show_same: 0,
  show_video_in_preview: false,
  access_group_labels: [],
};

/** Normalize BSI content_access_display (access false → none). */
export function mapAccessDisplay(raw: unknown): ContentAccessDisplay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_ACCESS };
  }
  const d = raw as Record<string, unknown>;
  let access: ContentAccessDisplay["access"] = "full";
  if (d.access === "preview") access = "preview";
  else if (d.access === "none" || d.access === false || d.access === "false") {
    access = "none";
  } else if (d.access === "full") {
    access = "full";
  }

  const labels = Array.isArray(d.access_group_labels)
    ? d.access_group_labels.filter((x): x is string => typeof x === "string")
    : [];

  return {
    access,
    has_content_access: d.has_content_access === true,
    user_has_access: d.user_has_access === true,
    has_preview: d.has_preview === true,
    is_exclusive: d.is_exclusive === true,
    show_same: typeof d.show_same === "number" && Number.isInteger(d.show_same) ? d.show_same : 0,
    show_video_in_preview: d.show_video_in_preview === true,
    access_group_labels: labels,
  };
}

function asAccessDisplay(r: LibraryResource | ContentAccessDisplay): ContentAccessDisplay {
  if (r && typeof r === "object" && "access" in r) {
    const nested = (r as { access: unknown }).access;
    // LibraryResource nests ContentAccessDisplay under `.access`
    if (nested && typeof nested === "object" && !Array.isArray(nested) && "access" in nested) {
      return nested as ContentAccessDisplay;
    }
    if (typeof nested === "string") {
      return r as ContentAccessDisplay;
    }
  }
  return r as ContentAccessDisplay;
}

/** Professional / exclusive visual callout (IA label, not a separate catalog). */
export function isProfessionalTagged(r: LibraryResource | ContentAccessDisplay): boolean {
  const a = asAccessDisplay(r);
  return a.is_exclusive || a.has_content_access || a.access === "preview" || a.access === "none";
}

/** Locked card: no body navigation — modal CTA only. */
export function isLockedCard(r: LibraryResource): boolean {
  return r.access.access === "none";
}

/**
 * Public BSI page HTML for legacy membership shortcodes
 * (`bsi-society-member`, `med-member-only`, `metfix-only`, …).
 * The resource search API still reports `access: "full"` for these pages.
 */
export function htmlShowsMembershipGate(html: string): boolean {
  const hay = html.toLowerCase();
  return (
    hay.includes("exclusive to members") ||
    hay.includes("exclusive to metfix affiliates") ||
    hay.includes("not currently logged into a profile with access")
  );
}

/** Open / free rail: full access and not exclusive. */
export function isFreeOpen(r: LibraryResource): boolean {
  return r.access.access === "full" && !r.access.is_exclusive && !r.access.has_content_access;
}

export function joinCtaHref(): string {
  return "/login?next=/library";
}
