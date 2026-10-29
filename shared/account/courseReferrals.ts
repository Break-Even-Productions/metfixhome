/**
 * Course referral eligibility, URL allowlist, commission validation & DTO builders (PR D).
 * Imported by worker/account.ts and client/src/pages/account/*.
 *
 * Coach expiry + tier resolution come from #21 shared modules — do not re-copy.
 */

import { normalizeFoundationsCoachStatus } from "./foundations-coach";
import {
  extractSubscriptionTierItems,
  isOrganizationOwnerTier,
  resolveAccountCanonicalTier,
  type SubscriptionTierItem,
} from "./tiers";

export const BSI_REF_RE = /^[A-Za-z0-9_-]{2,64}$/;
export const ATTEMPT_ID_RE = /^cca_[a-f0-9]{24,32}$/;
export const COURSE_ID_RE = /^[1-9][0-9]{0,9}$/;
export const CURRENCY_RE = /^[A-Z]{3}$/;
export const MFX_BSI_REF_KEY = "mfx_bsi_ref";

export type ReferralEligibilityType = "organization" | "foundations_coach" | null;
export type ReferralReasonCode =
  | "bsi_referral_ineligible"
  | "bsi_referral_coach_expired"
  | null;

export type AttributionSource =
  | "primary_org"
  | "explicit_slug"
  | "bsi_ref_cookie"
  | "none";

export type DropReason =
  | "commission_mismatch"
  | "estimate_mismatch"
  | "bad_price"
  | "bad_currency"
  | "bad_share_url"
  | "bad_row"
  | "join_code_commission_mismatch"
  | "bad_join_url";

export type CanGenerateInput = {
  /** Canonical: `'organization' | 'foundations_coach'`. Role-slug aliases go through the map. */
  eligibility_type?: unknown;
  canonical_tier?: unknown;
  subscription_items?: ReadonlyArray<SubscriptionTierItem>;
  /** Full foundations-coach payload — required for coach path (CQ-CR-E8). */
  foundations_coach?: unknown;
  /** Legacy role-slug alias only — mapped once via mapFoundationCertifiedAlias. */
  role_slug?: unknown;
};

export type CanGenerateResult =
  | { eligible: true; eligibility_type: "organization" | "foundations_coach" }
  | { eligible: false; reason_code: Exclude<ReferralReasonCode, null> };

/**
 * CR-ELIG-1 / W5 / MC34: single map for the legacy role slug.
 * The legacy slug literal appears only inside this function body.
 */
export function mapFoundationCertifiedAlias(
  raw: unknown,
): "foundations_coach" | null {
  if (raw === "foundation_certified" || raw === "foundations_coach") {
    return "foundations_coach";
  }
  return null;
}

function isCoachEligibilityClaim(input: CanGenerateInput): boolean {
  return (
    mapFoundationCertifiedAlias(input.eligibility_type) === "foundations_coach" ||
    mapFoundationCertifiedAlias(input.role_slug) === "foundations_coach" ||
    input.foundations_coach != null
  );
}

/**
 * CR-ELIG-1: org first (shared tier resolver); coach ONLY via
 * `normalizeFoundationsCoachStatus` (CQ-CR-E8 — no local expiry math).
 */
export function canGenerateCourseReferrals(
  input: CanGenerateInput,
  nowMs: number,
): CanGenerateResult {
  const tier = resolveAccountCanonicalTier({
    canonical_tier: input.canonical_tier,
    items: input.subscription_items,
  });

  if (input.eligibility_type === "organization" || isOrganizationOwnerTier(tier)) {
    return { eligible: true, eligibility_type: "organization" };
  }

  if (!isCoachEligibilityClaim(input)) {
    return { eligible: false, reason_code: "bsi_referral_ineligible" };
  }

  // CQ-CR-E8: no coach object → ineligible (do not rebuild expiry from bare fields).
  if (input.foundations_coach == null || typeof input.foundations_coach !== "object") {
    return { eligible: false, reason_code: "bsi_referral_ineligible" };
  }

  const coach = normalizeFoundationsCoachStatus(input.foundations_coach, nowMs);
  if (coach.active) {
    return { eligible: true, eligibility_type: "foundations_coach" };
  }
  if (coach.expires_at != null) {
    return { eligible: false, reason_code: "bsi_referral_coach_expired" };
  }
  return { eligible: false, reason_code: "bsi_referral_ineligible" };
}

