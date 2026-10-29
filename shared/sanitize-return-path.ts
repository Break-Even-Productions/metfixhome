/**
 * Shared same-origin relative return-path sanitizer (open-redirect closed).
 * Returns null when invalid — callers choose a default (`/`, `/account`, 400).
 */
export function sanitizeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > 512) return null;
  if (!/^\/(?!\/)[A-Za-z0-9/_\-#?=&.]*$/.test(raw)) return null;
  return raw;
}
