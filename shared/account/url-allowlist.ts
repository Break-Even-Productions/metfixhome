import { BEP_WHOP_COMPANY_ID } from "./whop";

const WHOP_ALLOWED_HOSTS = new Set(["whop.com"]);
const PORTAL_EXTRA_HOSTS = new Set(["billing.stripe.com", "checkout.stripe.com"]);
const FORBIDDEN_WHOP_SUBSTRINGS = ["curie"];
const BIZ_ID_RE = /biz_[A-Za-z0-9]+/g;

/**
 * Outbound billing / Whop URL gate (DP-WHOP-1 / T19).
 *
 * R3-N2: Reject non-default HTTPS ports (`u.port !== "" && u.port !== "443"`).
 * Stripe Customer Portal / Checkout hosts (`billing.stripe.com`,
 * `checkout.stripe.com`) are accepted only in `billing_portal` mode, never in
 * `whop_only`.
 */
export function sanitizeExternalBillingUrl(
  raw: unknown,
  mode: "whop_only" | "billing_portal",
): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "") return null;
  // Reject non-default HTTPS ports (R3-N2).
  if (u.port !== "" && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  const isWhop = WHOP_ALLOWED_HOSTS.has(host) || host.endsWith(".whop.com");
  // Stripe Customer Portal / Checkout session URLs — billing_portal mode only.
  const isStripePortal = mode === "billing_portal" && PORTAL_EXTRA_HOSTS.has(host);
  if (!isWhop && !isStripePortal) return null;
  const lowerHref = u.href.toLowerCase();
  if (FORBIDDEN_WHOP_SUBSTRINGS.some((s) => lowerHref.includes(s))) return null;
  // Pin Break Even Productions company id — any other biz_* fails closed.
  const bizIds = lowerHref.match(BIZ_ID_RE) ?? [];
  const bep = BEP_WHOP_COMPANY_ID.toLowerCase();
  if (bizIds.some((id) => id !== bep)) return null;
  return u.toString();
}
