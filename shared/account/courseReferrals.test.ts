import { describe, expect, it, vi } from "vitest";
import {
  ATTEMPT_ID_RE,
  buildCheckoutDto,
  buildReferralsDto,
  canGenerateCourseReferrals,
  estimateMatchesIntegerBounds,
  isAllowedReferralUrl,
  isBadCommissionBps,
  mapFoundationCertifiedAlias,
  shapeEarnings,
} from "./courseReferrals";
import { BEP_WHOP_COMPANY_ID } from "./whop";

const NOW = Date.parse("2026-10-28T22:00:00.000Z");

const CONTRACT_JOIN = {
  id: 7,
  slug: "cfexample9",
  whop_affiliate_code: "cfexample9",
  commission_percent: 15,
  commission_bps: 1500,
  join_url: "https://brokenscience.org/share/?slug=cfexample9",
};

const CONTRACT_LINK = {
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
};

/** Active coach grant for normalizeFoundationsCoachStatus (CQ-CR-E8). */
function coachGrant(expiresAt: string, grantedAt = "2024-01-15T12:00:00.000Z") {
  return {
    seminar_checked_in: true,
    granted_at: grantedAt,
    expires_at: expiresAt,
    metfix_essentials_completed: false,
    metfix_essentials_certificate_claimed: false,
  };
}

describe("canGenerateCourseReferrals (CR-ELIG-1/2)", () => {
  it("organization is eligible even with expired coach object", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "organization",
        foundations_coach: coachGrant("2020-01-01T00:00:00.000Z"),
      },
      NOW,
    );
    expect(r).toEqual({ eligible: true, eligibility_type: "organization" });
  });

  it("organization_owner tier is eligible", () => {
    expect(
      canGenerateCourseReferrals({ canonical_tier: "organization_owner" }, NOW),
    ).toEqual({ eligible: true, eligibility_type: "organization" });
  });

  it("coach expires_at = now+1ms via normalizer → eligible", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "foundations_coach",
        foundations_coach: coachGrant(new Date(NOW + 1).toISOString()),
      },
      NOW,
    );
    expect(r).toEqual({ eligible: true, eligibility_type: "foundations_coach" });
  });

  it("coach expires_at === now via normalizer → bsi_referral_coach_expired", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "foundations_coach",
        foundations_coach: coachGrant(new Date(NOW).toISOString()),
      },
      NOW,
    );
    expect(r).toEqual({
      eligible: false,
      reason_code: "bsi_referral_coach_expired",
    });
  });

  it("coach claim without foundations_coach object → ineligible (CQ-CR-E8)", () => {
    const r = canGenerateCourseReferrals(
      { eligibility_type: "foundations_coach" },
      NOW,
    );
    expect(r).toEqual({
      eligible: false,
      reason_code: "bsi_referral_ineligible",
    });
  });

  it("metfix_pro without coach → ineligible", () => {
    expect(
      canGenerateCourseReferrals({ canonical_tier: "metfix_pro" }, NOW),
    ).toEqual({ eligible: false, reason_code: "bsi_referral_ineligible" });
  });

  it("CR-ELIG-1 W5: unexpired foundation_certified role_slug → foundations_coach", () => {
    expect(mapFoundationCertifiedAlias("foundation_certified")).toBe("foundations_coach");
    const expires = new Date(NOW + 1000).toISOString();
    const r = canGenerateCourseReferrals(
      {
        role_slug: "foundation_certified",
        foundations_coach: coachGrant(expires),
      },
      NOW,
    );
    expect(r).toEqual({ eligible: true, eligibility_type: "foundations_coach" });
    const built = buildReferralsDto(
      {
        eligible: true,
        role_slug: "foundation_certified",
        foundations_coach: coachGrant(expires),
        foundations_coach_expires_at: expires,
        join_code: null,
        course_links: [],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.dto.eligibility_type).toBe("foundations_coach");
      expect(JSON.stringify(built.dto)).not.toContain("foundation_certified");
    }
  });

  it("CR-ELIG-1 W5: expired foundation_certified → bsi_referral_coach_expired", () => {
    expect(
      canGenerateCourseReferrals(
        {
          role_slug: "foundation_certified",
          foundations_coach: coachGrant(new Date(NOW - 1).toISOString()),
        },
        NOW,
      ),
    ).toEqual({ eligible: false, reason_code: "bsi_referral_coach_expired" });
  });

  it("organization_owner as eligibility_type alone is not a coach alias", () => {
    expect(
      canGenerateCourseReferrals(
        {
          eligibility_type: "organization_owner",
        },
        NOW,
      ),
    ).toEqual({ eligible: false, reason_code: "bsi_referral_ineligible" });
  });

  it("CQ-CR-E8: incomplete foundations_coach (no grant) → ineligible", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "foundations_coach",
        foundations_coach: { seminar_checked_in: false },
      },
      NOW,
    );
    expect(r).toEqual({ eligible: false, reason_code: "bsi_referral_ineligible" });
  });

  it("static: foundation_certified only inside mapFoundationCertifiedAlias", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./courseReferrals.ts", import.meta.url)), "utf8");
    expect(src).toMatch(/function mapFoundationCertifiedAlias/);
    const withoutMap = src.replace(
      /export function mapFoundationCertifiedAlias[\s\S]*?\n\}/,
      "export function mapFoundationCertifiedAlias(){return null}",
    );
    expect(withoutMap).not.toMatch(/foundation_certified/);
  });

  it("static: no local Date.parse expiry fallback in canGenerate", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./courseReferrals.ts", import.meta.url)), "utf8");
    const fn = src.match(
      /export function canGenerateCourseReferrals[\s\S]*?\n\}/,
    )?.[0] ?? "";
    expect(fn).toContain("normalizeFoundationsCoachStatus");
    expect(fn).not.toMatch(/foundations_coach_expires_at/);
    expect(fn).not.toMatch(/computeThreeYearExpiryIso/);
  });
});

