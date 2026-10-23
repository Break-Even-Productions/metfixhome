import { useCallback, useEffect, useRef, useState } from "react";
import {
  isFreeOpen,
  isProfessionalTagged,
  type LibraryResource,
} from "@shared/library";
import { fetchLibraryPopular, fetchLibrarySearch, type SearchParams } from "./api";

const PAGE = 24;

export type ArchiveKind =
  | { kind: "popular" }
  | { kind: "search"; params: Omit<SearchParams, "limit" | "offset"> }
  | { kind: "free"; params: Omit<SearchParams, "limit" | "offset"> }
  | { kind: "gated"; params: Omit<SearchParams, "limit" | "offset"> };

export type InfiniteArchiveState = {
  status: "loading" | "error" | "data";
  items: LibraryResource[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
};

function dedupeAppend(
  prev: LibraryResource[],
  next: LibraryResource[],
): LibraryResource[] {
  const seen = new Set(prev.map((r) => `${r.type}:${r.id}`));
  const out = [...prev];
  for (const r of next) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function filterPage(
  kind: ArchiveKind["kind"],
  rows: LibraryResource[],
): LibraryResource[] {
  if (kind === "free") return rows.filter(isFreeOpen);
  if (kind === "gated") return rows.filter(isProfessionalTagged);
  return rows;
}

/**
 * Infinite archive for Browse all.
 * popular + search use limit/offset; free/gated paginate search and keep matches.
 * Popular stops early if a page adds no new rows (upstream ignored offset).
 */
export function useInfiniteArchive(
  active: boolean,
  archive: ArchiveKind | null,
  resetKey: string,
): InfiniteArchiveState {
  const [status, setStatus] = useState<"loading" | "error" | "data">("loading");
  const [items, setItems] = useState<LibraryResource[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const itemsRef = useRef<LibraryResource[]>([]);
  const busyRef = useRef(false);
  const archiveRef = useRef(archive);
  archiveRef.current = archive;
  itemsRef.current = items;

  useEffect(() => {
    if (!active || !archive) {
      setStatus("loading");
      setItems([]);
      setHasMore(false);
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    setStatus("loading");
    setItems([]);
    setHasMore(false);
    offsetRef.current = 0;
    busyRef.current = true;

    void (async () => {
      try {
        if (archive.kind === "popular") {
          const body = await fetchLibraryPopular(
            { limit: PAGE, offset: 0 },
            signal,
          );
          if (signal.aborted) return;
          setItems(body.resources);
          offsetRef.current = PAGE;
          setHasMore(body.meta.has_more);
          setStatus("data");
          return;
        }

        const body = await fetchLibrarySearch(
          { ...archive.params, limit: PAGE, offset: 0 },
          signal,
        );
        if (signal.aborted) return;
        setItems(filterPage(archive.kind, body.resources));
        offsetRef.current = PAGE;
        setHasMore(body.meta.has_more);
        setStatus("data");
      } catch {
        if (signal.aborted) return;
        setStatus("error");
      } finally {
        busyRef.current = false;
      }
    })();

    return () => controller.abort();
  }, [active, archive, resetKey]);

  const loadMore = useCallback(() => {
    const arch = archiveRef.current;
    if (!arch || !hasMore || busyRef.current || status !== "data") return;
    busyRef.current = true;
    setLoadingMore(true);

    void (async () => {
      try {
        if (arch.kind === "popular") {
          const offset = offsetRef.current;
          const body = await fetchLibraryPopular({ limit: PAGE, offset });
          offsetRef.current = offset + PAGE;
          const next = dedupeAppend(itemsRef.current, body.resources);
          const gained = next.length - itemsRef.current.length;
          itemsRef.current = next;
          setItems(next);
          // Until BSI paginates popular, a repeated first page adds 0 → stop.
          setHasMore(gained > 0 && body.meta.has_more);
          return;
        }

        if (arch.kind === "search") {
          const offset = offsetRef.current;
          const body = await fetchLibrarySearch({
            ...arch.params,
            limit: PAGE,
            offset,
          });
          offsetRef.current = offset + PAGE;
          setItems((prev) => dedupeAppend(prev, body.resources));
          setHasMore(body.meta.has_more);
          return;
        }

        // free / gated — pull pages until we gain matches or exhaust
        let offset = offsetRef.current;
        let more = true;
        let gained = 0;
        let guard = 0;
        while (more && gained === 0 && guard < 5) {
          guard += 1;
          const body = await fetchLibrarySearch({
            ...arch.params,
            limit: PAGE,
            offset,
          });
          offset += PAGE;
          more = body.meta.has_more;
          const rows = filterPage(arch.kind, body.resources);
          if (rows.length) {
            setItems((prev) => dedupeAppend(prev, rows));
            gained = rows.length;
          }
        }
        offsetRef.current = offset;
        setHasMore(more);
      } catch {
        /* keep hasMore; next scroll can retry */
      } finally {
        busyRef.current = false;
        setLoadingMore(false);
      }
    })();
  }, [hasMore, status]);

  return { status, items, hasMore, loadingMore, loadMore };
}
