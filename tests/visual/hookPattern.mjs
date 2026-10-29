/**
 * Shared visual/test-hook ban list (PR E T-E-56 / PR F T-F-65).
 * Pattern per errata e1 ER-4.
 */
export const VISUAL_HOOK_PATTERN =
  /data-visual\b|__VISUAL|VISUAL_TEST|isVisualTest|visualTest|navigator\.webdriver|__PLAYWRIGHT__|\bVITE_VISUAL\w*|env\[\s*["']VITE_VISUAL\w*["']\s*\]|process\.env\.VISUAL/;