describe("shapeEarnings (CR-EARN-1 — BSI §2.4)", () => {
  it("maps real BSI shape; currency stays lowercase; connect_status required", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      shapeEarnings({
        currency: "usd",
        pending: 1250,
        ready: 3000,
        paid_total: 0,
        connect_status: "active",
      }),
    ).toEqual({
      pending_cents: 1250,
      ready_cents: 3000,
      paid_total_cents: 0,
      currency: "usd",
      connect_status: "active",
    });
    expect(shapeEarnings({
      currency: "usd",
      pending: 0,
      ready: 0,
      paid_total: 0,
      connect_status: "none",
    })?.connect_status).toBe("none");
    expect(shapeEarnings({
      currency: "usd",
      pending: 1,
      ready: 2,
      paid_total: 3,
      connect_status: "pending",
    })?.connect_status).toBe("pending");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("omits + logs bad_shape — never throws / never signals 502", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cases = [
      { pending: 1 },
      { currency: "USD", pending: 1, ready: 1, paid_total: 1, connect_status: "active" },
      { currency: "us", pending: 1, ready: 1, paid_total: 1, connect_status: "active" },
      { currency: "usd", pending: -1, ready: 1, paid_total: 1, connect_status: "active" },
      { currency: "usd", pending: 1.5, ready: 1, paid_total: 1, connect_status: "active" },
      { currency: "usd", pending: 1, ready: 1, paid_total: 1, connect_status: "restricted" },
      // No *_cents aliases (CQ-CR-E3)
      {
        currency: "usd",
        pending_cents: 1,
        ready_cents: 1,
        paid_total_cents: 1,
        connect_status: "active",
      },
      "nope",
    ];
    for (const c of cases) {
      expect(shapeEarnings(c)).toBeNull();
    }
    expect(spy.mock.calls.length).toBe(cases.length);
    const logged = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(logged).toEqual({
      event: "referral_earnings_omitted",
      reason: "bad_shape",
    });
    expect(Object.keys(logged).sort()).toEqual(["event", "reason"]);
    spy.mockRestore();
  });

  it("buildReferralsDto never 502s on bad earnings", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        canonical_tier: "organization_owner",
        join_code: null,
        course_links: [],
      },
      { garbage: true },
      NOW,
    );
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.dto.earnings).toBeUndefined();
    spy.mockRestore();
  });
});

