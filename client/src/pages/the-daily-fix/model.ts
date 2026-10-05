export const PILLARS = ["belly", "body", "brain"] as const;
export type Pillar = (typeof PILLARS)[number];

/** BSI "today" is Etc/GMT-2 (UTC+2), not the browser's local calendar date. */
export const BSI_TODAY_TZ = "Etc/GMT-2";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YYMMDD = /^(\d{2})(\d{2})(\d{2})$/;
const YYYYMMDD = /^(\d{4})(\d{2})(\d{2})$/;
const TWO_DIGITS = /^\d{2}$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

export type RecipeIngredient = {
  display: string;
  sort_order: number;
};

export type RecipeStep = {
  instruction: string;
  sort_order: number;
};

export type BellyMacros = {
  fat: number | null;
  carb: number | null;
  protein: number | null;
};

export type DailyFixBelly = {
  title: string;
  body?: string | null;
  steps?: string | null;
  fat: number | null;
  carb: number | null;
  protein: number | null;
  /** Non-empty https URL, or null when absent/invalid. */
  photo_url: string | null;
  /** Strict 11-char YouTube video id, or null when absent/unparseable. */
  yt_url: string | null;
  has_structured_ingredients: boolean;
  has_structured_steps: boolean;
  recipe_ingredients: RecipeIngredient[];
  recipe_steps: RecipeStep[];
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Trim; keep only a non-empty https: URL, else null. */
export function mapHttpsPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Extract a strict 11-char YouTube id from watch / youtu.be / embed / shorts.
 * Returns null when no usable id is present.
 */
export function extractYoutubeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (YT_ID.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return YT_ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && YT_ID.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
        const id = parts[1] ?? "";
        return YT_ID.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Build the autoplay embed URL for a parsed YouTube id. Never pass a raw page URL. */
export function youtubeEmbedUrl(videoId: string): string {
  const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
  embed.searchParams.set("autoplay", "1");
  embed.searchParams.set("rel", "0");
  embed.searchParams.set("playsinline", "1");
  return embed.toString();
}

/**
 * Glass overlay macros: Protein → Fat → Carbs, only values that are numbers > 0.
 * Null and 0g rows are omitted. Empty means no glass macros card.
 */
export function glassMacroRows(macros: BellyMacros): { label: string; grams: number }[] {
  const rows: { label: string; grams: number }[] = [];
  if (typeof macros.protein === "number" && macros.protein > 0) {
    rows.push({ label: "Protein", grams: macros.protein });
  }
  if (typeof macros.fat === "number" && macros.fat > 0) {
    rows.push({ label: "Fat", grams: macros.fat });
  }
  if (typeof macros.carb === "number" && macros.carb > 0) {
    rows.push({ label: "Carbs", grams: macros.carb });
  }
  return rows;
}

export type DailyFixBody = {
  title: string;
  html: string;
};

export type DailyFixBrain = {
  title: string;
  html: string;
  article_url?: string | null;
  button_text?: string | null;
};

export type DailyFixDay = {
  date: string;
  requested_date?: string | null;
  belly: DailyFixBelly;
  body: DailyFixBody;
  brain: DailyFixBrain;
};

export type DailyFixRouteKind = "today" | "day" | "invalid";

export type DailyFixRoute = {
  kind: DailyFixRouteKind;
  /** ISO calendar day when kind is "day". */
  iso: string | null;
  /** Canonical YYMMDD when kind is "day". */
  code: string | null;
  pillar: Pillar;
  /** True when a valid pillar was explicit in the path or hash. */
  pillarExplicit: boolean;
  canonicalPath: string;
  canonicalHash: string;
};

export type DailyFixRouteInput = {
  date?: string;
  pillar?: string;
  yy?: string;
  mm?: string;
  dd?: string;
  hash?: string;
};

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

export function isPillar(value: string | undefined): value is Pillar {
  return value === "belly" || value === "body" || value === "brain";
}

export function parsePillar(value: string | undefined): Pillar {
  return isPillar(value) ? value : "belly";
}

function hashToken(hash: string | undefined): string {
  if (!hash) return "";
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

function resolvePillar(pathPillar: string | undefined, hash: string | undefined): {
  pillar: Pillar;
  explicit: boolean;
} {
  if (pathPillar != null && pathPillar !== "") {
    if (isPillar(pathPillar)) return { pillar: pathPillar, explicit: true };
    return { pillar: "belly", explicit: false };
  }
  const token = hashToken(hash);
  if (!token) return { pillar: "belly", explicit: false };
  if (isPillar(token)) return { pillar: token, explicit: true };
  return { pillar: "belly", explicit: false };
}

function todayRoute(hash: string | undefined): DailyFixRoute {
  const { pillar, explicit } = resolvePillar(undefined, hash);
  return {
    kind: "today",
    iso: null,
    code: null,
    pillar,
    pillarExplicit: explicit,
    canonicalPath: "/the-daily-fix",
    canonicalHash: explicit ? `#${pillar}` : "",
  };
}

function dayRoute(iso: string, code: string, pathPillar: string | undefined, hash: string | undefined): DailyFixRoute {
  const { pillar, explicit } = resolvePillar(pathPillar, hash);
  return {
    kind: "day",
    iso,
    code,
    pillar,
    pillarExplicit: explicit,
    canonicalPath: `/the-daily-fix/${code}`,
    canonicalHash: explicit ? `#${pillar}` : "",
  };
}

function invalidRoute(hash: string | undefined, pathPillar?: string): DailyFixRoute {
  const { pillar, explicit } = resolvePillar(pathPillar, hash);
  return {
    kind: "invalid",
    iso: null,
    code: null,
    pillar,
    pillarExplicit: explicit,
    canonicalPath: "",
    canonicalHash: "",
  };
}

function parseDateSegment(segment: string, pathPillar: string | undefined, hash: string | undefined): DailyFixRoute {
  const six = YYMMDD.exec(segment);
  if (six) {
    const iso = isoFromYymmdd(segment);
    if (!iso) return invalidRoute(hash, pathPillar);
    return dayRoute(iso, segment, pathPillar, hash);
  }

  const eight = YYYYMMDD.exec(segment);
  if (eight) {
    const year = Number(eight[1]);
    const month = Number(eight[2]);
    const day = Number(eight[3]);
    if (!isValidCalendarDay(year, month, day)) return invalidRoute(hash, pathPillar);
    const iso = `${eight[1]}-${eight[2]}-${eight[3]}`;
    const code = yymmddFromIso(iso);
    if (!code) return invalidRoute(hash, pathPillar);
    return dayRoute(iso, code, pathPillar, hash);
  }

  const isoMatch = ISO_DATE.exec(segment);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDay(year, month, day)) return invalidRoute(hash, pathPillar);
    const code = yymmddFromIso(segment);
    if (!code) return invalidRoute(hash, pathPillar);
    return dayRoute(segment, code, pathPillar, hash);
  }

  return invalidRoute(hash, pathPillar);
}

function parseSlashDate(yy: string, mm: string, dd: string, hash: string | undefined): DailyFixRoute {
  if (!TWO_DIGITS.test(yy) || !TWO_DIGITS.test(mm) || !TWO_DIGITS.test(dd)) {
    return invalidRoute(hash);
  }
  const code = `${yy}${mm}${dd}`;
  const iso = isoFromYymmdd(code);
  if (!iso) return invalidRoute(hash);
  return dayRoute(iso, code, undefined, hash);
}

export function parseDailyFixRoute(input: DailyFixRouteInput = {}): DailyFixRoute {
  if (input.yy != null && input.mm != null && input.dd != null) {
    return parseSlashDate(input.yy, input.mm, input.dd, input.hash);
  }
  if (!input.date) return todayRoute(input.hash);
  return parseDateSegment(input.date, input.pillar, input.hash);
}

export function dailyFixCanonicalUrl(route: DailyFixRoute, search = ""): string {
  return `${route.canonicalPath}${search}${route.canonicalHash}`;
}

export function dailyFixPath(code?: string | null, pillar?: Pillar | null): string {
  if (!code) return pillar ? `/the-daily-fix#${pillar}` : "/the-daily-fix";
  return pillar ? `/the-daily-fix/${code}#${pillar}` : `/the-daily-fix/${code}`;
}

/** Today uses the bare path (plus optional hash). Other days use YYMMDD, never YYYY-MM-DD or a path pillar. */
export function dailyFixHref(todayIso: string, dateIso: string, pillar: Pillar | null): string {
  if (dateIso === todayIso) return dailyFixPath(null, pillar);
  const code = yymmddFromIso(dateIso);
  return dailyFixPath(code, pillar);
}

export function addCalendarDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dayParts(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "long" }),
    weekdayShort: date.toLocaleDateString("en-US", { weekday: "short" }),
    month: date.toLocaleDateString("en-US", { month: "long" }),
    monthShort: date.toLocaleDateString("en-US", { month: "short" }),
    day: date.getDate(),
    year: date.getFullYear(),
  };
}

