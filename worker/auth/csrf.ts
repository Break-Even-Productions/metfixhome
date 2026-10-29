import type { Env } from "../upstream";
import {
  csrfForPre,
  csrfForSid,
  randomId32,
  timingSafeEqualStr,
} from "./crypto";
import {
  PRE_COOKIE,
  clearHostCookie,
  getPre,
  getSid,
  setHostCookie,
} from "./cookies";
import {
  BODY_FORBIDDEN,
  BODY_NOT_FOUND,
  authJson,
  methodNotAllowed,
} from "./responses";
import { isLocalAuthEnabled } from "../dev-auth";
import {
  AUTH_HOST,
  isAuthHost,
  isStagingAuthHost,
  normalizeHostname,
} from "./host";

const PRE_MAX_AGE = 1800;

function isDefaultOriginPort(protocol: string, port: string): boolean {
  if (port === "") return true;
  if (protocol === "https:" && port === "443") return true;
  if (protocol === "http:" && port === "80") return true;
  return false;
}

/**
 * Production: https://metfix.org (case / one trailing-dot on hostname OK).
 * Staging: exact https://{STAGING_AUTH_HOSTS} (same trailing-dot / :443 rules).
 * LOCAL_AUTH: also http(s)://localhost|127.0.0.1 (any port).
 * Hostname is normalized once.
 */
export function isAllowedAuthOrigin(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Normalize once (trailing-dot + case) for metfix.org and preview alike.
    const bare = normalizeHostname(u.hostname);
    if (!bare) return false;

    if (
      u.protocol === "https:" &&
      isDefaultOriginPort(u.protocol, u.port) &&
      (bare === AUTH_HOST || isStagingAuthHost(bare, env))
    ) {
      return true;
    }

    if (isLocalAuthEnabled(env)) {
      return bare === "localhost" || bare === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
}

export async function handleCsrf(request: Request, env: Env): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
  const method = request.method.toUpperCase();
  if (method === "HEAD") return methodNotAllowed("GET");
  if (method !== "GET") return methodNotAllowed("GET");

  if (!env.CSRF_SECRET) {
    return authJson({ error: "unavailable" }, 503, { "Retry-After": "300" });
  }

  const cookies: string[] = [];
  let pre = getPre(request);
  if (!pre) {
    pre = randomId32();
    cookies.push(setHostCookie(PRE_COOKIE, pre, PRE_MAX_AGE));
  }
  const csrf = await csrfForPre(env.CSRF_SECRET, pre);
  return authJson({ csrf }, 200, {}, cookies);
}

export type CsrfCheck =
  | { ok: true; sid: string | null; pre: string | null }
  | { ok: false; response: Response };

/**
 * P2: Origin exact, Sec-Fetch-Site same-origin when present, X-CSRF-Token match.
 * Signed-in → HMAC(sid); signed-out → HMAC(pre).
 */
export async function requireCsrf(request: Request, env: Env): Promise<CsrfCheck> {
  if (!env.CSRF_SECRET) {
    return {
      ok: false,
      response: authJson({ error: "unavailable" }, 503, { "Retry-After": "300" }),
    };
  }
  const origin = request.headers.get("Origin");
  if (!isAllowedAuthOrigin(origin, env)) {
    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  }
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs != null && sfs !== "same-origin") {
    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  }
  const token = request.headers.get("X-CSRF-Token");
  if (!token) {
    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  }
  const sid = getSid(request);
  const pre = getPre(request);
  let expected: string;
  if (sid) {
    expected = await csrfForSid(env.CSRF_SECRET, sid);
  } else if (pre) {
    expected = await csrfForPre(env.CSRF_SECRET, pre);
  } else {
    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  }
  if (!timingSafeEqualStr(token, expected)) {
    return { ok: false, response: authJson(BODY_FORBIDDEN, 403) };
  }
  return { ok: true, sid, pre };
}

export function clearPreCookie(): string {
  return clearHostCookie(PRE_COOKIE);
}
