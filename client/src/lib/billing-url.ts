/**
 * Client-side billing URL gate (CQ N1: host-only check; Worker already
 * sanitizes DTO URLs before they reach the browser).
 */
const WHOP_HOSTS = new Set(["whop.com"]);
const PORTAL_HOSTS = new Set(["billing.stripe.com", "checkout.stripe.com"]);

export function sanitizeClientBillingUrl(
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
  const host = u.hostname.toLowerCase();
  const isWhop = WHOP_HOSTS.has(host) || host.endsWith(".whop.com");
  const isStripe = mode === "billing_portal" && PORTAL_HOSTS.has(host);
  if (!isWhop && !isStripe) return null;
  return u.toString();
}
