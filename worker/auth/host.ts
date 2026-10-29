import {
  isLocalAuthEnabled,
  LOCAL_AUTH_HOSTS,
  type LocalAuthEnv,
} from "../dev-auth";

/** AUTH-HOST: auth and write routes only on exact Host metfix.org (AU25.1). */
export const AUTH_HOST = "metfix.org";

export type AuthHostEnv = LocalAuthEnv & {
  /**
   * Comma-separated exact hostnames allowed for auth on Worker Previews / staging.
   * Set only in wrangler `previews` (never top-level / production vars).
   * Exact match only — no suffix or wildcard on workers.dev.
   */
  STAGING_AUTH_HOSTS?: string;
};

/**
 * Parse STAGING_AUTH_HOSTS into exact bare hostnames (lowercase, trimmed).
 * Drops empty parts and any token that looks like a wildcard, URL, or port.
 */
export function parseStagingAuthHosts(env?: AuthHostEnv): string[] {
  const raw = env?.STAGING_AUTH_HOSTS;
  if (typeof raw !== "string" || raw.length === 0) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const h = part.trim().toLowerCase();
    if (!h) continue;
    if (h.includes("*") || h.includes("/") || h.includes(":")) continue;
    out.push(h);
  }
  return out;
}

/** Exact hostname match against STAGING_AUTH_HOSTS (no suffix / wildcard). */
export function isStagingAuthHost(bareHost: string, env?: AuthHostEnv): boolean {
  const bare = bareHost.toLowerCase();
  return parseStagingAuthHosts(env).includes(bare);
}

/**
 * Production: only metfix.org.
 * Staging preview: exact hosts listed in STAGING_AUTH_HOSTS (env-driven).
 * Local: when env.LOCAL_AUTH is set, also localhost / 127.0.0.1 (never other hosts).
 */
export function isAuthHost(request: Request, env?: AuthHostEnv): boolean {
  const host = request.headers.get("Host") ?? new URL(request.url).host;
  // Strip port if present for local tests that use metfix.org:443 etc.
  const bare = (host.split(":")[0] ?? host).toLowerCase();
  if (bare === AUTH_HOST) return true;
  if (isStagingAuthHost(bare, env)) return true;
  if (isLocalAuthEnabled(env) && (LOCAL_AUTH_HOSTS as readonly string[]).includes(bare)) {
    return true;
  }
  return false;
}

/**
 * siteverify hostname: metfix.org, or an exact STAGING_AUTH_HOSTS entry when set.
 * Production (no STAGING_AUTH_HOSTS) stays metfix.org-only.
 */
export function isAllowedRecaptchaHostname(
  hostname: unknown,
  env?: AuthHostEnv,
): boolean {
  if (typeof hostname !== "string") return false;
  const bare = hostname.toLowerCase();
  if (bare === AUTH_HOST) return true;
  return isStagingAuthHost(bare, env);
}
