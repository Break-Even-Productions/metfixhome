/** Shared ISO date helpers (CL-ACCESS-1 / LR-2 / 1.2.8 CQ B2 / N15). */

/**
 * Strict ISO-8601 instant → UTC `YYYY-MM-DDTHH:MM:SSZ`, or null.
 * Renamed from `isStrictIsoZ` (1.2.8 N15). No fractional seconds (BSI `gmdate('c')`).
 * Range-checked fields; leap-year day check; offsets capped ±14:00 at the regex
 * (1.2.9 N21: minutes over `14:00` fail at the regex); rejects `-00:00` and `24:00`.
 */
const ISO_INSTANT =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(Z|([+-])(?:(0\d|1[0-3]):([0-5]\d)|14:00))$/;

function daysInMonth(y: number, mo: number): number {
  if (mo === 2) {
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    return leap ? 29 : 28;
  }
  if (mo === 4 || mo === 6 || mo === 9 || mo === 11) return 30;
  return 31;
}

export function parseIsoInstantToUtcZ(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(ISO_INSTANT);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const offsetTok = m[7]!;

  if (d > daysInMonth(y, mo)) return null;

  if (offsetTok !== "Z") {
    const sign = m[8]!;
    // RFC 3339 unknown-local offset; reject `-00:00`. ±14:00 already gated by regex (N21).
    if (sign === "-" && offsetTok === "-00:00") return null;
  }

  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** @deprecated Prefer `parseIsoInstantToUtcZ` (1.2.8 N15). */
export function normalizeIsoToZ(raw: unknown): string | null {
  return parseIsoInstantToUtcZ(raw);
}

export function isStrictIsoZ(raw: unknown): raw is string {
  return parseIsoInstantToUtcZ(raw) != null;
}

export function normalizeClaimedAtIso(raw: unknown): string | null {
  return parseIsoInstantToUtcZ(raw);
}

export function formatUtcDate(iso: string): string {
  const z = parseIsoInstantToUtcZ(iso) ?? iso;
  return new Date(z).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAccessUntilLine(
  accessExpiresAt: string | null,
  nowMs = Date.now(),
): string | null {
  if (accessExpiresAt == null) return null;
  const z = parseIsoInstantToUtcZ(accessExpiresAt);
  if (!z) return null;
  const label = formatUtcDate(z);
  if (nowMs >= Date.parse(z)) return `Access ended ${label}`;
  return `Access until ${label}`;
}
