/**
 * Certificate claim-options DTO builder (CL-DTO-1 / CL-REASON-1 / CL-MONEY-1).
 * errata d6: no credit{} / promo fields (DR-13/DR-21). Fail closed — this screen moves money.
 */
import { formatUsdFromCents, toNonNegativeSafeCents } from "./ltv";
import { parseIsoInstantToUtcZ } from "./dates";

export type ClaimPathId = "redeem_ltv" | "prepay_credit" | "buy_outright";

/** Path-card / §PD-enum reasons (never includes claim_in_progress). */
export type ClaimIneligibleReason =
  | "legacy_stripe_member"
  | "not_completed"
  | "insufficient_ltv"
  | "already_claimed"
  | "not_subscriber"
  | "no_shortfall"
  | "membership_not_renewing"
  | "course_not_purchasable";

/** Worker closed reason list: §PD-enum + LR-3 `claim_in_progress` (503 body only). */
export type ClaimReasonCode = ClaimIneligibleReason | "claim_in_progress";

/** 409 idempotency-in-progress body (rev 1.2.10 CQ 59cf5b29 N1). */
export type ClaimInProgressBody = { error: "claim_in_progress" };

/** LR-3 / 1.2.10 CQ N1: exact 503 lock-timeout body (distinct from 409). */
export type ClaimLockTimeoutBody = {
  error: "claim_in_progress";
  reason_code: "claim_in_progress";
};

export const CLAIM_INELIGIBLE_REASONS = new Set<string>([
  "legacy_stripe_member",
  "not_completed",
  "insufficient_ltv",
  "already_claimed",
  "not_subscriber",
  "no_shortfall",
  "membership_not_renewing",
  "course_not_purchasable",
]);

/** @deprecated Prefer CLAIM_INELIGIBLE_REASONS for path DTO validation. */
export const CLAIM_REASON_CODES = CLAIM_INELIGIBLE_REASONS;

export const CLAIM_REASON_COPY: Record<ClaimIneligibleReason, string> = {
  legacy_stripe_member:
    "Certificate prepay is for Whop subscribers. Your plan is billed through our old system.",
  not_completed: "Finish the course to claim its certificate.",
  insufficient_ltv: "Your past spending doesn't cover this certificate yet.",
  already_claimed: "",
  not_subscriber: "Certificate prepay needs an active MetFix subscription on Whop.",
  no_shortfall:
    "This option isn't needed. Your lifetime spend already covers this certificate.",
  membership_not_renewing: "Prepay needs a renewing subscription.",
  course_not_purchasable: "This course can't be bought right now.",
};

export type ClaimPathDto = {
  path: ClaimPathId;
  eligible: boolean;
  shortfall_cents: number;
  price_cents: number;
  reason_code: ClaimIneligibleReason | null;
};

export type ClaimCourseDto = {
  course_id: number;
  slug: string;
  title: string;
  completion_status: "not_started" | "in_progress" | "completed";
  completed_at: string | null;
  price_cents: number;
  already_claimed: boolean;
  claimed_at: string | null;
  claimed_via: ClaimPathId | null;
  access_expires_at: string | null;
  paths: ClaimPathDto[];
};

export type ClaimOptionsDto = {
  currency: "usd";
  ltv: {
    total_ltv_cents: number;
    claimed_value_cents: number;
    available_cents: number;
  };
  courses: ClaimCourseDto[];
};

export type ClaimRejectReason =
  | "unknown_reason_code"
  | "bad_path"
  | "bad_money"
  | "bad_enum"
  | "bad_date"
  | "eligibility_mismatch"
  | "shortfall_mismatch"
  | "bad_shape";

export type ClaimOptionsLog = {
  event: string;
  reason?: string;
  course_id?: number;
};

export type BuildClaimOptionsResult =
  | { ok: true; dto: ClaimOptionsDto; logs: ClaimOptionsLog[] }
  | { ok: false; error: "upstream_error"; reason: ClaimRejectReason };

const PATH_ORDER: ClaimPathId[] = ["redeem_ltv", "prepay_credit", "buy_outright"];
const COMPLETION = new Set(["not_started", "in_progress", "completed"]);
const CLAIMED_VIA = new Set(["redeem_ltv", "prepay_credit", "buy_outright"]);
/** After stripStrayFields: only these top-level keys may remain (errata d6 §DTO). */
const TOP_KEYS = new Set(["currency", "ltv", "courses"]);

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function reject(reason: ClaimRejectReason): BuildClaimOptionsResult {
  return { ok: false, error: "upstream_error", reason };
}

function money(v: unknown): number | null {
  try {
    return toNonNegativeSafeCents(v as number);
  } catch {
    return null;
  }
}

/** LR-2 / 1.2.7 CQ B2: all claim-option dates accept Z/offset and normalize to Z. */
function dateOrNull(v: unknown): string | null | "bad" {
  if (v === null) return null;
  const norm = parseIsoInstantToUtcZ(v);
  return norm ?? "bad";
}

