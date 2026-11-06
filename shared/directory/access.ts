import { normalizeFoundationsCoachStatus } from "../account/foundations-coach";

/** BSI may send badge strings (`none` / `owner` / `approved`) or booleans. */
function badgePresent(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s !== "" && s !== "none" && s !== "false" && s !== "0";
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

/**
 * Coach map is for signed-in certified coaches and affiliate staff.
 * Uses fields already on the account overview — not a new capability.
 */
export function mayViewCoachDirectory(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const overview = raw as Record<string, unknown>;
  const badges =
    overview.badges && typeof overview.badges === "object" && !Array.isArray(overview.badges)
      ? (overview.badges as Record<string, unknown>)
      : {};
  if (badgePresent(badges.affiliate)) return true;
  return normalizeFoundationsCoachStatus(overview.foundations_coach).active;
}
