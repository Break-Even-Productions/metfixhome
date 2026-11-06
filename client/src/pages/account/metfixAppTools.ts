import type { CanonicalSubscriptionTier } from "@shared/account/tiers";

export type AppToolLink = {
  id: string;
  title: string;
  summary?: string;
  /** In-site route. Null when metfix.org has no page for this tool yet. */
  href: string | null;
  /** When true, link is Pro-gated (show upgrade CTA for non-Pro). */
  proOnly?: boolean;
};

export type AppTool = {
  id: string;
  title: string;
  summary: string;
  /** Primary in-site route for the card. Null → shell / available-only. */
  href: string | null;
  /** When true, card is Pro-gated (show upgrade CTA for non-Pro). */
  proOnly?: boolean;
  /** Optional nested links (Belly / Body / Brain pillars). */
  links?: readonly AppToolLink[];
};

/**
 * Overview tools — 3 columns × 2 rows.
 * Row 1: Belly · Body · Brain
 * Row 2: Daily Fix Archive · My Data / Spark · Inbox
 */
export const METFIX_APP_TOOLS: readonly AppTool[] = [
  {
    id: "belly",
    title: "Belly",
    summary: "Meal plans, shopping cart, recipes, and coaching share tools.",
    href: "/account/meal-plans",
    proOnly: true,
    links: [
      {
        id: "meal-plans",
        title: "Meal Plans",
        summary: "Build, edit, and schedule hybrid meal plans.",
        href: "/account/meal-plans",
        proOnly: true,
      },
      {
        id: "shopping-cart",
        title: "Shopping Cart",
        summary: "Build, generate, and email grocery lists.",
        href: "/account/shopping-cart",
        proOnly: true,
      },
      {
        id: "my-meals",
        title: "My Meals",
        summary: "Logged meals and the custom recipe builder.",
        href: "/account/my-meals",
        proOnly: true,
      },
    ],
  },
  {
    id: "body",
    title: "Body",
    summary: "PRs, workout feed, and coaching in one place.",
    href: "/account/benchmarks",
    proOnly: true,
    links: [
      {
        id: "pr-tracking",
        title: "PR tracking",
        summary: "Lifts, tests, and markers.",
        href: "/account/benchmarks",
        proOnly: true,
      },
      {
        id: "workout-feed",
        title: "Workout feed",
        summary: "Logged sessions and consistency.",
        href: null,
        proOnly: true,
      },
      {
        id: "coaching",
        title: "Coaching",
        summary: "Coach notes and programming.",
        href: null,
        proOnly: true,
      },
    ],
  },
  {
    id: "brain",
    title: "Brain",
    summary: "Exclusive posts, saved items, and lists.",
    href: "/account/exclusive",
    proOnly: true,
    links: [
      {
        id: "exclusive-feed",
        title: "Exclusive feed",
        summary: "Posts exclusive to your access level.",
        href: "/account/exclusive",
        proOnly: true,
      },
      {
        id: "saved",
        title: "Saved",
        summary: "Articles, recipes, and workouts you kept.",
        href: "/account/favorites",
      },
      {
        id: "lists",
        title: "Lists",
        summary: "Collections you own, share, and subscribe to.",
        href: "/account/lists",
      },
    ],
  },
  {
    id: "daily-fix-archive",
    title: "Daily Fix Archive",
    summary:
      "Eat. Move. Think. A new recipe, workout, and reading each day — full archive for Pro.",
    href: "/the-daily-fix",
    proOnly: true,
  },
  {
    id: "spark",
    title: "My Data / Spark",
    summary: "Measurement history and PR overview from Spark.",
    href: "/account/spark",
    proOnly: true,
  },
  {
    id: "inbox",
    title: "Inbox",
    summary: "Conversations and in-app notifications.",
    href: "/account/inbox",
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

/** Whether a specific tool/link is open for this membership. */
export function toolUnlocked(
  tool: { proOnly?: boolean },
  tier: CanonicalSubscriptionTier,
): boolean {
  if (!tool.proOnly) return true;
  return metfixToolsUnlocked(tier);
}
