/** AUTH-HOST UI (AU25.2 / D-3): sign-in, signup, composer only on exact metfix.org. */
export function isAuthUiHost(hostname: string = defaultHostname()): boolean {
  return hostname === "metfix.org";
}

function defaultHostname(): string {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.hostname;
}
