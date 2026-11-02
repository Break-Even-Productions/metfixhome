import { sha256Hex } from "./crypto";
import type { ActingContext } from "./acting";

/**
 * CQ B3 / DP-T-CFG3: per-user limiter key for account + Whop checkout.
 * Prefer real `bsi_user_id`. Treat missing, `""`, and `"0"` as absent → hashed sid.
 */
export async function accountRateLimitKey(ctx: ActingContext): Promise<string> {
  const uid = ctx.record.bsi_user_id;
  if (typeof uid === "string" && uid.length > 0 && uid !== "0") {
    return `acct:${uid}`;
  }
  return `sid:${await sha256Hex(ctx.sid)}`;
}
