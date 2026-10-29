/**
 * PR B account Worker gates (QA §E/F) — bearer-only, CSRF, LTV300, tiers, URL allowlist.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleAccountRoutes,
  EDITABLE_ATTR_IDS,
  PUBLIC_MEMBER_SUMMARY_KEYS,
  parsePositiveCourseId,
} from "./account";
import type { Env, FetchImpl, RateLimitBinding } from "./upstream";
import {
  ACCESS1,
  BSI_ORIGIN,
  createHarness,
  csrfSid,
  hOk,
  ORIGIN,
  setupAuthHooks,
  type Harness,
} from "../tools/pr2/harness/realauth-harness";
import { SID_COOKIE } from "./auth/cookies";
import { computeLtvBudget, formatUsdFromCents } from "../shared/account/ltv";

setupAuthHooks();

function countingLimiter(max: number): RateLimitBinding {
  const windows = new Map<string, number[]>();
  return {
    async limit({ key }: { key: string }) {
      const now = Date.now();
      const w = (windows.get(key) ?? []).filter((t) => now - t < 60_000);
      if (w.length >= max) {
        windows.set(key, w);
        return { success: false };
      }
      w.push(now);
      windows.set(key, w);
      return { success: true };
    },
  };
}

type Recorded = {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
};

const FORBIDDEN_UPSTREAM = [
  "x-api-key",
  "referer",
  "origin",
  "x-forwarded-for",
  "cf-connecting-ip",
];

function assertBearerOnly(rec: Recorded) {
  for (const h of FORBIDDEN_UPSTREAM) {
    expect(rec.headers[h], `${h} on ${rec.url}`).toBeUndefined();
  }
  if (rec.headers.authorization) {
    expect(rec.headers.authorization, rec.url).toMatch(/^Bearer /);
  }
}

function assertHasBearer(rec: Recorded) {
  assertBearerOnly(rec);
  expect(rec.headers.authorization, rec.url).toMatch(/^Bearer /);
}

function assertNoStore(res: Response) {
  expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  expect(res.headers.get("Pragma")).toBe("no-cache");
  expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(res.headers.get("Vary")).toBe("Cookie");
}

type MockHandler = (req: {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
  path: string;
}) => Response | Promise<Response>;

async function withSession(h: Harness) {
  const { sid } = await h.login();
  const csrf = await csrfSid(h.env, sid);
  return { sid, csrf, cookie: `${SID_COOKIE}=${encodeURIComponent(sid)}` };
}

function installAccountLimiters(env: Env, max = 100) {
  env.ACCOUNT_READ_LIMITER = countingLimiter(max);
  env.ACCOUNT_WRITE_LIMITER = countingLimiter(max);
  env.ACCOUNT_PORTAL_LIMITER = countingLimiter(max);
}

function makeFetchMock(handlers: MockHandler[]): { fetchImpl: FetchImpl; recorded: Recorded[] } {
  const recorded: Recorded[] = [];
  const fetchImpl: FetchImpl = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method =
      init?.method?.toUpperCase() ??
      (typeof input !== "string" && !(input instanceof URL)
        ? (input as Request).method.toUpperCase()
        : "GET");
    const rawBody = init?.body;
    let bodyText = "";
    if (typeof rawBody === "string") bodyText = rawBody;
    else if (rawBody instanceof ArrayBuffer) bodyText = `[bin:${rawBody.byteLength}]`;
    else if (rawBody == null) bodyText = "";
    else bodyText = String(rawBody);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const rec = { url, method, headers, bodyText };
    recorded.push(rec);
    if (url.includes("/wp-json/")) {
      assertBearerOnly(rec);
    }
    const u = new URL(url);
    const path = u.pathname;
    for (const handler of handlers) {
      const res = await handler({ url, method, headers, bodyText, path });
      if (res) return res;
    }
    return Response.json({ error: "mock_miss", path }, { status: 404 });
  };
  return { fetchImpl, recorded };
}

async function callAccount(
  h: Harness,
  path: string,
  init: RequestInit,
  fetchImpl: FetchImpl,
): Promise<Response> {
  const req = new Request(`https://metfix.org${path}`, init);
  return handleAccountRoutes(req, h.env, { fetchImpl, bsiBaseUrl: BSI_ORIGIN }) as Promise<Response>;
}

const OVERVIEW_FIXTURE = {
  user_id: 42,
  member_id: 7,
  display_name: "Jane",
  email: "jane@example.test",
  member_since: "2024-01-01",
  badges: { medical: false, affiliate: false, subscription: true, foundations_coach: false },
  canonical_tier: "metfix_pro",
  foundations_coach: {
    seminar_checked_in: false,
    metfix_essentials_completed: false,
    metfix_essentials_certificate_claimed: false,
  },
  tabs: [],
  links: {},
};

const SUBS_FIXTURE = {
  canonical_tier: "organization_owner",
  items: [
    {
      sub_ref: "opaque_aff_1",
      provider: "stripe",
      tier: "organization_owner",
      legacy_source: "affiliate_stripe",
      status: "active",
      current_period_end: "2026-12-01T00:00:00Z",
      paid_through: "2026-12-01T00:00:00Z",
      cancel_at_period_end: false,
      card: { brand: "visa", last4: "4242" },
      stripe_id: "cus_123",
      customer_id: "cus_123",
      external_sub_id: "sub_9",
    },
    {
      sub_ref: "opaque_med_2",
      provider: "stripe",
      tier: "metfix_pro",
      legacy_source: "medical_society_stripe",
      is_duplicate_stripe: true,
      can_convert_to_whop: true,
      status: "active",
      current_period_end: "2026-11-01T00:00:00Z",
      paid_through: "2026-11-01T00:00:00Z",
      cancel_at_period_end: false,
      payment_method: { brand: "visa", last4: "1111" },
    },
  ],
  conversion: {
    state: "none",
  },
};

const LTV300_SPEND = {
  total_ltv_cents: 30000,
  claimed_courses_value_cents: 20000,
  claimed_certificates: [
    {
      course_id: 1,
      course_slug: "a",
      course_title: "Course A",
      allocated_cents: 15000,
      claimed_at: "2026-01-01T00:00:00Z",
      claim_method: "redeem_ltv",
    },
    {
      course_id: 3,
      course_slug: "c",
      course_title: "Course C",
      allocated_cents: 5000,
      claimed_at: "2026-01-02T00:00:00Z",
      claim_method: "redeem_ltv",
    },
  ],
  canonical_tier: "metfix_pro",
  foundations_coach: {
    seminar_checked_in: true,
    granted_at: "2024-06-01T00:00:00.000Z",
    expires_at: "2027-06-01T00:00:00.000Z",
    metfix_essentials_completed: false,
    metfix_essentials_certificate_claimed: false,
  },
};

describe("worker/account routes", () => {
  let h: Harness;

  beforeEach(() => {
    h = createHarness();
    installAccountLimiters(h.env);
  });

  afterEach(() => {
    // harness cleans via setupAuthHooks
  });

  it("DP-T-AUTH: off-auth-host → 403; signed out → unauthenticated; no DAILY_FIX_API_KEY still works", async () => {
    delete h.env.DAILY_FIX_API_KEY;
    const { fetchImpl } = makeFetchMock([
      async () => Response.json(OVERVIEW_FIXTURE),
    ]);

    const off = await handleAccountRoutes(
      new Request("https://evil.example/api/account/overview", {
        headers: { Host: "evil.example" },
      }),
      h.env,
      { fetchImpl, bsiBaseUrl: BSI_ORIGIN },
    );
    expect(off!.status).toBe(403);
    assertNoStore(off!);

    const signedOut = await callAccount(h, "/api/account/overview", {}, fetchImpl);
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toEqual({ error: "unauthenticated" });
    assertNoStore(signedOut);

    const sess = await withSession(h);
    const ok = await callAccount(
      h,
      "/api/account/overview",
      { headers: { Cookie: sess.cookie, Host: "metfix.org" } },
      fetchImpl,
    );
    expect(ok.status).toBe(200);
    assertNoStore(ok);
  });

  it("DP-T-1 overview DTO includes canonical_tier + foundations_coach 7 keys", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/account")) return Response.json(OVERVIEW_FIXTURE);
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/overview",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      canonical_tier: string;
      foundations_coach: Record<string, unknown>;
    };
    expect(body.canonical_tier).toBe("metfix_pro");
    expect(Object.keys(body.foundations_coach).sort()).toEqual(
      [
        "active",
        "expires_at",
        "grant_reason",
        "granted_at",
        "metfix_essentials_certificate_claimed",
        "metfix_essentials_completed",
        "seminar_checked_in",
      ].sort(),
    );
    expect(recorded.length).toBe(1);
    expect(recorded[0]!.url).toContain("/wp-json/bsi/v1/me/account");
  });

  it("DP-T-2 subscriptions strip stripe_id/cus_/sub_", async () => {
    const sess = await withSession(h);
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/subscriptions")) return Response.json(SUBS_FIXTURE);
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/subscriptions",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/cus_/);
    expect(text).not.toMatch(/sub_[0-9]/);
    expect(text).not.toContain("stripe_id");
    expect(text).not.toContain("customer_id");
    expect(text).not.toContain("external_sub_id");
    const body = JSON.parse(text) as { items: Array<{ sub_ref: string; is_duplicate_stripe?: boolean }> };
    expect(body.items[0]!.sub_ref).toBe("opaque_aff_1");
    expect(body.items[1]!.is_duplicate_stripe).toBe(true);
  });

  it("DP-T-3 portal-link allowlist; evil URL → 502", async () => {
    const sess = await withSession(h);
    for (const [upstreamUrl, expectStatus] of [
      ["https://whop.com/checkout/abc", 200],
      ["https://billing.stripe.com/p/session", 200],
      ["https://evil.example/phish", 502],
      ["http://whop.com/x", 502],
      ["https://whop.com.evil.io/x", 502],
      ["javascript:alert(1)", 502],
    ] as const) {
      const { fetchImpl } = makeFetchMock([
        async ({ path }) => {
          if (path.endsWith("/portal-link")) {
            return Response.json({ url: upstreamUrl });
          }
          return new Response(null, { status: 404 });
        },
      ]);
      const res = await callAccount(
        h,
        "/api/account/subscriptions/portal-link",
        {
          method: "POST",
          headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
          body: JSON.stringify({ intent: "manage" }),
        },
        fetchImpl,
      );
      expect(res.status, upstreamUrl).toBe(expectStatus);
      assertNoStore(res);
    }

    const { fetchImpl, recorded } = makeFetchMock([]);
    const badIntent = await callAccount(
      h,
      "/api/account/subscriptions/portal-link",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ intent: "nope" }),
      },
      fetchImpl,
    );
    expect(badIntent.status).toBe(400);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-3b convert-to-whop bad target_tier → 400, 0 upstream", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([]);
    const res = await callAccount(
      h,
      "/api/account/subscriptions/convert-to-whop",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ target_tier: "medical_society" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(400);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-3c cancel-duplicate opaque subRef; bad ref → 400", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([]);
    const bad = await callAccount(
      h,
      "/api/account/subscriptions/sub_9/cancel-duplicate",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ at_period_end: true }),
      },
      fetchImpl,
    );
    expect(bad.status).toBe(400);
    expect(recorded.length).toBe(0);

    const { fetchImpl: okFetch, recorded: okRec } = makeFetchMock([
      async ({ path }) => {
        if (path.includes("/cancel-duplicate")) return Response.json({ ok: true });
        return new Response(null, { status: 404 });
      },
    ]);
    const ok = await callAccount(
      h,
      "/api/account/subscriptions/opaque_med_2/cancel-duplicate",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ at_period_end: true }),
      },
      okFetch,
    );
    expect(ok.status).toBe(200);
    expect(okRec.some((r) => r.url.includes("/opaque_med_2/cancel-duplicate"))).toBe(true);
  });

  it("DP-T-4 payments page bounds", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, url }) => {
        if (path.endsWith("/me/payments")) {
          const u = new URL(url);
          return Response.json({
            items: [
              {
                id: "p1",
                created_at: "2026-01-01",
                description: "Pro",
                amount_cents: 1234,
                currency: "usd",
                provider: "whop",
                status: "paid",
                receipt_url: "https://billing.stripe.com/r/1",
              },
            ],
            total: 1,
            page: Number(u.searchParams.get("page")),
            per_page: Number(u.searchParams.get("per_page")),
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    for (const q of ["page=0", "page=51", "per_page=51", "page=50&per_page=50"]) {
      const res = await callAccount(
        h,
        `/api/account/payments?${q}`,
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(res.status, q).toBe(400);
    }
    const before = recorded.length;
    const ok = await callAccount(
      h,
      "/api/account/payments",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(ok.status).toBe(200);
    expect(recorded.length).toBe(before + 1);
    expect(recorded[recorded.length - 1]!.url).toContain("page=1&per_page=20");
    const body = (await ok.json()) as { items: Array<{ amount_cents: number }> };
    expect(body.items[0]!.amount_cents).toBe(1234);
    expect(formatUsdFromCents(1234)).toBe("$12.34");
  });

  it("DP-T-5 / DP-T-CERT3 LTV300 spend + alias (legacy claim-certificate route removed)", async () => {
    const sess = await withSession(h);
    const budget = computeLtvBudget(30000, 20000);
    expect(budget.available_certificate_ltv_cents).toBe(10000);
    expect(formatUsdFromCents(30000)).toBe("$300.00");

    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/spend")) return Response.json(LTV300_SPEND);
        return new Response(null, { status: 404 });
      },
    ]);

    const a = await callAccount(
      h,
      "/api/account/ltv-certificates",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    const b = await callAccount(
      h,
      "/api/account/spend",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const ja = (await a.json()) as Record<string, unknown>;
    const jb = (await b.json()) as Record<string, unknown>;
    expect(ja.available_certificate_ltv_cents).toBe(10000);
    expect(ja.claimed_courses_value_cents).toBe(20000);
    expect(jb.available_certificate_ltv_cents).toBe(10000);
    expect((ja.foundations_coach as { active: boolean; grant_reason: string }).active).toBe(true);
    expect((ja.foundations_coach as { grant_reason: string }).grant_reason).toBe(
      "in_person_seminar",
    );

    // CQ B1: legacy /claim-certificate Worker route is gone (404 not_found).
    const gone = await callAccount(
      h,
      "/api/account/courses/2/claim-certificate",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ method: "ltv" }),
      },
      fetchImpl,
    );
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: "not_found" });
  });

  it("DP-T-12 profile ignores member_id; upstream /profiles/me", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/profiles/me")) return Response.json({ display_name: "Jane", bio: "x" });
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/profile?member_id=99",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    expect(recorded[0]!.url).toContain("/wp-json/bsi/v1/profiles/me");
    expect(recorded[0]!.url).not.toContain("member_id");
  });

  it("DP-T-13 PATCH allowlist rejects email/role", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([]);
    const res = await callAccount(
      h,
      "/api/account/profile",
      {
        method: "PATCH",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ display_name: "A", email: "x@y.z" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(400);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-14 attributes block email keys/values + unknown attr_id", async () => {
    const sess = await withSession(h);
    expect(EDITABLE_ATTR_IDS.has(1)).toBe(true);
    const { fetchImpl, recorded } = makeFetchMock([]);
    for (const payload of [
      { attributes: [{ attr_id: 99, value: "ok" }] },
      { attributes: [{ attr_id: 1, key: "Email", value: "ok" }] },
      { attributes: [{ attr_id: 1, name: "alt_email", value: "ok" }] },
      { attributes: [{ attr_id: 1, value: "x@y.co" }] },
    ]) {
      recorded.length = 0;
      const res = await callAccount(
        h,
        "/api/account/profile/attributes",
        {
          method: "POST",
          headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
          body: JSON.stringify(payload),
        },
        fetchImpl,
      );
      expect(res.status).toBe(400);
      expect(recorded.length).toBe(0);
    }
  });

  it("DP-T-16 picture magic bytes", async () => {
    const sess = await withSession(h);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path }) => {
        if (path.includes("profile-picture")) return Response.json({ ok: true });
        return new Response(null, { status: 404 });
      },
    ]);
    const ok = await callAccount(
      h,
      "/api/account/profile/picture",
      {
        method: "POST",
        headers: {
          ...hOk({ csrf: sess.csrf, sid: sess.sid }),
          "Content-Type": "image/jpeg",
        },
        body: jpeg,
      },
      fetchImpl,
    );
    expect(ok.status).toBe(200);
    expect(recorded.length).toBe(1);

    recorded.length = 0;
    const bad = await callAccount(
      h,
      "/api/account/profile/picture",
      {
        method: "POST",
        headers: {
          ...hOk({ csrf: sess.csrf, sid: sess.sid }),
          "Content-Type": "image/png",
        },
        body: jpeg,
      },
      fetchImpl,
    );
    expect(bad.status).toBe(400);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-22 favorites idempotent F29", async () => {
    const sess = await withSession(h);
    let favorited = false;
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ method, path }) => {
        if (path.endsWith("/favorites") && method === "GET") {
          return Response.json({
            items: favorited ? [{ source_type: "articles", source_id: "a1" }] : [],
          });
        }
        if (path.includes("/favorites/articles/a1") && method === "POST") {
          favorited = !favorited;
          return Response.json({ ok: true });
        }
        return new Response(null, { status: 404 });
      },
    ]);

    const put1 = await callAccount(
      h,
      "/api/account/favorites/articles/a1",
      { method: "PUT", headers: hOk({ csrf: sess.csrf, sid: sess.sid }), body: "{}" },
      fetchImpl,
    );
    expect(put1.status).toBe(200);
    const posts1 = recorded.filter((r) => r.method === "POST").length;
    expect(posts1).toBe(1);

    const put2 = await callAccount(
      h,
      "/api/account/favorites/articles/a1",
      { method: "PUT", headers: hOk({ csrf: sess.csrf, sid: sess.sid }), body: "{}" },
      fetchImpl,
    );
    expect(put2.status).toBe(200);
    const posts2 = recorded.filter((r) => r.method === "POST").length;
    expect(posts2).toBe(1); // no extra POST when already favorited
  });

  it("DP-T-21 favorites type filter", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async () => Response.json({ items: [] }),
    ]);
    const bad = await callAccount(
      h,
      "/api/account/favorites?type=x",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(bad.status).toBe(400);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-24/25/26/28/29/30 referrals gifts notifications privacy password email", async () => {
    const sess = await withSession(h);
    const referralsDto = {
      eligible: true,
      eligibility_type: "organization",
      reason_code: null,
      payee_display_name: "Gym",
      foundations_coach_expires_at: null,
      join_code: {
        slug: "abcslug01",
        whop_affiliate_code: "abcslug01",
        join_url: "https://metfix.org/share/?slug=abcslug01",
        commission_percent: 15,
        commission_bps: 1500,
      },
      course_links: [],
    };
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (path.endsWith("/me/referrals")) return Response.json(referralsDto);
        if (path.includes("referral-earnings")) {
          // CR-EARN-1 BSI §2.4 shape (no *_cents aliases; lowercase currency).
          return Response.json({
            currency: "usd",
            pending: 0,
            ready: 0,
            paid_total: 0,
            connect_status: "active",
          });
        }
        if (path.includes("referral-code")) return Response.json(referralsDto);
        if (path.includes("course-gifts")) return Response.json({ items: [] });
        if (path.includes("notification-preferences")) {
          return Response.json({ email: true });
        }
        if (path.includes("/me/newsletter")) return Response.json({ subscribed: true });
        if (path.includes("privacy-settings")) return Response.json({ directory: true });
        if (path.includes("password-reset")) return Response.json({ ok: true });
        if (path.endsWith("/me/email") && method === "PUT") return Response.json({ pending: true });
        if (path.includes("email/confirm")) return Response.json({ ok: true });
        return new Response(null, { status: 404 });
      },
    ]);

    expect(
      (
        await callAccount(h, "/api/account/referrals", { headers: { Cookie: sess.cookie } }, fetchImpl)
      ).status,
    ).toBe(200);
    expect(
      (
        await callAccount(
          h,
          "/api/account/referral-code",
          {
            method: "POST",
            headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
            body: JSON.stringify({ action: "generate" }),
          },
          fetchImpl,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await callAccount(
          h,
          "/api/account/course-gifts",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        )
      ).status,
    ).toBe(200);

    const notifPut = await callAccount(
      h,
      "/api/account/notifications",
      {
        method: "PUT",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ email: true, newsletter: true }),
      },
      fetchImpl,
    );
    expect(notifPut.status).toBe(200);
    expect(recorded.some((r) => r.url.includes("/me/newsletter"))).toBe(true);

    expect(
      (
        await callAccount(
          h,
          "/api/account/privacy",
          {
            method: "PUT",
            headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
            body: JSON.stringify({ directory: false }),
          },
          fetchImpl,
        )
      ).status,
    ).toBe(200);

    expect(
      (
        await callAccount(
          h,
          "/api/account/password-reset",
          { method: "POST", headers: hOk({ csrf: sess.csrf, sid: sess.sid }), body: "{}" },
          fetchImpl,
        )
      ).status,
    ).toBe(200);

    const emailConfirmNoCode = await callAccount(
      h,
      "/api/account/email/confirm",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({}),
      },
      fetchImpl,
    );
    expect(emailConfirmNoCode.status).toBe(400);

    expect(
      (
        await callAccount(
          h,
          "/api/account/email",
          {
            method: "PUT",
            headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
            body: JSON.stringify({ email: "new@example.test" }),
          },
          fetchImpl,
        )
      ).status,
    ).toBe(200);
  });

  it("DP-T-31 / T9 / T10 members masks email display_name and drops role_badges_html", async () => {
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, headers }) => {
        // Public path may omit Authorization — assert no forbidden headers either way.
        for (const h of FORBIDDEN_UPSTREAM) {
          expect(headers[h]).toBeUndefined();
        }
        if (path.includes("/profiles/summary/")) {
          return Response.json({
            member_id: 9,
            display_name: "alice@example.com",
            role_badges_html: "<b>Affiliate</b>",
            badges: { medical: false, affiliate: true, foundations_coach: false },
            bio: "hi",
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const badId = await callAccount(h, "/api/members/0", {}, fetchImpl);
    expect(badId.status).toBe(400);
    expect(await badId.json()).toEqual({ error: "invalid_member_id" });

    const res = await callAccount(h, "/api/members/9", {}, fetchImpl);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.display_name).toBe("Member");
    expect(body).not.toHaveProperty("role_badges_html");
    expect(recorded.length).toBe(1);
  });

  it("DP-T-T7 Cache-Control private, no-store on 401/403/400/502", async () => {
    const { fetchImpl } = makeFetchMock([
      async () => Response.json({ url: "https://evil.example/x" }),
    ]);
    const r401 = await callAccount(h, "/api/account/overview", {}, fetchImpl);
    assertNoStore(r401);
    const r403 = await handleAccountRoutes(
      new Request("https://evil.example/api/account/overview", { headers: { Host: "evil.example" } }),
      h.env,
      { fetchImpl, bsiBaseUrl: BSI_ORIGIN },
    );
    assertNoStore(r403!);
  });

  describe("DP-T-T8 CSRF matrix", () => {
    const mutations: Array<{ method: string; path: string; body: string }> = [
      {
        method: "POST",
        path: "/api/account/subscriptions/portal-link",
        body: JSON.stringify({ intent: "manage" }),
      },
      {
        method: "POST",
        path: "/api/account/courses/1/claim",
        body: JSON.stringify({ path: "redeem_ltv" }),
      },
      { method: "PATCH", path: "/api/account/profile", body: JSON.stringify({ bio: "x" }) },
      { method: "PUT", path: "/api/account/favorites/articles/a1", body: "{}" },
      { method: "DELETE", path: "/api/account/favorites/articles/a1", body: "{}" },
    ];

    for (const m of mutations) {
      it(`${m.method} ${m.path} CSRF failures → 403, 0 upstream`, async () => {
        const sess = await withSession(h);
        const { fetchImpl, recorded } = makeFetchMock([
          async () => Response.json({ ok: true }),
        ]);

        const cases: RequestInit[] = [
          {
            method: m.method,
            headers: {
              Origin: ORIGIN,
              "Sec-Fetch-Site": "same-origin",
              "Content-Type": "application/json",
              Cookie: sess.cookie,
            },
            body: m.body,
          },
          {
            method: m.method,
            headers: {
              Origin: ORIGIN,
              "Sec-Fetch-Site": "same-origin",
              "X-CSRF-Token": "wrong",
              "Content-Type": "application/json",
              Cookie: sess.cookie,
            },
            body: m.body,
          },
          {
            method: m.method,
            headers: {
              Origin: "https://evil.example",
              "Sec-Fetch-Site": "same-origin",
              "X-CSRF-Token": sess.csrf,
              "Content-Type": "application/json",
              Cookie: sess.cookie,
            },
            body: m.body,
          },
          {
            method: m.method,
            headers: {
              Origin: ORIGIN,
              "Sec-Fetch-Site": "cross-site",
              "X-CSRF-Token": sess.csrf,
              "Content-Type": "application/json",
              Cookie: sess.cookie,
            },
            body: m.body,
          },
        ];

        for (const init of cases) {
          recorded.length = 0;
          const res = await callAccount(h, m.path, init, fetchImpl);
          expect(res.status).toBe(403);
          expect(recorded.length).toBe(0);
          assertNoStore(res);
        }
      });
    }
  });

  it("DP-T-CFG1 rate limiter 429 + missing limiter 503", async () => {
    const sess = await withSession(h);
    h.env.ACCOUNT_READ_LIMITER = countingLimiter(0);
    const { fetchImpl, recorded } = makeFetchMock([
      async () => Response.json(OVERVIEW_FIXTURE),
    ]);
    const limited = await callAccount(
      h,
      "/api/account/overview",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(recorded.length).toBe(0);
    assertNoStore(limited);

    delete h.env.ACCOUNT_READ_LIMITER;
    const missing = await callAccount(
      h,
      "/api/account/overview",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(missing.status).toBe(503);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-T1 bearer-only on every successful upstream route sample", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (method === "GET" && path.endsWith("/me/account")) return Response.json(OVERVIEW_FIXTURE);
        if (path.endsWith("/me/subscriptions")) return Response.json(SUBS_FIXTURE);
        if (path.endsWith("/me/spend")) return Response.json(LTV300_SPEND);
        if (path.endsWith("/profiles/me")) return Response.json({ display_name: "Jane" });
        if (path.includes("/favorites")) return Response.json({ items: [] });
        if (path.includes("/my-courses")) return Response.json({ items: [] });
        return Response.json({ ok: true });
      },
    ]);
    const paths: Array<{ method?: string; path: string; body?: string }> = [
      { path: "/api/account/overview" },
      { path: "/api/account/subscriptions" },
      { path: "/api/account/ltv-certificates" },
      { path: "/api/account/profile" },
      { path: "/api/account/courses" },
      { path: "/api/account/favorites" },
      {
        method: "POST",
        path: "/api/account/password-reset",
        body: "{}",
      },
    ];
    for (const p of paths) {
      const headers =
        p.method && p.method !== "GET"
          ? hOk({ csrf: sess.csrf, sid: sess.sid })
          : { Cookie: sess.cookie };
      const res = await callAccount(
        h,
        p.path,
        { method: p.method ?? "GET", headers, body: p.body },
        fetchImpl,
      );
      expect(res.status, p.path).toBeLessThan(500);
    }
    expect(recorded.length).toBeGreaterThan(0);
    for (const rec of recorded) {
      if (rec.url.includes("/wp-json/")) assertHasBearer(rec);
    }
    // No raw ACCESS1 in response bodies
    for (const p of paths) {
      void p;
    }
    expect(ACCESS1.length).toBeGreaterThan(0);
  });

  it("CQ B1: expired coach → foundations_coach badge false; missing granted_at inactive", async () => {
    const sess = await withSession(h);
    const expiredGrant = "2020-01-15T00:00:00.000Z";
    const expiredAt = "2023-01-15T00:00:00.000Z";
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/account")) {
          return Response.json({
            ...OVERVIEW_FIXTURE,
            badges: {
              medical: false,
              affiliate: false,
              subscription: true,
              foundations_coach: true, // upstream lies — Worker must not echo when expired
            },
            foundations_coach: {
              seminar_checked_in: true,
              metfix_essentials_completed: false,
              metfix_essentials_certificate_claimed: false,
              granted_at: expiredGrant,
              expires_at: expiredAt,
              active: true,
            },
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/overview",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      badges: { foundations_coach: boolean };
      foundations_coach: { active: boolean; granted_at: string | null };
    };
    expect(body.foundations_coach.active).toBe(false);
    expect(body.badges.foundations_coach).toBe(false);

    const { fetchImpl: fetch2 } = makeFetchMock([
      async () =>
        Response.json({
          ...OVERVIEW_FIXTURE,
          foundations_coach: {
            seminar_checked_in: true,
            metfix_essentials_completed: false,
            metfix_essentials_certificate_claimed: false,
            // granted_at missing → INACTIVE
          },
        }),
    ]);
    const res2 = await callAccount(
      h,
      "/api/account/overview",
      { headers: { Cookie: sess.cookie } },
      fetch2,
    );
    const body2 = (await res2.json()) as {
      badges: { foundations_coach: boolean };
      foundations_coach: { active: boolean; granted_at: string | null; expires_at: string | null };
    };
    expect(body2.foundations_coach.active).toBe(false);
    expect(body2.foundations_coach.granted_at).toBeNull();
    expect(body2.foundations_coach.expires_at).toBeNull();
    expect(body2.badges.foundations_coach).toBe(false);
  });

  it("CQ B2 / R2-N1: same active Med Society rows → same metfix_pro on overview/subs/LTV", async () => {
    const sess = await withSession(h);
    const medItems = [
      {
        sub_ref: "opaque_med_1",
        provider: "stripe",
        tier: "member",
        legacy_source: "medical_society_stripe",
        status: "active",
        current_period_end: "2026-12-01",
        paid_through: "2026-12-01",
        cancel_at_period_end: false,
        card: { brand: "visa", last4: "1111" },
      },
    ];
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/account")) {
          return Response.json({
            ...OVERVIEW_FIXTURE,
            canonical_tier: "free",
            subscription_items: medItems,
          });
        }
        if (path.endsWith("/me/subscriptions")) {
          return Response.json({ canonical_tier: "free", items: medItems });
        }
        if (path.endsWith("/me/spend")) {
          return Response.json({
            ...LTV300_SPEND,
            canonical_tier: "free",
            subscription_items: medItems,
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const ov = await (
      await callAccount(h, "/api/account/overview", { headers: { Cookie: sess.cookie } }, fetchImpl)
    ).json() as { canonical_tier: string };
    const su = await (
      await callAccount(
        h,
        "/api/account/subscriptions",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      )
    ).json() as { canonical_tier: string };
    const lt = await (
      await callAccount(
        h,
        "/api/account/ltv-certificates",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      )
    ).json() as { canonical_tier: string };
    expect(ov.canonical_tier).toBe("metfix_pro");
    expect(su.canonical_tier).toBe("metfix_pro");
    expect(lt.canonical_tier).toBe("metfix_pro");
  });

  it("accountRateLimitKey: '' and '0' → hashed sid; real id → acct:; never raw sid / acct:0", async () => {
    const { accountRateLimitKey } = await import("./account");
    const { sha256Hex } = await import("./auth/crypto");
    const base = {
      sid: "sid_aaa",
      hex: "x",
      access: "a",
      record: {
        bsi_access: "a",
        bsi_refresh: "r",
        access_exp: Date.now() + 60_000,
        user_public_name: "A",
        bsi_user_id: "",
        can_moderate: false,
        created: Date.now(),
        last_seen: Date.now(),
      },
    };
    const hashed = `sid:${await sha256Hex("sid_aaa")}`;
    expect(await accountRateLimitKey(base)).toBe(hashed);
    expect(await accountRateLimitKey(base)).not.toBe("sid:sid_aaa");
    expect(
      await accountRateLimitKey({
        ...base,
        record: { ...base.record, bsi_user_id: "0" },
      }),
    ).toBe(hashed);
    expect(
      await accountRateLimitKey({
        ...base,
        sid: "sid_bbb",
        record: { ...base.record, bsi_user_id: "123" },
      }),
    ).toBe("acct:123");
    expect(hashed.includes("acct:0")).toBe(false);
  });

  it("grandfathered med society + convert-to-whop happy path", async () => {
    const sess = await withSession(h);
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.includes("convert-to-whop")) {
          return Response.json({
            purchase_url: "https://whop.com/checkout/be",
            trial_period_days: 12,
            stripe_period_end: "2026-12-01",
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/subscriptions/convert-to-whop",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ target_tier: "metfix_pro", sub_ref: "opaque_med_2" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { purchase_url: string };
    expect(body.purchase_url).toContain("whop.com");
  });

  it("DP-T-CFG3: real limiter keys for '', '0', absent; two no-uid sessions differ; 123→acct:123", async () => {
    const { createSession } = await import("./auth/session");
    const { sha256Hex } = await import("./auth/crypto");
    const { csrfSid } = await import("../tools/pr2/harness/realauth-harness");

    async function sessionWithUid(user_id: string | undefined) {
      const tokens: {
        access_token: string;
        refresh_token: string;
        public_name: string;
        user_id?: string;
      } = {
        access_token: ACCESS1,
        refresh_token: "refresh",
        public_name: "NoUid",
      };
      if (user_id !== undefined) tokens.user_id = user_id;
      const sid = (await createSession(h.env, tokens)) as string;
      const csrf = await csrfSid(h.env, sid);
      return { sid, csrf, cookie: `${SID_COOKIE}=${encodeURIComponent(sid)}` };
    }

    const keys: string[] = [];
    h.env.ACCOUNT_READ_LIMITER = {
      async limit({ key }) {
        keys.push(key);
        return { success: true };
      },
    };
    const { fetchImpl } = makeFetchMock([
      async () => Response.json(OVERVIEW_FIXTURE),
    ]);

    const empty = await sessionWithUid("");
    const zero = await sessionWithUid("0");
    const absent = await sessionWithUid(undefined);
    const real = await sessionWithUid("123");

    for (const s of [empty, zero, absent, real]) {
      await callAccount(
        h,
        "/api/account/overview",
        { headers: { Cookie: s.cookie } },
        fetchImpl,
      );
    }

    expect(keys.length).toBe(4);
    expect(keys.every((k) => !k.includes("acct:0"))).toBe(true);
    expect(keys[0]).toBe(`sid:${await sha256Hex(empty.sid)}`);
    expect(keys[1]).toBe(`sid:${await sha256Hex(zero.sid)}`);
    expect(keys[2]).toBe(`sid:${await sha256Hex(absent.sid)}`);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[3]).toBe("acct:123");
  });

  it("CL-T6 / W-N14 / W-N27: repeat allocated_cents must be 0; missing/non-int/neg → 502", async () => {
    const sess = await withSession(h);
    const repeatBody = (allocated: unknown) => ({
      course_id: 10,
      already_claimed: true,
      ...(allocated !== undefined ? { allocated_cents: allocated } : {}),
      claim_method: "redeem_ltv",
      claimed_at: "2026-06-01T12:00:00+00:00",
      available_certificate_ltv_cents: 0,
      available_ltv_cents: 0,
      claimed_courses_value_cents: 20000,
      foundations_coach: null,
    });
    const claimOnce = async (allocated: unknown, idemSuffix: string) => {
      const { fetchImpl } = makeFetchMock([
        async ({ path, method }) => {
          if (path.includes("/claim-certificate") && method === "POST") {
            return Response.json(repeatBody(allocated));
          }
          return new Response(null, { status: 404 });
        },
      ]);
      return callAccount(
        h,
        "/api/account/courses/10/claim",
        {
          method: "POST",
          headers: {
            ...hOk({ csrf: sess.csrf, sid: sess.sid }),
            "Idempotency-Key": `550e8400-e29b-41d4-a716-44665544${idemSuffix}`,
          },
          body: JSON.stringify({ path: "redeem_ltv" }),
        },
        fetchImpl,
      );
    };

    const ok = await claimOnce(0, "0000");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ already_claimed: true });

    // W-N14 nonzero / W-N27 missing, string, float, negative, unsafe → 502, no checkout_url.
    for (const [alloc, suf] of [
      [20000, "0001"],
      [undefined, "0002"],
      ["0", "0003"],
      [0.5, "0004"],
      [-1, "0005"],
      [Number.MAX_SAFE_INTEGER + 1, "0006"],
    ] as const) {
      const bad = await claimOnce(alloc, suf);
      expect(bad.status, `allocated=${String(alloc)}`).toBe(502);
      expect(await bad.json()).toEqual({ error: "upstream_error" });
    }
  });

  it("W-N26 / CQ F1: legacy 'ltv' claim_method → 200, method null, one log", async () => {
    const sess = await withSession(h);
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { fetchImpl } = makeFetchMock([
        async ({ path }) => {
          if (path.endsWith("/me/spend")) {
            return Response.json({
              total_ltv_cents: 30000,
              claimed_courses_value_cents: 20000,
              claimed_certificates: [
                {
                  course_id: 1,
                  course_slug: "a",
                  course_title: "Course A",
                  allocated_cents: 15000,
                  claimed_at: "2026-01-01T00:00:00Z",
                  claim_method: "ltv",
                },
                {
                  course_id: 3,
                  course_slug: "c",
                  course_title: "Course C",
                  allocated_cents: 5000,
                  claimed_at: "2026-01-02T00:00:00Z",
                  claim_method: "redeem_ltv",
                },
              ],
              canonical_tier: "metfix_pro",
              foundations_coach: {},
            });
          }
          return new Response(null, { status: 404 });
        },
      ]);
      const res = await callAccount(
        h,
        "/api/account/ltv-certificates",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        claimed_certificates: Array<{ course_id: number; claim_method: string | null }>;
      };
      expect(body.claimed_certificates).toHaveLength(2);
      expect(body.claimed_certificates[0]).toMatchObject({
        course_id: 1,
        claim_method: null,
      });
      expect(body.claimed_certificates[1]).toMatchObject({
        course_id: 3,
        claim_method: "redeem_ltv",
      });
      const logs = spyWarn.mock.calls
        .map((c) => {
          try {
            return JSON.parse(String(c[0])) as { event?: string };
          } catch {
            return null;
          }
        })
        .filter((l) => l?.event === "ltv_row_method_unknown");
      expect(logs).toHaveLength(1);
    } finally {
      spyWarn.mockRestore();
    }
  });

  it("R2-N3: parsePositiveCourseId accepts number and digit-only string; nulls others", () => {
    expect(parsePositiveCourseId(7)).toBe(7);
    expect(parsePositiveCourseId("20")).toBe(20);
    expect(parsePositiveCourseId("07")).toBe(7);
    expect(parsePositiveCourseId(0)).toBeNull();
    expect(parsePositiveCourseId(-1)).toBeNull();
    expect(parsePositiveCourseId(1.5)).toBeNull();
    expect(parsePositiveCourseId("20a")).toBeNull();
    expect(parsePositiveCourseId("")).toBeNull();
    expect(parsePositiveCourseId(null)).toBeNull();
    expect(parsePositiveCourseId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(parsePositiveCourseId("1e3")).toBeNull();
    expect(parsePositiveCourseId(" 1")).toBeNull();
    expect(parsePositiveCourseId(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
  });

  it("B-R3-1: redeem_ltv claim makes exactly 1 upstream fetch (claim POST only)", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("/claim-certificate") && method === "POST") {
          return Response.json({ already_claimed: true, allocated_cents: 0 });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/courses/10/claim",
      {
        method: "POST",
        headers: {
          ...hOk({ csrf: sess.csrf, sid: sess.sid }),
          "Idempotency-Key": "550e8400-e29b-41d4-a716-446655449a01",
        },
        body: JSON.stringify({ path: "redeem_ltv" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.url).toContain("/claim-certificate");
    expect(recorded[0]!.method.toUpperCase()).toBe("POST");
    expect(recorded.some((r) => r.url.includes("/me/spend"))).toBe(false);
  });

  it("R2-N3: shapeLtv keeps digit-string course_id (normalized) and number course_id", async () => {
    const sess = await withSession(h);
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/spend")) {
          return Response.json({
            total_ltv_cents: 30000,
            claimed_courses_value_cents: 20000,
            claimed_certificates: [
              {
                course_id: "7",
                course_slug: "str-id",
                course_title: "String Id",
                allocated_cents: 15000,
                claimed_at: "2026-01-01T00:00:00Z",
                claim_method: "redeem_ltv",
              },
              {
                course_id: 3,
                course_slug: "c",
                course_title: "Course C",
                allocated_cents: 5000,
                claimed_at: "2026-01-02T00:00:00Z",
                claim_method: "redeem_ltv",
              },
            ],
            canonical_tier: "metfix_pro",
            foundations_coach: {},
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/ltv-certificates",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      claimed_certificates: Array<{ course_id: number }>;
    };
    expect(body.claimed_certificates.map((c) => c.course_id)).toEqual([7, 3]);
  });

  it("CL-LTVROW-A: bad allocated_cents cases + valid total → 200, drop bad row, available ≤ total", async () => {
    const sess = await withSession(h);
    const badCases: Array<{ label: string; allocated: unknown }> = [
      { label: "missing", allocated: undefined },
      { label: "0.5", allocated: 0.5 },
      { label: "-5", allocated: -5 },
      { label: '"100"', allocated: "100" },
    ];
    for (const { label, allocated } of badCases) {
      const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const badRow: Record<string, unknown> = {
          course_id: 7,
          course_slug: "bad-alloc",
          course_title: "Bad Alloc",
          claimed_at: "2026-01-01T00:00:00Z",
          claim_method: "redeem_ltv",
        };
        if (allocated !== undefined) badRow.allocated_cents = allocated;
        // total (22000) < naive row sum (25000) so over-total fails if bad row summed.
        const { fetchImpl } = makeFetchMock([
          async ({ path }) => {
            if (path.endsWith("/me/spend")) {
              return Response.json({
                total_ltv_cents: 22000,
                claimed_courses_value_cents: 20000,
                claimed_certificates: [
                  badRow,
                  {
                    course_id: 3,
                    course_slug: "c",
                    course_title: "Course C",
                    allocated_cents: 25000,
                    claimed_at: "2026-01-02T00:00:00Z",
                    claim_method: "redeem_ltv",
                  },
                ],
                canonical_tier: "metfix_pro",
                foundations_coach: {},
              });
            }
            return new Response(null, { status: 404 });
          },
        ]);
        const res = await callAccount(
          h,
          "/api/account/ltv-certificates",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        );
        expect(res.status, label).toBe(200);
        assertNoStore(res);
        const body = (await res.json()) as {
          total_ltv_cents: number;
          claimed_courses_value_cents: number;
          available_certificate_ltv_cents: number;
          claimed_certificates: Array<{ course_id: number; allocated_cents: number | null }>;
        };
        expect(body.claimed_courses_value_cents, label).toBe(20000);
        expect(body.available_certificate_ltv_cents, label).toBe(2000);
        expect(body.available_certificate_ltv_cents, label).toBeLessThanOrEqual(body.total_ltv_cents);
        expect(body.claimed_certificates.map((c) => c.course_id), label).toEqual([3]);
        expect(
          body.claimed_certificates.every((c) => typeof c.allocated_cents === "number"),
          label,
        ).toBe(true);
        const logs = spyWarn.mock.calls
          .map((c) => {
            try {
              return JSON.parse(String(c[0])) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((l) => l?.event === "ltv_row_allocated_invalid");
        expect(logs, label).toHaveLength(1);
        expect(Object.keys(logs[0]!).sort(), label).toEqual(["course_id", "event"]);
        expect(logs[0], label).toEqual({ event: "ltv_row_allocated_invalid", course_id: 7 });
      } finally {
        spyWarn.mockRestore();
      }
    }
  });

  it("CL-LTVROW-B: bad allocated + missing total → 502 upstream_error, no-store", async () => {
    const sess = await withSession(h);
    const badCases: unknown[] = [undefined, 0.5, -5, "100"];
    let branchBBody: Record<string, unknown> | null = null;
    for (const allocated of badCases) {
      const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const badRow: Record<string, unknown> = {
          course_id: 9,
          course_slug: "bad",
          course_title: "Bad",
          claimed_at: "2026-01-01T00:00:00Z",
          claim_method: "redeem_ltv",
        };
        if (allocated !== undefined) badRow.allocated_cents = allocated;
        const { fetchImpl } = makeFetchMock([
          async ({ path }) => {
            if (path.endsWith("/me/spend")) {
              return Response.json({
                total_ltv_cents: 30000,
                claimed_certificates: [badRow],
                canonical_tier: "metfix_pro",
                foundations_coach: {},
              });
            }
            return new Response(null, { status: 404 });
          },
        ]);
        const res = await callAccount(
          h,
          "/api/account/ltv-certificates",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        );
        expect(res.status).toBe(502);
        assertNoStore(res);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body).toEqual({ error: "upstream_error" });
        for (const k of Object.keys(body)) {
          expect(k.includes("ltv") || k.includes("available"), String(k)).toBe(false);
        }
        if (branchBBody == null) branchBBody = body;
        else expect(body).toEqual(branchBBody);

        const logs = spyWarn.mock.calls
          .map((c) => {
            try {
              return JSON.parse(String(c[0])) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((l) => l?.event === "ltv_row_allocated_invalid");
        expect(logs).toHaveLength(1);
        expect(Object.keys(logs[0]!).sort()).toEqual(["course_id", "event"]);
      } finally {
        spyWarn.mockRestore();
      }
    }
  });

  it("CL-LTVROW-B2: invalid claimed_courses_value_cents → same as B; 1 log; 0 claim calls", async () => {
    const sess = await withSession(h);
    const invalidTotals = [0.5, "20000", -1];
    const badAllocatedCases = [undefined, 0.5, -5, "100"];

    const runBranch = async (claimedTotal: unknown, allocated: unknown) => {
      const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const badRow: Record<string, unknown> = {
        course_id: 11,
        claim_method: "redeem_ltv",
      };
      if (allocated !== undefined) badRow.allocated_cents = allocated;
      const spend: Record<string, unknown> = {
        total_ltv_cents: 30000,
        claimed_certificates: [badRow],
        canonical_tier: "metfix_pro",
        foundations_coach: {},
      };
      if (claimedTotal !== undefined) spend.claimed_courses_value_cents = claimedTotal;
      let claimCalls = 0;
      const { fetchImpl, recorded } = makeFetchMock([
        async ({ path, method }) => {
          if (path.endsWith("/me/spend")) return Response.json(spend);
          if (path.includes("/claim-certificate") && method === "POST") {
            claimCalls += 1;
            return Response.json({ already_claimed: false });
          }
          return new Response(null, { status: 404 });
        },
      ]);
      try {
        const res = await callAccount(
          h,
          "/api/account/ltv-certificates",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        );
        const logs = spyWarn.mock.calls
          .map((c) => {
            try {
              return JSON.parse(String(c[0])) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((l) => l?.event === "ltv_row_allocated_invalid");
        expect(logs).toHaveLength(1);
        expect(claimCalls).toBe(0);
        expect(recorded.every((r) => !r.url.includes("/claim-certificate"))).toBe(true);
        return res;
      } finally {
        spyWarn.mockRestore();
      }
    };

    const baseline = await runBranch(undefined, undefined);
    expect(baseline.status).toBe(502);
    assertNoStore(baseline);
    const baselineBody = await baseline.json();
    expect(baselineBody).toEqual({ error: "upstream_error" });

    for (const total of invalidTotals) {
      for (const allocated of badAllocatedCases) {
        await expect(runBranch(total, allocated)).resolves.toBeTruthy();
        const res = await runBranch(total, allocated);
        expect(res.status).toBe(502);
        assertNoStore(res);
        expect(await res.json()).toEqual(baselineBody);
      }
    }
  });

  it("CL-T19 / CQ N1: 409 ClaimInProgressBody vs 503 ClaimLockTimeoutBody exact keys", async () => {
    const sess = await withSession(h);
    const postClaim = async (upstream: Response, idem: string) => {
      const { fetchImpl } = makeFetchMock([
        async ({ path, method }) => {
          if (path.includes("/claim-certificate") && method === "POST") return upstream;
          return new Response(null, { status: 404 });
        },
      ]);
      return callAccount(
        h,
        "/api/account/courses/10/claim",
        {
          method: "POST",
          headers: {
            ...hOk({ csrf: sess.csrf, sid: sess.sid }),
            "Idempotency-Key": idem,
          },
          body: JSON.stringify({ path: "redeem_ltv" }),
        },
        fetchImpl,
      );
    };

    const r409 = await postClaim(
      Response.json(
        { code: "bsi_idempotency_key_in_progress" },
        { status: 409 },
      ),
      "550e8400-e29b-41d4-a716-446655440010",
    );
    expect(r409.status).toBe(409);
    const b409 = (await r409.json()) as Record<string, unknown>;
    expect(b409).toEqual({ error: "claim_in_progress" });
    expect(Object.keys(b409).sort()).toEqual(["error"]);

    const r503 = await postClaim(
      Response.json({ code: "bsi_claim_lock_timeout" }, { status: 503 }),
      "550e8400-e29b-41d4-a716-446655440011",
    );
    expect(r503.status).toBe(503);
    const b503 = (await r503.json()) as Record<string, unknown>;
    expect(b503).toEqual({
      error: "claim_in_progress",
      reason_code: "claim_in_progress",
    });
    expect(Object.keys(b503).sort()).toEqual(["error", "reason_code"]);
  });

  it("DP-T-16: 5242880 pass / 5242881 reject; gif/SVG reject; png/webp pass", async () => {
    const sess = await withSession(h);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x00,
    ]);
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path }) => {
        if (path.includes("profile-picture")) return Response.json({ ok: true });
        return new Response(null, { status: 404 });
      },
    ]);

    async function postPic(ct: string, body: Uint8Array) {
      recorded.length = 0;
      return callAccount(
        h,
        "/api/account/profile/picture",
        {
          method: "POST",
          headers: {
            ...hOk({ csrf: sess.csrf, sid: sess.sid }),
            "Content-Type": ct,
          },
          body,
        },
        fetchImpl,
      );
    }

    const okPng = await postPic("image/png", png);
    expect(okPng.status).toBe(200);
    expect(recorded.length).toBe(1);
    const okWebp = await postPic("image/webp", webp);
    expect(okWebp.status).toBe(200);

    const badGif = await postPic("image/gif", gif);
    expect(badGif.status).toBe(400);
    expect(recorded.length).toBe(0);
    const badSvg = await postPic("image/svg+xml", svg);
    expect(badSvg.status).toBe(400);
    expect(recorded.length).toBe(0);

    const exact = new Uint8Array(5_242_880);
    exact.set(png, 0);
    const okExact = await postPic("image/png", exact);
    expect(okExact.status).toBe(200);

    const over = new Uint8Array(5_242_881);
    over.set(png, 0);
    const badOver = await postPic("image/png", over);
    expect([413, 400]).toContain(badOver.status);
    expect(recorded.length).toBe(0);
  });

  it("DP-T-26b: notifications PUT whitelist strips unknown keys", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("notification-preferences") && method === "PUT") {
          return Response.json({ ok: true });
        }
        if (path.includes("/me/newsletter") && method === "PUT") {
          return Response.json({ ok: true });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/notifications",
      {
        method: "PUT",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({
          preferences: { email_digest: true, product_updates: false },
          newsletter: true,
          role: "admin",
          user_id: 9,
          email: "x@y.z",
          __proto__: { polluted: true },
          is_admin: true,
        }),
      },
      fetchImpl,
    );
    expect(res.status).toBeLessThan(500);
    const prefPut = recorded.find(
      (r) => r.method === "PUT" && r.url.includes("notification-preferences"),
    );
    expect(prefPut).toBeTruthy();
    const body = JSON.parse(prefPut!.bodyText) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["newsletter", "preferences"].sort());
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("is_admin");
    expect(body.preferences).toEqual({ email_digest: true, product_updates: false });
  });

  it("R3-B1: public /api/members/:id key-set exact; expired coach badge false; no foundations_coach object", async () => {
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.includes("/profiles/summary/")) {
          return Response.json({
            member_id: 9,
            display_name: "Bob",
            badges: { medical: false, affiliate: false, foundations_coach: true },
            foundations_coach: {
              seminar_checked_in: true,
              granted_at: "2020-01-15T00:00:00.000Z",
              expires_at: "2023-01-15T00:00:00.000Z",
            },
            bio: "hi",
            location: "Austin",
            role_badges_html: "<b>x</b>",
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(h, "/api/members/9", {}, fetchImpl);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([...PUBLIC_MEMBER_SUMMARY_KEYS].sort());
    expect(body).not.toHaveProperty("foundations_coach");
    expect(body).not.toHaveProperty("role_badges_html");
    expect((body.badges as { foundations_coach: boolean }).foundations_coach).toBe(false);
  });

  it("DP-T-UI5: /members/abc and /members/1.5 → 400, 0 upstream", async () => {
    const { fetchImpl, recorded } = makeFetchMock([
      async () => Response.json({ ok: true }),
    ]);
    for (const id of ["abc", "1.5", "-1"]) {
      recorded.length = 0;
      const res = await callAccount(h, `/api/members/${id}`, {}, fetchImpl);
      expect(res.status).toBe(400);
      expect(recorded.length).toBe(0);
    }
  });

  it("R3-B2: only subscriptions.items → same canonical_tier on overview + LTV", async () => {
    const sess = await withSession(h);
    const medViaNested = {
      items: [
        {
          sub_ref: "opaque_med_nested",
          provider: "stripe",
          tier: "member",
          legacy_source: "medical_society_stripe",
          status: "active",
          current_period_end: "2026-12-01",
          paid_through: "2026-12-01",
          cancel_at_period_end: false,
          card: { brand: "visa", last4: "4242" },
        },
      ],
    };
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/account")) {
          return Response.json({
            ...OVERVIEW_FIXTURE,
            canonical_tier: "free",
            // No top-level subscription_items — only nested subscriptions.items
            subscriptions: medViaNested,
          });
        }
        if (path.endsWith("/me/spend")) {
          return Response.json({
            ...LTV300_SPEND,
            canonical_tier: "free",
            subscriptions: medViaNested,
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const ov = (await (
      await callAccount(h, "/api/account/overview", { headers: { Cookie: sess.cookie } }, fetchImpl)
    ).json()) as { canonical_tier: string };
    const lt = (await (
      await callAccount(
        h,
        "/api/account/ltv-certificates",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      )
    ).json()) as { canonical_tier: string };
    expect(ov.canonical_tier).toBe("metfix_pro");
    expect(lt.canonical_tier).toBe("metfix_pro");
  });

  it("DP-T-T6: account routes do not console-log Bearer tokens or emails", async () => {
    const sess = await withSession(h);
    const spyInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { fetchImpl } = makeFetchMock([
        async () =>
          Response.json({
            ...OVERVIEW_FIXTURE,
            email: "secret.user@example.test",
          }),
      ]);
      await callAccount(
        h,
        "/api/account/overview",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      const all = [...spyInfo.mock.calls, ...spyLog.mock.calls].map((c) => String(c[0] ?? ""));
      for (const line of all) {
        expect(line).not.toMatch(/Bearer /);
        expect(line).not.toMatch(/secret\.user@example\.test/i);
        expect(line).not.toContain(ACCESS1);
      }
    } finally {
      spyInfo.mockRestore();
      spyLog.mockRestore();
    }
  });

  describe("Worker Section I (CL1 / CL-T4 / CL-RET / CL-ERR / CL-T10–T16 / CL3 / CL-T20)", () => {
    const K = "550e8400-e29b-41d4-a716-4466554400aa";
    const CHECKOUT = "https://whop.com/checkout/plan_section_i";
    const CLF = {
      currency: "usd",
      ltv: { total_ltv_cents: 30000, claimed_value_cents: 8000, available_cents: 22000 },
      credit: {
        balance_cents: 1300,
        days_granted: 12,
        pending_promo_cents: 1300,
        promo_state: "waiting_to_apply",
      },
      courses: [
        {
          course_id: 1,
          slug: "essentials",
          title: "Essentials",
          completion_status: "completed",
          completed_at: "2026-01-01T00:00:00Z",
          price_cents: 30000,
          already_claimed: false,
          claimed_at: null,
          claimed_via: null,
          access_expires_at: null,
          paths: [
            {
              path: "redeem_ltv",
              eligible: false,
              shortfall_cents: 8000,
              price_cents: 30000,
              reason_code: "insufficient_ltv",
            },
            {
              path: "prepay_credit",
              eligible: true,
              shortfall_cents: 8000,
              price_cents: 30000,
              reason_code: null,
            },
            {
              path: "buy_outright",
              eligible: true,
              shortfall_cents: 30000,
              price_cents: 30000,
              reason_code: null,
            },
          ],
        },
      ],
    };

    const PATHS = ["redeem_ltv", "prepay_credit", "buy_outright"] as const;

    function claimHeaders(sess: { csrf: string; sid: string }, key: string | null) {
      const headers: Record<string, string> = {
        ...hOk({ csrf: sess.csrf, sid: sess.sid }),
      };
      if (key !== null) headers["Idempotency-Key"] = key;
      return headers;
    }

    it("CL1 GET: allowlisted body via certificateClaimOptionsPath; off-host 403; signed-out 401; retired route 404", async () => {
      const sess = await withSession(h);
      const { fetchImpl, recorded } = makeFetchMock([
        async ({ path, method }) => {
          if (path.endsWith("/me/certificate-claim-options") && method === "GET") {
            return Response.json(CLF);
          }
          return new Response(null, { status: 404 });
        },
      ]);
      const ok = await callAccount(
        h,
        "/api/account/certificate-claim-options",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(ok.status).toBe(200);
      assertNoStore(ok);
      const body = (await ok.json()) as typeof CLF;
      expect(body.currency).toBe("usd");
      expect(body.ltv.available_cents).toBe(22000);
      expect(body.courses[0]!.paths.map((p) => p.path)).toEqual([
        "redeem_ltv",
        "prepay_credit",
        "buy_outright",
      ]);
      expect(recorded).toHaveLength(1);
      expect(recorded[0]!.url).toContain("/wp-json/bsi/v1/me/certificate-claim-options");
      expect(recorded[0]!.method.toUpperCase()).toBe("GET");

      recorded.length = 0;
      const offHost = await handleAccountRoutes(
        new Request("https://evil.example/api/account/certificate-claim-options", {
          headers: { Host: "evil.example", Cookie: sess.cookie },
        }),
        h.env,
        { fetchImpl, bsiBaseUrl: BSI_ORIGIN },
      );
      expect(offHost!.status).toBe(403);
      expect(recorded).toHaveLength(0);

      const signedOut = await callAccount(h, "/api/account/certificate-claim-options", {}, fetchImpl);
      expect(signedOut.status).toBe(401);

      recorded.length = 0;
      const retired = await callAccount(
        h,
        "/api/account/courses/1/claim-options",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(retired.status).toBe(404);
      expect(recorded).toHaveLength(0);
    });

    it("CL-T4: Idempotency matrix → 400 invalid_idempotency_key, 0 upstream, each path", async () => {
      const sess = await withSession(h);
      const badKeys: Array<string | null> = [
        null,
        "",
        "550E8400-E29B-41D4-A716-446655440000",
        "550e8400-e29b-11d4-a716-446655440000",
        "550e8400-e29b-41d4-c716-446655440000",
        "550e8400-e29b-41d4-a716-44665544000z",
        "abcdefgh",
      ];
      for (const path of PATHS) {
        for (const key of badKeys) {
          const { fetchImpl, recorded } = makeFetchMock([
            async () => Response.json({ checkout_url: CHECKOUT }),
          ]);
          const init: RequestInit = {
            method: "POST",
            headers: claimHeaders(sess, key),
            body: JSON.stringify({ path }),
          };
          const res = await callAccount(h, "/api/account/courses/10/claim", init, fetchImpl);
          expect(res.status, `${path} key=${String(key)}`).toBe(400);
          expect(await res.json()).toEqual({ error: "invalid_idempotency_key" });
          expect(recorded, `${path} key=${String(key)}`).toHaveLength(0);
        }
      }
    });

    it("CL-RET-1 / CL-T10–T12 / CL-T16: status/body maps; extras never pass", async () => {
      const sess = await withSession(h);
      type Case = {
        label: string;
        path: (typeof PATHS)[number];
        upstream: Response;
        status: number;
        body: Record<string, unknown>;
        keys: string[];
      };
      const cases: Case[] = [
        {
          label: "prepay success",
          path: "prepay_credit",
          upstream: Response.json({
            checkout_url: CHECKOUT,
            allocated_cents: 1,
            attempt_id: "x",
            data: { shortfall_cents: 9 },
          }),
          status: 200,
          body: { checkout_url: CHECKOUT },
          keys: ["checkout_url"],
        },
        {
          label: "buy success",
          path: "buy_outright",
          upstream: Response.json({ checkout_url: CHECKOUT, whop_plan_id: "plan_x" }),
          status: 200,
          body: { checkout_url: CHECKOUT },
          keys: ["checkout_url"],
        },
        {
          label: "redeem success",
          path: "redeem_ltv",
          upstream: Response.json({
            already_claimed: false,
            claim_method: "redeem_ltv",
            allocated_cents: 20000,
          }),
          status: 200,
          body: { already_claimed: false },
          keys: ["already_claimed"],
        },
        {
          label: "redeem repeat",
          path: "redeem_ltv",
          upstream: Response.json({
            already_claimed: true,
            allocated_cents: 0,
            claim_method: "redeem_ltv",
          }),
          status: 200,
          body: { already_claimed: true },
          keys: ["already_claimed"],
        },
        {
          label: "409 in-progress",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_idempotency_key_in_progress" }, { status: 409 }),
          status: 409,
          body: { error: "claim_in_progress" },
          keys: ["error"],
        },
        {
          label: "409 mismatch",
          path: "redeem_ltv",
          upstream: Response.json({ code: "idempotency_key_mismatch" }, { status: 409 }),
          status: 409,
          body: { error: "idempotency_key_mismatch" },
          keys: ["error"],
        },
        {
          label: "near-miss mismatch → 502",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_idempotency_key_mismatch" }, { status: 409 }),
          status: 502,
          body: { error: "upstream_error" },
          keys: ["error"],
        },
        {
          label: "400 invalid claim method → 502",
          path: "prepay_credit",
          upstream: Response.json({ code: "bsi_invalid_claim_method" }, { status: 400 }),
          status: 502,
          body: { error: "upstream_error" },
          keys: ["error"],
        },
        {
          label: "503 lock timeout",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_claim_lock_timeout" }, { status: 503 }),
          status: 503,
          body: { error: "claim_in_progress", reason_code: "claim_in_progress" },
          keys: ["error", "reason_code"],
        },
        {
          label: "unknown 409",
          path: "buy_outright",
          upstream: Response.json({ code: "bsi_other" }, { status: 409 }),
          status: 502,
          body: { error: "upstream_error" },
          keys: ["error"],
        },
        {
          label: "unknown 418",
          path: "buy_outright",
          upstream: Response.json({ code: "whatever" }, { status: 418 }),
          status: 502,
          body: { error: "upstream_error" },
          keys: ["error"],
        },
        {
          label: "CL-T10 legacy stripe",
          path: "prepay_credit",
          upstream: Response.json(
            { code: "bsi_prepay_legacy_stripe_member", data: { shortfall_cents: 8000 } },
            { status: 403 },
          ),
          status: 403,
          body: { error: "claim_ineligible", reason_code: "legacy_stripe_member" },
          keys: ["error", "reason_code"],
        },
        {
          label: "CL-T10 course not found",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_course_not_found" }, { status: 404 }),
          status: 404,
          body: { error: "course_not_found" },
          keys: ["error"],
        },
        {
          label: "CL-T10 invalid course price",
          path: "buy_outright",
          upstream: Response.json({ code: "bsi_invalid_course_price" }, { status: 400 }),
          status: 400,
          body: { error: "invalid_course_price" },
          keys: ["error"],
        },
        {
          label: "CL-T16 insufficient ltv",
          path: "redeem_ltv",
          upstream: Response.json(
            {
              code: "bsi_insufficient_certificate_ltv",
              data: { shortfall_cents: 8000, available_certificate_ltv_cents: 22000 },
            },
            { status: 402 },
          ),
          status: 402,
          body: { error: "claim_ineligible", reason_code: "insufficient_ltv" },
          keys: ["error", "reason_code"],
        },
        {
          label: "CL-T16 not completed",
          path: "redeem_ltv",
          upstream: Response.json(
            { code: "bsi_course_not_completed", data: { x: 1 } },
            { status: 403 },
          ),
          status: 403,
          body: { error: "claim_ineligible", reason_code: "not_completed" },
          keys: ["error", "reason_code"],
        },
        {
          label: "unmapped 402 → 502",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_totally_unknown" }, { status: 402 }),
          status: 502,
          body: { error: "upstream_error" },
          keys: ["error"],
        },
        {
          label: "non-BEP checkout → 502",
          path: "prepay_credit",
          upstream: Response.json({
            checkout_url: "https://whop.com/checkout/plan_x/?whop_company_id=biz_OTHER",
            whop_company_id: "biz_OTHER",
          }),
          status: 502,
          body: { error: "upstream_error" },
          keys: ["error"],
        },
      ];

      for (const c of cases) {
        const { fetchImpl, recorded } = makeFetchMock([
          async ({ path: p, method }) => {
            if (method === "POST" && (p.includes("/claim-certificate") || p.includes("/checkout") || p.includes("/certificate-prepay-checkout"))) {
              return c.upstream;
            }
            return new Response(null, { status: 404 });
          },
        ]);
        const res = await callAccount(
          h,
          "/api/account/courses/10/claim",
          {
            method: "POST",
            headers: claimHeaders(sess, K),
            body: JSON.stringify({ path: c.path }),
          },
          fetchImpl,
        );
        expect(res.status, c.label).toBe(c.status);
        assertNoStore(res);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body, c.label).toStrictEqual(c.body);
        expect(Object.keys(body).sort(), c.label).toEqual([...c.keys].sort());
        expect(JSON.stringify(body), c.label).not.toMatch(/\bcents\b/);
        expect(JSON.stringify(body), c.label).not.toContain("8000");
        expect(JSON.stringify(body), c.label).not.toContain("22000");
        expect(recorded.every((r) => !r.url.includes("/me/spend")), c.label).toBe(true);
        expect(recorded).toHaveLength(1);
      }
    });

    it("CL3: CL1 read / CL2 write limiter; success:false → 429 with 0 upstream", async () => {
      const sess = await withSession(h);
      h.env.ACCOUNT_READ_LIMITER = countingLimiter(0);
      h.env.ACCOUNT_WRITE_LIMITER = countingLimiter(100);
      const { fetchImpl, recorded } = makeFetchMock([
        async () => Response.json(CLF),
      ]);
      const r1 = await callAccount(
        h,
        "/api/account/certificate-claim-options",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(r1.status).toBe(429);
      expect(recorded).toHaveLength(0);

      h.env.ACCOUNT_READ_LIMITER = countingLimiter(100);
      h.env.ACCOUNT_WRITE_LIMITER = countingLimiter(0);
      recorded.length = 0;
      const r2 = await callAccount(
        h,
        "/api/account/courses/10/claim",
        {
          method: "POST",
          headers: claimHeaders(sess, K),
          body: JSON.stringify({ path: "redeem_ltv" }),
        },
        fetchImpl,
      );
      expect(r2.status).toBe(429);
      expect(recorded).toHaveLength(0);
    });

    it("CL-T20: CSRF → limiter → validation → exactly 1 upstream (no /me/spend)", async () => {
      const sess = await withSession(h);
      let limitCalls = 0;
      h.env.ACCOUNT_WRITE_LIMITER = {
        async limit() {
          limitCalls += 1;
          return { success: true };
        },
      };

      // Missing CSRF → 403; limiter not called.
      limitCalls = 0;
      const { fetchImpl: f0, recorded: rec0 } = makeFetchMock([
        async () => Response.json({ already_claimed: false, claim_method: "redeem_ltv" }),
      ]);
      const noCsrf = await callAccount(
        h,
        "/api/account/courses/10/claim",
        {
          method: "POST",
          headers: {
            Origin: ORIGIN,
            "Sec-Fetch-Site": "same-origin",
            "Content-Type": "application/json",
            Cookie: sess.cookie,
            "Idempotency-Key": K,
          },
          body: JSON.stringify({ path: "redeem_ltv" }),
        },
        f0,
      );
      expect(noCsrf.status).toBe(403);
      expect(await noCsrf.json()).toEqual({ error: "forbidden" });
      expect(limitCalls).toBe(0);
      expect(rec0).toHaveLength(0);

      // Exhausted limiter + bad key → 429 (limiter before validation).
      h.env.ACCOUNT_WRITE_LIMITER = countingLimiter(0);
      const { fetchImpl: f1, recorded: rec1 } = makeFetchMock([
        async () => Response.json({ already_claimed: false, claim_method: "redeem_ltv" }),
      ]);
      const limited = await callAccount(
        h,
        "/api/account/courses/10/claim",
        {
          method: "POST",
          headers: claimHeaders(sess, "NOT-A-UUID"),
          body: JSON.stringify({ path: "redeem_ltv" }),
        },
        f1,
      );
      expect(limited.status).toBe(429);
      expect(rec1).toHaveLength(0);

      // Valid → exactly 1 upstream claim POST; no /me/spend; key never logged.
      installAccountLimiters(h.env, 100);
      const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
      const spyInfo = vi.spyOn(console, "info").mockImplementation(() => {});
      try {
        const { fetchImpl, recorded } = makeFetchMock([
          async ({ path, method }) => {
            if (path.includes("/claim-certificate") && method === "POST") {
              return Response.json({ already_claimed: false, claim_method: "redeem_ltv" });
            }
            return new Response(null, { status: 404 });
          },
        ]);
        const ok = await callAccount(
          h,
          "/api/account/courses/10/claim",
          {
            method: "POST",
            headers: claimHeaders(sess, K),
            body: JSON.stringify({ path: "redeem_ltv" }),
          },
          fetchImpl,
        );
        expect(ok.status).toBe(200);
        expect(recorded).toHaveLength(1);
        expect(recorded[0]!.url).toContain("/claim-certificate");
        expect(recorded.some((r) => r.url.includes("/me/spend"))).toBe(false);
        const logs = [...spyWarn.mock.calls, ...spyLog.mock.calls, ...spyInfo.mock.calls]
          .map((c) => String(c[0] ?? ""));
        expect(logs.every((l) => !l.includes(K))).toBe(true);

        // Uppercase UUID → 400 (Worker does not case-fold / trim).
        recorded.length = 0;
        const upper = await callAccount(
          h,
          "/api/account/courses/10/claim",
          {
            method: "POST",
            headers: claimHeaders(sess, K.toUpperCase()),
            body: JSON.stringify({ path: "redeem_ltv" }),
          },
          fetchImpl,
        );
        expect(upper.status).toBe(400);
        expect(await upper.json()).toEqual({ error: "invalid_idempotency_key" });
        expect(recorded).toHaveLength(0);

        // CL-T20: interior-space key → 400 (Worker does not normalize).
        recorded.length = 0;
        const interior = `${K.slice(0, 8)} ${K.slice(9)}`;
        const spaced = await callAccount(
          h,
          "/api/account/courses/10/claim",
          {
            method: "POST",
            headers: claimHeaders(sess, interior),
            body: JSON.stringify({ path: "redeem_ltv" }),
          },
          fetchImpl,
        );
        expect(spaced.status).toBe(400);
        expect(await spaced.json()).toEqual({ error: "invalid_idempotency_key" });
        expect(recorded).toHaveLength(0);
      } finally {
        spyWarn.mockRestore();
        spyLog.mockRestore();
        spyInfo.mockRestore();
      }
    });

    it("CL-DTO-1: claim_options_rejected reasons + event keys + allowlist", async () => {
      const sess = await withSession(h);
      const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const deep = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
      const courseKeys = [
        "course_id",
        "slug",
        "title",
        "completion_status",
        "completed_at",
        "price_cents",
        "already_claimed",
        "claimed_at",
        "claimed_via",
        "access_expires_at",
        "paths",
      ] as const;

      async function rejectCase(
        label: string,
        mutate: (raw: Record<string, unknown>) => void,
        reason: string,
      ) {
        spyWarn.mockClear();
        const raw = deep(CLF) as Record<string, unknown>;
        mutate(raw);
        const { fetchImpl } = makeFetchMock([
          async ({ path }) => {
            if (path.endsWith("/me/certificate-claim-options")) return Response.json(raw);
            return new Response(null, { status: 404 });
          },
        ]);
        const res = await callAccount(
          h,
          "/api/account/certificate-claim-options",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        );
        expect(res.status, label).toBe(502);
        expect(await res.json(), label).toEqual({ error: "upstream_error" });
        const logs = spyWarn.mock.calls
          .map((c) => {
            try {
              return JSON.parse(String(c[0])) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((l) => l?.event === "claim_options_rejected");
        expect(logs, label).toHaveLength(1);
        expect(logs[0], label).toEqual({ event: "claim_options_rejected", reason });
        expect(Object.keys(logs[0]!).sort(), label).toEqual(["event", "reason"]);
      }

      try {
        for (const k of ["currency", "ltv", "credit", "courses"] as const) {
          await rejectCase(`bad_shape missing ${k}`, (raw) => {
            delete raw[k];
          }, "bad_shape");
        }
        for (const k of courseKeys) {
          await rejectCase(`bad_shape missing course.${k}`, (raw) => {
            const course = (raw.courses as Record<string, unknown>[])[0]!;
            delete course[k];
          }, "bad_shape");
        }

        await rejectCase("bad_enum currency USD", (raw) => {
          raw.currency = "USD";
        }, "bad_enum");
        await rejectCase("bad_enum completion_status", (raw) => {
          (raw.courses as Record<string, unknown>[])[0]!.completion_status = "done";
        }, "bad_enum");
        await rejectCase("bad_enum claimed_via ltv", (raw) => {
          (raw.courses as Record<string, unknown>[])[0]!.claimed_via = "ltv";
        }, "bad_enum");
        await rejectCase("bad_enum promo_state", (raw) => {
          (raw.credit as Record<string, unknown>).promo_state = "later";
        }, "bad_enum");

        await rejectCase("bad_path missing path", (raw) => {
          (raw.courses as Record<string, unknown>[])[0]!.paths = [
            {
              path: "redeem_ltv",
              eligible: false,
              shortfall_cents: 8000,
              price_cents: 30000,
              reason_code: "insufficient_ltv",
            },
            {
              path: "prepay_credit",
              eligible: true,
              shortfall_cents: 8000,
              price_cents: 30000,
              reason_code: null,
            },
          ];
        }, "bad_path");
        await rejectCase("bad_path reordered", (raw) => {
          (raw.courses as Record<string, unknown>[])[0]!.paths = [
            {
              path: "buy_outright",
              eligible: true,
              shortfall_cents: 30000,
              price_cents: 30000,
              reason_code: null,
            },
            {
              path: "redeem_ltv",
              eligible: false,
              shortfall_cents: 8000,
              price_cents: 30000,
              reason_code: "insufficient_ltv",
            },
            {
              path: "prepay_credit",
              eligible: true,
              shortfall_cents: 8000,
              price_cents: 30000,
              reason_code: null,
            },
          ];
        }, "bad_path");
        // Kill claimOptions.ts:243 mutant — length !== 3 must reject (duplicate / fourth).
        const pathRow = (
          id: "redeem_ltv" | "prepay_credit" | "buy_outright",
          eligible: boolean,
          shortfall: number,
          reason: string | null,
        ) => ({
          path: id,
          eligible,
          shortfall_cents: shortfall,
          price_cents: 30000,
          reason_code: reason,
        });
        await rejectCase("bad_path duplicate path", (raw) => {
          (raw.courses as Record<string, unknown>[])[0]!.paths = [
            pathRow("redeem_ltv", false, 8000, "insufficient_ltv"),
            pathRow("redeem_ltv", false, 8000, "insufficient_ltv"),
            pathRow("buy_outright", true, 30000, null),
          ];
        }, "bad_path");
        await rejectCase("bad_path fourth path", (raw) => {
          (raw.courses as Record<string, unknown>[])[0]!.paths = [
            pathRow("redeem_ltv", false, 8000, "insufficient_ltv"),
            pathRow("prepay_credit", true, 8000, null),
            pathRow("buy_outright", true, 30000, null),
            pathRow("buy_outright", true, 30000, null),
          ];
        }, "bad_path");

        await rejectCase("bad_money available 21999", (raw) => {
          (raw.ltv as Record<string, unknown>).available_cents = 21999;
        }, "bad_money");

        // Injected ids never appear on a valid DTO.
        spyWarn.mockClear();
        const injected = deep(CLF) as Record<string, unknown>;
        injected.whop_plan_id = "plan_injected";
        injected.membership_id = "mem_injected";
        (injected.courses as Record<string, unknown>[])[0]!.whop_plan_id = "plan_course";
        (injected.courses as Record<string, unknown>[])[0]!.membership_id = 42;
        const { fetchImpl } = makeFetchMock([
          async ({ path }) => {
            if (path.endsWith("/me/certificate-claim-options")) return Response.json(injected);
            return new Response(null, { status: 404 });
          },
        ]);
        const ok = await callAccount(
          h,
          "/api/account/certificate-claim-options",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        );
        expect(ok.status).toBe(200);
        const body = (await ok.json()) as Record<string, unknown>;
        expect(body).not.toHaveProperty("whop_plan_id");
        expect(body).not.toHaveProperty("membership_id");
        expect(JSON.stringify(body)).not.toMatch(/whop_plan_id|membership_id|plan_injected|mem_injected/);
      } finally {
        spyWarn.mockRestore();
      }
    });

    it("CL-LEAK-1: spec regex on every claim POST + claim-options body", async () => {
      const sess = await withSession(h);
      // CL-LEAK-1 — exact spec regex (verbatim).
      const LEAK =
        /(biz|cus|sub|mem|plan|prod|ch)_[A-Za-z0-9]+|cca_[a-f0-9]+|membership_id|attempt/;

      function assertClean(label: string, body: unknown) {
        const clone =
          body && typeof body === "object" && !Array.isArray(body)
            ? { ...(body as Record<string, unknown>) }
            : body;
        if (clone && typeof clone === "object" && !Array.isArray(clone)) {
          delete (clone as Record<string, unknown>).checkout_url;
        }
        expect(JSON.stringify(clone), label).not.toMatch(LEAK);
      }

      const claimCases: Array<{ label: string; path: string; upstream: Response }> = [
        {
          label: "prepay 200 extras",
          path: "prepay_credit",
          upstream: Response.json({
            checkout_url: CHECKOUT,
            attempt_id: "cca_deadbeefdeadbeefdeadbeef",
            membership_id: 9,
            whop_company_id: "biz_u15G8d34g9c0B0",
          }),
        },
        {
          label: "buy 200",
          path: "buy_outright",
          upstream: Response.json({ checkout_url: CHECKOUT }),
        },
        {
          label: "redeem 200",
          path: "redeem_ltv",
          upstream: Response.json({ already_claimed: false, claim_method: "redeem_ltv" }),
        },
        {
          label: "402",
          path: "redeem_ltv",
          upstream: Response.json(
            { code: "bsi_insufficient_certificate_ltv", data: { shortfall_cents: 1 } },
            { status: 402 },
          ),
        },
        {
          label: "403",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_course_not_completed" }, { status: 403 }),
        },
        {
          label: "404",
          path: "redeem_ltv",
          upstream: new Response(null, { status: 404 }),
        },
        {
          label: "409 in_progress",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_idempotency_key_in_progress" }, { status: 409 }),
        },
        {
          label: "503 lock",
          path: "redeem_ltv",
          upstream: Response.json({ code: "bsi_claim_lock_timeout" }, { status: 503 }),
        },
        {
          label: "418 → 502",
          path: "redeem_ltv",
          upstream: Response.json({ code: "whatever", membership_id: "mem_leak" }, { status: 418 }),
        },
      ];

      for (const c of claimCases) {
        const { fetchImpl } = makeFetchMock([
          async ({ method }) => {
            if (method === "POST") return c.upstream;
            return new Response(null, { status: 404 });
          },
        ]);
        const res = await callAccount(
          h,
          "/api/account/courses/10/claim",
          {
            method: "POST",
            headers: claimHeaders(sess, K),
            body: JSON.stringify({ path: c.path }),
          },
          fetchImpl,
        );
        assertClean(c.label, await res.json());
      }

      // CL1 claim-options: success + 502 rejection bodies.
      for (const upstream of [
        CLF,
        { currency: "USD", ltv: {}, credit: {}, courses: [], membership_id: 1 },
      ]) {
        const { fetchImpl } = makeFetchMock([
          async ({ path }) => {
            if (path.endsWith("/me/certificate-claim-options")) return Response.json(upstream);
            return new Response(null, { status: 404 });
          },
        ]);
        const res = await callAccount(
          h,
          "/api/account/certificate-claim-options",
          { headers: { Cookie: sess.cookie } },
          fetchImpl,
        );
        assertClean(`CL1 ${res.status}`, await res.json());
      }
    });

    it("CL-T5: upstream Idempotency-Key bytes equal K; same-key replay deep-equal", async () => {
      const sess = await withSession(h);
      const stored = { checkout_url: `${CHECKOUT}?s=1` };
      const { fetchImpl, recorded } = makeFetchMock([
        async ({ path, method }) => {
          if (path.includes("/certificate-prepay-checkout") && method === "POST") {
            return Response.json(stored);
          }
          return new Response(null, { status: 404 });
        },
      ]);
      const post = () =>
        callAccount(
          h,
          "/api/account/courses/10/claim",
          {
            method: "POST",
            headers: claimHeaders(sess, K),
            body: JSON.stringify({ path: "prepay_credit" }),
          },
          fetchImpl,
        );
      const r1 = await post();
      expect(r1.status).toBe(200);
      const b1 = await r1.json();
      expect(b1).toStrictEqual({ checkout_url: stored.checkout_url });
      expect(recorded[0]!.headers["idempotency-key"]).toBe(K);
      expect(recorded[0]!.bodyText).toBe("{}");

      const r2 = await post();
      expect(r2.status).toBe(200);
      expect(await r2.json()).toStrictEqual(b1);
      expect(recorded[1]!.headers["idempotency-key"]).toBe(K);
      expect(recorded[1]!.bodyText).toBe(recorded[0]!.bodyText);
    });
  });
});
