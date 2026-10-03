import type { DailyFixDay } from "./model";

/**
 * Static GitHub Pages cannot call the credentialed Daily Fix day endpoint.
 * Do not fetch WordPress from the client, and do not hide that gap with sample days.
 */
export type DailyFixLoadState =
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "loaded"; day: DailyFixDay };

export function loadDailyFixState(kind: "today" | "day" | "invalid"): DailyFixLoadState {
  if (kind === "invalid") return { status: "invalid" };
  return { status: "unavailable" };
}