describe("isAllowedReferralUrl (CR-URL-1)", () => {
  const accept = [
    "https://metfix.org/x",
    "https://www.metfix.org/x",
    "https://brokenscience.org/x",
    "https://www.brokenscience.org/x",
    "https://BrokenScience.org/x",
  ];
  const reject = [
    "http://brokenscience.org/x",
    "http://metfix.org/x",
    "https://evil.example/x",
    "https://brokenscience.org.evil.com/x",
    "https://metfix.org.evil.com/x",
    "https://evilmetfix.org/x",
    "https://evilbrokenscience.org/x",
    "https://user@brokenscience.org/x",
    "https://u:p@metfix.org/x",
    "https://metfix.org:8443/x",
    "https://brokenscience.org:8443/x",
    "javascript:alert(1)",
    "//metfix.org/x",
    "/courses/x",
    "",
  ];
  for (const u of accept) {
    it(`accepts ${u}`, () => expect(isAllowedReferralUrl(u)).toBe(true));
  }
  for (const u of reject) {
    it(`rejects ${JSON.stringify(u)}`, () => expect(isAllowedReferralUrl(u)).toBe(false));
  }
});

describe("commission bps + estimate (CR-COMM-2)", () => {
  it("isBadCommissionBps table", () => {
    expect(isBadCommissionBps(-1)).toBe(true);
    expect(isBadCommissionBps(10001)).toBe(true);
    expect(isBadCommissionBps(NaN)).toBe(true);
    expect(isBadCommissionBps(Infinity)).toBe(true);
    expect(isBadCommissionBps(20.5)).toBe(true);
    expect(isBadCommissionBps("1500")).toBe(true);
    expect(isBadCommissionBps(0)).toBe(false);
    expect(isBadCommissionBps(10000)).toBe(false);
    expect(isBadCommissionBps(1550)).toBe(false);
  });

  it("estimate integer floor/round set", () => {
    expect(estimateMatchesIntegerBounds(20000, 1500, 3000)).toBe(true);
    expect(estimateMatchesIntegerBounds(20000, 1500, 2999)).toBe(false);
    expect(estimateMatchesIntegerBounds(20000, 1500, 3001)).toBe(false);
    expect(estimateMatchesIntegerBounds(333, 1500, 49)).toBe(true);
    expect(estimateMatchesIntegerBounds(333, 1500, 50)).toBe(true);
    expect(estimateMatchesIntegerBounds(333, 1500, 48)).toBe(false);
    expect(estimateMatchesIntegerBounds(333, 1500, 51)).toBe(false);
    expect(estimateMatchesIntegerBounds(3, 1000, 0)).toBe(true);
    expect(estimateMatchesIntegerBounds(3, 1000, 1)).toBe(false);
    expect(estimateMatchesIntegerBounds(333, 1500, 49.5)).toBe(false);
    expect(estimateMatchesIntegerBounds(333, 1500, "50")).toBe(false);
  });

  it("static: no Math.round/ceil/abs in courseReferrals.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./courseReferrals.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/Math\.round/);
    expect(src).not.toMatch(/Math\.ceil/);
    expect(src).not.toMatch(/Math\.abs/);
  });
});

