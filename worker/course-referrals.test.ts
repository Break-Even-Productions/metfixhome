/**
 * PR D course referrals + checkout gates (QA r1.4 — 39 [CI] coverage).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAccountRoutes } from "./account";
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
import { BEP_WHOP_COMPANY_ID } from "../shared/account/whop";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

setupAuthHooks();

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const NOW_ISO = "2026-10-28T22:00:00.000Z";

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
    expect(rec.headers.authorization).toMatch(/^Bearer /);
  }
}

function assertNoStore(res: Response) {
  expect(res.headers.get("Cache-Control")).toBe("private, no-store");
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

function installLimiters(env: Env, max = 100) {
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
      if (headers["x-api-key"] && headers.authorization) {
        return new Response("trap", { status: 500 });
      }
    }
    const path = new URL(url).pathname;
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

const JOIN = {
  id: 7,
  slug: "cfexample9",
  whop_affiliate_code: "cfexample9",
  commission_percent: 15,
  commission_bps: 1500,
  join_url: "https://brokenscience.org/share/?slug=cfexample9",
};

function link(over: Record<string, unknown> = {}) {
  return {
    course_id: 20231,
    course_slug: "metfix-essentials",
    course_title: "MetFix Essentials",
    course_price_cents: 20000,
    currency: "USD",
    commission_percent: 15,
    commission_bps: 1500,
    estimated_commission_cents: 3000,
    bsi_ref_slug: "cfexample9",
    whop_affiliate_code: "cfexample9",
    whop_plan_id: "plan_course_essentials",
    share_url: "https://brokenscience.org/courses/metfix-essentials/?bsi_ref=cfexample9",
    ...over,
  };
}

const REFERRALS_OK = {
  eligible: true,
  eligibility_type: "organization",
  reason_code: null,
  payee_entity_id: 42,
  payee_display_name: "CrossFit Example Affiliate",
  foundations_coach_expires_at: "2029-10-28T18:00:00Z",
  join_code: JOIN,
  course_links: [link()],
};

const CHECKOUT_OK = {
  attempt_id: "cca_9f8e7d6c5b4a3f2e1d0c9b8a",
  course_id: 20231,
  checkout_url: "https://whop.com/checkout/plan_course_essentials/?d2c=true&a=cfexample9",
  whop_company_id: BEP_WHOP_COMPANY_ID,
  whop_product_id: "prod_course_essentials",
  whop_plan_id: "plan_course_essentials",
  whop_checkout_config_id: "ch_cfg_01Jtest",
  course_price_cents: 20000,
  currency: "USD",
  attribution: {
    attribution_source: "primary_org",
    payee_entity_id: 42,
    bsi_ref_slug: "cfexample9",
    whop_affiliate_code: "cfexample9",
    commission_percent: 15,
    commission_bps: 1500,
  },
};

/** BSI account-api-gaps rev1.3.18 §2.4 documented payload (not *_cents). */
const EARNINGS = {
  currency: "usd",
  pending: 0,
  ready: 100,
  paid_total: 500,
  connect_status: "active",
};