export function formatDayLabel(iso: string) {
  const parts = dayParts(iso);
  return `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year}`;
}

export function pillarLabel(pillar: Pillar) {
  switch (pillar) {
    case "belly":
      return "Belly";
    case "body":
      return "Body";
    case "brain":
      return "Brain";
    default: {
      const exhaustive: never = pillar;
      return exhaustive;
    }
  }
}

export function visibleMacros(macros: BellyMacros) {
  const rows: { label: string; grams: number }[] = [];
  if (macros.fat != null) rows.push({ label: "Fat", grams: macros.fat });
  if (macros.carb != null) rows.push({ label: "Carbs", grams: macros.carb });
  if (macros.protein != null) rows.push({ label: "Protein", grams: macros.protein });
  return rows;
}

export function sortedIngredients(items: RecipeIngredient[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function sortedSteps(items: RecipeStep[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function isCloserScheduledDay(day: DailyFixDay, requestedIso: string) {
  return Boolean(day.requested_date && day.requested_date !== day.date) || day.date !== requestedIso;
}

export function recentDateStrip(anchorIso: string, days = 21) {
  const start = addCalendarDays(anchorIso, -(days - 1));
  return Array.from({ length: days }, (_, index) => addCalendarDays(start, index));
}

export function brainButtonText(brain: DailyFixBrain) {
  const label = brain.button_text?.trim();
  return label && label.length > 0 ? label : "FULL ARTICLE";
}
