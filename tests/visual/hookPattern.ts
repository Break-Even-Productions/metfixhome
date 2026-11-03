/**
 * Shared visual/test-hook ban list (PR E T-E-56 / PR F T-F-65).
 * Pattern per errata e1 ER-4 (wins over F rev1.0.10 §17d / E §19b).
 * Zero matches allowed in client/src/** and own dist chunks (ER-1).
 */
export { VISUAL_HOOK_PATTERN } from "./hookPattern.mjs";
