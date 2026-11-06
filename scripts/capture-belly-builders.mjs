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
  badges: { medical: true, affiliate: true, subscription: true, foundations_coach: true },
  canonical_tier: "organization_owner",
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
  has_physical_gym: true,
  has_physical_clinic: false,
  roles: [],
};
const subs = {
  canonical_tier: "organization_owner",
  items: [
    {
      sub_ref: "ref_owner_1",
      provider: "whop",
      tier: "organization_owner",
      status: "active",
      current_period_end: "2026-11-15T00:00:00.000Z",
      paid_through: "2026-11-15T00:00:00.000Z",
      cancel_at_period_end: false,
      can_open_portal: true,
      card: { brand: "visa", last4: "4242" },
    },
  ],
};

const recipes = {
  recipes: [
    {
      id: 99,
      title: "Flank steak bowl",
      macros: { protein: 52, fat: 30, carbs: 8 },
      ingredients: ["Flank steak", "Rice"],
      instructions: ["Sear", "Rest"],
    },
  ],
};

const library = {
  active: { used: [], saved_only: [] },
  inactive: {
    used: [],
    saved_only: [
      {
        id: 11,
        title: "High-protein week",
        duration_days: 7,
        status: "published",
        is_active: false,
        can_schedule: true,
        usage_status: "saved_only",
        days: [],
      },
    ],
  },
  meta: { active_count: 0, inactive_count: 1 },
};

const coachHub = {
  affiliates: [{ affiliate_id: 7, name: "MetFix HQ", role: "owner" }],
  clients: [
    {
      id: 3,
      status: "active",
      invited_by: "client",
      viewer_is_coach: true,
      counterparty: { user_id: "88", name: "Alex Client", display_name: "Alex Client" },
    },
  ],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

await page.route("**/api/**", async (route) => {
  const url = route.request().url();
  const method = route.request().method();
  const json = (body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.includes("/api/auth/me")) return json({ signed_in: true, public_name: "Ethan Rush" });
  if (url.includes("/api/account/overview")) return json(overview);
  if (url.includes("/api/account/subscriptions")) return json(subs);
  if (url.includes("/api/account/coaching/coach")) return json(coachHub);
  if (url.includes("/api/account/plans/library")) return json(library);
  if (url.includes("/api/account/plans/") && method === "GET") {
    return json({
      id: 11,
      title: "High-protein week",
      duration_days: 7,
      status: "published",
      is_active: false,
      can_schedule: true,
      days: [
        {
          id: 1,
          day_index: 0,
          items: [
            {
              id: 101,
              item_type: "meal",
              recipe_source_type: "custom_recipe",
              recipe_source_id: 99,
              servings: 1,
            },
          ],
        },
      ],
    });
  }
  if (url.includes("/api/account/plans") && method === "POST") {
    return json({ id: 12, plan_id: 12, title: "New plan" }, 201);
  }
  if (url.includes("/api/account/custom-recipes/") && method === "GET") {
    return json(recipes.recipes[0]);
  }
  if (url.includes("/api/account/custom-recipes") && method === "GET") return json(recipes);
  if (url.includes("/api/account/custom-recipes") && method === "POST") {
    return json({ id: 100, title: "New recipe" }, 201);
  }
  if (url.includes("/api/account/plans/") && url.includes("/acl") && method === "POST") {
    return json({ ok: true });
  }
  if (url.includes("/api/account/plans/") && url.includes("/schedule")) return json({ ok: true });
  if (url.includes("/api/account/plans/") && url.includes("/active")) return json({ id: 11 });
  if (url.includes("/api/account/plans/") && url.includes("/publish")) return json({ id: 11 });
  if (url.includes("/api/account/ltv") || url.includes("/api/account/spend")) {
    return json({
      total_ltv_cents: 30000,
      claimed_courses_value_cents: 20000,
      available_certificate_ltv_cents: 10000,
      claimed_certificates: [],
      canonical_tier: "organization_owner",
    });
  }
  if (url.includes("/api/account/meals")) return json({ meals: [], grouped_by_date: {} });
  if (url.includes("/api/account/macros/range")) return json({ entries: [] });
  return json({ error: "not_found" }, 404);
});

for (const [path, name] of [
  ["/account/meal-plans", "belly_plans_coaching"],
  ["/account/meal-plans/new", "belly_plan_builder"],
  ["/account/my-meals", "belly_my_meals_recipes"],
  ["/account/my-meals/recipes/new", "belly_recipe_builder"],
]) {
  await page.goto(`http://127.0.0.1:5173${path}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  const text = await page.locator("body").innerText();
  const ok = !text.includes("Something went wrong");
  console.log(name, "ok=", ok, "hasCoach=", text.includes("Coaching tools"), "hasCreate=", text.includes("Create"));
  const dest = `${out}/${name}.png`;
  await page.screenshot({ path: dest, fullPage: true });
  await copyFile(dest, `${artifacts}/${name}.png`);
}

await browser.close();
