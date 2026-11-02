import {
  isLibraryDetailBody,
  isLibraryFiltersBody,
  isLibrarySearchBody,
  type LibraryDetailBody,
  type LibraryFiltersBody,
  type LibrarySearchBody,
} from "@shared/library";

export type SearchParams = {
  query?: string;
  content_type_terms?: string[];
  content_types?: string[];
  topics?: number[];
  categories?: number[];
  limit?: number;
  offset?: number;
};

function toQuery(params: SearchParams): string {
  const sp = new URLSearchParams();
  if (params.query) sp.set("query", params.query);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  for (const v of params.content_type_terms ?? []) {
    sp.append("content_type_terms[]", v);
  }
  for (const v of params.content_types ?? []) {
    sp.append("content_types[]", v);
  }
  for (const v of params.topics ?? []) {
    sp.append("topics[]", String(v));
  }
  for (const v of params.categories ?? []) {
    sp.append("categories[]", String(v));
  }
  return sp.toString();
}

export async function fetchLibrarySearch(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchBody> {
  const qs = toQuery(params);
  const res = await fetch(`/api/library/search?${qs}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) throw new Error(`search_${res.status}`);
  const json: unknown = await res.json();
  if (!isLibrarySearchBody(json)) throw new Error("search_shape");
  return json;
}

/** BSI popular-by-views ranking (avada_post_views_count). Paginate with offset. */
export async function fetchLibraryPopular(
  params: { limit?: number; offset?: number; content_types?: string[] } = {},
  signal?: AbortSignal,
): Promise<LibrarySearchBody> {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  for (const v of params.content_types ?? []) {
    sp.append("content_types[]", v);
  }
  const qs = sp.toString();
  const res = await fetch(`/api/library/popular${qs ? `?${qs}` : ""}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) throw new Error(`popular_${res.status}`);
  const json: unknown = await res.json();
  if (!isLibrarySearchBody(json)) throw new Error("popular_shape");
  return json;
}

/** Glassman topic ∪ category, plus Book Library when that content type exists. */
export async function fetchLibraryArchive(
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<LibrarySearchBody> {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  const res = await fetch(`/api/library/archive${qs ? `?${qs}` : ""}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) throw new Error(`archive_${res.status}`);
  const json: unknown = await res.json();
  if (!isLibrarySearchBody(json)) throw new Error("archive_shape");
  return json;
}

export async function fetchLibraryFilters(
  signal?: AbortSignal,
): Promise<LibraryFiltersBody> {
  const res = await fetch("/api/library/filters", {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) throw new Error(`filters_${res.status}`);
  const json: unknown = await res.json();
  if (!isLibraryFiltersBody(json)) throw new Error("filters_shape");
  return json;
}

export async function fetchLibraryItem(
  type: string,
  id: number,
  signal?: AbortSignal,
): Promise<LibraryDetailBody> {
  const res = await fetch(`/api/library/item/${type}/${id}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) throw new Error(`item_${res.status}`);
  const json: unknown = await res.json();
  if (!isLibraryDetailBody(json)) throw new Error("item_shape");
  return json;
}
