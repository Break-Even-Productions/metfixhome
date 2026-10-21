/**
 * Local-only auth/upstream escapes. Gated by LOCAL_AUTH in `.dev.vars`.
 * Must never be set in production wrangler vars/secrets (see build.config.test).
 */

export type LocalAuthEnv = {
  /** "1" / "true" enables localhost auth Host + optional BSI_ORIGIN override. */
  LOCAL_AUTH?: string;
  /**
   * Optional upstream origin when LOCAL_AUTH is on (e.g. http://127.0.0.1:8080).
   * When unset, production https://brokenscience.org is used (preference: local → prod BSI).
   */
  BSI_ORIGIN?: string;
};

export function isLocalAuthEnabled(env: LocalAuthEnv | undefined): boolean {
  const v = (env?.LOCAL_AUTH ?? "").toLowerCase();
  return v === "1" || v === "true";
}

/** Extra Host values accepted only when LOCAL_AUTH is enabled. */
export const LOCAL_AUTH_HOSTS = ["localhost", "127.0.0.1"] as const;

export function parseLocalBsiOrigin(env: LocalAuthEnv | undefined): string | null {
  if (!isLocalAuthEnabled(env) || !env?.BSI_ORIGIN) return null;
  try {
    const u = new URL(env.BSI_ORIGIN);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}
