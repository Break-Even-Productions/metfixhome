/**
 * Shared CSRF + reCAPTCHA helpers (CQ N1 / CQ r2 NB2).
 * CSRF cache is session-generation-tied; cleared on auth change (sign-in/out/new sid).
 * No Rule-4 test-token fallback — missing grecaptcha returns "".
 */

type CsrfEntry = { token: string; sessionKey: string };

let csrfCache: CsrfEntry | null = null;
/** Bumped on sign-in/out/new sid so a cached token cannot outlive the session. */
let csrfSessionGeneration = 0;

/** Current CSRF session binding key (opaque; not a cookie read). */
export function csrfSessionKey(_cookieHeader?: string): string {
  void _cookieHeader;
  return `g${csrfSessionGeneration}`;
}

/** Call on sign-in/out or whenever the sid changes (NB2). */
export function noteCsrfSessionChange(): void {
  csrfSessionGeneration += 1;
  csrfCache = null;
}

export function clearCsrfCache(): void {
  noteCsrfSessionChange();
}

export async function fetchCsrf(opts?: {
  force?: boolean;
  /** Injectable fetch (JoinModal authHttp / CommentThread); defaults to global fetch. */
  http?: typeof fetch;
}): Promise<string | null> {
  const sessionKey = csrfSessionKey();
  if (!opts?.force && csrfCache && csrfCache.sessionKey === sessionKey) {
    return csrfCache.token;
  }
  const http = opts?.http ?? fetch;
  try {
    const res = await http("/api/auth/csrf", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { csrf?: unknown };
    const token = typeof json.csrf === "string" && json.csrf ? json.csrf : null;
    if (token) csrfCache = { token, sessionKey };
    else csrfCache = null;
    return token;
  } catch {
    return null;
  }
}

/**
 * POST JSON with CSRF; on 403 retry once with a forced fresh token (NB2).
 */
export async function postJsonWithCsrf(
  path: string,
  body: unknown,
  init?: Omit<RequestInit, "body" | "method">,
): Promise<Response> {
  const attempt = async (force: boolean) => {
    const csrf = await fetchCsrf({ force });
    if (!csrf) {
      return new Response(JSON.stringify({ error: "csrf_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRF-Token", csrf);
    return fetch(path, {
      ...init,
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(body),
    });
  };

  let res = await attempt(false);
  if (res.status === 403) {
    clearCsrfCache();
    res = await attempt(true);
  }
  return res;
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
