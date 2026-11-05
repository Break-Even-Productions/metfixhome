import type { CanonicalSubscriptionTier } from "@shared/account/tiers";

export type AppTool = {
  id: string;
  title: string;
  summary: string;
  /** In-site route. Null when metfix.org has no page for this tool yet. */
  href: string | null;
};

export const METFIX_APP_TOOLS: readonly AppTool[] = [
  {
    id: "meal-plans",
    title: "Meal plans",
    summary: "Build and follow meal plans from the MetFix nutrition framework.",
    href: null,
  },
  {
    id: "daily-fix",
    title: "Daily Fix",
    summary: "Today's recipe, workout, and reading.",
    href: "/the-daily-fix",
  },
  {
    id: "workout-tracking",
    title: "Workout tracking",
    summary: "Log training sessions and review what you did.",
    href: null,
  },
  {
    id: "pr-benchmarks",
    title: "PR & benchmark tracking",
    summary: "Record personal records and benchmark workouts.",
    href: null,
  },
  {
    id: "spark",
    title: "Spark data",
    summary: "Class attendance and Spark athlete data.",
    href: null,
  },
  {
    id: "calendar",
    title: "Calendar",
    summary: "Scheduled meals, workouts, and classes.",
    href: null,
  },
  {
    id: "metrics",
    title: "Metrics",
    summary: "Body and performance measurements over time.",
    href: null,
  },
];

export function metfixToolsUnlocked(tier: CanonicalSubscriptionTier): boolean {
  switch (tier) {
    case "metfix_pro":
    case "organization_owner":
      return true;
    case "free":
    case "member":
      return false;
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}
