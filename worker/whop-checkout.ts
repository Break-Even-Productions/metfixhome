/**
 * Whop subscription checkout mint (WJ22 subset — subscriptions only, no courses).
 * Upstream path via shared/account/bsi-paths (AU26.8 — no wp-json literals here).
 */
import { accountWhopCheckoutSessionPath } from "../shared/account/bsi-paths";
import { sanitizeReturnPath } from "../shared/account/returnPath";
import { sanitizeExternalBillingUrl } from "../shared/account/url-allowlist";
import {
  DEFAULT_WHOP_CHECKOUT_RETURN_PATH,
  isWhopCheckoutPlan,
  type WhopCheckoutPlan,
} from "../shared/account/whop-plans";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { accountRateLimitKey } from "./auth/account-rate-limit";
import { csrfForSid, timingSafeEqualStr } from "./auth/crypto";
import { isAllowedAuthOrigin } from "./auth/csrf";
import { isAuthHost } from "./auth/host";
import {
  assertBsiHost,
  bsiAccountBearerHeaders,
  parseRetryAfter,
  resolveBsiOrigin,
  type BsiHttpResult,
  type Env,
  type FetchImpl,
  type RateLimitBinding,
} from "./upstream";

const MAX_BODY_BYTES = 8_192;
const PRIVATE_NO_STORE = "private, no-store";

export type WhopCheckoutEnv = Env & {
  WHOP_CHECKOUT_LIMITER?: RateLimitBinding;
};

function jsonPrivateNoStore(
  body: unknown,
  status: number,
  extra: HeadersInit = {},
): Response {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  headers.set("Cache-Control", PRIVATE_NO_STORE);
  headers.set("Pragma", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Cookie");
  return new Response(JSON.stringify(body), { status, headers });
}

async function limitOrDeny(
  binding: RateLimitBinding | undefined,
  key: string,
): Promise<boolean> {
  if (!binding) return false;
  const r = await binding.limit({ key });
  return r.success === true;
}

function unauthenticated(): Response {
  return jsonPrivateNoStore({ error: "unauthenticated" }, 401);
}

function forbidden(): Response {
  return jsonPrivateNoStore({ error: "forbidden" }, 403);
}

function rateLimited429(): Response {
  return jsonPrivateNoStore({ error: "rate_limited" }, 429, { "Retry-After": "60" });
}

function upstreamError(status = 502): Response {
  return jsonPrivateNoStore({ error: "upstream_error" }, status >= 500 ? 502 : status);
}

async function requireCheckoutCsrf(
  request: Request,
  env: Env,
  sid: string,
): Promise<Response | null> {
  if (!env.CSRF_SECRET) {
    return jsonPrivateNoStore({ error: "unavailable" }, 503, { "Retry-After": "300" });
  }
  if (!isAllowedAuthOrigin(request.headers.get("Origin"), env)) return forbidden();
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs != null && sfs !== "same-origin") return forbidden();
  const token = request.headers.get("X-CSRF-Token") ?? "";
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(token, expected)) return forbidden();
  return null;
}

async function readJsonBody(request: Request): Promise<{ json: unknown } | Response> {
  const ct = request.headers.get("Content-Type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return jsonPrivateNoStore({ error: "unsupported_media_type" }, 415);
  }
  const cl = request.headers.get("Content-Length");
  if (cl != null) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return jsonPrivateNoStore({ error: "payload_too_large" }, 413);
    }
  }
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    return jsonPrivateNoStore({ error: "payload_too_large" }, 413);
  }
  try {
    return { json: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return jsonPrivateNoStore({ error: "invalid_request" }, 400);
  }
}

async function resolveSessionOrUnauth(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  const resolved = await resolveActingSession(request, env, fetchImpl, opts);
  if (resolved instanceof Response) {
    if (resolved.status === 401) return unauthenticated();
    if (resolved.status === 503) {
      return jsonPrivateNoStore({ error: "unavailable" }, 503, {
        "Retry-After": resolved.headers.get("Retry-After") ?? "60",
      });
    }
    return upstreamError(resolved.status);
  }
  return resolved;
}