describe("buildReferralsDto", () => {
  it("§3.2 contract fixture passes; strips policy", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        reason_code: null,
        payee_entity_id: 42,
        payee_display_name: "CrossFit Example Affiliate",
        foundations_coach_expires_at: "2029-10-28T18:00:00Z",
        join_code: CONTRACT_JOIN,
        course_links: [CONTRACT_LINK],
        commission_policy: { commission_percent: 25, commission_bps: 2500 },
      },
      {
        currency: "usd",
        pending: 0,
        ready: 100,
        paid_total: 500,
        connect_status: "active",
      },
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.join_code?.commission_percent).toBe(15);
    expect(built.dto.course_links).toHaveLength(1);
    expect(JSON.stringify(built.dto)).not.toContain("commission_policy");
    expect(JSON.stringify(built.dto)).not.toContain("payee_entity_id");
    expect(built.dto.course_links_dropped).toBe(0);
    expect(built.dto.join_code_dropped).toBe(false);
    expect(built.dto.earnings).toEqual({
      pending_cents: 0,
      ready_cents: 100,
      paid_total_cents: 500,
      currency: "usd",
      connect_status: "active",
    });
  });

  it("W3 join_code_dropped true only on commission mismatch; bad join_url leaves false", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mismatch = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: { ...CONTRACT_JOIN, commission_percent: 20, commission_bps: 1500 },
        course_links: [CONTRACT_LINK],
      },
      undefined,
      NOW,
    );
    expect(mismatch.ok).toBe(true);
    if (mismatch.ok) {
      expect(mismatch.dto.join_code).toBeNull();
      expect(mismatch.dto.join_code_dropped).toBe(true);
      expect(mismatch.dto.course_links).toHaveLength(1);
      expect(mismatch.logs).toContainEqual({
        event: "course_link_dropped",
        reason: "join_code_commission_mismatch",
        course_id: null,
      });
    }
    const badUrl = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: { ...CONTRACT_JOIN, join_url: "http://evil.example/x" },
        course_links: [CONTRACT_LINK],
      },
      undefined,
      NOW,
    );
    expect(badUrl.ok).toBe(true);
    if (badUrl.ok) {
      expect(badUrl.dto.join_code).not.toBeNull();
      expect(badUrl.dto.join_code?.join_url).toBeNull();
      expect(badUrl.dto.join_code_dropped).toBe(false);
    }
    const upstreamNull = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: null,
        course_links: [],
      },
      undefined,
      NOW,
    );
    expect(upstreamNull.ok).toBe(true);
    if (upstreamNull.ok) {
      expect(upstreamNull.dto.join_code_dropped).toBe(false);
      expect(typeof upstreamNull.dto.join_code_dropped).toBe("boolean");
    }
    warn.mockRestore();
  });

  it("CR-DROP-T1: keeps 50 and 3000, drops 51", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: CONTRACT_JOIN,
        course_links: [
          { ...CONTRACT_LINK, course_id: 1, course_price_cents: 333, estimated_commission_cents: 50 },
          { ...CONTRACT_LINK, course_id: 2, course_price_cents: 333, estimated_commission_cents: 51 },
          { ...CONTRACT_LINK, course_id: 3, course_price_cents: 20000, estimated_commission_cents: 3000 },
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.course_links.map((c) => c.course_id)).toEqual([1, 3]);
    expect(built.dto.course_links[0]!.estimated_commission_cents).toBe(50);
    expect(built.dto.course_links_dropped).toBe(1);
    expect(built.logs).toEqual([
      { event: "course_link_dropped", reason: "estimate_mismatch", course_id: 2 },
    ]);
    warn.mockRestore();
  });

  it("CR-DROP-T2: bps 10001 → fatal even with bad share_url", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: CONTRACT_JOIN,
        course_links: [
          {
            ...CONTRACT_LINK,
            commission_bps: 10001,
            share_url: "http://evil.example/x",
          },
        ],
      },
      undefined,
      NOW,
    );
    expect(built).toEqual({ ok: false, error: "upstream_error" });
  });

  it("W1 order: bad percent + later bad bps → 502, 0 drops", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        course_links: [
          { ...CONTRACT_LINK, course_id: 1, commission_percent: 20, commission_bps: 1500 },
          { ...CONTRACT_LINK, course_id: 2, commission_bps: 10001 },
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(false);
  });

  it("multi-fault row logs first reason only", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        course_links: [
          {
            ...CONTRACT_LINK,
            commission_percent: 20,
            course_price_cents: -1,
            currency: "usd",
            share_url: "http://evil.example",
            estimated_commission_cents: 999,
          },
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.logs[0]!.reason).toBe("commission_mismatch");
  });

  it("W1: only currency + share_url bad → bad_currency", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        course_links: [
          {
            ...CONTRACT_LINK,
            currency: "usd",
            share_url: "http://evil.example/x",
          },
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.course_links).toEqual([]);
    expect(built.dto.course_links_dropped).toBe(1);
    expect(built.logs).toEqual([
      {
        event: "course_link_dropped",
        reason: "bad_currency",
        course_id: CONTRACT_LINK.course_id,
      },
    ]);
  });

  it("W1: only share_url + estimate bad → bad_share_url", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        course_links: [
          {
            ...CONTRACT_LINK,
            share_url: "http://evil.example/x",
            estimated_commission_cents: 9999,
          },
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.course_links).toEqual([]);
    expect(built.dto.course_links_dropped).toBe(1);
    expect(built.logs).toEqual([
      {
        event: "course_link_dropped",
        reason: "bad_share_url",
        course_id: CONTRACT_LINK.course_id,
      },
    ]);
  });

  it("ineligible forces empty with 0 drops", () => {
    const built = buildReferralsDto(
      {
        eligible: false,
        reason_code: "bsi_referral_ineligible",
        join_code: CONTRACT_JOIN,
        course_links: [CONTRACT_LINK],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.join_code).toBeNull();
    expect(built.dto.course_links).toEqual([]);
    expect(built.dto.course_links_dropped).toBe(0);
    expect(built.logs).toEqual([]);
  });

  it("join_code percent mismatch nulls join_code and sets join_code_dropped", () => {
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: { ...CONTRACT_JOIN, commission_percent: 20, commission_bps: 1500 },
        course_links: [CONTRACT_LINK],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.join_code).toBeNull();
    expect(built.dto.join_code_dropped).toBe(true);
    expect(built.dto.course_links).toHaveLength(1);
    expect(built.dto.course_links_dropped).toBe(0);
  });
});

