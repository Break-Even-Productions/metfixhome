/**
 * Join / Whop checkout Worker routes (WJ21, WJ22).
 * Upstream BSI mocked in tests; Bearer-only (WT-J2); BEP Whop only (WJ-WHOP-1).
 */
import {
  isOnboardingRoleId,
  isWhopCheckoutPlan,
  type RoleId,
  type WhopCheckoutPlan,
} from "../shared/join/membership-domain";
import { sanitizeExternalBillingUrl } from "../shared/account/url-allowlist";
import { sanitizeReturnPath } from "../shared/account/returnPath";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { accountRateLimitKey } from "./auth/account-rate-limit";
import { isAuthHost } from "./auth/host";
import { requireSidCsrf, readJsonBody as readJsonBodyShared } from "./auth/sid-guards";
import type { Env, FetchImpl, RateLimitBinding } from "./upstream";
import { bsiPostMeOnboarding, bsiPostWhopCheckoutSession } from "./upstream";

const MAX_BODY_BYTES = 8_192;
const NAME_MAX = 80;

export type JoinLimitEnv = Env & {
  WHOP_CHECKOUT_LIMITER?: RateLimitBinding;
};

const PRIVATE_NO_STORE = "private, no-store";

export function jsonPrivateNoStore(
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

export async function checkWhopCheckoutLimit(
  env: JoinLimitEnv,
  ctx: ActingContext,
): Promise<{ allowed: true } | { allowed: false }> {
  const key = await accountRateLimitKey(ctx);
  const ok = await limitOrDeny(env.WHOP_CHECKOUT_LIMITER, key);
  return ok ? { allowed: true } : { allowed: false };
}

async function checkOnboardingWriteLimit(
  env: JoinLimitEnv,
  ctx: ActingContext,
): Promise<{ allowed: true } | { allowed: false }> {
  // #21 owns ACCOUNT_WRITE_LIMITER — join only consumes it (no duplicate Env field).
  const key = await accountRateLimitKey(ctx);
  const ok = await limitOrDeny(env.ACCOUNT_WRITE_LIMITER, key);
  return ok ? { allowed: true } : { allowed: false };
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

async function readJsonBody(request: Request) {
  return readJsonBodyShared(request, jsonPrivateNoStore);
}

async function requireJoinCsrf(request: Request, env: Env, sid: string) {
  return requireSidCsrf(request, env, sid, jsonPrivateNoStore);
}

function trimName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length < 1 || t.length > NAME_MAX) return null;
  return t;
}

export type OnboardingPayload = {
  first_name: string;
  last_name: string;
  roles: RoleId[];
  has_physical_gym: boolean | null;
  has_physical_clinic: boolean | null;
};

export function validateOnboardingBody(raw: unknown): OnboardingPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const first_name = trimName(body.first_name);
  const last_name = trimName(body.last_name);
  if (!first_name || !last_name) return null;
  if (!Array.isArray(body.roles) || body.roles.length < 1 || body.roles.length > 5) {
    return null;
  }
  const seen = new Set<RoleId>();
  const roles: RoleId[] = [];
  for (const r of body.roles) {
    if (!isOnboardingRoleId(r)) return null;
    if (seen.has(r)) continue;
    seen.add(r);
    roles.push(r);
  }
  if (roles.length < 1) return null;

  const needsGym = roles.includes("gym_owner");
  const needsClinic = roles.includes("clinician");

  let has_physical_gym: boolean | null;
  if (needsGym) {
    if (typeof body.has_physical_gym !== "boolean") return null;
    has_physical_gym = body.has_physical_gym;
  } else {
    // CQ B3 / P-WJ-7: never accept true when gym_owner is absent
    if (body.has_physical_gym === true) return null;
    if (
      body.has_physical_gym !== null &&
      body.has_physical_gym !== false &&
      body.has_physical_gym !== undefined
    ) {
      return null;
    }
    has_physical_gym = body.has_physical_gym === false ? false : null;
  }

  let has_physical_clinic: boolean | null;
  if (needsClinic) {
    if (typeof body.has_physical_clinic !== "boolean") return null;
    has_physical_clinic = body.has_physical_clinic;
  } else {
    if (body.has_physical_clinic === true) return null;
    if (
      body.has_physical_clinic !== null &&
      body.has_physical_clinic !== false &&
      body.has_physical_clinic !== undefined
    ) {
      return null;
    }
    has_physical_clinic = body.has_physical_clinic === false ? false : null;
  }

  return { first_name, last_name, roles, has_physical_gym, has_physical_clinic };
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

