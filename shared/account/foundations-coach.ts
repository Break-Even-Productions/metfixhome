export type FoundationsCoachGrantReason =
  | "in_person_seminar"
  | "metfix_essentials_certificate"
  | null;

export type FoundationsCoachStatus = {
  active: boolean;
  grant_reason: FoundationsCoachGrantReason;
  granted_at: string | null;
  expires_at: string | null;
  seminar_checked_in: boolean;
  metfix_essentials_completed: boolean;
  metfix_essentials_certificate_claimed: boolean;
};

export function computeThreeYearExpiryIso(grantedAtIso: string): string | null {
  const parsed = Date.parse(grantedAtIso);
  if (!Number.isFinite(parsed)) return null;
  const d = new Date(parsed);
  d.setUTCFullYear(d.getUTCFullYear() + 3);
  return d.toISOString();
}

export function normalizeFoundationsCoachStatus(
  raw: unknown,
  nowMs: number = Date.now(),
): FoundationsCoachStatus {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const seminar_checked_in = obj.seminar_checked_in === true;
  const metfix_essentials_completed = obj.metfix_essentials_completed === true;
  const metfix_essentials_certificate_claimed =
    obj.metfix_essentials_certificate_claimed === true;

  // Path A: In-person seminar check-in OR Path B: Online MetFix Essentials completed + certificate claimed
  const grant_reason: FoundationsCoachGrantReason = seminar_checked_in
    ? "in_person_seminar"
    : metfix_essentials_completed && metfix_essentials_certificate_claimed
      ? "metfix_essentials_certificate"
      : null;

  if (!grant_reason) {
    return {
      active: false,
      grant_reason: null,
      granted_at: null,
      expires_at: null,
      seminar_checked_in,
      metfix_essentials_completed,
      metfix_essentials_certificate_claimed,
    };
  }

  const granted_at =
    typeof obj.granted_at === "string" && Number.isFinite(Date.parse(obj.granted_at))
      ? obj.granted_at
      : null;
  const expires_at =
    typeof obj.expires_at === "string" && Number.isFinite(Date.parse(obj.expires_at))
      ? obj.expires_at
      : granted_at
        ? computeThreeYearExpiryIso(granted_at)
        : null;

  const isExpired = expires_at !== null && Date.parse(expires_at) <= nowMs;

  return {
    active: !isExpired,
    grant_reason,
    granted_at,
    expires_at,
    seminar_checked_in,
    metfix_essentials_completed,
    metfix_essentials_certificate_claimed,
  };
}
