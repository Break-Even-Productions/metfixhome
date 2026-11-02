import type {
  AccountOverview,
  AccountSubscriptions,
  CoursesPage,
  LtvCertificates,
  PaymentsPage,
} from "@/lib/account";

export const COACH_NONE = {
  active: false,
  grant_reason: null,
  granted_at: null,
  expires_at: null,
  seminar_checked_in: false,
  metfix_essentials_completed: false,
  metfix_essentials_certificate_claimed: false,
} as const;

export const COACH_ACTIVE = {
  active: true,
  grant_reason: "in_person_seminar" as const,
  granted_at: "2026-01-15T00:00:00.000Z",
  expires_at: "2029-01-15T00:00:00.000Z",
  seminar_checked_in: true,
  metfix_essentials_completed: false,
  metfix_essentials_certificate_claimed: false,
};

export const OVERVIEW_FIXTURE: AccountOverview = {
  user_id: 1,
  member_id: 42,
  display_name: "Ada Lovelace",
  email: "ada@example.com",
  member_since: "2024-01-01T00:00:00.000Z",
  badges: {
    medical: false,
    affiliate: true,
    subscription: true,
    foundations_coach: true,
  },
  canonical_tier: "metfix_pro",
  foundations_coach: COACH_ACTIVE,
  tabs: [],
  links: {},
};

export const SUBS_ACTIVE: AccountSubscriptions = {
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

export const LTV300_AC: LtvCertificates = {
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
    {
      course_id: 30,
      course_slug: "course-c",
      course_title: "Course C",
      allocated_cents: 5000,
      claimed_at: "2026-02-02T00:00:00.000Z",
      claim_method: "redeem_ltv",
    },
  ],
  canonical_tier: "metfix_pro",
  foundations_coach: COACH_ACTIVE,
};

export const COURSES_LTV300: CoursesPage = {
  page: 1,
  per_page: 20,
  total: 3,
  items: [
    {
      id: 10,
      slug: "course-a",
      title: "Course A",
      progress_percent: 100,
      completed: true,
      is_metfix_essentials: false,
      course_price_cents: 15000,
      included_with_subscription: true,
      purchased_directly: false,
      certificate_claimed: true,
      certificate_claim_method: "redeem_ltv",
      certificate_url: null,
    },
    {
      id: 20,
      slug: "course-b",
      title: "Course B",
      progress_percent: 100,
      completed: true,
      is_metfix_essentials: false,
      course_price_cents: 20000,
      included_with_subscription: true,
      purchased_directly: false,
      certificate_claimed: false,
      certificate_claim_method: null,
      certificate_url: null,
    },
    {
      id: 30,
      slug: "course-c",
      title: "Course C",
      progress_percent: 100,
      completed: true,
      is_metfix_essentials: false,
      course_price_cents: 5000,
      included_with_subscription: true,
      purchased_directly: false,
      certificate_claimed: true,
      certificate_claim_method: "redeem_ltv",
      certificate_url: null,
    },
  ],
};

export const PAYMENTS_PAGE1: PaymentsPage = {
  page: 1,
  per_page: 20,
  total: 25,
  items: [
    {
      id: 1,
      created_at: "2026-03-01T12:00:00.000Z",
      description: "MetFix Pro",
      amount_cents: 1234,
      currency: "usd",
      provider: "whop",
      status: "paid",
      receipt_url: "https://billing.stripe.com/receipt/1",
    },
  ],
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