const ALLOWED_REFERRAL_HOSTS = new Set([
  "metfix.org",
  "www.metfix.org",
  "brokenscience.org",
  "www.brokenscience.org",
]);

/** CR-URL-1: absolute https, exact host set, no userinfo, no port. Never rewrite. */
export function isAllowedReferralUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username !== "" || u.password !== "") return false;
  if (u.port !== "") return false;
  return ALLOWED_REFERRAL_HOSTS.has(u.hostname);
}

/** Bad bps → page-fatal 502. Accepts 0..10000 inclusive integers only. */
export function isBadCommissionBps(bps: unknown): boolean {
  return (
    typeof bps !== "number" ||
    !Number.isInteger(bps) ||
    Number.isNaN(bps) ||
    !Number.isFinite(bps) ||
    bps < 0 ||
    bps > 10000
  );
}

export function commissionPercentMatchesBps(
  percent: unknown,
  bps: number,
): boolean {
  return typeof percent === "number" && Number.isFinite(percent) && percent === bps / 100;
}

export function estimateMatchesIntegerBounds(
  priceCents: number,
  bps: number,
  estimate: unknown,
): boolean {
  if (typeof estimate !== "number" || !Number.isSafeInteger(estimate)) return false;
  const n = priceCents * bps;
  if (!Number.isSafeInteger(n)) return false;
  const floor = Math.floor(n / 10000);
  const round = Math.floor((n + 5000) / 10000);
  return estimate === floor || estimate === round;
}

export type JoinCodeDto = {
  slug: string;
  whop_affiliate_code: string;
  join_url: string | null;
  commission_percent: number;
  commission_bps: number;
};

export type CourseLinkDto = {
  course_id: number;
  course_slug: string;
  course_title: string;
  course_price_cents: number;
  currency: string;
  commission_percent: number;
  commission_bps: number;
  estimated_commission_cents: number;
  bsi_ref_slug: string;
  whop_affiliate_code: string;
  whop_plan_id: string;
  share_url: string;
};

export type ReferralsDto = {
  eligible: boolean;
  eligibility_type: ReferralEligibilityType;
  reason_code: ReferralReasonCode;
  payee_display_name: string | null;
  foundations_coach_expires_at: string | null;
  join_code: JoinCodeDto | null;
  course_links: CourseLinkDto[];
  course_links_dropped: number;
  /** W3: true when join_code was nulled due to commission mismatch. */
  join_code_dropped: boolean;
  earnings?: {
    pending_cents: number;
    ready_cents: number;
    paid_total_cents: number;
    /** Lowercase 3-letter ISO (BSI §2.4); never case-folded. */
    currency: string;
    connect_status: "none" | "pending" | "active";
  };
  /** Enforce: never present on client DTO. */
  commission_policy?: never;
};

export type ConnectStatus = "none" | "pending" | "active";
const CONNECT_STATUSES = new Set<string>(["none", "pending", "active"]);
const EARNINGS_CURRENCY_RE = /^[a-z]{3}$/;

export type DropLogEvent = {
  event: "course_link_dropped";
  reason: DropReason;
  course_id: number | null;
};

export type BuildReferralsResult =
  | { ok: true; dto: ReferralsDto; logs: DropLogEvent[] }
  | { ok: false; error: "upstream_error" };

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function strField(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function safeNonNegInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) return null;
  return v;
}

/**
 * W1: scan all rows for bad bps first → fatal; then per-row drops in order:
 * percent → price → currency → share_url → estimate.
 */
