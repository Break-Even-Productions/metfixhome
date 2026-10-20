import type { Env, FetchImpl, TokenPairBody } from "../upstream";
import {
  bsiWebLogin,
  normalizeCanModerate,
  parseRetryAfter,
} from "../upstream";
import { requireCsrf } from "./csrf";
import { SID_COOKIE, getSid, setHostCookie } from "./cookies";
import { randomId32, sha256Prefix12 } from "./crypto";
import { isAuthHost } from "./host";
import {
  BODY_INVALID_LOGIN,
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_TRY_AGAIN,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";
import { createSession, destroySession } from "./session";
import {
  attemptR8b,
  checkR8a,
  clearR8a,
  clientIp,
  failR8a,
  reserveR8c,
} from "./throttle";

const SID_MAX_AGE = 2_592_000; // 30d

type LoginBody = {
  identifier?: unknown;
  password?: unknown;
  recaptcha?: unknown;
  client_id?: unknown;
};

export async function handleLogin(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string; baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);
  const method = request.method.toUpperCase();
  if (method !== "POST") return methodNotAllowed("POST");

  const csrf = await requireCsrf(request, env);
  if (!csrf.ok) return csrf.response;

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return authJson(BODY_INVALID_REQUEST, 400);
  }

  const identifier = typeof body.identifier === "string" ? body.identifier : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }

  // Order: R8a → R8b → token shape → R8c → BSI-C10 (§0s.1 / 1.6.3)
  const r8a = await checkR8a(env, identifier);
  if (!r8a.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8a.retryAfter),
    });
  }

  const ip = clientIp(request);
  const r8b = await attemptR8b(env, ip);
  if (!r8b.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8b.retryAfter),
    });
  }

  // Shape check: non-empty JSON string; no trim (AU26.2).
  if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  const recaptchaToken = body.recaptcha;

  const r8c = await reserveR8c(env);
  if (!r8c.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(r8c.retryAfter),
    });
  }

  const clientId = env.BSI_OAUTH_CLIENT_ID;
  if (!clientId || !env.DAILY_FIX_API_KEY || !env.SESSION_ENC_KEY) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }

  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  const upstream = await bsiWebLogin(
    {
      username: identifier,
      password,
      client_id: clientId,
      recaptcha_token: recaptchaToken,
    },
    env,
    fetchImpl,
    { baseUrl, timeoutMs: 5000 },
  );

  return mapWebLoginOutcome(upstream, {
    env,
    identifier,
    incomingSid: getSid(request),
  });
}

async function mapWebLoginOutcome(
  upstream: Awaited<ReturnType<typeof bsiWebLogin>>,
  ctx: { env: Env; identifier: string; incomingSid: string | null },
): Promise<Response> {
  const { env, identifier, incomingSid } = ctx;

  if (
    upstream.kind === "nokey" ||
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "bad_json"
  ) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }

  if (upstream.kind === "ok") {
    const tok = upstream.json as TokenPairBody;
    if (
      typeof tok.access_token !== "string" ||
      typeof tok.refresh_token !== "string" ||
      typeof tok.public_name !== "string" ||
      tok.user_id == null
    ) {
      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
    }
    // Discard any incoming sid (A-T1).
    if (incomingSid) {
      try {
        await destroySession(env, incomingSid);
      } catch {
        /* ignore */
      }
    }
    const newSid = randomId32();
    await createSession(env, newSid, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: tok.expires_in,
      public_name: tok.public_name,
      user_id: tok.user_id,
      can_moderate: normalizeCanModerate(tok.can_moderate),
    });
    await clearR8a(env, identifier);
    return authJson(
      { signed_in: true, public_name: tok.public_name },
      200,
      {},
      [setHostCookie(SID_COOKIE, newSid, SID_MAX_AGE)],
    );
  }

  const { status, code, retryAfter } = upstream;

  if (status === 429 || code === "rate_limited") {
    const ra = retryAfter ?? parseRetryAfter(null);
    return authJson(BODY_RATE_LIMITED, 429, { "Retry-After": String(ra) });
  }

  if (code === "missing_fields") {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  if (code === "recaptcha_missing" || code === "recaptcha_failed") {
    return authJson(BODY_TRY_AGAIN, 403);
  }
  if (code === "invalid_credentials" || code === "login_disabled") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  if (code === "client_not_allowed") {
    console.log("bsi_client_not_allowed", await sha256Prefix12(identifier));
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  if (status === 401 && code === "forbidden") {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  }
  if (status === 401 && code === "invalid_credentials") {
    await failR8a(env, identifier);
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}
