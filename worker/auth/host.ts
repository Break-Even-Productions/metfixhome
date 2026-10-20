/** AUTH-HOST: auth and write routes only on exact Host metfix.org (AU25.1). */
export const AUTH_HOST = "metfix.org";

export function isAuthHost(request: Request): boolean {
  const host = request.headers.get("Host") ?? new URL(request.url).host;
  // Strip port if present for local tests that use metfix.org:443 etc.
  const bare = host.split(":")[0] ?? host;
  return bare === AUTH_HOST;
}
