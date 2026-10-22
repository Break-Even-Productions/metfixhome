import {
  isLocalAuthEnabled,
  LOCAL_AUTH_HOSTS,
  type LocalAuthEnv,
} from "../dev-auth";

/** AUTH-HOST: auth and write routes only on exact Host metfix.org (AU25.1). */
export const AUTH_HOST = "metfix.org";

/**
 * Production: only metfix.org.
 * Local: when env.LOCAL_AUTH is set, also localhost / 127.0.0.1 (never other hosts).
 */
export function isAuthHost(request: Request, env?: LocalAuthEnv): boolean {
  const host = request.headers.get("Host") ?? new URL(request.url).host;
  // Strip port if present for local tests that use metfix.org:443 etc.
  const bare = host.split(":")[0] ?? host;
  if (bare === AUTH_HOST) return true;
  if (isLocalAuthEnabled(env) && (LOCAL_AUTH_HOSTS as readonly string[]).includes(bare)) {
    return true;
  }
  return false;
}
