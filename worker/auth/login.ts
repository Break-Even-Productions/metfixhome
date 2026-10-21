import type { Env, FetchImpl, TokenPairBody } from "../upstream";
import {
  bsiFetchMe,
  oauthPasswordGrant,
  parseBsiMeProfile,
  parseRetryAfter,
  requireAuthConfig,
} from "../upstream";
import { requireCsrf } from "./csrf";
import { SID_COOKIE, getSid, setHostCookie } from "./cookies";
import { randomId32 } from "./crypto";
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
  ThrottleUnavailableError,
} from "./throttle";

const SID_MAX_AGE = 2_592_000; // 30d

type LoginBody = {
  identifier?: unknown;
  password?: unknown;
  recaptcha?: unknown;
};

async function siteverifyLogin(
  token: string,
  secret: string,
  fetchImpl: FetchImpl,
): Promise<"pass" | "fail" | "outage"> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetchImpl("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "outage";
    const json = (await res.json()) as {
      success?: unknown;
      score?: unknown;
      action?: unknown;
      hostname?: unknown;
    };
    if (json.success !== true) return "fail";
    if (json.hostname !== "metfix.org") return "fail";
    if (json.action !== "login") return "fail";
    if (typeof json.score !== "number" || json.score < 0.5) return "fail";
    return "pass";
  } catch {
    return "outage";
  }
}

function unavailable503(retryAfter: number = 60): Response {
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(retryAfter) });
}

export async function handleLogin(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string; baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
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

  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;

  try {
    const cfg = requireAuthConfig(env, {
      needRecaptcha: true,
      needApiKey: false,
      baseUrl,
    });
    if (!cfg) {
      return unavailable503(60);
    }

    const r8a = await checkR8a(env, identifier);
    if (!r8a.allowed) {
      return authJson(BODY_RATE_LIMITED, 429, {
        "Retry-After": String(r8a.retryAfter),
      });
    }

    const r8b = await attemptR8b(env, clientIp(request));
    if (!r8b.allowed) {
      return authJson(BODY_RATE_LIMITED, 429, {
        "Retry-After": String(r8b.retryAfter),
      });
    }

    if (typeof body.recaptcha !== "string" || body.recaptcha.length === 0) {
      return authJson(BODY_TRY_AGAIN, 403);
    }
    const recaptchaToken = body.recaptcha;

    const sv = await siteverifyLogin(recaptchaToken, cfg.recaptchaSecret, fetchImpl);
    if (sv === "fail") {
      return authJson(BODY_TRY_AGAIN, 403);
    }
    if (sv === "outage") {
      return unavailable503(60);
    }

    const r8c = await reserveR8c(env);
    if (!r8c.allowed) {
      return authJson(BODY_RATE_LIMITED, 429, {
        "Retry-After": String(r8c.retryAfter),
      });
    }

    if (!env.SESSION_ENC_KEY) {
      return unavailable503(60);
    }

    const tokenRes = await oauthPasswordGrant(
      { username: identifier, password },
      env,
      fetchImpl,
      { baseUrl, timeoutMs: 5000 },
    );

    return await mapDirectTokenOutcome(tokenRes, {
      env,
      identifier,
      incomingSid: getSid(request),
      fetchImpl,
      baseUrl,
    });
  } catch (e) {
    if (e instanceof ThrottleUnavailableError) {
      return unavailable503(60);
    }
    throw e;
  }
}

async function mapDirectTokenOutcome(
  upstream: Awaited<ReturnType<typeof oauthPasswordGrant>>,
  ctx: {
    env: Env;
    identifier: string;
    incomingSid: string | null;
    fetchImpl: FetchImpl;
    baseUrl?: string;
  },
): Promise<Response> {
  const { env, identifier, incomingSid, fetchImpl, baseUrl } = ctx;

  if (upstream.kind === "nokey") {
    return unavailable503(60);
  }

  if (
    upstream.kind === "timeout" ||
    upstream.kind === "throw" ||
    upstream.kind === "bad_json"
  ) {
    return unavailable503(60);
  }

  if (upstream.kind === "http") {
    const { status, code, retryAfter } = upstream;
    if (code === "invalid_grant") {
      await failR8a(env, identifier);
      return authJson(BODY_INVALID_LOGIN, 401);
    }
    if (status === 429 || status >= 500) {
      const ra = retryAfter ?? parseRetryAfter(null);
      return unavailable503(ra);
    }
    return unavailable503(60);
  }

  const tok = upstream.json as TokenPairBody;
  if (typeof tok.access_token !== "string" || tok.access_token.length === 0) {
    return unavailable503(60);
  }
  const refreshToken =
    typeof tok.refresh_token === "string" && tok.refresh_token.length > 0
      ? tok.refresh_token
      : null;
  if (!refreshToken) {
    return unavailable503(60);
  }

  const meRes = await bsiFetchMe(tok.access_token, env, fetchImpl, {
    baseUrl,
    timeoutMs: 5000,
  });

  if (meRes.kind !== "ok") {
    const ra =
      meRes.kind === "http" || meRes.kind === "bad_json"
        ? (meRes.retryAfter ?? parseRetryAfter(null))
        : parseRetryAfter(null);
    return unavailable503(ra);
  }

  const profile = parseBsiMeProfile(meRes.json);
  if (!profile) {
    return unavailable503(60);
  }

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
    refresh_token: refreshToken,
    expires_in: tok.expires_in,
    public_name: profile.display_name,
    user_id: profile.id,
    can_moderate: profile.can_moderate,
  });
  await clearR8a(env, identifier);
  return authJson(
    { signed_in: true, public_name: profile.display_name },
    200,
    {},
    [setHostCookie(SID_COOKIE, newSid, SID_MAX_AGE)],
  );
}