describe("PR D course referrals + checkout", () => {
  let h: Harness;

  beforeEach(() => {
    h = createHarness();
    installLimiters(h.env);
  });

  it("CR-WHOP-1 repo scan: only BEP biz_ literal; zero foreign curie biz", () => {
    const dirs = ["client", "worker", "shared"].map((d) => join(REPO_ROOT, d));
    const files: string[] = [];
    function walk(dir: string) {
      if (!existsSync(dir)) return;
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === "node_modules" || ent.name === "dist") continue;
        const full = join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsonc|json)$/.test(ent.name)) files.push(full);
      }
    }
    for (const d of dirs) walk(d);
    files.push(join(REPO_ROOT, "wrangler.jsonc"));
    const bizHits: string[] = [];
    for (const f of files) {
      const rel = relative(REPO_ROOT, f);
      if (/\.test\.(ts|tsx)$/.test(rel)) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/biz_[A-Za-z0-9]+/g)) {
        if (m[0] !== BEP_WHOP_COMPANY_ID) bizHits.push(`${rel}:${m[0]}`);
      }
    }
    expect(bizHits).toEqual([]);
    // Only one production source of the literal (shared/account/whop.ts)
    const whopSrc = readFileSync(join(REPO_ROOT, "shared/account/whop.ts"), "utf8");
    expect(whopSrc).toContain(BEP_WHOP_COMPANY_ID);
  });

  it("CR1 GET referrals + alias strips policy/ids; merges earnings", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/referrals")) {
          return Response.json({
            ...REFERRALS_OK,
            commission_policy: { commission_percent: 25, commission_bps: 2500 },
          });
        }
        if (path.includes("referral-earnings")) return Response.json(EARNINGS);
        return new Response(null, { status: 404 });
      },
    ]);
    for (const path of ["/api/account/referrals", "/api/account/course-referrals"]) {
      const res = await callAccount(h, path, { headers: { Cookie: sess.cookie } }, fetchImpl);
      assertNoStore(res);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.eligible).toBe(true);
      expect(body.join_code.commission_percent).toBe(15);
      expect(body.course_links[0].estimated_commission_cents).toBe(3000);
      expect(body.earnings).toEqual({
        pending_cents: 0,
        ready_cents: 100,
        paid_total_cents: 500,
        currency: "USD",
      });
      const s = JSON.stringify(body);
      expect(s).not.toContain("commission_policy");
      expect(s).not.toContain("payee_entity_id");
      expect(s).not.toContain('"id":7');
      expect(body).not.toHaveProperty("commission_policy");
    }
    for (const r of recorded.filter((x) => x.url.includes("/wp-json/"))) {
      expect(Object.keys(r.headers).sort()).toEqual(
        expect.arrayContaining(["accept", "authorization", "user-agent"]),
      );
      expect(r.headers["x-api-key"]).toBeUndefined();
    }
  });

  it("CR-ELIG-2 ineligible forces empty even when upstream sent rows", async () => {
    const sess = await withSession(h);
    const { fetchImpl } = makeFetchMock([
      async ({ path }) => {
        if (path.endsWith("/me/referrals")) {
          return Response.json({
            eligible: false,
            reason_code: "bsi_referral_ineligible",
            join_code: JOIN,
            course_links: [link()],
          });
        }
        if (path.includes("referral-earnings")) return Response.json(EARNINGS);
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/referrals",
      { headers: { Cookie: sess.cookie } },
      fetchImpl,
    );
    const body = await res.json();
    expect(body.join_code).toBeNull();
    expect(body.course_links).toEqual([]);
    expect(body.course_links_dropped).toBe(0);
  });

  it("CR-DROP-T1 / T2 + log key allowlist", async () => {
    const sess = await withSession(h);
    const warns: unknown[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((msg) => {
      warns.push(typeof msg === "string" ? JSON.parse(msg) : msg);
    });

    const dropFixture = {
      eligible: true,
      eligibility_type: "organization",
      join_code: JOIN,
      course_links: [
        link({ course_id: 1, course_price_cents: 333, estimated_commission_cents: 50 }),
        link({ course_id: 2, course_price_cents: 333, estimated_commission_cents: 51 }),
        link({ course_id: 3, course_price_cents: 20000, estimated_commission_cents: 3000 }),
      ],
    };
    {
      const { fetchImpl } = makeFetchMock([
        async ({ path }) => {
          if (path.endsWith("/me/referrals")) return Response.json(dropFixture);
          if (path.includes("referral-earnings")) return Response.json(EARNINGS);
          return new Response(null, { status: 404 });
        },
      ]);
      const res = await callAccount(
        h,
        "/api/account/referrals",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.course_links.map((c: { course_id: number }) => c.course_id)).toEqual([1, 3]);
      expect(body.course_links[0].estimated_commission_cents).toBe(50);
      expect(body.course_links_dropped).toBe(1);
      expect(warns).toEqual([
        { event: "course_link_dropped", reason: "estimate_mismatch", course_id: 2 },
      ]);
      expect(Object.keys(warns[0] as object).sort()).toEqual(["course_id", "event", "reason"]);
    }

    warns.length = 0;
    {
      const { fetchImpl } = makeFetchMock([
        async ({ path }) => {
          if (path.endsWith("/me/referrals")) {
            return Response.json({
              ...dropFixture,
              course_links: [...dropFixture.course_links, link({ commission_bps: 10001 })],
            });
          }
          if (path.includes("referral-earnings")) return Response.json(EARNINGS);
          return new Response(null, { status: 404 });
        },
      ]);
      const res = await callAccount(
        h,
        "/api/account/referrals",
        { headers: { Cookie: sess.cookie } },
        fetchImpl,
      );
      expect(res.status).toBe(502);
      expect(warns).toEqual([]);
    }
    spy.mockRestore();
  });

  it("CR2 generate maps 403 reason_code; ≤1 upstream mutation (CQ B3)", async () => {
    const sess = await withSession(h);
    let posts = 0;
    let gets = 0;
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("referral-code") && method === "POST") {
          posts += 1;
          return Response.json(
            { code: "bsi_referral_coach_expired", message: "expired" },
            { status: 403 },
          );
        }
        if (method === "GET") gets += 1;
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/referral-code",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ action: "generate" }),
      },
      fetchImpl,
    );
    assertNoStore(res);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "referral_ineligible",
      reason_code: "bsi_referral_coach_expired",
    });
    expect(posts).toBe(1);
    expect(gets).toBe(0);
    expect(recorded.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(1);
  });

  it("CQ B2: upstream 500 with payee/whop/commission_policy → only {error}", async () => {
    const sess = await withSession(h);
    const { fetchImpl } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("/courses/20231/checkout") && method === "POST") {
          return Response.json(
            {
              error: "boom",
              payee_entity_id: 42,
              whop_checkout_config_id: "ch_leak",
              commission_policy: { commission_percent: 25 },
            },
            { status: 500 },
          );
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/courses/20231/purchase-checkout",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({}),
      },
      fetchImpl,
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["error"]);
    expect(body).toEqual({ error: "upstream_error" });
    expect(JSON.stringify(body)).not.toMatch(/payee|whop_|commission_policy/);
  });

  it("CR2 invalid action → 400 with 0 upstream", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([]);
    const res = await callAccount(
      h,
      "/api/account/course-referrals",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ action: "mint" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(400);
    expect(recorded.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(0);
  });

  it("CR3 checkout: §4.2 fixture, strips internals, maps errors", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method, bodyText }) => {
        if (path.includes("/courses/20231/checkout") && method === "POST") {
          expect(JSON.parse(bodyText)).toEqual({ bsi_ref: "cfexample9" });
          return Response.json(CHECKOUT_OK);
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/courses/20231/purchase-checkout",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({
          bsi_ref: "cfexample9",
          attribution_source: "explicit_slug",
          payee_entity_id: 99,
          commission_bps: 9999,
        }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      attempt_id: "cca_9f8e7d6c5b4a3f2e1d0c9b8a",
      course_id: 20231,
      checkout_url: "https://whop.com/checkout/plan_course_essentials/?d2c=true&a=cfexample9",
      course_price_cents: 20000,
      currency: "USD",
      attribution: {
        attribution_source: "primary_org",
        bsi_ref_slug: "cfexample9",
        whop_affiliate_code: "cfexample9",
        commission_percent: 15,
        commission_bps: 1500,
      },
    });
    const s = JSON.stringify(body);
    for (const leak of [
      "whop_checkout_config_id",
      "payee_entity_id",
      "whop_company_id",
      "whop_product_id",
      "whop_plan_id",
      "commission_policy",
    ]) {
      expect(s).not.toContain(leak);
    }
    expect(recorded.some((r) => r.url.includes("/checkout"))).toBe(true);
    expect(recorded.every((r) => !r.url.includes("purchase-checkout"))).toBe(true);

    // alias route
    const { fetchImpl: f2 } = makeFetchMock([
      async ({ path }) => {
        if (path.includes("/courses/20231/checkout")) return Response.json(CHECKOUT_OK);
        return new Response(null, { status: 404 });
      },
    ]);
    const alias = await callAccount(
      h,
      "/api/courses/20231/checkout",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({}),
      },
      f2,
    );
    expect(alias.status).toBe(200);
  });

  it("CR3 validation + error map + evil checkout_url", async () => {
    const sess = await withSession(h);

    const { fetchImpl: f0, recorded: r0 } = makeFetchMock([]);
    expect(
      (
        await callAccount(
          h,
          "/api/account/courses/0/purchase-checkout",
          {
            method: "POST",
            headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
            body: JSON.stringify({}),
          },
          f0,
        )
      ).status,
    ).toBe(400);
    expect(r0.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(0);

    const { fetchImpl: fBadRef, recorded: rBad } = makeFetchMock([]);
    const badRef = await callAccount(
      h,
      "/api/account/courses/1/purchase-checkout",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ bsi_ref: "a" }),
      },
      fBadRef,
    );
    expect(badRef.status).toBe(400);
    expect(await badRef.json()).toEqual({ error: "invalid_referral_code" });
    expect(rBad.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(0);

    for (const [code, status] of [
      ["bsi_course_not_found", 404],
      ["bsi_course_whop_mapping_not_found", 404],
      ["whop_company_mismatch", 422],
      ["whop_checkout_upstream_error", 502],
    ] as const) {
      const { fetchImpl } = makeFetchMock([
        async () => Response.json({ code, message: code }, { status }),
      ]);
      const res = await callAccount(
        h,
        "/api/account/courses/1/purchase-checkout",
        {
          method: "POST",
          headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
          body: JSON.stringify({}),
        },
        fetchImpl,
      );
      expect(res.status).toBe(status);
      assertNoStore(res);
    }

    for (const evil of [
      "http://whop.com/x",
      "https://evil.example",
      "javascript:alert(1)",
      "//evil.com",
      "https://whop.com.evil.io",
      "https://evilwhop.com",
      "https://u:p@whop.com",
      "https://curie.whop.com",
    ]) {
      const { fetchImpl } = makeFetchMock([
        async () => Response.json({ ...CHECKOUT_OK, checkout_url: evil }),
      ]);
      const res = await callAccount(
        h,
        "/api/account/courses/20231/purchase-checkout",
        {
          method: "POST",
          headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
          body: JSON.stringify({}),
        },
        fetchImpl,
      );
      expect(res.status, evil).toBe(502);
    }

    const { fetchImpl: fBiz } = makeFetchMock([
      async () => Response.json({ ...CHECKOUT_OK, whop_company_id: "biz_OTHER" }),
    ]);
    expect(
      (
        await callAccount(
          h,
          "/api/account/courses/20231/purchase-checkout",
          {
            method: "POST",
            headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
            body: JSON.stringify({}),
          },
          fBiz,
        )
      ).status,
    ).toBe(502);
  });

  it("CR-ATTEMPT-1 rejects bad attempt_id", async () => {
    const sess = await withSession(h);
    const badIds = [
      "cca_" + "a".repeat(23),
      "cca_" + "a".repeat(33),
      "cca_9F8E7d6c5b4a3f2e1d0c9b8a",
      "cc_" + "a".repeat(24),
      "CCA_" + "a".repeat(24),
      "cca_" + "g".repeat(24),
      null,
      123,
    ];
    for (const attempt_id of badIds) {
      const { fetchImpl } = makeFetchMock([
        async () => Response.json({ ...CHECKOUT_OK, attempt_id }),
      ]);
      const res = await callAccount(
        h,
        "/api/account/courses/20231/purchase-checkout",
        {
          method: "POST",
          headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
          body: JSON.stringify({}),
        },
        fetchImpl,
      );
      expect(res.status, String(attempt_id)).toBe(502);
    }
  });

  it("T-CR3 CSRF before limiter; T-CR4 no-store; CR5 429", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async () => Response.json(CHECKOUT_OK),
    ]);
    const noCsrf = await callAccount(
      h,
      "/api/account/courses/20231/purchase-checkout",
      {
        method: "POST",
        headers: {
          Cookie: sess.cookie,
          Origin: ORIGIN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      fetchImpl,
    );
    expect(noCsrf.status).toBe(403);
    assertNoStore(noCsrf);
    expect(recorded.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(0);

    h.env.ACCOUNT_WRITE_LIMITER = countingLimiter(0);
    const limited = await callAccount(
      h,
      "/api/account/courses/20231/purchase-checkout",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({}),
      },
      fetchImpl,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    assertNoStore(limited);
  });

  it("off-host 403 and signed-out 401 with 0 upstream", async () => {
    const { fetchImpl, recorded } = makeFetchMock([]);
    const off = await handleAccountRoutes(
      new Request("https://evil.example/api/account/referrals", {
        headers: { Host: "evil.example" },
      }),
      h.env,
      { fetchImpl, bsiBaseUrl: BSI_ORIGIN },
    );
    expect(off!.status).toBe(403);
    const unauth = await callAccount(h, "/api/account/referrals", {}, fetchImpl);
    expect(unauth.status).toBe(401);
    expect(recorded.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(0);
  });

  it("W2 checkout attribution mismatch → 502", async () => {
    const sess = await withSession(h);
    const { fetchImpl } = makeFetchMock([
      async () =>
        Response.json({
          ...CHECKOUT_OK,
          attribution: {
            ...CHECKOUT_OK.attribution,
            commission_percent: 20,
            commission_bps: 1500,
          },
        }),
    ]);
    const res = await callAccount(
      h,
      "/api/account/courses/20231/purchase-checkout",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({}),
      },
      fetchImpl,
    );
    expect(res.status).toBe(502);
  });

  it("CR2 200 returns CR1 DTO via same builder; exactly 1 upstream call", async () => {
    const sess = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock([
      async ({ path, method }) => {
        if (path.includes("referral-code") && method === "POST") {
          return Response.json({
            ...REFERRALS_OK,
            commission_policy: { commission_percent: 25, commission_bps: 2500 },
          });
        }
        return new Response(null, { status: 404 });
      },
    ]);
    const res = await callAccount(
      h,
      "/api/account/referral-code",
      {
        method: "POST",
        headers: hOk({ csrf: sess.csrf, sid: sess.sid }),
        body: JSON.stringify({ action: "generate" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.join_code.commission_percent).toBe(15);
    expect(body).not.toHaveProperty("commission_policy");
    expect(body).not.toHaveProperty("earnings");
    expect(recorded.filter((r) => r.url.includes("/wp-json/"))).toHaveLength(1);
  });
});

describe("CR5 limiter lockstep", () => {
  it("ACCOUNT_READ/WRITE ids lockstep in wrangler", () => {
    const raw = readFileSync(join(REPO_ROOT, "wrangler.jsonc"), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    const top = Object.fromEntries(
      json.ratelimits.map((r: { name: string; namespace_id: string; simple: unknown }) => [
        r.name,
        r,
      ]),
    );
    const prev = Object.fromEntries(
      json.previews.ratelimits.map((r: { name: string; namespace_id: string; simple: unknown }) => [
        r.name,
        r,
      ]),
    );
    expect(top.ACCOUNT_READ_LIMITER.namespace_id).toBe("27112");
    expect(top.ACCOUNT_WRITE_LIMITER.namespace_id).toBe("27113");
    expect(top.ACCOUNT_READ_LIMITER.simple).toEqual({ limit: 60, period: 60 });
    expect(top.ACCOUNT_WRITE_LIMITER.simple).toEqual({ limit: 15, period: 60 });
    expect(prev.ACCOUNT_READ_LIMITER.namespace_id).toBe("27212");
    expect(prev.ACCOUNT_WRITE_LIMITER.namespace_id).toBe("27213");
    expect(prev.ACCOUNT_READ_LIMITER.simple).toEqual(top.ACCOUNT_READ_LIMITER.simple);
    expect(prev.ACCOUNT_WRITE_LIMITER.simple).toEqual(top.ACCOUNT_WRITE_LIMITER.simple);
  });
});

describe("static client scans", () => {
  it("0 commission_policy reads in client/src outside tests; 0 hardcoded % literals", () => {
    function walk(dir: string, out: string[] = []) {
      if (!existsSync(dir)) return out;
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, ent.name);
        if (ent.isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.(ts|tsx)$/.test(ent.name)) out.push(full);
      }
      return out;
    }
    const files = walk(join(REPO_ROOT, "client/src"));
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, relative(REPO_ROOT, f)).not.toMatch(/commission_policy/);
      expect(src, relative(REPO_ROOT, f)).not.toMatch(/['"`]15%['"`]/);
      expect(src, relative(REPO_ROOT, f)).not.toMatch(/['"`]20%['"`]/);
      expect(src, relative(REPO_ROOT, f)).not.toMatch(/['"`]25%['"`]/);
      expect(src, relative(REPO_ROOT, f)).not.toMatch(/established_at/);
    }
  });
});

// silence unused ACCESS1 import warning path — used by harness login
void ACCESS1;
void NOW_ISO;
