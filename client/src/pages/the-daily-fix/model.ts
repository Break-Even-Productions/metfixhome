import {
  BSI_TODAY_TZ,
  addCalendarDays,
  bsiTodayIso,
  isoFromYymmdd,
  isIsoDate,
  isValidCalendarDay,
  normalizeDailyFixPath,
  plainText,
  readMinutes,
  yymmddFromIso,
  type DailyFixArchiveEntry,
  type DailyFixTab,
} from "@shared/daily-fix";
import {
  extractYoutubeId,
  mapDailyFixDay,
  mapHttpsPhotoUrl,
  type DailyFixBelly,
  type DailyFixBody,
  type DailyFixBrain,
  type DailyFixDay,
  type RecipeIngredient,
  type RecipeStep,
} from "@shared/daily-fix/mapper";

export {
  BSI_TODAY_TZ,
  addCalendarDays,
  bsiTodayIso,
  extractYoutubeId,
  isoFromYymmdd,
  isIsoDate,
  isValidCalendarDay,
  mapDailyFixDay,
  mapHttpsPhotoUrl,
  normalizeDailyFixPath,
  plainText,
  readMinutes,
  yymmddFromIso,
};
export type {
  DailyFixArchiveEntry,
  DailyFixBelly,
  DailyFixBody,
  DailyFixBrain,
  DailyFixDay,
  DailyFixTab,
  RecipeIngredient,
  RecipeStep,
};

export const PILLARS = ["belly", "body", "brain"] as const;
export type Pillar = (typeof PILLARS)[number];

export type BellyMacros = {
  fat: number | null;
  carb: number | null;
  protein: number | null;
};

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

export type DailyFixRouteKind = "today" | "day" | "invalid";

export type DailyFixRoute = {
  kind: DailyFixRouteKind;
  /** ISO calendar day when kind is "day". */
  iso: string | null;
  /** Canonical YYMMDD when kind is "day". */
  code: string | null;
  pillar: Pillar;
  /** True when a valid pillar was explicit in the path or ?tab=. */
  pillarExplicit: boolean;
  canonicalPath: string;
  /** Allowed share tab (`body`/`brain`), or null for belly / no param. */
  tab: DailyFixTab | null;
};

export type DailyFixRouteInput = {
  date?: string;
  pillar?: string;
  yy?: string;
  mm?: string;
  dd?: string;
  /** Raw location.search (with or without `?`). */
  search?: string;
};

export function isPillar(value: string | undefined): value is Pillar {
  return value === "belly" || value === "body" || value === "brain";
}

export function parsePillar(value: string | undefined): Pillar {
  return isPillar(value) ? value : "belly";
}

function pairKey(pair: string): string {
  const eq = pair.indexOf("=");
  return eq === -1 ? pair : pair.slice(0, eq);
}

/**
 * Apply legacy `#belly|#body|#brain` → `?tab=` (belly drops param) via replaceState
 * before the first render reads the pillar. Returns the search string to use.
 * Rewrites raw query pairs (no URLSearchParams set/delete) so encoding is preserved.
 */
export function consumeLegacyHashInBrowser(): string {
  if (typeof window === "undefined") return "";
  const token = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const path = window.location.pathname;
  const search = window.location.search;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const pairs = raw ? raw.split("&") : [];

  if (token !== "belly" && token !== "body" && token !== "brain") {
    // C3: drop unknown hashes (#bogus) so they don't linger.
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", `${path}${search}`);
    }
    return search;
  }

  const rebuilt: string[] = [];
  let tabPlaced = false;
  for (const p of pairs) {
    const key = pairKey(p);
    if (key === "tab" || key === "tab[]") {
      if (!tabPlaced && (token === "body" || token === "brain")) {
        rebuilt.push(`tab=${token}`);
        tabPlaced = true;
      }
      continue;
    }
    rebuilt.push(p);
  }
  if (!tabPlaced && (token === "body" || token === "brain")) {
    rebuilt.push(`tab=${token}`);
  }

  const nextSearch = rebuilt.length ? `?${rebuilt.join("&")}` : "";
  const next = `${path}${nextSearch}`;
  const current = `${path}${search}${window.location.hash}`;
  if (next !== current.replace(/#.*$/, "") || window.location.hash) {
    window.history.replaceState(window.history.state, "", next);
  }
  return nextSearch;
}

/**
 * Client route parse. Prefers shared normalizeDailyFixPath for path+query when
 * the path is under /the-daily-fix; falls back for param-based router input.
 * Legacy hashes are handled by consumeLegacyHashInBrowser before this runs.
 */
