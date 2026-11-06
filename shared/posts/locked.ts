import { mapAccessDisplay } from "../library/access";

/**
 * Structural access gate for list + detail mapping.
 * Requires `access_levels` (any array) and a plain `content_access_display` object.
 * Exclusive / preview / gated posts are allowed — tags come from `postListAccessFlags`.
 */
export function hasMappablePostAccess(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const item = raw as Record<string, unknown>;

  if (!Array.isArray(item.access_levels)) return false;

  const display = item.content_access_display;
  if (!display || typeof display !== "object" || Array.isArray(display)) return false;

  return true;
}

/**
 * List-card flags derived from BSI access fields.
 * Exclusive covers membership gates, exclusive flags, and preview/none access.
 */
export function postListAccessFlags(raw: unknown): {
  exclusive: boolean;
  preview_available: boolean;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { exclusive: false, preview_available: false };
  }
  const item = raw as Record<string, unknown>;
  const access = mapAccessDisplay(item.content_access_display);
  const levels = Array.isArray(item.access_levels) ? item.access_levels : [];
  const exclusive =
    access.is_exclusive ||
    access.has_content_access ||
    access.access === "preview" ||
    access.access === "none" ||
    levels.length > 0;
  return {
    exclusive,
    preview_available: access.has_preview,
  };
}

/**
 * Fully public / free post (no exclusive tag). Kept for callers that need the
 * historical D8 "unlocked" meaning — list/detail mapping no longer drops exclusives.
 *
 * Keep only when ALL hold:
 * - `access_levels` is an empty array
 * - `content_access_display` is a non-null plain object (MISSING → locked)
 * - `content_access_display.access === "full"`
 * - `content_access_display.is_exclusive === false`
 * - `content_access_display.has_content_access === false`
 */
export function isUnlockedPost(raw: unknown): boolean {
  if (!hasMappablePostAccess(raw)) return false;
  const item = raw as Record<string, unknown>;

  if (item.access_levels.length !== 0) return false;

  const cad = item.content_access_display as Record<string, unknown>;
  if (cad.access !== "full") return false;
  if (cad.is_exclusive !== false) return false;
  if (cad.has_content_access !== false) return false;

  return true;
}
