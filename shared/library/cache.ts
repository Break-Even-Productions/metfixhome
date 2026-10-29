/** Cache API keys — anonymous public; gated responses must be user-salted. */
/** v3: course purchase locks + member-gated page flags on listing payloads. */

const ANON = "anon";
const VER = "v3";

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