async function bsiPostCheckoutSession(
  accessToken: string,
  body: Record<string, unknown>,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<BsiHttpResult> {
  const origin = resolveBsiOrigin(env, opts);
  const url = `${origin}${accountWhopCheckoutSessionPath()}`;
  try {
    assertBsiHost(url, env);
  } catch {
    return { kind: "throw" };
  }
  const headers = bsiAccountBearerHeaders(accessToken, "application/json");
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { ...headers } as unknown as Record<string, string>,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const bodyText = await response.text();
    const raRaw = response.headers.get("Retry-After");
    const retryAfter = raRaw != null ? parseRetryAfter(raRaw) : null;
    let json: unknown = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return { kind: "bad_json", status: response.status, bodyText, retryAfter };
    }
    if (response.ok) {
      return { kind: "ok", status: response.status, json, bodyText, retryAfter };
    }
    const code =
      json && typeof json === "object" && typeof (json as { code?: unknown }).code === "string"
        ? (json as { code: string }).code
        : null;
    return { kind: "http", status: response.status, json, bodyText, code, retryAfter };
  } catch {
    return { kind: "throw" };
  }
}

export async function handleWhopCheckoutSession(
  request: Request,
  env: WhopCheckoutEnv,
  deps: { fetchImpl?: FetchImpl; bsiBaseUrl?: string } = {},
): Promise<Response> {
  if (!isAuthHost(request, env)) return forbidden();
  const method = request.method.toUpperCase();
  if (method === "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": PRIVATE_NO_STORE },
    });
  }
  if (method !== "POST") {
    return jsonPrivateNoStore({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const opts = deps.bsiBaseUrl ? { baseUrl: deps.bsiBaseUrl } : undefined;

  const session = await resolveSessionOrUnauth(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;

  const csrfFail = await requireCheckoutCsrf(request, env, session.sid);
  if (csrfFail) return csrfFail;

  const key = await accountRateLimitKey(session);
  const ok = await limitOrDeny(env.WHOP_CHECKOUT_LIMITER, key);
  if (!ok) return rateLimited429();

  const bodyRead = await readJsonBody(request);
  if (bodyRead instanceof Response) return bodyRead;
  const raw = bodyRead.json;
  if (!raw || typeof raw !== "object") {
    return jsonPrivateNoStore({ error: "invalid_request" }, 400);
  }
  const body = raw as Record<string, unknown>;
  if (!isWhopCheckoutPlan(body.plan)) {
    return jsonPrivateNoStore({ error: "invalid_plan" }, 400);
  }
  const plan: WhopCheckoutPlan = body.plan;

  let return_path = DEFAULT_WHOP_CHECKOUT_RETURN_PATH;
  if (body.return_path !== undefined && body.return_path !== null) {
    const sanitized = sanitizeReturnPath(body.return_path);
    if (!sanitized) return jsonPrivateNoStore({ error: "invalid_return_path" }, 400);
    return_path = sanitized;
  }

  const upstreamBody: Record<string, unknown> = { plan, return_path };

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPostCheckoutSession(access, upstreamBody, env, fetchImpl, opts),
  );
  if (ran instanceof Response) {
    if (ran.status === 401) return unauthenticated();
    return upstreamError(ran.status);
  }

  const { result } = ran;
  if (result.kind !== "ok") {
    return jsonPrivateNoStore({ error: "upstream_error" }, 502);
  }
  const json = result.json;
  if (!json || typeof json !== "object") {
    return jsonPrivateNoStore({ error: "upstream_error" }, 502);
  }
  const checkoutRaw = (json as Record<string, unknown>).checkout_url;
  const checkout_url = sanitizeExternalBillingUrl(checkoutRaw, "whop_only");
  if (!checkout_url) {
    return jsonPrivateNoStore({ error: "upstream_error" }, 502);
  }
  const expires_at = (json as Record<string, unknown>).expires_at;
  const out: Record<string, unknown> = { checkout_url, plan };
  if (typeof expires_at === "string") out.expires_at = expires_at;
  return jsonPrivateNoStore(out, 200);
}

/** Route dispatcher — returns null when path is not owned. */
export async function handleWhopCheckoutRoutes(
  request: Request,
  env: WhopCheckoutEnv,
  deps: { fetchImpl?: FetchImpl; bsiBaseUrl?: string } = {},
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === "/api/billing/whop/checkout-session") {
    return handleWhopCheckoutSession(request, env, deps);
  }
  return null;
}
