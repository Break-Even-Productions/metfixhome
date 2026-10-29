/** Single return-path allowlist (relative path only). CQ-CR-E6 / CR N3. */
export function sanitizeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  if (!/^\/(?!\/)[A-Za-z0-9/_\-#?=&.]*$/.test(raw)) return null;
  return raw;
}
