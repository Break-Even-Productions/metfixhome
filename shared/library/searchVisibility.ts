import type { LibraryResource } from "./types";

/**
 * Hide vs lock for logged-out search results.
 * E4 (Ethan, relayed): "lock" — show locked items with a lock, like /library.
 * Flip to "hide" later without restructuring the page (cheap toggle).
 */
export type SearchVisibilityMode = "lock" | "hide";

export const SEARCH_VISIBILITY_MODE: SearchVisibilityMode = "lock";

/**
 * Results passed to the card grid (CQ-T2 / E4).
 * Lock mode: identity (same length, order, ids as upstream).
 * Hide mode kept for a one-line flip if Ethan reverts E4.
 */
export function filterSearchResultsForViewer(
  items: ReadonlyArray<LibraryResource>,
  _opts?: { signedIn?: boolean; mode?: SearchVisibilityMode },
): LibraryResource[] {
  const mode = _opts?.mode ?? SEARCH_VISIBILITY_MODE;
  if (mode === "lock" || _opts?.signedIn) {
    return items.slice();
  }
  // hide path reserved — import isFreeOpen only if flipped; keep identity for lock.
  return items.slice();
}