export function buildReferralsDto(
  referralsRaw: unknown,
  earningsRaw: unknown | undefined,
  nowMs: number,
): BuildReferralsResult {
  const obj = asRecord(referralsRaw) ?? {};
  const logs: DropLogEvent[] = [];

  const eligCheck = canGenerateCourseReferrals(
    {
      eligibility_type: obj.eligibility_type,
      canonical_tier: obj.canonical_tier,
      foundations_coach: obj.foundations_coach,
      role_slug: obj.role_slug,
      subscription_items: extractSubscriptionTierItems(obj),
    },
    nowMs,
  );

  // Prefer upstream eligible flag when present, but force empty when our predicate says no.
  let eligible = eligCheck.eligible;
  let eligibility_type: ReferralEligibilityType = eligCheck.eligible
    ? eligCheck.eligibility_type
    : null;
  let reason_code: ReferralReasonCode = eligCheck.eligible ? null : eligCheck.reason_code;

  // If upstream explicitly marks ineligible with a reason, prefer upstream reason.
  if (obj.eligible === false) {
    eligible = false;
    eligibility_type = null;
    if (
      obj.reason_code === "bsi_referral_ineligible" ||
      obj.reason_code === "bsi_referral_coach_expired"
    ) {
      reason_code = obj.reason_code;
    } else if (!reason_code) {
      reason_code = "bsi_referral_ineligible";
    }
  } else if (obj.eligible === true && eligCheck.eligible) {
    eligible = true;
    eligibility_type = eligCheck.eligibility_type;
    reason_code = null;
  }

  if (!eligible) {
    // CR-ELIG-2: force empty; not a drop — no logs, course_links_dropped stays 0.
    const dto: ReferralsDto = {
      eligible: false,
      eligibility_type: null,
      reason_code: reason_code ?? "bsi_referral_ineligible",
      payee_display_name:
        typeof obj.payee_display_name === "string" ? obj.payee_display_name : null,
      foundations_coach_expires_at:
        typeof obj.foundations_coach_expires_at === "string"
          ? obj.foundations_coach_expires_at
          : null,
      join_code: null,
      course_links: [],
      course_links_dropped: 0,
      join_code_dropped: false,
    };
    const earnings = shapeEarnings(earningsRaw);
    if (earnings) dto.earnings = earnings;
    return { ok: true, dto, logs };
  }

  const rawLinks = Array.isArray(obj.course_links) ? obj.course_links : [];
  const joinRaw = asRecord(obj.join_code);

  // Pass 1 — bad bps on join_code or ANY row → 502 before any drop.
  if (joinRaw) {
    if (isBadCommissionBps(joinRaw.commission_bps)) {
      return { ok: false, error: "upstream_error" };
    }
  }
  for (const row of rawLinks) {
    const r = asRecord(row);
    if (!r) continue;
    if (isBadCommissionBps(r.commission_bps)) {
      return { ok: false, error: "upstream_error" };
    }
  }

  let join_code: JoinCodeDto | null = null;
  let join_code_dropped = false;

  if (joinRaw) {
    const bps = joinRaw.commission_bps as number;
    if (!commissionPercentMatchesBps(joinRaw.commission_percent, bps)) {
      logs.push({
        event: "course_link_dropped",
        reason: "join_code_commission_mismatch",
        course_id: null,
      });
      join_code = null;
      join_code_dropped = true;
    } else {
      const slug = strField(joinRaw.slug);
      const whop = strField(joinRaw.whop_affiliate_code);
      if (slug && whop) {
        let join_url: string | null = strField(joinRaw.join_url);
        if (join_url !== null && !isAllowedReferralUrl(join_url)) {
          logs.push({
            event: "course_link_dropped",
            reason: "bad_join_url",
            course_id: null,
          });
          join_url = null;
        }
        join_code = {
          slug,
          whop_affiliate_code: whop,
          join_url,
          commission_percent: joinRaw.commission_percent as number,
          commission_bps: bps,
        };
      }
    }
  }

  const course_links: CourseLinkDto[] = [];
  let course_links_dropped = 0;

  for (const row of rawLinks) {
    const r = asRecord(row);
    if (!r) {
      // N1: non-object rows → bad_row + skipped log (no course_id).
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "bad_row",
        course_id: null,
      });
      continue;
    }
    const course_id =
      typeof r.course_id === "number" && Number.isSafeInteger(r.course_id) ? r.course_id : null;
    const bps = r.commission_bps as number;

    // Drop order (W1): percent → price → currency → share_url → estimate
    if (!commissionPercentMatchesBps(r.commission_percent, bps)) {
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "commission_mismatch",
        course_id,
      });
      continue;
    }

    const price = safeNonNegInt(r.course_price_cents);
    if (price === null) {
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "bad_price",
        course_id,
      });
      continue;
    }
    // Also reject unsafe product for estimate math
    if (!Number.isSafeInteger(price * bps)) {
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "bad_price",
        course_id,
      });
      continue;
    }

    const currency = strField(r.currency);
    if (!currency || !CURRENCY_RE.test(currency)) {
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "bad_currency",
        course_id,
      });
      continue;
    }

    const share_url = strField(r.share_url);
    if (!share_url || !isAllowedReferralUrl(share_url)) {
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "bad_share_url",
        course_id,
      });
      continue;
    }

    if (!estimateMatchesIntegerBounds(price, bps, r.estimated_commission_cents)) {
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "estimate_mismatch",
        course_id,
      });
      continue;
    }

    const course_slug = strField(r.course_slug);
    const course_title = strField(r.course_title);
    const bsi_ref_slug = strField(r.bsi_ref_slug);
    const whop_affiliate_code = strField(r.whop_affiliate_code);
    const whop_plan_id = strField(r.whop_plan_id);
    if (
      course_id == null ||
      !course_slug ||
      !course_title ||
      !bsi_ref_slug ||
      !whop_affiliate_code ||
      !whop_plan_id
    ) {
      // N1: incomplete identity fields → bad_row (not bad_price).
      course_links_dropped += 1;
      logs.push({
        event: "course_link_dropped",
        reason: "bad_row",
        course_id,
      });
      continue;
    }

    course_links.push({
      course_id,
      course_slug,
      course_title,
      course_price_cents: price,
      currency,
      commission_percent: r.commission_percent as number,
      commission_bps: bps,
      estimated_commission_cents: r.estimated_commission_cents as number,
      bsi_ref_slug,
      whop_affiliate_code,
      whop_plan_id,
      share_url, // byte-for-byte, never rewritten
    });
  }

  const dto: ReferralsDto = {
    eligible: true,
    eligibility_type,
    reason_code: null,
    payee_display_name:
      typeof obj.payee_display_name === "string" ? obj.payee_display_name : null,
    foundations_coach_expires_at:
      typeof obj.foundations_coach_expires_at === "string"
        ? obj.foundations_coach_expires_at
        : null,
    join_code,
    course_links,
    course_links_dropped,
    join_code_dropped,
  };

  const earnings = shapeEarnings(earningsRaw);
  if (earnings) dto.earnings = earnings;

  return { ok: true, dto, logs };
}

