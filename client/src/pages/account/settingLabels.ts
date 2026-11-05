const KNOWN_LABELS: Record<string, string> = {
  email_digest: "Email digest",
  product_updates: "Product updates",
  newsletter: "Newsletter",
  directory_visible: "Show in directory",
  profile_public: "Public profile",
  community_opt_in: "Community opt-in",
  address: "Address",
  video: "Video",
};

/**
 * Human label for a settings key or attribute name.
 * Numeric ids and email fields return null so the UI never asks for them.
 */
export function humanSettingLabel(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return null;
  const slug = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  const known = KNOWN_LABELS[slug];
  if (known) return known;
  const words = trimmed
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!words) return null;
  return words.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
