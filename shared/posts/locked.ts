/**
 * D8 fail-closed unlock predicate (A9 / CQ B5 / PW30).
 *
 * Keep only when ALL hold:
 * - `access_levels` is an empty array
 * - `content_access_display` is a non-null plain object (MISSING → locked)
 * - `content_access_display.access === "full"`
 * - `content_access_display.is_exclusive === false`
 * - `content_access_display.has_content_access === false`
 *
 * Extra keys on `content_access_display` (e.g. `access_group_labels`, `show_same`,
 * `has_preview`) are ignored — an expired exclusive reported unlocked is kept (OQ-P2).
 * Never treat a missing field as unlocked (PM22).
 */
export function isUnlockedPost(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const item = raw as Record<string, unknown>;

  if (!Array.isArray(item.access_levels)) return false;
  if (item.access_levels.length !== 0) return false;

  const display = item.content_access_display;
  // MISSING / null / array / string / non-object → locked
  if (!display || typeof display !== "object" || Array.isArray(display)) return false;

  const cad = display as Record<string, unknown>;
  if (cad.access !== "full") return false;
  if (cad.is_exclusive !== false) return false;
  if (cad.has_content_access !== false) return false;

  return true;
}