export async function handleAccountOnboarding(
  request: Request,
  env: JoinLimitEnv,
  deps: { fetchImpl?: FetchImpl; bsiBaseUrl?: string } = {},
): Promise<Response> {
  if (!isAuthHost(request, env)) return forbidden();
  const method = request.method.toUpperCase();
  if (method === "HEAD") {
    return new Response(null, {
      status: 405,
      headers: {
        Allow: "POST",
        "Cache-Control": PRIVATE_NO_STORE,
      },
    });
  }
  if (method !== "POST") {
    return jsonPrivateNoStore({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const opts = deps.bsiBaseUrl ? { baseUrl: deps.bsiBaseUrl } : undefined;

  const session = await resolveSessionOrUnauth(request, env, fetchImpl, opts);
  if (session instanceof Response) return session;

  const csrfFail = await requireJoinCsrf(request, env, session.sid);
  if (csrfFail) return csrfFail;

  // N8: limiter before body parse — invalid bodies still count against the key
  const lim = await checkOnboardingWriteLimit(env, session);
  if (!lim.allowed) return rateLimited429();

  const bodyRead = await readJsonBody(request);
  if (bodyRead instanceof Response) return bodyRead;
  const payload = validateOnboardingBody(bodyRead.json);
  if (!payload) return jsonPrivateNoStore({ error: "invalid_request" }, 400);

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPostMeOnboarding(access, payload, env, fetchImpl, opts),
  );
  if (ran instanceof Response) {
    if (ran.status === 401) return unauthenticated();
    return upstreamError(ran.status);
  }

  const { result } = ran;
  if (result.kind === "ok") {
    return jsonPrivateNoStore(
      typeof result.json === "object" && result.json !== null ? result.json : { ok: true },
      200,
    );
  }
  if (result.kind === "http" && result.status === 401) return unauthenticated();
  return jsonPrivateNoStore({ error: "upstream_error" }, 502);
}

export async function handleWhopCheckoutSession(
  request: Request,
  env: JoinLimitEnv,
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

  const csrfFail = await requireJoinCsrf(request, env, session.sid);
  if (csrfFail) return csrfFail;

  const lim = await checkWhopCheckoutLimit(env, session);
  if (!lim.allowed) return rateLimited429();

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
  let return_path: string | undefined;
  if (body.return_path !== undefined && body.return_path !== null) {
    const sanitized = sanitizeReturnPath(body.return_path);
    if (!sanitized) return jsonPrivateNoStore({ error: "invalid_return_path" }, 400);
    return_path = sanitized;
  }

  const upstreamBody: Record<string, unknown> = { plan };
  if (return_path) upstreamBody.return_path = return_path;

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPostWhopCheckoutSession(access, upstreamBody, env, fetchImpl, opts),
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
  const out: Record<string, unknown> = { checkout_url };
  if (typeof expires_at === "string") out.expires_at = expires_at;
  return jsonPrivateNoStore(out, 200);
}

/** Route dispatcher — returns null when path is not owned. */
export async function handleJoinRoutes(
  request: Request,
  env: JoinLimitEnv,
  deps: { fetchImpl?: FetchImpl; bsiBaseUrl?: string } = {},
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === "/api/account/onboarding") {
    return handleAccountOnboarding(request, env, deps);
  }
  if (path === "/api/billing/whop/checkout-session") {
    return handleWhopCheckoutSession(request, env, deps);
  }
  return null;
}
