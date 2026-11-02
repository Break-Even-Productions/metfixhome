/**
 * Re-export only — canonical definition lives in shared/account/returnPath.ts (B1 / LR-8).
 * Call sites that historically imported this path keep working without a second definition.
 */
export { sanitizeReturnPath } from "./account/returnPath";
