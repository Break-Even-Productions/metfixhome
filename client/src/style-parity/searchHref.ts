/**
 * LR-4 / LR-13 / ER-11: nav search href derivation.
 * "Resolves" only when AppRoutes defines a LITERAL `/library/search` route.
 * Param routes like `/library/:slug` do NOT count.
 */
export function expectedSearchHrefFromApp(appSrc: string): "/library/search" | "/library" {
  const hasLiteral =
    /path=\{["']\/library\/search["']\}/.test(appSrc) ||
    /path=["']\/library\/search["']/.test(appSrc);
  return hasLiteral ? "/library/search" : "/library";
}