/**
 * CR-EARN-1 (spec 1.1.5 / CQ rev1.1.5): map BSI GET /me/referral-earnings §2.4
 * `{ currency:'usd', pending, ready, paid_total, connect_status }` only —
 * no `*_cents` aliases. Currency stays lowercase; `"USD"` → bad_shape.
 * Reasons: `upstream_error` | `bad_shape` only. Never 502.
 */
export function shapeEarnings(
  raw: unknown,
): ReferralsDto["earnings"] | null {
  if (raw == null) return null;
  const obj = asRecord(raw);
  if (!obj) {
    console.warn(
      JSON.stringify({ event: "referral_earnings_omitted", reason: "bad_shape" }),
    );
    return null;
  }
  // Strict §2.4 keys only — reject nested {earnings:{...}} wrappers and *_cents.
  const pending = safeNonNegInt(obj.pending);
  const ready = safeNonNegInt(obj.ready);
  const paid = safeNonNegInt(obj.paid_total);
  const currency = strField(obj.currency);
  const connect = strField(obj.connect_status);

  if (
    pending == null ||
    ready == null ||
    paid == null ||
    !currency ||
    !EARNINGS_CURRENCY_RE.test(currency) ||
    !connect ||
    !CONNECT_STATUSES.has(connect)
  ) {
    console.warn(
      JSON.stringify({
        event: "referral_earnings_omitted",
        reason: "bad_shape",
      }),
    );
    return null;
  }
  return {
    pending_cents: pending,
    ready_cents: ready,
    paid_total_cents: paid,
    currency,
    connect_status: connect as ConnectStatus,
  };
}

