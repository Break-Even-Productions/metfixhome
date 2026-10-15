/** BSI "today" is Etc/GMT-2 (UTC+2), not the browser's local calendar date. */
export const BSI_TODAY_TZ = "Etc/GMT-2";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YYMMDD = /^(\d{2})(\d{2})(\d{2})$/;
const YYYYMMDD = /^(\d{4})(\d{2})(\d{2})$/;
const TWO_DIGITS = /^\d{2}$/;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

export function bsiTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BSI_TODAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidCalendarDay(year: number, month: number, day: number): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  return isValidCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function yymmddFromIso(iso: string): string | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDay(year, month, day)) return null;
  return `${String(year).slice(2)}${match[2]}${match[3]}`;
}

export function isoFromYymmdd(code: string): string | null {
  const match = YYMMDD.exec(code);
  if (!match) return null;
  const year = MIN_YEAR + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDay(year, month, day)) return null;
  return `${year}-${match[2]}-${match[3]}`;
}

export function addCalendarDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export { ISO_DATE, YYMMDD, YYYYMMDD, TWO_DIGITS };
