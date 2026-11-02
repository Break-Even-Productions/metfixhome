/** AUTH-HOST UI (AU25.2 / D-3): sign-in, signup, composer on exact metfix.org. */

type StagingHostsWindow = {
  __MFX_STAGING_AUTH_HOSTS__?: unknown;
};

/**
 * Exact hostnames injected by `/api/recaptcha-site-key.js` from Worker
 * `STAGING_AUTH_HOSTS` (preview-only). Empty on production (C5: no preview
 * host literals in client source).
 */
function stagingAuthHostsFromWindow(): string[] {
  if (typeof window === "undefined") return [];
  const raw = (window as unknown as StagingHostsWindow).__MFX_STAGING_AUTH_HOSTS__;
  if (!Array.isArray(raw)) return [];
  return raw.filter((h): h is string => typeof h === "string" && h.length > 0);
}

export function isAuthUiHost(hostname: string = defaultHostname()): boolean {
  if (hostname === "metfix.org") return true;
  // Local Vite/wrangler only — never matches a public preview or production host.
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return import.meta.env.DEV === true || import.meta.env.VITE_LOCAL_AUTH === "1";
  }
  const bare = hostname.toLowerCase();
  return stagingAuthHostsFromWindow().includes(bare);
}

function defaultHostname(): string {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.hostname;
}
