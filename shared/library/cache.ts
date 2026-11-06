/** Cache API keys — anonymous public; gated responses must be session-salted. */
/** v5: salt is user + session + entitlement, so an anon entry cannot satisfy a member. */

const ANON = "anon";
const VER = "v5";

function cacheToken(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, "");
}

/**
 * Worker Cache API salt for a resolved session.
 * Null (caller uses the anon key) only when there is no session.
 * Session and entitlement are both in the key so a new login cannot reuse an
 * anon entry, and a logout cannot reuse the previous member entry.
 */
export function libraryViewerCacheSalt(
  input: { userId: string; sessionId: string; entitlement: string } | null,
): string | null {
  if (!input) return null;
  const sessionId = cacheToken(input.sessionId.trim());
  const entitlement = cacheToken(input.entitlement.trim());
  if (!sessionId || !entitlement) return null;
  const userId = cacheToken(input.userId.trim());
  const user = userId && userId !== "0" ? `u${userId}` : "nouid";
  return `${user}.s${sessionId}.e${entitlement}`;
}

export function librarySearchCacheKey(
  queryString: string,
  userSalt: string | null,
): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  const q = queryString.startsWith("?") ? queryString : `?${queryString}`;
  return new Request(`https://library-cache.metfix.internal/${VER}/search/${salt}${q}`, {
    method: "GET",
  });
}

export function libraryPopularCacheKey(
  queryString: string,
  userSalt: string | null,
): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  const q = queryString.startsWith("?") ? queryString : `?${queryString}`;
  return new Request(`https://library-cache.metfix.internal/${VER}/popular/${salt}${q}`, {
    method: "GET",
  });
}

export function libraryFiltersCacheKey(userSalt: string | null): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  return new Request(`https://library-cache.metfix.internal/${VER}/filters/${salt}`, {
    method: "GET",
  });
}

export function libraryDetailCacheKey(
  type: string,
  id: string,
  userSalt: string | null,
): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  return new Request(
    `https://library-cache.metfix.internal/${VER}/item/${salt}/${type}/${id}`,
    { method: "GET" },
  );
}
