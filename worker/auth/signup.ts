import type { Env, FetchImpl } from "../upstream";
import {
  METFIX_CALLBACK_URI,
  bsiCheckUsername,
  bsiRegisterDirect,
  parseRetryAfter,
  requireAuthConfig,
} from "../upstream";
import { checkSignupLimit, checkUsernameLimit } from "./auth-rate-limit";
import { requireCsrf } from "./csrf";
import { isAuthHost } from "./host";
import {
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_TRY_AGAIN,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";
import { clientIp } from "./throttle";

function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{1,32}$/.test(username);
}

async function siteverify(
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
    if (json.action !== "signup") return "fail";
    if (typeof json.score !== "number" || json.score < 0.5) return "fail";
    return "pass";
  } catch {
    return "outage";
  }
}

export async function handleSignup(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "POST") return methodNotAllowed("POST");
  const csrf = await requireCsrf(request, env);
  if (!csrf.ok) return csrf.response;
  let body: { username?: unknown; email?: unknown; recaptcha?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return authJson(BODY_INVALID_REQUEST, 400);
  }
  const username = typeof body.username === "string" ? body.username : "";
  const email = typeof body.email === "string" ? body.email : "";
  const recaptcha = typeof body.recaptcha === "string" ? body.recaptcha : "";
  if (!username || !email || !recaptcha) return authJson(BODY_INVALID_REQUEST, 400);
  if (!isValidUsername(username)) return authJson({ error: "invalid_username" }, 400);
  const ip = clientIp(request);
  const lim = await checkSignupLimit(env, ip);
  if (!lim.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(parseRetryAfter(null)),
    });
  }
  const cfg = requireAuthConfig(env, {
    needRecaptcha: true,
    needApiKey: false,
    baseUrl: opts?.bsiBaseUrl,
  });
  if (!cfg) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }
  const sv = await siteverify(recaptcha, cfg.recaptchaSecret, fetchImpl);
  if (sv === "fail") return authJson(BODY_TRY_AGAIN, 403);
  if (sv === "outage") return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
  const upstream = await bsiRegisterDirect(
    {
      username,
      email,
      client_id: cfg.clientId,
      redirect_uri: METFIX_CALLBACK_URI,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl },
  );
  if (upstream.kind === "ok") return authJson({ status: "check_email" }, 202);
  if (upstream.kind === "http") {
    if (upstream.code === "invalid_username") return authJson({ error: "invalid_username" }, 400);
    if (upstream.status === 409 || upstream.code === "account_exists") {
      return authJson({ status: "check_email" }, 202);
    }
    if (upstream.status === 429) {
      return authJson(BODY_RATE_LIMITED, 429, {
        "Retry-After": String(upstream.retryAfter ?? parseRetryAfter(null)),
      });
    }
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}

export async function handleUsernameCheck(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
  const method = request.method.toUpperCase();
  if (method === "HEAD") return methodNotAllowed("GET");
  if (method !== "GET") return methodNotAllowed("GET");
  const csrf = await requireCsrf(request, env);
  if (!csrf.ok) return csrf.response;
  const url = new URL(request.url);
  const all = url.searchParams.getAll("username");
  if (all.length !== 1) return authJson(BODY_INVALID_REQUEST, 400);
  const username = all[0] ?? "";
  if (!username) return authJson({ valid: false }, 200);
  if (username.includes("@")) return authJson({ valid: false }, 200);
  const ip = clientIp(request);
  const lim = await checkUsernameLimit(env, ip);
  if (!lim.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(parseRetryAfter(null)),
    });
  }
  const upstream = await bsiCheckUsername(username, env, fetchImpl, {
    baseUrl: opts?.bsiBaseUrl,
  });
  if (upstream.kind === "ok" && upstream.json && typeof upstream.json === "object") {
    const avail = (upstream.json as { available?: unknown }).available;
    if (typeof avail === "boolean") return authJson({ available: avail }, 200);
  }
  if (upstream.kind === "http" && upstream.code === "invalid_username") {
    return authJson({ valid: false }, 200);
  }
  if (upstream.kind === "http" && upstream.status === 429) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(upstream.retryAfter ?? parseRetryAfter(null)),
    });
  }
  return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
}
