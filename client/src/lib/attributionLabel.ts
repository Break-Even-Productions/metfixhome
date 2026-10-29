/**
 * N7: human-readable attribution source labels for checkout UI.
 * Wire values stay unchanged on the API; only display is remapped.
 */
export type AttributionSourceWire =
  | "primary_org"
  | "explicit_slug"
  | "bsi_ref_cookie"
  | "none";

const LABELS: Record<AttributionSourceWire, string> = {
  primary_org: "Your primary organization",
  explicit_slug: "Referral link you entered",
  bsi_ref_cookie: "Saved referral from this browser",
  none: "No referral attribution",
};

export function friendlyAttributionLabel(source: string): string {
  if (source in LABELS) return LABELS[source as AttributionSourceWire];
  return source;
}
