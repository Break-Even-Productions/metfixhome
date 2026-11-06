import type { CanonicalSubscriptionTier } from "@shared/account/tiers";

export type AppTool = {
  id: string;
  title: string;
  summary: string;
  /** In-site route. Null when metfix.org has no page for this tool yet. */
  href: string | null;
  /** When true, link is Pro-gated (show upgrade CTA for non-Pro). */
  proOnly?: boolean;
};

export const METFIX_APP_TOOLS: readonly AppTool[] = [
  {
    id: "meal-plans",
    title: "Meal plans",
    summary: "Weekly metabolic meals, built around how you actually eat.",
    href: "/account/meals",
    proOnly: true,
  },
  {
    id: "daily-fix-archive",
    title: "Daily Fix Archive",
    summary: "Eat. Move. Think. A new recipe, workout, and reading each day — full archive for Pro.",
    href: "/the-daily-fix",
    proOnly: true,
  },
  {
    id: "workout-tracking",
    title: "Workout tracking",
    summary: "Log sessions and see recovery, load, and consistency in one place.",
    href: null,
    proOnly: true,
  },
  {
    id: "pr-benchmarks",
    title: "PR & benchmark tracking",
    summary: "Keep lifts, tests, and body markers without a spreadsheet.",
    href: "/account/benchmarks",
    proOnly: true,
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
