/** Fixed auth response helpers. Never log tokens/passwords. */

export const AUTH_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function authJson(
  body: unknown,
  status: number,
  extra: HeadersInit = {},
  setCookies: string[] = [],
): Response {
  const headers = new Headers({ ...AUTH_HEADERS, ...extra });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status, headers });
}

export function authEmpty(
  status: number,
  extra: HeadersInit = {},
  setCookies: string[] = [],
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status, headers });
}

export function methodNotAllowed(allow: string): Response {
  return authJson({ error: "method_not_allowed" }, 405, { Allow: allow });
}

export const BODY_INVALID_REQUEST = Object.freeze({ error: "invalid_request" });
export const BODY_INVALID_LOGIN = Object.freeze({ error: "invalid_login" });
export const BODY_TRY_AGAIN = Object.freeze({ error: "try_again" });
export const BODY_RATE_LIMITED = Object.freeze({ error: "rate_limited" });
export const BODY_UNAVAILABLE = Object.freeze({ error: "unavailable" });
export const BODY_SIGNED_OUT = Object.freeze({ error: "signed_out" });
export const BODY_FORBIDDEN = Object.freeze({ error: "forbidden" });
export const BODY_NOT_FOUND = Object.freeze({ error: "not_found" });