export function parseDailyFixRoute(input: DailyFixRouteInput = {}): DailyFixRoute {
  // Build a path from router params when present
  let path = "/the-daily-fix";
  if (input.yy != null && input.mm != null && input.dd != null) {
    path = `/the-daily-fix/${input.yy}/${input.mm}/${input.dd}`;
  } else if (input.date) {
    path = input.pillar
      ? `/the-daily-fix/${input.date}/${input.pillar}`
      : `/the-daily-fix/${input.date}`;
  }

  const search = input.search ?? "";
  const normalized = normalizeDailyFixPath(path, search);

  if (normalized.kind === "notFound") {
    return {
      kind: "invalid",
      iso: null,
      code: null,
      pillar: "belly",
      pillarExplicit: false,
      canonicalPath: "",
      tab: null,
    };
  }

  if (normalized.kind === "redirect") {
    // Client still needs a usable route for in-app rewrite; parse the target.
    const loc = normalized.location;
    const qIndex = loc.indexOf("?");
    const p = qIndex === -1 ? loc : loc.slice(0, qIndex);
    const s = qIndex === -1 ? "" : loc.slice(qIndex);
    return parseDailyFixRouteFromPath(p, s);
  }

  return serveToRoute(normalized);
}

function parseDailyFixRouteFromPath(path: string, search: string): DailyFixRoute {
  const normalized = normalizeDailyFixPath(path, search);
  if (normalized.kind === "serve") return serveToRoute(normalized);
  if (normalized.kind === "redirect") {
    const loc = normalized.location;
    const qIndex = loc.indexOf("?");
    const p = qIndex === -1 ? loc : loc.slice(0, qIndex);
    const s = qIndex === -1 ? "" : loc.slice(qIndex);
    const again = normalizeDailyFixPath(p, s);
    if (again.kind === "serve") return serveToRoute(again);
  }
  return {
    kind: "invalid",
    iso: null,
    code: null,
    pillar: "belly",
    pillarExplicit: false,
    canonicalPath: "",
    tab: null,
  };
}

function serveToRoute(
  normalized: Extract<ReturnType<typeof normalizeDailyFixPath>, { kind: "serve" }>,
): DailyFixRoute {
  const tab = normalized.tab;
  const pillar: Pillar = tab ?? "belly";
  if (normalized.mode === "bare") {
    return {
      kind: "today",
      iso: null,
      code: null,
      pillar,
      pillarExplicit: tab != null,
      canonicalPath: "/the-daily-fix",
      tab,
    };
  }
  return {
    kind: "day",
    iso: normalized.iso,
    code: normalized.yymmdd,
    pillar,
    pillarExplicit: tab != null,
    canonicalPath: `/the-daily-fix/${normalized.yymmdd}`,
    tab,
  };
}

/** Canonical path + search for the route (no hash). Drops invalid client-side tab. */
export function dailyFixCanonicalUrl(route: DailyFixRoute, search = ""): string {
  const qs = buildSearchWithTab(search, route.tab);
  return `${route.canonicalPath}${qs}`;
}

/**
 * Rebuild search keeping `tab` in its original pair position (edge parity).
 * Non-tab pairs keep their raw encoding.
 */
function buildSearchWithTab(search: string, tab: DailyFixTab | null): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const pairs = raw ? raw.split("&") : [];
  const rebuilt: string[] = [];
  let tabPlaced = false;
  for (const p of pairs) {
    const key = pairKey(p);
    if (key === "tab" || key === "tab[]") {
      if (!tabPlaced && (tab === "body" || tab === "brain")) {
        rebuilt.push(`tab=${tab}`);
        tabPlaced = true;
      }
      continue;
    }
    rebuilt.push(p);
  }
  if (!tabPlaced && (tab === "body" || tab === "brain")) {
    rebuilt.push(`tab=${tab}`);
  }
  return rebuilt.length ? `?${rebuilt.join("&")}` : "";
}

export function dailyFixPath(code?: string | null, pillar?: Pillar | null): string {
  const tab = pillar === "body" || pillar === "brain" ? pillar : null;
  if (!code) {
    return tab ? `/the-daily-fix?tab=${tab}` : "/the-daily-fix";
  }
  return tab ? `/the-daily-fix/${code}?tab=${tab}` : `/the-daily-fix/${code}`;
}

/** Today uses the bare path (plus optional ?tab=). Other days use YYMMDD. */
export function dailyFixHref(todayIso: string, dateIso: string, pillar: Pillar | null): string {
  if (dateIso === todayIso) return dailyFixPath(null, pillar);
  const code = yymmddFromIso(dateIso);
  return dailyFixPath(code, pillar);
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

export const FIRST_FIX_ISO = "2025-02-10";

const WP_UPLOAD = /^(https:\/\/[^?#]+\/wp-content\/uploads\/[^?#]+?)(?:-scaled|-\d+x\d+)?(\.(?:jpe?g|png|webp|gif))$/i;

/** WordPress's 150×150 crop of an upload, or null for non-WordPress URLs. */
export function wpThumbnailUrl(url: string): string | null {
  const match = WP_UPLOAD.exec(url);
  return match ? `${match[1]}-150x150${match[2]}` : null;
}

/** Local-midnight Date for a calendar ISO day (what react-day-picker expects). */
export function dateFromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoFromDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function recentDateStrip(anchorIso: string, days = 21) {
  const start = addCalendarDays(anchorIso, -(days - 1));
  return Array.from({ length: days }, (_, index) => addCalendarDays(start, index));
}

export function brainButtonText(brain: DailyFixBrain) {
  const label = brain.button_text?.trim();
  return label && label.length > 0 ? label : "FULL ARTICLE";
}
