/**
 * B4-W / S-G9 public-name helper shared by comments (W7), leaderboards (L5) and `/me`.
 * Fail closed until D-NAME: without `public_name_safe`, every display_name → Member
 * (except the deliberate `[Anonymous]` marker for deleted==2 comments).
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
 * - Prefer BSI safe field `public_name_safe` when present (positive control until D-NAME).
 * - `[Anonymous]` kept only when `allowAnonymous` (comments deleted==2).
 * - Otherwise fail closed to `Member` when only `display_name` is available.
 */
export function publicDisplayName(
  row: { display_name?: unknown; public_name_safe?: unknown } | null | undefined,
  opts?: { allowAnonymous?: boolean },
): string {
  const allowAnonymous = opts?.allowAnonymous === true;
  if (row && typeof row.public_name_safe === "string") {
    const safe = row.public_name_safe.trim();
    if (!safe || isMemberFallback(safe)) return "Member";
    return safe;
  }
  const raw = row && typeof row.display_name === "string" ? row.display_name : "";
  if (allowAnonymous && raw.trim() === "[Anonymous]") return "[Anonymous]";
  // Fail closed: display_name alone is never trusted (B4W.1 / S-G9).
  return "Member";
}
