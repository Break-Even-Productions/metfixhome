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

describe("canGenerateCourseReferrals (CR-ELIG-1/2)", () => {
  it("organization is eligible even with expired coach", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "organization",
        foundations_coach_expires_at: "2020-01-01T00:00:00.000Z",
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

  it("coach expires_at = now+1ms → eligible", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "foundations_coach",
        foundations_coach_expires_at: new Date(NOW + 1).toISOString(),
      },
      NOW,
    );
    expect(r).toEqual({ eligible: true, eligibility_type: "foundations_coach" });
  });

  it("coach expires_at === now → bsi_referral_coach_expired", () => {
    const r = canGenerateCourseReferrals(
      {
        eligibility_type: "foundations_coach",
        foundations_coach_expires_at: new Date(NOW).toISOString(),
      },
      NOW,
    );
    expect(r).toEqual({
      eligible: false,
      reason_code: "bsi_referral_coach_expired",
    });
  });

  it("coach expires_at null → ineligible", () => {
    const r = canGenerateCourseReferrals(
      { eligibility_type: "foundations_coach", foundations_coach_expires_at: null },
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

  it("maps foundation_certified alias once", () => {
    expect(mapFoundationCertifiedAlias("foundation_certified")).toBe(
      "foundations_coach",
    );
    const r = canGenerateCourseReferrals(
      {
        role_slug: "foundation_certified",
        foundations_coach_expires_at: new Date(NOW + 1000).toISOString(),
      },
      NOW,
    );
    expect(r).toEqual({ eligible: true, eligibility_type: "foundations_coach" });
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
        pending_cents: 0,
        ready_cents: 100,
        paid_total_cents: 500,
        currency: "USD",
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
