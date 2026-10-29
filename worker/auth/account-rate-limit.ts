import { sha256Hex } from "./crypto";

/** Minimal session shape for rate-limit keying (DP-T-CFG3 / R2-N3). */
export type RateLimitSession = {
  sid: string;
  record: { bsi_user_id?: string | null };
};

/**
 * Prefer real `bsi_user_id`. Treat missing, `""`, and `"0"` as absent → hashed sid.
 * Never raw sid; never `acct:0`.
 */
export async function accountRateLimitKey(ctx: RateLimitSession): Promise<string> {
  const uid = ctx.record.bsi_user_id;
  if (typeof uid === "string" && uid.length > 0 && uid !== "0") {
    return `acct:${uid}`;
  }
  return `sid:${await sha256Hex(ctx.sid)}`;
}
