/**
 * Local-only auth/upstream escapes. Gated by LOCAL_AUTH in `.dev.vars`.
 * Must never be set in production wrangler vars/secrets (see build.config.test).
 */

export type LocalAuthEnv = {
  /** "1" / "true" enables localhost auth Host + optional BSI_ORIGIN override. */
  LOCAL_AUTH?: string;
  /**
   * Optional upstream origin when LOCAL_AUTH is on (e.g. http://127.0.0.1:8080).
   * When unset, production https://api.brokenscience.org is used (preference: local → API host).
   */
  BSI_ORIGIN?: string;
};

export function isLocalAuthEnabled(env: LocalAuthEnv | undefined): boolean {
  const v = (env?.LOCAL_AUTH ?? "").toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Prod reCAPTCHA keys return siteverify `browser-error` on localhost.
 * When LOCAL_AUTH is on (`.dev.vars` only), skip Google siteverify so password
 * login / signup / comments work locally. Never enabled in production wrangler.
 */
export function bypassRecaptchaSiteverify(env: LocalAuthEnv | undefined): boolean {
  return isLocalAuthEnabled(env);
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

/** Production Google OAuth redirect. Unchanged when LOCAL_AUTH is off. */
export const PROD_GOOGLE_REDIRECT_URI = "https://metfix.org/api/auth/google/callback";

const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  return first.length > 0 ? first : null;
}

/**
 * Origin for a localhost / 127.0.0.1 host header.
 * Rejects userinfo, paths, and any other hostname.
 */
function localOriginFromHost(protoRaw: string, hostRaw: string): string | null {
  const proto = protoRaw.toLowerCase().replace(/:$/, "");
  if (proto !== "http" && proto !== "https") return null;
  let parsed: URL;
  try {
    parsed = new URL(`${proto}://${hostRaw}`);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
  const hostname = parsed.hostname.toLowerCase();
  if (!(LOCAL_AUTH_HOSTS as readonly string[]).includes(hostname)) return null;
  return parsed.origin;
}

function localOriginFromRequest(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return localOriginFromHost(url.protocol, url.host);
  } catch {
    return null;
  }
}

/**
 * Google redirect_uri.
 * Production and preview always use metfix.org.
 * LOCAL_AUTH uses the browser origin so the __Host- cookie and the code
 * return to the same host. Vite's /api proxy sets X-Forwarded-Host to that
 * browser host (the worker itself sees localhost:8787). A forwarded host that
 * is not localhost or 127.0.0.1 is ignored.
 */
export function googleRedirectUri(request: Request, env: LocalAuthEnv | undefined): string {
  if (!isLocalAuthEnabled(env)) return PROD_GOOGLE_REDIRECT_URI;
  const forwardedHost = firstHeaderValue(request.headers.get("X-Forwarded-Host"));
  const forwardedProto = firstHeaderValue(request.headers.get("X-Forwarded-Proto"));
  if (forwardedHost && forwardedProto) {
    const forwarded = localOriginFromHost(forwardedProto, forwardedHost);
    if (forwarded) return `${forwarded}${GOOGLE_CALLBACK_PATH}`;
  }
  const fromRequest = localOriginFromRequest(request);
  if (fromRequest) return `${fromRequest}${GOOGLE_CALLBACK_PATH}`;
  return PROD_GOOGLE_REDIRECT_URI;
}
