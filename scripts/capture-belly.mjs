import { chromium } from "@playwright/test";
import { mkdir, copyFile } from "node:fs/promises";

const out =
  "/cursor/stores/bc-2beac79b-9400-4a59-9c4f-471d3f80a3a8/media/dashboard-redesign";
const artifacts = "/opt/cursor/artifacts";
await mkdir(out, { recursive: true });
await mkdir(artifacts, { recursive: true });

const overview = {
  user_id: 1,
  member_id: 42,
  display_name: "Ethan Rush",
  email: "ethan@metfix.org",
  member_since: "2024-01-01T00:00:00.000Z",
  badges: { medical: true, affiliate: false, subscription: true, foundations_coach: true },
  canonical_tier: "metfix_pro",
  foundations_coach: {
    active: true,
    grant_reason: "in_person_seminar",
    granted_at: "2026-01-15T00:00:00.000Z",
    expires_at: "2029-01-15T00:00:00.000Z",
    seminar_checked_in: true,
    metfix_essentials_completed: false,
    metfix_essentials_certificate_claimed: false,
  },
  tabs: ["referrals"],
  links: {},
  avatar_url: null,
  onboarding_roles: ["individual"],
  has_physical_gym: false,
  has_physical_clinic: false,
  roles: [],
};
const subs = {
  canonical_tier: "metfix_pro",
  items: [
    {
      sub_ref: "ref_pro_1",
      provider: "whop",
      tier: "metfix_pro",
      status: "active",
      current_period_end: "2026-11-15T00:00:00.000Z",
      paid_through: "2026-11-15T00:00:00.000Z",
      cancel_at_period_end: false,
      can_open_portal: true,
      card: { brand: "visa", last4: "4242" },
    },
  ],
};

const plan = {
  id: 11,
  title: "High-protein week",
  description: "Seven days of metabolic meals",
  duration_days: 7,
  status: "published",
  is_active: true,
  times_scheduled: 2,
  usage_status: "used",
  can_schedule: true,
  days: [
    {
      id: 1,
      day_index: 0,
      items: [
        {
          id: 101,
          item_type: "meal",
          label: "Steak & greens",
          recipe_source_type: "daily_mod",
          recipe_source_id: 3,
        },
      ],
    },
  ],
};

const library = {
  active: { used: [plan], saved_only: [] },
  inactive: {
    used: [],
    saved_only: [
      {
        id: 12,
        title: "Travel week",
        duration_days: 5,
        status: "draft",
        is_active: false,
        usage_status: "saved_only",
        can_schedule: false,
      },
    ],
  },
  meta: { active_count: 1, inactive_count: 1 },
};

const meals = {
  meals: [
    {
      id: 1,
      date: "2026-11-06",
      slot_index: 1,
      recipe_source_type: "daily_mod",
      recipe_source_id: 3,
      label: null,
      notes: null,
      logged: 0,
      recipe_preview: {
        title: "Chicken-Wrapped Asparagus",
        photo_url: null,
        macros: { protein: 48, fat: 28, carbs: 6 },
      },
    },
  ],
  grouped_by_date: {
    "2026-11-06": [
      {
        id: 1,
        date: "2026-11-06",
        slot_index: 1,
        recipe_source_type: "daily_mod",
        recipe_source_id: 3,
        label: null,
        notes: null,
        logged: 0,
        recipe_preview: {
          title: "Chicken-Wrapped Asparagus",
          photo_url: null,
          macros: { protein: 48, fat: 28, carbs: 6 },
        },
      },
    ],
  },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

await page.route("**/api/**", async (route) => {
  const url = route.request().url();
  const method = route.request().method();
  const json = (body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.includes("/api/auth/me")) return json({ signed_in: true, public_name: "Ethan Rush" });
  if (url.includes("/api/account/overview")) return json(overview);
  if (url.includes("/api/account/subscriptions")) return json(subs);
  if (url.includes("/api/account/ltv") || url.includes("/api/account/spend")) {
    return json({
      total_ltv_cents: 30000,
      claimed_courses_value_cents: 20000,
      available_certificate_ltv_cents: 10000,
      claimed_certificates: [],
      canonical_tier: "metfix_pro",
    });
  }
  if (url.includes("/api/account/calendar/surface")) {
    return json({
      meal_counts: { "2026-11-06": 1 },
      workout_counts: {},
      brain_counts: {},
      event_counts: {},
    });
  }
  if (url.includes("/api/account/plans/library")) return json(library);
  if (url.includes("/api/account/plans/11")) return json(plan);
  if (url.includes("/api/account/plans/") && method === "POST") return json(plan);
  if (url.includes("/api/account/plans/") && method === "PATCH") return json(plan);
  if (url.includes("/api/account/meals/upcoming")) {
    return json({ meals: [], meta: { count: 0, total: 0, limit: 40, offset: 0, has_more: false } });
  }
  if (url.includes("/api/account/meals")) return json(meals);
  if (url.includes("/api/account/macros/range")) {
    return json({
      entries: [
        {
          date: "2026-11-06",
          meals: [{ mealTitle: "Greek yogurt bowl", macros: { protein: 36, fat: 12, carbs: 22 } }],
        },
      ],
    });
  }
  if (url.includes("/api/account/custom-recipes")) {
    return json({ recipes: [{ id: 99, title: "Flank steak bowl", macros: { protein: 52, fat: 30, carbs: 8 } }] });
  }
  if (url.includes("/api/account/shopping-lists/generated-dates")) return json({ dates: ["2026-11-03"] });
  if (url.includes("/api/account/shopping-lists/") && url.includes("/generate")) {
    return json({
      success: true,
      list: {
        id: 9,
        title: "Cart",
        status: "generated",
        items_by_category: { Produce: [{ id: 1, item_name: "Asparagus", quantity: "1 lb", sort_order: 0 }] },
      },
    });
  }
  if (url.includes("/api/account/shopping-lists/") && url.includes("/email")) {
    return json({ success: true, emailed_to: "ethan@metfix.org" });
  }
  if (url.includes("/api/account/shopping-lists") && method === "POST") {
    return json({ id: 9, title: "Cart", status: "created", dates: [], meals: [], items: [] }, 201);
  }
  if (url.includes("/api/account/shopping-lists")) return json({ lists: [{ id: 9, title: "Week list", status: "generated" }] });
  return json({ error: "not_found" }, 404);
});

for (const [path, name] of [
  ["/account", "belly_overview_forkknife"],
  ["/account/meal-plans", "belly_meal_plans"],
  ["/account/shopping-cart", "belly_shopping_cart"],
  ["/account/my-meals", "belly_my_meals"],
]) {
  await page.goto(`http://127.0.0.1:4173${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1400);
  const dest = `${out}/${name}.png`;
  await page.screenshot({ path: dest, fullPage: true });
  await copyFile(dest, `${artifacts}/${name}.png`);
  console.log("saved", name, page.url());
}

await browser.close();
