import { chromium } from "@playwright/test";
import { mkdir, writeFile, copyFile } from "node:fs/promises";

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
  badges: {
    medical: true,
    affiliate: false,
    subscription: true,
    foundations_coach: true,
  },
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
  onboarding_roles: ["individual", "clinician"],
  has_physical_gym: false,
  has_physical_clinic: true,
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
      card: { brand: "visa", last4: "4242" },
    },
  ],
};

const ltv = {
  total_ltv_cents: 30000,
  claimed_courses_value_cents: 20000,
  available_certificate_ltv_cents: 10000,
  claimed_certificates: [
    {
      course_id: 10,
      course_slug: "course-a",
      course_title: "Course A",
      allocated_cents: 15000,
      claimed_at: "2026-02-01T00:00:00.000Z",
      claim_method: "redeem_ltv",
    },
  ],
  canonical_tier: "metfix_pro",
  foundations_coach: overview.foundations_coach,
};

const courses = {
  page: 1,
  per_page: 20,
  total: 2,
  items: [
    {
      id: 10,
      slug: "course-a",
      title: "MetFix Essentials",
      progress_percent: 100,
      completed: true,
      is_metfix_essentials: true,
      course_price_cents: 15000,
      included_with_subscription: true,
      purchased_directly: false,
      certificate_claimed: true,
      certificate_claim_method: "redeem_ltv",
      certificate_url: "https://example.com/cert",
    },
    {
      id: 20,
      slug: "course-b",
      title: "Women's Health",
      progress_percent: 40,
      completed: false,
      is_metfix_essentials: false,
      course_price_cents: 20000,
      included_with_subscription: true,
      purchased_directly: false,
      certificate_claimed: false,
      certificate_claim_method: null,
      certificate_url: null,
    },
  ],
};

const referrals = {
  eligible: true,
  eligibility_type: "organization",
  reason_code: null,
  payee_display_name: "Ethan Rush",
  foundations_coach_expires_at: null,
  join_code: {
    slug: "ethan",
    whop_affiliate_code: "aff_ethan",
    join_url: "https://metfix.org/join?ref=ethan",
    commission_percent: 20,
    commission_bps: 2000,
  },
  course_links: [
    {
      course_id: 10,
      course_slug: "course-a",
      course_title: "MetFix Essentials",
      course_price_cents: 15000,
      currency: "usd",
      commission_percent: 20,
      commission_bps: 2000,
      estimated_commission_cents: 3000,
      bsi_ref_slug: "ethan",
      whop_affiliate_code: "aff_ethan",
      whop_plan_id: "plan_abc",
      share_url: "https://whop.com/checkout/plan_abc?aff=ethan",
    },
  ],
  course_links_dropped: 0,
  join_code_dropped: false,
  earnings: {
    pending_cents: 750,
    ready_cents: 0,
    paid_total_cents: 0,
    currency: "usd",
    connect_status: "none",
  },
};

const profile = {
  first_name: "Ethan",
  last_name: "Rush",
  display_name: "Ethan Rush",
  bio: "",
  location: "",
  credentials: "",
  community_opt_in: true,
  avatar_url: null,
  attributes: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

await page.route("**/api/**", async (route) => {
  const url = route.request().url();
  const json = (body, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  if (url.includes("/api/auth/me")) {
    return json({ signed_in: true, public_name: "Ethan Rush", moderator: false });
  }
  if (url.includes("/api/account/overview")) return json(overview);
  if (url.includes("/api/account/subscriptions")) return json(subs);
  if (url.includes("/api/account/ltv") || url.includes("/api/account/spend")) return json(ltv);
  if (url.includes("/api/account/courses")) return json(courses);
  if (url.includes("/api/account/referrals") || url.includes("/api/account/course-referrals"))
    return json(referrals);
  if (url.includes("/api/account/course-gifts")) return json({ items: [] });
  if (url.includes("/api/account/profile")) return json(profile);
  if (url.includes("/api/account/favorites")) return json({ items: [] });
  if (url.includes("/api/account/notifications")) return json({ preferences: {} });
  if (url.includes("/api/account/privacy")) return json({ directory_visible: true });
  return json({ error: "not_found" }, 404);
});

for (const [path, name] of [
  ["/account", "new_dashboard_overview"],
  ["/account/benchmarks", "new_dashboard_benchmarks"],
  ["/account/meals", "new_dashboard_meals"],
  ["/account/profile", "new_dashboard_profile"],
  ["/account/courses", "new_dashboard_courses"],
  ["/account/referrals", "new_dashboard_referrals"],
]) {
  await page.goto(`http://127.0.0.1:4173${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".account-shell, .dash-greet, .dash-tool-hero", { timeout: 15000 });
  await page.waitForTimeout(800);
  const dest = `${out}/${name}.png`;
  await page.screenshot({ path: dest, fullPage: true });
  await copyFile(dest, `${artifacts}/${name}.png`);
  console.log("saved", name, page.url());
}

await browser.close();
