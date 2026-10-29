/**
 * Shared CSRF + reCAPTCHA helpers for Login / JoinFlow (CQ N1).
 * No Rule-4 test-token fallback — missing grecaptcha returns "".
 */

let csrfCache: string | null = null;

export async function fetchCsrf(opts?: { force?: boolean }): Promise<string | null> {
  if (!opts?.force && csrfCache) return csrfCache;
  try {
    const res = await fetch("/api/auth/csrf", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { csrf?: unknown };
    const token = typeof json.csrf === "string" && json.csrf ? json.csrf : null;
    csrfCache = token;
    return token;
  } catch {
    return null;
  }
}

export function clearCsrfCache(): void {
  csrfCache = null;
}

/** Returns "" when the site key / grecaptcha is unavailable (Worker rejects empty). */
export async function getRecaptchaToken(action: string): Promise<string> {
  const g = (
    window as unknown as {
      grecaptcha?: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, opts: { action: string }) => Promise<string>;
      };
    }
  ).grecaptcha;
  const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })
    .__MFX_RECAPTCHA_SITE_KEY__;
  if (!g || !siteKey) return "";
  await new Promise<void>((resolve) => g.ready(() => resolve()));
  return g.execute(siteKey, { action });
}
