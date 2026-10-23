import type { LibraryFiltersBody } from "@shared/library";
import { fetchLibraryFilters } from "./api";

/**
 * Module-level cached filters promise (CQ B4 / SN5).
 * Shared by LibraryPage and /library/search. No test-only reset export —
 * tests use `vi.resetModules()` between cases.
 */
let filtersPromise: Promise<LibraryFiltersBody> | null = null;

export function getLibraryFilters(
  signal?: AbortSignal,
): Promise<LibraryFiltersBody> {
  if (!filtersPromise) {
    filtersPromise = fetchLibraryFilters().catch((err) => {
      filtersPromise = null;
      throw err;
    });
  }
  if (!signal) return filtersPromise;
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    filtersPromise!.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}