/**
 * Validate and allowlist the BSI §DTO claim-options body (errata d6 / rev1.32).
 * Promo/credit fields must already be stripped (DR-15/DR-22); remaining extras → 502.
 */
export function buildClaimOptionsDto(raw: unknown): BuildClaimOptionsResult {
  const logs: ClaimOptionsLog[] = [];
  const obj = asRecord(raw);
  if (!obj) return reject("bad_shape");

  for (const k of Object.keys(obj)) {
    if (!TOP_KEYS.has(k)) return reject("bad_shape");
  }
  for (const k of ["currency", "ltv", "courses"] as const) {
    if (!(k in obj)) return reject("bad_shape");
  }

  if (obj.currency !== "usd") return reject("bad_enum");

  const ltvRaw = asRecord(obj.ltv);
  if (!ltvRaw || !Array.isArray(obj.courses)) return reject("bad_shape");

  const total = money(ltvRaw.total_ltv_cents);
  const claimed = money(ltvRaw.claimed_value_cents);
  const available = money(ltvRaw.available_cents);
  if (total == null || claimed == null || available == null) return reject("bad_money");
  if (available !== Math.max(0, total - claimed)) return reject("bad_money");

  const courses: ClaimCourseDto[] = [];
  let legacyClaimedViaLogged = false;
  for (const row of obj.courses) {
    const c = asRecord(row);
    if (!c) return reject("bad_shape");
    for (const k of [
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
    ] as const) {
      if (!(k in c)) return reject("bad_shape");
    }

    const course_id = money(c.course_id);
    if (course_id == null || course_id < 1 || !Number.isSafeInteger(course_id)) {
      return reject("bad_money");
    }
    if (typeof c.slug !== "string" || typeof c.title !== "string") return reject("bad_shape");
    if (typeof c.completion_status !== "string" || !COMPLETION.has(c.completion_status)) {
      return reject("bad_enum");
    }
    const completed_at = dateOrNull(c.completed_at);
    const claimed_at = dateOrNull(c.claimed_at);
    const access_expires_at = dateOrNull(c.access_expires_at);
    if (completed_at === "bad" || claimed_at === "bad" || access_expires_at === "bad") {
      return reject("bad_date");
    }

    const price_cents = money(c.price_cents);
    if (price_cents == null) return reject("bad_money");
    if (typeof c.already_claimed !== "boolean") return reject("bad_shape");

    // One-line legacy map (1.2.7 / CQ): direct_purchase → buy_outright; log once per response.
    let claimed_via: ClaimPathId | null = null;
    if (c.claimed_via === null) {
      claimed_via = null;
    } else if (typeof c.claimed_via === "string") {
      const rawVia = c.claimed_via;
      const claimedVia = rawVia === "direct_purchase" ? "buy_outright" : rawVia;
      if (rawVia === "direct_purchase" && !legacyClaimedViaLogged) {
        legacyClaimedViaLogged = true;
        logs.push({ event: "legacy_claimed_via_mapped", course_id });
      }
      if (CLAIMED_VIA.has(claimedVia)) {
        claimed_via = claimedVia as ClaimPathId;
      } else {
        return reject("bad_enum");
      }
    } else {
      return reject("bad_enum");
    }

    if (!Array.isArray(c.paths) || c.paths.length !== 3) return reject("bad_path");
    const paths: ClaimPathDto[] = [];
    for (let i = 0; i < 3; i++) {
      const p = asRecord(c.paths[i]);
      if (!p) return reject("bad_path");
      if (p.path !== PATH_ORDER[i]) return reject("bad_path");
      if (typeof p.eligible !== "boolean") return reject("bad_shape");
      const shortfall = money(p.shortfall_cents);
      const pPrice = money(p.price_cents);
      if (shortfall == null || pPrice == null) return reject("bad_money");
      if (pPrice !== price_cents) return reject("shortfall_mismatch");

      let reason: ClaimIneligibleReason | null = null;
      if (p.reason_code === null) reason = null;
      else if (typeof p.reason_code === "string" && CLAIM_INELIGIBLE_REASONS.has(p.reason_code)) {
        reason = p.reason_code as ClaimIneligibleReason;
      } else {
        return reject("unknown_reason_code");
      }

      if (p.eligible === true && reason !== null) return reject("eligibility_mismatch");
      if (p.eligible === false && reason === null) return reject("eligibility_mismatch");

      if (c.already_claimed) {
        if (p.eligible !== false || shortfall !== 0 || reason !== "already_claimed") {
          return reject("eligibility_mismatch");
        }
      } else {
        const expectedShortfall =
          p.path === "buy_outright"
            ? price_cents
            : Math.max(0, price_cents - available);
        if (shortfall !== expectedShortfall) return reject("shortfall_mismatch");
        if (p.path === "prepay_credit" && expectedShortfall === 0) {
          if (p.eligible !== false || reason !== "no_shortfall" || shortfall !== 0) {
            return reject("shortfall_mismatch");
          }
        }
      }

      paths.push({
        path: PATH_ORDER[i]!,
        eligible: p.eligible,
        shortfall_cents: shortfall,
        price_cents: pPrice,
        reason_code: reason,
      });
    }

    courses.push({
      course_id,
      slug: c.slug,
      title: c.title,
      completion_status: c.completion_status as ClaimCourseDto["completion_status"],
      completed_at,
      price_cents,
      already_claimed: c.already_claimed,
      claimed_at,
      claimed_via,
      access_expires_at,
      paths,
    });
  }

  return {
    ok: true,
    dto: {
      currency: "usd",
      ltv: {
        total_ltv_cents: total,
        claimed_value_cents: claimed,
        available_cents: available,
      },
      courses,
    },
    logs,
  };
}

