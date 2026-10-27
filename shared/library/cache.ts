/** Cache API keys — anonymous public; gated responses must be user-salted. */
/** v2: ResourceVideo shape + filter description/image (CQ-4.2 / TX1). */

const ANON = "anon";
const VER = "v2";

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
