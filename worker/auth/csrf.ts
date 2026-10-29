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
import { isAuthHost, isStagingAuthHost, normalizeHost } from "./host";

const PRE_MAX_AGE = 1800;
const ORIGIN = "https://metfix.org";

/**
 * Production Origin only; with STAGING_AUTH_HOSTS, exact https://{host};
 * with LOCAL_AUTH, also http(s)://localhost|127.0.0.1.
 * Hostnames go through normalizeHost (case, trailing dots, port stripped).
 */
export function isAllowedAuthOrigin(origin: string | null, env: Env): boolean {
  if (origin === ORIGIN) return true;
  if (origin) {
    try {
      const u = new URL(origin);
      const bare = normalizeHost(u.hostname);
      // Preview hosts: https only; default port ("" or 443) — same bare-host idea as Host.
      if (
        u.protocol === "https:" &&
        (u.port === "" || u.port === "443") &&
        isStagingAuthHost(bare, env)
      ) {
        return true;
      }
    } catch {
      /* fall through */
    }
  }
  if (!isLocalAuthEnabled(env) || !origin) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const bare = normalizeHost(u.hostname);
    return bare === "localhost" || bare === "127.0.0.1";
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
