import { bsiTodayIso } from "./dates";
import { decodeHtmlEntitiesOnce, stripTags } from "./text";

export type DailyFixPick = {
  source_type: "daily_mod" | "daily_workout" | "daily_article";
  source_id: number;
  title: string;
  date: string;
};

const PILLARS = [
  ["belly", "daily_mod"],
  ["body", "daily_workout"],
  ["brain", "daily_article"],
] as const;

function titleOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = decodeHtmlEntitiesOnce(stripTags(raw)).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return Array.from(text).slice(0, 300).join("");
}

function idOf(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0) return raw;
  return null;
}

function picksFromDay(raw: unknown): DailyFixPick[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const day = raw as Record<string, unknown>;
  const date =
    typeof day.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date : "";
  const out: DailyFixPick[] = [];
  for (const [key, source_type] of PILLARS) {
    const block = day[key];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const row = block as Record<string, unknown>;
    const source_id = idOf(row.id);
    const title = titleOf(row.title);
    if (source_id == null || !title) continue;
    out.push({ source_type, source_id, title, date });
  }
  return out;
}

/** One Daily Fix day, or a `{ days: [...] }` batch. */
export function dailyFixPicks(raw: unknown): DailyFixPick[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const body = raw as Record<string, unknown>;
  if (Array.isArray(body.days)) {
    return body.days.flatMap((day) => picksFromDay(day));
  }
  return picksFromDay(raw);
}

/** Recent BSI calendar dates, newest first. */
export function recentDailyFixDates(count = 7, now = new Date()): string[] {
  const n = Math.min(14, Math.max(1, Math.floor(count)));
  const today = bsiTodayIso(now);
  const [year, month, day] = today.split("-").map(Number);
  const start = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    dates.push(new Date(start - i * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}
