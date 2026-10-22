/** AUTH-HOST UI (AU25.2 / D-3): sign-in, signup, composer on exact metfix.org. */
export function isAuthUiHost(hostname: string = defaultHostname()): boolean {
  if (hostname === "metfix.org") return true;
  // Local Vite/wrangler only — never matches a public preview or production host.
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return import.meta.env.DEV === true || import.meta.env.VITE_LOCAL_AUTH === "1";
  }
  return false;
}

function defaultHostname(): string {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.hostname;
}
