export const PILLARS = ["belly", "body", "brain"] as const;
export type Pillar = (typeof PILLARS)[number];

/** BSI "today" is Etc/GMT-2 (UTC+2), not the browser's local calendar date. */
export const BSI_TODAY_TZ = "Etc/GMT-2";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  has_structured_ingredients: boolean;
  has_structured_steps: boolean;
  recipe_ingredients: RecipeIngredient[];
  recipe_steps: RecipeStep[];
};

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

export type DailyFixRoute = {
  kind: "today" | "day" | "invalid";
  date: string | null;
  pillar: Pillar;
  pillarInUrl: boolean;
};

export function bsiTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BSI_TODAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function isPillar(value: string | undefined): value is Pillar {
  return value === "belly" || value === "body" || value === "brain";
}

export function parsePillar(value: string | undefined): Pillar {
  return isPillar(value) ? value : "belly";
}

export function parseDailyFixRoute(date?: string, pillar?: string): DailyFixRoute {
  if (!date) {
    return { kind: "today", date: null, pillar: "belly", pillarInUrl: false };
  }
  if (!isIsoDate(date)) {
    return { kind: "invalid", date, pillar: parsePillar(pillar), pillarInUrl: isPillar(pillar) };
  }
  return {
    kind: "day",
    date,
    pillar: parsePillar(pillar),
    pillarInUrl: isPillar(pillar),
  };
}

export function dailyFixPath(date?: string | null, pillar?: Pillar | null): string {
  if (!date) return "/the-daily-fix";
  if (pillar) return `/the-daily-fix/${date}/${pillar}`;
  return `/the-daily-fix/${date}`;
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
