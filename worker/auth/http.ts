import type { RetryAfterSeconds } from "../upstream";

export function jsonNoStore(
  body: unknown,
  status: number,
  extra: HeadersInit = {},
): Response {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function rateLimited(retryAfter: RetryAfterSeconds | number): Response {
  const ra = Math.max(1, Math.min(600, Math.floor(Number(retryAfter)) || 60));
  return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": String(ra) });
}

export function unavailable(retryAfter = 300): Response {
  return jsonNoStore({ error: "unavailable" }, 503, {
    "Retry-After": String(retryAfter),
  });
}

export function clientIp(request: Request): string {
  // Used only for Worker-local R8b keys — never forwarded upstream.
  return request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
}
