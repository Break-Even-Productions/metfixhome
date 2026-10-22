/**
 * B4-W public-name helper shared by comments (W7), leaderboards (L5) and `/me`.
 * Uses the passed `display_name`. Blank / "Unknown" / email-like → `Member`.
 * `[Anonymous]` is kept for deleted==2 comments when `allowAnonymous` is set.
 */

const EMAIL_LIKE = /@/;

export function isEmailLike(value: string): boolean {
  return EMAIL_LIKE.test(value);
}

function isMemberFallback(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  if (t.toLowerCase() === "unknown") return true;
  if (isEmailLike(t)) return true;
  return false;
}

/**
 * Resolve a public display name for comments / leaderboards /me.
 * - Use `display_name` when it is a usable public name.
 * - `[Anonymous]` kept only when `allowAnonymous` (comments deleted==2).
 * - Blank / Unknown / email-like → `Member`.
 */
export function publicDisplayName(
  row: { display_name?: unknown } | null | undefined,
  opts?: { allowAnonymous?: boolean },
): string {
  const allowAnonymous = opts?.allowAnonymous === true;
  const raw = row && typeof row.display_name === "string" ? row.display_name : "";
  const trimmed = raw.trim();
  if (allowAnonymous && trimmed === "[Anonymous]") return "[Anonymous]";
  if (isMemberFallback(trimmed)) return "Member";
  return trimmed;
}