describe("buildCheckoutDto + attempt_id (CR-ATTEMPT-1 / CR-COALESCE-4)", () => {
  const base = {
    attempt_id: "cca_9f8e7d6c5b4a3f2e1d0c9b8a",
    course_id: 20231,
    checkout_url: "https://whop.com/checkout/plan_course_essentials/?d2c=true&a=cfexample9",
    whop_company_id: BEP_WHOP_COMPANY_ID,
    whop_product_id: "prod_course_essentials",
    whop_plan_id: "plan_course_essentials",
    whop_checkout_config_id: "ch_cfg_01J",
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

  it("§4.2 fixture passes and strips internals", () => {
    const built = buildCheckoutDto(base, BEP_WHOP_COMPANY_ID);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.attempt_id).toBe("cca_9f8e7d6c5b4a3f2e1d0c9b8a");
    const s = JSON.stringify(built.dto);
    expect(s).not.toContain("whop_checkout_config_id");
    expect(s).not.toContain("payee_entity_id");
    expect(s).not.toContain("whop_company_id");
    expect(s).not.toContain("whop_product_id");
    expect(s).not.toContain("whop_plan_id");
  });

  it("attempt_id edges", () => {
    expect(ATTEMPT_ID_RE.test("cca_" + "a".repeat(24))).toBe(true);
    expect(ATTEMPT_ID_RE.test("cca_" + "a".repeat(32))).toBe(true);
    expect(ATTEMPT_ID_RE.test("cca_" + "a".repeat(28))).toBe(true);
    expect(ATTEMPT_ID_RE.test("cca_" + "a".repeat(23))).toBe(false);
    expect(ATTEMPT_ID_RE.test("cca_" + "a".repeat(33))).toBe(false);
    expect(ATTEMPT_ID_RE.test("cca_9F8E7d6c5b4a3f2e1d0c9b8a")).toBe(false);
    expect(ATTEMPT_ID_RE.test("cc_" + "a".repeat(24))).toBe(false);
    expect(ATTEMPT_ID_RE.test("CCA_" + "a".repeat(24))).toBe(false);
    expect(ATTEMPT_ID_RE.test("cca_" + "a".repeat(24) + "\n")).toBe(false);
    expect(ATTEMPT_ID_RE.test(" cca_" + "a".repeat(24))).toBe(false);
    expect(ATTEMPT_ID_RE.test("cca-" + "a".repeat(24))).toBe(false);
    expect(ATTEMPT_ID_RE.test("ccb_" + "a".repeat(24))).toBe(false);
    expect(ATTEMPT_ID_RE.test("cca_" + "A".repeat(32))).toBe(false);
  });

  it("N1: non-object + incomplete identity fields → bad_row (not bad_price)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: CONTRACT_JOIN,
        course_links: [
          null,
          "skip-me",
          { ...CONTRACT_LINK, course_id: 10, course_slug: "" },
          { ...CONTRACT_LINK, course_id: 11, whop_plan_id: "" },
          { ...CONTRACT_LINK, course_id: 12, course_title: null },
          CONTRACT_LINK,
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.course_links.map((c) => c.course_id)).toEqual([CONTRACT_LINK.course_id]);
    expect(built.dto.course_links_dropped).toBe(5);
    expect(built.logs.map((l) => l.reason)).toEqual([
      "bad_row",
      "bad_row",
      "bad_row",
      "bad_row",
      "bad_row",
    ]);
    expect(built.logs[0]).toEqual({
      event: "course_link_dropped",
      reason: "bad_row",
      course_id: null,
    });
    expect(built.logs[2]).toEqual({
      event: "course_link_dropped",
      reason: "bad_row",
      course_id: 10,
    });
    warn.mockRestore();
  });

  it("CR-COMM-2 bad_price / bad_currency / bad_join_url + multi-fault first reason", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = buildReferralsDto(
      {
        eligible: true,
        eligibility_type: "organization",
        join_code: {
          ...CONTRACT_JOIN,
          join_url: "http://brokenscience.org/bad",
        },
        course_links: [
          { ...CONTRACT_LINK, course_id: 1, course_price_cents: -1 },
          { ...CONTRACT_LINK, course_id: 2, currency: "usd" },
          {
            ...CONTRACT_LINK,
            course_id: 3,
            commission_percent: 20,
            course_price_cents: -1,
            currency: "usd",
            share_url: "http://evil",
          },
        ],
      },
      undefined,
      NOW,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.dto.join_code?.join_url).toBeNull();
    expect(built.dto.course_links_dropped).toBe(3);
    expect(built.logs.map((l) => l.reason)).toEqual([
      "bad_join_url",
      "bad_price",
      "bad_currency",
      "commission_mismatch",
    ]);
    warn.mockRestore();
  });

  it("wrong company → 502", () => {
    expect(buildCheckoutDto({ ...base, whop_company_id: "biz_OTHER" }, BEP_WHOP_COMPANY_ID).ok).toBe(
      false,
    );
  });

  it("W2 attribution percent mismatch → 502", () => {
    expect(
      buildCheckoutDto(
        {
          ...base,
          attribution: { ...base.attribution, commission_percent: 20, commission_bps: 1500 },
        },
        BEP_WHOP_COMPANY_ID,
      ).ok,
    ).toBe(false);
  });

  it("none with 0/0 passes", () => {
    const built = buildCheckoutDto(
      {
        ...base,
        attribution: {
          attribution_source: "none",
          bsi_ref_slug: null,
          whop_affiliate_code: null,
          commission_percent: 0,
          commission_bps: 0,
        },
      },
      BEP_WHOP_COMPANY_ID,
    );
    expect(built.ok).toBe(true);
  });
});