/** Log helper for upstream earnings GET failures (CR-EARN-1). */
export function logEarningsUpstreamOmitted(): void {
  console.warn(
    JSON.stringify({
      event: "referral_earnings_omitted",
      reason: "upstream_error",
    }),
  );
}

export type CheckoutAttributionDto = {
  attribution_source: AttributionSource;
  bsi_ref_slug: string | null;
  whop_affiliate_code: string | null;
  commission_percent: number;
  commission_bps: number;
};

export type CheckoutDto = {
  attempt_id: string;
  course_id: number;
  checkout_url: string;
  course_price_cents: number;
  currency: string;
  attribution: CheckoutAttributionDto;
};

export type BuildCheckoutResult =
  | { ok: true; dto: CheckoutDto }
  | { ok: false; error: "upstream_error" | "whop_company_mismatch"; status?: number };

const ATTRIBUTION_SOURCES = new Set<string>([
  "primary_org",
  "explicit_slug",
  "bsi_ref_cookie",
  "none",
]);

/**
 * Build sanitized client checkout DTO. Caller must verify checkout_url via
 * sanitizeExternalBillingUrl(whop_only) before/after — this checks company + attempt_id + attribution.
 */
export function buildCheckoutDto(
  raw: unknown,
  expectedCompanyId: string,
): BuildCheckoutResult {
  const obj = asRecord(raw);
  if (!obj) return { ok: false, error: "upstream_error" };

  if (obj.whop_company_id !== expectedCompanyId) {
    return { ok: false, error: "upstream_error" };
  }

  const attempt_id = strField(obj.attempt_id);
  if (!attempt_id || !ATTEMPT_ID_RE.test(attempt_id)) {
    return { ok: false, error: "upstream_error" };
  }

  const course_id = safeNonNegInt(obj.course_id);
  if (course_id == null || course_id < 1) {
    return { ok: false, error: "upstream_error" };
  }

  const checkout_url = strField(obj.checkout_url);
  if (!checkout_url) return { ok: false, error: "upstream_error" };

  const course_price_cents = safeNonNegInt(obj.course_price_cents);
  if (course_price_cents == null) return { ok: false, error: "upstream_error" };

  const currency = strField(obj.currency);
  if (!currency || !CURRENCY_RE.test(currency)) {
    return { ok: false, error: "upstream_error" };
  }

  const attr = asRecord(obj.attribution);
  if (!attr) return { ok: false, error: "upstream_error" };

  const attribution_source = strField(attr.attribution_source);
  if (!attribution_source || !ATTRIBUTION_SOURCES.has(attribution_source)) {
    return { ok: false, error: "upstream_error" };
  }

  if (isBadCommissionBps(attr.commission_bps)) {
    return { ok: false, error: "upstream_error" };
  }
  const bps = attr.commission_bps as number;
  // W2: percent/bps mismatch in checkout attribution → 502
  if (!commissionPercentMatchesBps(attr.commission_percent, bps)) {
    return { ok: false, error: "upstream_error" };
  }

  return {
    ok: true,
    dto: {
      attempt_id,
      course_id,
      checkout_url,
      course_price_cents,
      currency,
      attribution: {
        attribution_source: attribution_source as AttributionSource,
        bsi_ref_slug: strField(attr.bsi_ref_slug),
        whop_affiliate_code: strField(attr.whop_affiliate_code),
        commission_percent: attr.commission_percent as number,
        commission_bps: bps,
      },
    },
  };
}

export function emitDropLogs(logs: DropLogEvent[]): void {
  for (const evt of logs) {
    console.warn(JSON.stringify(evt));
  }
}
