/**
 * Rewards DTO shared by worker shaping + client (BSI GET /me/rewards).
 */

export type RewardsOffer = {
  id: string;
  kind: string;
  title: string;
  description: string;
  audience: string[];
  source: string;
  code?: string;
  url?: string;
};

export type RewardsClassClaims = {
  enabled: boolean;
  mode: string;
  used: number;
  cap_n: number | null;
  window_start: string | null;
  resets_at: string | null;
  calendar_month: {
    used: number;
    start: string | null;
    end: string | null;
  };
  active: Array<{
    id: number;
    course_id: number;
    created_at: string;
    access_until: string;
    tier_at_claim: string;
  }>;
};

export type RewardsPayload = {
  currency: string;
  dashboard_enabled: boolean;
  offers_live: boolean;
  tier: {
    canonical_tier: string;
    personas: Record<string, unknown>;
    audience_keys: string[];
  };
  ltv: {
    total_cents: number;
    available_cents: number;
    claimed_certificate_cents: number;
    claimed_certificates: unknown[];
    foundations_coach: unknown;
  };
  class_claims: RewardsClassClaims;
  offers: RewardsOffer[];
  referrals: { href: string };
  links: Record<string, string>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function nonNegInt(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : fallback;
}

/**
 * Shape / validate upstream Rewards JSON for the worker boundary.
 * Returns null when the payload is unusable.
 */
export function shapeRewardsPayload(raw: unknown): RewardsPayload | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const ltvRaw = asRecord(obj.ltv);
  if (!ltvRaw) return null;
  const total = nonNegInt(ltvRaw.total_cents, -1);
  if (total < 0) return null;

  const claimsRaw = asRecord(obj.class_claims) ?? {};
  const monthRaw = asRecord(claimsRaw.calendar_month) ?? {};
  const tierRaw = asRecord(obj.tier) ?? {};
  const personas = asRecord(tierRaw.personas) ?? {};
  const audience_keys = Array.isArray(tierRaw.audience_keys)
    ? tierRaw.audience_keys.filter((k): k is string => typeof k === "string")
    : [];

  const offersIn = Array.isArray(obj.offers) ? obj.offers : [];
  const offers: RewardsOffer[] = [];
  for (const row of offersIn) {
    const r = asRecord(row);
    if (!r || typeof r.id !== "string" || typeof r.title !== "string") continue;
    const offer: RewardsOffer = {
      id: r.id,
      kind: typeof r.kind === "string" ? r.kind : "partner_offer",
      title: r.title,
      description: typeof r.description === "string" ? r.description : "",
      audience: Array.isArray(r.audience)
        ? r.audience.filter((a): a is string => typeof a === "string")
        : [],
      source: typeof r.source === "string" ? r.source : "bsi_reward_offer",
    };
    if (typeof r.code === "string" && r.code.trim() !== "") {
      offer.code = r.code.trim();
    }
    if (typeof r.url === "string" && r.url.trim() !== "") {
      offer.url = r.url.trim();
    }
    offers.push(offer);
  }

  const activeIn = Array.isArray(claimsRaw.active) ? claimsRaw.active : [];
  const active: RewardsClassClaims["active"] = [];
  for (const row of activeIn) {
    const r = asRecord(row);
    if (!r) continue;
    if (
      typeof r.id !== "number" ||
      typeof r.course_id !== "number" ||
      typeof r.created_at !== "string" ||
      typeof r.access_until !== "string"
    ) {
      continue;
    }
    active.push({
      id: r.id,
      course_id: r.course_id,
      created_at: r.created_at,
      access_until: r.access_until,
      tier_at_claim: typeof r.tier_at_claim === "string" ? r.tier_at_claim : "",
    });
  }

  const capRaw = claimsRaw.cap_n;
  const cap_n =
    capRaw === null
      ? null
      : typeof capRaw === "number" && Number.isSafeInteger(capRaw)
        ? capRaw
        : 0;

  const linksRaw = asRecord(obj.links) ?? {};
  const links: Record<string, string> = {};
  for (const [k, v] of Object.entries(linksRaw)) {
    if (typeof v === "string") links[k] = v;
  }

  const referralsRaw = asRecord(obj.referrals);

  return {
    currency: typeof obj.currency === "string" ? obj.currency : "USD",
    dashboard_enabled: obj.dashboard_enabled !== false,
    offers_live: obj.offers_live === true,
    tier: {
      canonical_tier:
        typeof tierRaw.canonical_tier === "string" ? tierRaw.canonical_tier : "free",
      personas,
      audience_keys,
    },
    ltv: {
      total_cents: total,
      available_cents: nonNegInt(ltvRaw.available_cents),
      claimed_certificate_cents: nonNegInt(ltvRaw.claimed_certificate_cents),
      claimed_certificates: Array.isArray(ltvRaw.claimed_certificates)
        ? ltvRaw.claimed_certificates
        : [],
      foundations_coach: ltvRaw.foundations_coach ?? null,
    },
    class_claims: {
      enabled: claimsRaw.enabled === true,
      mode: typeof claimsRaw.mode === "string" ? claimsRaw.mode : "none",
      used: nonNegInt(claimsRaw.used),
      cap_n,
      window_start:
        typeof claimsRaw.window_start === "string" ? claimsRaw.window_start : null,
      resets_at: typeof claimsRaw.resets_at === "string" ? claimsRaw.resets_at : null,
      calendar_month: {
        used: nonNegInt(monthRaw.used),
        start: typeof monthRaw.start === "string" ? monthRaw.start : null,
        end: typeof monthRaw.end === "string" ? monthRaw.end : null,
      },
      active,
    },
    offers,
    referrals: {
      href:
        typeof referralsRaw?.href === "string"
          ? referralsRaw.href
          : "/bsi/v1/me/referrals",
    },
    links,
  };
}