/** Lowercase UUID v4 only (CL-IDEM-1 / Q-G). */
export const IDEMPOTENCY_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isValidIdempotencyKey(raw: unknown): raw is string {
  return typeof raw === "string" && IDEMPOTENCY_KEY_RE.test(raw);
}

/** Upstream claim error codes → client reason_code (CL-ERR-1). */
export const CLAIM_REASON_BY_UPSTREAM = {
  bsi_course_not_completed: "not_completed",
  bsi_insufficient_certificate_ltv: "insufficient_ltv",
  bsi_prepay_legacy_stripe_member: "legacy_stripe_member",
} as const satisfies Record<string, ClaimIneligibleReason>;

export type UpstreamClaimCode = keyof typeof CLAIM_REASON_BY_UPSTREAM;

export type ClaimAlreadyDto = { already_claimed: boolean };

export type MapRedeemResult =
  | { ok: true; dto: ClaimAlreadyDto; logs: Array<{ event: string }> }
  | { ok: false; error: "upstream_error" };

/**
 * Map #36 redeem_ltv success (CL-RET-1 / LR-7 / BSI rev1.22).
 * Validates only returned fields: `already_claimed` + `claim_method === 'redeem_ltv'`.
 * On success path, `prepay_credit` / `buy_outright` / legacy values → 502 (1.2.7/1.2.8).
 * Other #36 keys logged by name only (no values / PII).
 */
export function mapRedeemLtvSuccess(raw: unknown): MapRedeemResult {
  const obj = asRecord(raw);
  if (!obj) return { ok: false, error: "upstream_error" };
  if (typeof obj.already_claimed !== "boolean") return { ok: false, error: "upstream_error" };
  if (obj.claim_method !== "redeem_ltv") {
    return { ok: false, error: "upstream_error" };
  }
  const extras = Object.keys(obj).filter((k) => k !== "already_claimed" && k !== "claim_method");
  const logs: Array<{ event: string }> = [];
  if (extras.length > 0) {
    logs.push({ event: "claim_success_shape_drift" });
    console.warn(JSON.stringify({ event: "claim_success_shape_drift", keys: extras }));
  }
  const dto = { already_claimed: obj.already_claimed } satisfies ClaimAlreadyDto;
  return { ok: true, dto, logs };
}

/**
 * N17: one-line legacy map for any read-side claim_method / claimed_via.
 * Returns display value; caller logs once per Worker response when mapped.
 */
export function mapLegacyClaimMethod(raw: unknown): {
  value: ClaimPathId | null;
  mappedFromDirectPurchase: boolean;
  bad: boolean;
} {
  if (raw === null || raw === undefined) return { value: null, mappedFromDirectPurchase: false, bad: false };
  if (typeof raw !== "string") return { value: null, mappedFromDirectPurchase: false, bad: true };
  const claimedVia = raw === "direct_purchase" ? "buy_outright" : raw;
  if (claimedVia === "redeem_ltv" || claimedVia === "prepay_credit" || claimedVia === "buy_outright") {
    return {
      value: claimedVia,
      mappedFromDirectPurchase: raw === "direct_purchase",
      bad: false,
    };
  }
  return { value: null, mappedFromDirectPurchase: false, bad: true };
}

export function mapClaimIneligible(
  code: string | null,
): { error: "claim_ineligible"; reason_code: ClaimIneligibleReason } | null {
  if (!code || !(code in CLAIM_REASON_BY_UPSTREAM)) return null;
  const reason_code = CLAIM_REASON_BY_UPSTREAM[code as UpstreamClaimCode];
  return { error: "claim_ineligible", reason_code };
}

export const PATH_TITLES: Record<ClaimPathId, string> = {
  redeem_ltv: "Redeem with LTV",
  /** Wire id stays prepay_credit; label must avoid "credit" (errata d6 DR-19/DR-23). */
  prepay_credit: "Certificate prepay",
  /** Prefer `buyOutrightTitle(price_cents)` for the card label (DP-T-CERT1). */
  buy_outright: "Option 1 direct purchase",
};

export const PATH_ACTIONS: Record<ClaimPathId, string> = {
  redeem_ltv: "Redeem",
  prepay_credit: "Prepay",
  buy_outright: "Buy",
};

/** DP-T-CERT1 / 1.2.4 (5): e.g. `Option 1 direct purchase ($200.00)`. */
export function buyOutrightTitle(priceCents: number): string {
  return `Option 1 direct purchase (${formatUsdFromCents(priceCents)})`;
}
