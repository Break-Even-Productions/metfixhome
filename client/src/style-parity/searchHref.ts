/**
 * LR-4 / LR-13 / ER-11 / ER-14: nav search href derivation.
 *
 * "Resolves" only when AppRoutes defines a LITERAL `/library/search` route that
 * is not shadowed by an earlier param route (e.g. `/library/:slug`) in the
 * wouter Switch order, and that route is wired to a real search page component
 * (not NotFound / empty fallback).
 *
 * If either check fails, nav uses `/library` per LR-4.
 */
export type SearchHref = "/library/search" | "/library";

const LITERAL_SEARCH = /path=\{["']\/library\/search["']\}|path=["']\/library\/search["']/;
const PARAM_LIBRARY =
  /path=\{["']\/library\/:[^"']+["']\}|path=["']\/library\/:[^"']+["']/;
const NOT_FOUNDISH =
  /NotFound|not-found|component=\{?\(?\)?\s*=>\s*null|component=\{null\}/;

/** Extract ordered Route path=… snippets from AppRoutes source (best-effort). */
export function listRoutePathsInOrder(appSrc: string): string[] {
  const paths: string[] = [];
  const re = /path=\{?["']([^"']+)["']\}?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(appSrc))) paths.push(m[1]);
  return paths;
}

/**
 * True if a param route would match `/library/search` before the literal route
 * in Switch order (ER-14 shadowing).
 */
export function librarySearchIsShadowed(appSrc: string): boolean {
  const paths = listRoutePathsInOrder(appSrc);
  const literalIdx = paths.indexOf("/library/search");
  if (literalIdx === -1) return false;
  for (let i = 0; i < literalIdx; i++) {
    const p = paths[i];
    // /library/:slug (one param after library) would match /library/search
    if (/^\/library\/:[^/]+$/.test(p)) return true;
  }
  return false;
}

/** Heuristic: literal route line looks like a real search page, not 404/empty. */
export function librarySearchRendersSearchPage(appSrc: string): boolean {
  if (!LITERAL_SEARCH.test(appSrc)) return false;
  // Grab a window around the literal route declaration
  const idx = appSrc.search(LITERAL_SEARCH);
  const window = appSrc.slice(Math.max(0, idx - 80), idx + 200);
  if (NOT_FOUNDISH.test(window)) return false;
  // Prefer an explicit Search-ish component name when present
  if (/LibrarySearch|SearchPage|library\/search/i.test(window)) return true;
  // Otherwise accept any non-NotFound component={…} on the same Route
  if (/component=\{[^}]+\}/.test(window) || /component=\{?\w+/.test(window)) {
    return !/component=\{?NotFound/.test(window);
  }
  // Self-closing / children-only Route without component — treat as incomplete
  return false;
}

export function expectedSearchHrefFromApp(appSrc: string): SearchHref {
  if (!LITERAL_SEARCH.test(appSrc)) return "/library";
  if (librarySearchIsShadowed(appSrc)) return "/library";
  if (!librarySearchRendersSearchPage(appSrc)) return "/library";
  // PARAM_LIBRARY alone (without shadowing the literal) is fine
  void PARAM_LIBRARY;
  return "/library/search";
}
