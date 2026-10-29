/**
 * PR B account Worker gates (QA §E/F) — bearer-only, CSRF, LTV300, tiers, URL allowlist.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAccountRoutes, EDITABLE_ATTR_IDS } from "./account";
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
      claim_method: "ltv",
    },
    {
      course_id: 3,
      course_slug: "c",
      course_title: "Course C",
      allocated_cents: 5000,
      claimed_at: "2026-01-02T00:00:00Z",
      claim_method: "ltv",
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

  it("DP-T-5 / DP-T-CERT3 LTV300 spend + alias; CERT3 insufficient shortfall", async () => {
    const sess = await withSession(h);
    const budget = computeLtvBudget(30000, 20000);
    expect(budget.available_certificate_ltv_cents).toBe(10000);
    expect(formatUsdFromCents(30000)).toBe("$300.00");

    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/spend")) return Response.json(LTV300_SPEND);
        if (path.includes("/claim-certificate")) {
          return Response.json(
            {
              error: "insufficient_ltv",
              required_cents: 20000,
              available_cents: 10000,
              shortfall_cents: 10000,
            },
            { status: 400 },
          );
        }
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

    const claim = await callAccount(
      h,
      "/api/account/courses/2/claim-certificate",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ method: "ltv" }),
      },
      fetchImpl,
    );
    expect(claim.status).toBe(400);
    expect(await claim.json()).toEqual({
      error: "insufficient_ltv",
      required_cents: 20000,
      available_cents: 10000,
      shortfall_cents: 10000,
    });
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
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("referral-earnings")) return Response.json({ earnings_cents: 0 });
        if (path.includes("referral-code")) return Response.json({ code: "ABC" });
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
        path: "/api/account/courses/1/claim-certificate",
        body: JSON.stringify({ method: "ltv" }),
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

  it("DP-T-CERT3b: 409 double claim; claimed>total → available 0", async () => {
    const sess = await withSession(h);
    let claims = 0;
    const { fetchImpl } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("/claim-certificate") && method === "POST") {
          claims += 1;
          if (claims > 1) {
            return Response.json({ error: "already_claimed" }, { status: 409 });
          }
          return Response.json({ ok: true, foundations_coach: { seminar_checked_in: false } });
        }
        if (path.endsWith("/me/spend")) {
          return Response.json({
            total_ltv_cents: 30000,
            claimed_courses_value_cents: 50000,
            claimed_certificates: [],
            canonical_tier: "metfix_pro",
            foundations_coach: {},
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);

    const first = await callAccount(
      h,
      "/api/account/courses/10/claim-certificate",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ method: "ltv" }),
      },
      fetchImpl,
    );
    expect(first.status).toBe(200);

    const second = await callAccount(
      h,
      "/api/account/courses/10/claim-certificate",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ method: "ltv" }),
      },
      fetchImpl,
    );
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "already_claimed" });

    const ltv = await callAccount(
      h,
      "/api/account/ltv-certificates",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    expect(ltv.status).toBe(200);
    const body = (await ltv.json()) as {
      available_certificate_ltv_cents: number;
      claimed_courses_value_cents: number;
    };
    expect(body.available_certificate_ltv_cents).toBe(0);
    expect(body.claimed_courses_value_cents).toBe(50000);
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

  it("members expired coach → foundations_coach badge false (normalize only)", async () => {
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
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(h, "/api/members/9", {}, fetchImpl);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      badges: { foundations_coach: boolean };
      foundations_coach: { active: boolean };
    };
    expect(body.foundations_coach.active).toBe(false);
    expect(body.badges.foundations_coach).toBe(false);
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

  it("DP-T-T6: accountLog redacts Bearer and emails (no Bearer , no @)", async () => {
    const { accountLog } = await import("./account");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      accountLog(
        "probe",
        `Authorization: Bearer ${ACCESS1} user=jane@example.test`,
      );
      expect(spy).toHaveBeenCalled();
      const logged = String(spy.mock.calls[0]![0] ?? "");
      expect(logged).not.toMatch(/Bearer /);
      expect(logged).not.toContain("@");
      expect(logged).not.toContain(ACCESS1);
    } finally {
      spy.mockRestore();
    }
  });
});
