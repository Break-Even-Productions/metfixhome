/** Cache API keys — anonymous public; gated responses must be user-salted. */

const ANON = "anon";

export function librarySearchCacheKey(
  queryString: string,
  userSalt: string | null,
): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  const q = queryString.startsWith("?") ? queryString : `?${queryString}`;
  return new Request(`https://library-cache.metfix.internal/search/${salt}${q}`, {
    method: "GET",
  });
}

export function libraryPopularCacheKey(
  queryString: string,
  userSalt: string | null,
): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  const q = queryString.startsWith("?") ? queryString : `?${queryString}`;
  return new Request(`https://library-cache.metfix.internal/popular/${salt}${q}`, {
    method: "GET",
  });
}

export function libraryFiltersCacheKey(userSalt: string | null): Request {
  const salt = userSalt && userSalt.length > 0 ? userSalt : ANON;
  return new Request(`https://library-cache.metfix.internal/filters/${salt}`, {
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
    `https://library-cache.metfix.internal/item/${salt}/${type}/${id}`,
    { method: "GET" },
  );
}
