const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

/** MetFix Daily Fix archive stamp (`YYMMDD`) from an ISO date. */
export function formatYymmdd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d || y.length < 4) return ymd;
  return `${y.slice(2)}${m}${d}`;
}

export function formatDayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, -1)) return "Yesterday";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  const [y, m, d] = ymd.split("-").map(Number);
  const month = MONTHS[(m ?? 1) - 1] ?? "";
  if (String(y) === today.slice(0, 4)) return `${month} ${d}`;
  return `${month} ${d}, ${y}`;
}

/** Clock stamp without `toLocaleString` (account money-scan). */
export function formatStamp(raw: string): string {
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return raw;
  const month = MONTHS[d.getMonth()] ?? "";
  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${month} ${d.getDate()}, ${hour}:${minute} ${ampm}`;
}

/** One decimal without `.toFixed`. */
export function formatScoreNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  const tenths = Math.round(n * 10) / 10;
  if (Number.isInteger(tenths)) return String(tenths);
  const whole = Math.trunc(tenths);
  const frac = Math.abs(Math.round((tenths - whole) * 10));
  return `${whole}.${frac}`;
}
