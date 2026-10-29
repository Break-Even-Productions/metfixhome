/**
 * Join / Whop checkout Worker routes (WJ21, WJ22).
 * Upstream BSI mocked in tests; Bearer-only (WT-J2); BEP Whop only (WJ-WHOP-1).
 */
import {
  isOnboardingRoleId,
  isWhopCheckoutPlan,
  ONBOARDING_ROLE_IDS,
  sanitizeReturnPath,
  sanitizeWhopCheckoutUrl,
  type RoleId,
  type WhopCheckoutPlan,
} from "../shared/join/membership-domain";
import { resolveActingSession, runUserBsiCall, type ActingContext } from "./auth/acting";
import { csrfForSid, timingSafeEqualStr } from "./auth/crypto";
import { isAllowedAuthOrigin } from "./auth/csrf";
import { isAuthHost } from "./auth/host";
import { clientIp } from "./auth/http";
import type { Env, FetchImpl, RateLimitBinding } from "./upstream";
import {
  bsiAccountBearerHeaders,
  bsiPostMeOnboarding,
  bsiPostWhopCheckoutSession,
} from "./upstream";

export { bsiAccountBearerHeaders };

const MAX_BODY_BYTES = 8_192;
const NAME_MAX = 80;

export type JoinLimitEnv = Env & {
  ACCOUNT_WRITE_LIMITER?: RateLimitBinding;
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

const keyChains = new Map<string, Promise<unknown>>();

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = keyChains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const next = prev.then(
    () => gate,
    () => gate,
  );
  keyChains.set(key, next);
  await prev.then(
    () => undefined,
    () => undefined,
  );
  try {
    return await fn();
  } finally {
    release();
    if (keyChains.get(key) === next) keyChains.delete(key);
  }
}

async function limitOrDeny(
  binding: RateLimitBinding | undefined,
  key: string,
): Promise<boolean> {
  if (!binding) return false;
  return withKeyLock(key, async () => {
    const r = await binding.limit({ key });
    return r.success === true;
  });
}

export async function checkAccountWriteLimit(
  env: JoinLimitEnv,
  userId: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await limitOrDeny(env.ACCOUNT_WRITE_LIMITER, `acctw:${userId}:${ip}`);
  return ok ? { allowed: true } : { allowed: false };
}

export async function checkWhopCheckoutLimit(
  env: JoinLimitEnv,
  userId: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false }> {
  const ok = await limitOrDeny(env.WHOP_CHECKOUT_LIMITER, `whop:${userId}:${ip}`);
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

async function requireSidCsrf(
  request: Request,
  env: Env,
  sid: string,
): Promise<Response | null> {
  if (!env.CSRF_SECRET) {
    return jsonPrivateNoStore({ error: "unavailable" }, 503, { "Retry-After": "300" });
  }
  const origin = request.headers.get("Origin");
  if (!isAllowedAuthOrigin(origin, env)) return forbidden();
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs != null && sfs !== "same-origin") return forbidden();
  const header = request.headers.get("X-CSRF-Token") ?? "";
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(header, expected)) return forbidden();
  return null;
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; json: unknown } | Response> {
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
    return { ok: true, json: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return jsonPrivateNoStore({ error: "invalid_request" }, 400);
  }
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
  // Reject unknown keys that look like admin escalation
  for (const r of body.roles) {
    if (typeof r === "string" && !(ONBOARDING_ROLE_IDS as readonly string[]).includes(r)) {
      return null;
    }
  }

  const needsGym = roles.includes("gym_owner");
  const needsClinic = roles.includes("clinician");

  let has_physical_gym: boolean | null;
  if (needsGym) {
    if (typeof body.has_physical_gym !== "boolean") return null;
    has_physical_gym = body.has_physical_gym;
  } else if (body.has_physical_gym === null || body.has_physical_gym === false || body.has_physical_gym === undefined) {
    has_physical_gym = body.has_physical_gym === false ? false : null;
  } else if (typeof body.has_physical_gym === "boolean") {
    has_physical_gym = body.has_physical_gym;
  } else {
    return null;
  }

  let has_physical_clinic: boolean | null;
  if (needsClinic) {
    if (typeof body.has_physical_clinic !== "boolean") return null;
    has_physical_clinic = body.has_physical_clinic;
  } else if (
    body.has_physical_clinic === null ||
    body.has_physical_clinic === false ||
    body.has_physical_clinic === undefined
  ) {
    has_physical_clinic = body.has_physical_clinic === false ? false : null;
  } else if (typeof body.has_physical_clinic === "boolean") {
    has_physical_clinic = body.has_physical_clinic;
  } else {
    return null;
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
    // Map acting signed_out → unauthenticated for account/billing contract (WJ21/WJ22).
    if (resolved.status === 401) return unauthenticated();
    // Preserve 503 unavailable; wrap others as private no-store when possible.
    const text = await resolved.text();
    const headers = new Headers(resolved.headers);
    headers.set("Cache-Control", PRIVATE_NO_STORE);
    return new Response(text, { status: resolved.status, headers });
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

  const csrfFail = await requireSidCsrf(request, env, session.sid);
  if (csrfFail) return csrfFail;

  const bodyRead = await readJsonBody(request);
  if (bodyRead instanceof Response) return bodyRead;
  const payload = validateOnboardingBody(bodyRead.json);
  if (!payload) return jsonPrivateNoStore({ error: "invalid_request" }, 400);

  const userId = String(session.record.bsi_user_id ?? session.hex);
  const ip = clientIp(request);
  const lim = await checkAccountWriteLimit(env, userId, ip);
  if (!lim.allowed) return rateLimited429();

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPostMeOnboarding(access, payload, env, fetchImpl, opts),
  );
  if (ran instanceof Response) {
    if (ran.status === 401) return unauthenticated();
    const text = await ran.text();
    const headers = new Headers(ran.headers);
    headers.set("Cache-Control", PRIVATE_NO_STORE);
    return new Response(text, { status: ran.status, headers });
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

  const csrfFail = await requireSidCsrf(request, env, session.sid);
  if (csrfFail) return csrfFail;

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

  const userId = String(session.record.bsi_user_id ?? session.hex);
  const ip = clientIp(request);
  const lim = await checkWhopCheckoutLimit(env, userId, ip);
  if (!lim.allowed) return rateLimited429();

  const upstreamBody: Record<string, unknown> = { plan };
  if (return_path) upstreamBody.return_path = return_path;

  const ran = await runUserBsiCall(session, env, fetchImpl, opts, (access) =>
    bsiPostWhopCheckoutSession(access, upstreamBody, env, fetchImpl, opts),
  );
  if (ran instanceof Response) {
    if (ran.status === 401) return unauthenticated();
    const text = await ran.text();
    const headers = new Headers(ran.headers);
    headers.set("Cache-Control", PRIVATE_NO_STORE);
    return new Response(text, { status: ran.status, headers });
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
  const checkout_url = sanitizeWhopCheckoutUrl(checkoutRaw);
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
