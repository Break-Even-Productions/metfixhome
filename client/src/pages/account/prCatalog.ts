import type { PrOverview, PrOverviewRow } from "@/lib/account";

const WEIGHT_UNIT_IDS = new Set([1, 2, 20]);
const RM_NAME = /^(.+?)\s+(\d+)\s*RM$/i;

const WORKOUT_ALIASES: Record<string, string> = {
  girl: "girls",
  the_girls: "girls",
  heroes: "hero",
  named: "named_benchmark",
  named_benchmarks: "named_benchmark",
  other: "benchmark_other",
  benchmark: "benchmark_other",
};

const MOVEMENT_ORDER = [
  ["weight", "Weight"],
  ["time", "Time"],
  ["distance", "Distance"],
  ["reps", "Reps"],
  ["other", "Other"],
] as const;

const WORKOUT_ORDER = [
  ["girls", "Girls"],
  ["hero", "Heroes"],
  ["named_benchmark", "Named benchmarks"],
  ["benchmark_other", "Other benchmarks"],
] as const;

export type CatalogSection = {
  id: string;
  family: "Movements" | "Benchmarks";
  title: string;
  rows: PrOverviewRow[];
};

export type CatalogTag = {
  label: string;
  logged: boolean;
};

export type CatalogItem = {
  key: string;
  title: string;
  tags: CatalogTag[];
  logged: boolean;
  liftId: string;
};

export function rowKey(row: PrOverviewRow): string {
  if (row.measurement_id) return `m-${row.measurement_id}`;
  if (row.custom_workout_id) return `w-${row.custom_workout_id}`;
  return row.name;
}

/** Same families the MetFix app uses for workout PR sections. */
export function workoutBenchmarkSlug(raw: string | null | undefined): string {
  const slug = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!slug) return "benchmark_other";
  return WORKOUT_ALIASES[slug] ?? slug;
}

/** Movements have no shared movement id — group by score kind, then unit. */
export function movementScoreKind(row: PrOverviewRow): string {
  const mode = (row.score_mode ?? "").toLowerCase();
  const unit = (row.unit_abbreviation ?? "").toLowerCase();
  const klass = (row.benchmark_classification ?? "").toLowerCase();
  if (
    mode.includes("weight") ||
    mode.includes("load") ||
    WEIGHT_UNIT_IDS.has(row.score_unit_id ?? -1) ||
    unit === "lb" ||
    unit === "lbs" ||
    unit === "kg"
  ) {
    return "weight";
  }
  if (
    mode.includes("time") ||
    klass === "time" ||
    unit === "s" ||
    unit === "sec" ||
    unit === "secs" ||
    unit === "min"
  ) {
    return "time";
  }
  if (
    mode.includes("distance") ||
    mode.includes("calorie") ||
    unit === "m" ||
    unit === "km" ||
    unit === "mi" ||
    unit === "ft" ||
    unit === "cal"
  ) {
    return "distance";
  }
  if (mode.includes("rep")) return "reps";
  return "other";
}

function titleFromSlug(slug: string): string {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pushBuckets(
  rows: PrOverviewRow[],
  keyOf: (row: PrOverviewRow) => string,
  family: CatalogSection["family"],
  known: ReadonlyArray<readonly [string, string]>,
): CatalogSection[] {
  const buckets = new Map<string, PrOverviewRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const knownKeys = new Set(known.map(([key]) => key));
  const sections: CatalogSection[] = [];
  for (const [key, title] of known) {
    const list = buckets.get(key);
    if (!list?.length) continue;
    sections.push({
      id: `${family}:${key}`,
      family,
      title,
      rows: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  const extras = [...buckets.keys()]
    .filter((key) => !knownKeys.has(key))
    .sort((a, b) => a.localeCompare(b));
  for (const key of extras) {
    const list = buckets.get(key);
    if (!list?.length) continue;
    sections.push({
      id: `${family}:${key}`,
      family,
      title: titleFromSlug(key),
      rows: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return sections;
}

export function buildPrCatalog(prs: PrOverview | null): CatalogSection[] {
  if (!prs) return [];
  return [
    ...pushBuckets(prs.movements ?? [], movementScoreKind, "Movements", MOVEMENT_ORDER),
    ...pushBuckets(
      prs.workouts ?? [],
      (row) => workoutBenchmarkSlug(row.benchmark_classification),
      "Benchmarks",
      WORKOUT_ORDER,
    ),
  ];
}

export function formatCatalogScore(row: PrOverviewRow): string {
  if (row.best_score == null) return "Not logged";
  const n = row.best_score;
  const unit = row.unit_abbreviation?.trim();
  if (!unit && n > 30 && n < 3600 && Number.isInteger(n)) {
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (row.score_unit_id === 1 || unit === "lb" || unit === "lbs") return `${Math.round(n)} lb`;
  if (row.score_unit_id === 2 || unit === "kg") return `${Math.round(n)} kg`;
  if (unit) {
    const whole = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
    return `${whole} ${unit}`;
  }
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Collapse "Bench Press 3RM" / "5RM" into one catalog row. */
export function catalogItems(rows: PrOverviewRow[]): CatalogItem[] {
  const groups = new Map<string, { base: string; rows: Array<{ row: PrOverviewRow; reps: number | null }> }>();
  const order: string[] = [];
  for (const row of rows) {
    const match = RM_NAME.exec(row.name.trim());
    const base = match?.[1]?.trim() || row.name;
    const reps = match ? Number(match[2]) : null;
    const key = match ? base.toLowerCase() : `solo:${rowKey(row)}`;
    let group = groups.get(key);
    if (!group) {
      group = { base, rows: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.rows.push({ row, reps: reps != null && Number.isSafeInteger(reps) ? reps : null });
  }
  return order.map((key) => {
    const group = groups.get(key)!;
    group.rows.sort((a, b) => {
      if (a.reps == null && b.reps == null) return a.row.name.localeCompare(b.row.name);
      if (a.reps == null) return 1;
      if (b.reps == null) return -1;
      return a.reps - b.reps;
    });
    const preferred =
      group.rows.find((item) => item.reps === 1 && item.row.best_score != null) ??
      group.rows.find((item) => item.row.best_score != null) ??
      group.rows.find((item) => item.reps === 1) ??
      group.rows[0]!;
    const multiRm = group.rows.length > 1 && group.rows.every((item) => item.reps != null);
    const tags: CatalogTag[] = multiRm
      ? group.rows.map((item) => ({
          label:
            item.row.best_score != null
              ? `${item.reps}RM ${formatCatalogScore(item.row)}`
              : `${item.reps}RM`,
          logged: item.row.best_score != null,
        }))
      : [
          {
            label: formatCatalogScore(preferred.row),
            logged: preferred.row.best_score != null,
          },
        ];
    return {
      key,
      title: group.base,
      tags,
      logged: tags.some((tag) => tag.logged),
      liftId: rowKey(preferred.row),
    };
  });
}
