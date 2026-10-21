/** Cookie helpers for __Host-mfx_sid and __Host-mfx_pre. */

export const SID_COOKIE = "__Host-mfx_sid";
export const PRE_COOKIE = "__Host-mfx_pre";

const COOKIE_BASE = "Path=/; Secure; HttpOnly; SameSite=Lax";

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** Count occurrences of a cookie name (P4.2 duplicate sid). */
export function countCookie(header: string | null, name: string): number {
  if (!header) return 0;
  let n = 0;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    const k = (i < 0 ? part : part.slice(0, i)).trim();
    if (k === name) n++;
  }
  return n;
}

export function getSid(request: Request): string | null {
  return parseCookies(request.headers.get("Cookie"))[SID_COOKIE] ?? null;
}

export function getPre(request: Request): string | null {
  return parseCookies(request.headers.get("Cookie"))[PRE_COOKIE] ?? null;
}

export function setHostCookie(name: string, value: string, maxAgeSec: number): string {
  return `${name}=${encodeURIComponent(value)}; ${COOKIE_BASE}; Max-Age=${maxAgeSec}`;
}

export function clearHostCookie(name: string): string {
  return `${name}=; ${COOKIE_BASE}; Max-Age=0`;
}

export function sidCookieSet(sid: string, maxAgeSec = 30 * 24 * 60 * 60): string {
  return setHostCookie(SID_COOKIE, sid, maxAgeSec);
}

export function sidCookieClear(): string {
  return clearHostCookie(SID_COOKIE);
}

export function preCookieSet(pre: string, maxAgeSec = 600): string {
  return setHostCookie(PRE_COOKIE, pre, maxAgeSec);
}

export function preCookieClear(): string {
  return clearHostCookie(PRE_COOKIE);
}
