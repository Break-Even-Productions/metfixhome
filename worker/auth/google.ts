/**
 * Google OAuth scaffolding (R9: gated until GOOGLE_AUTH_ENABLED).
 * Routes return 404 when the gate is off.
 */

import type { Env, FetchImpl } from "../upstream";
import {
  METFIX_CALLBACK_URI,
  bsiExchangeCode,
  bsiFollowBridge,
  bsiSocialAuth,
  normalizeCanModerate,
} from "../upstream";
import { PRE_COOKIE, SID_COOKIE, getPre, setHostCookie } from "./cookies";
import {
  bytesToBase64Url,
  randomBytes,
  randomId32,
  sha256Hex,
} from "./crypto";
import { isAuthHost } from "./host";
import {
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  authJson,
  methodNotAllowed,
} from "./responses";
import { createSession } from "./session";
import type { OauthStateRecord } from "../do/oauth-state";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const SID_MAX_AGE = 2_592_000;

function googleEnabled(env: Env): boolean {
  const v = (env.GOOGLE_AUTH_ENABLED ?? "").toLowerCase();
  return (
    (v === "1" || v === "true") &&
    !!env.GOOGLE_WEB_CLIENT_ID &&
    !!env.GOOGLE_WEB_CLIENT_SECRET
  );
}

function sanitizeReturn(raw: string | null): string {
  if (!raw || raw.length > 512) return "/";
  if (!/^\/(?!\/)[A-Za-z0-9/_\-#?=&.]*$/.test(raw)) return "/";
  return raw;
}

async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  const name = `oauth:${await sha256Hex(state)}`;
  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
  await stub.fetch(
    new Request("https://oauth.do/put", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    }),
  );
}

async function takeOauthState(
  env: Env,
  state: string,
): Promise<OauthStateRecord | null> {
  const name = `oauth:${await sha256Hex(state)}`;
  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
  const res = await stub.fetch(new Request("https://oauth.do/take", { method: "POST" }));
  if (!res.ok) return null;
  const data = (await res.json()) as { record?: OauthStateRecord };
  return data.record ?? null;
}

export async function handleGoogleStart(request: Request, env: Env): Promise<Response> {
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);
  if (!googleEnabled(env)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed("GET");

  const url = new URL(request.url);
  const intentRaw = url.searchParams.get("intent");
  const intent = intentRaw === "register" ? "register" : "login";
  const ret = sanitizeReturn(url.searchParams.get("return"));

  let pre = getPre(request);
  const cookies: string[] = [];
  if (!pre) {
    pre = randomId32();
    cookies.push(setHostCookie(PRE_COOKIE, pre, 1800));
  }

  const state = randomId32();
  const nonce = randomId32();
  const verifier = bytesToBase64Url(randomBytes(32));
  const challenge = bytesToBase64Url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );

  await putOauthState(env, state, {
    flow: "google",
    nonce,
    verifier,
    intent,
    return: ret,
    pre_hash: await sha256Hex(pre),
    created: Date.now(),
  });

  const g = new URL(GOOGLE_AUTH);
  g.searchParams.set("client_id", env.GOOGLE_WEB_CLIENT_ID!);
  g.searchParams.set("redirect_uri", "https://metfix.org/api/auth/google/callback");
  g.searchParams.set("response_type", "code");
  g.searchParams.set("scope", "openid email profile");
  g.searchParams.set("state", state);
  g.searchParams.set("nonce", nonce);
  g.searchParams.set("code_challenge", challenge);
  g.searchParams.set("code_challenge_method", "S256");

  const headers = new Headers({
    Location: g.toString(),
    "Cache-Control": "no-store",
  });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function handleGoogleCallback(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);
  if (!googleEnabled(env)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed("GET");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=state", "Cache-Control": "no-store" },
    });
  }

  const rec = await takeOauthState(env, state);
  const pre = getPre(request);
  if (!rec || !pre || (await sha256Hex(pre)) !== rec.pre_hash) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=state", "Cache-Control": "no-store" },
    });
  }

  // Trade code with Google.
  let idToken: string;
  try {
    const tokenRes = await fetchImpl(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_WEB_CLIENT_ID!,
        client_secret: env.GOOGLE_WEB_CLIENT_SECRET!,
        redirect_uri: "https://metfix.org/api/auth/google/callback",
        grant_type: "authorization_code",
        code_verifier: rec.verifier,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!tokenRes.ok) throw new Error("google_token");
    const tj = (await tokenRes.json()) as { id_token?: string };
    if (typeof tj.id_token !== "string") throw new Error("no_id_token");
    idToken = tj.id_token;
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  // Minimal JWT payload parse for email_verified / nonce (signature check TODO via JWKS).
  let payload: { nonce?: string; email_verified?: unknown; aud?: unknown };
  try {
    const mid = idToken.split(".")[1];
    if (!mid) throw new Error("jwt");
    const pad = "=".repeat((4 - (mid.length % 4)) % 4);
    payload = JSON.parse(atob(mid.replace(/-/g, "+").replace(/_/g, "/") + pad)) as typeof payload;
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }
  if (payload.nonce !== rec.nonce) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  // D-2: unverified → login by sub only (never register).
  const verified = payload.email_verified === true;
  const intent = verified ? rec.intent : "login";

  if (!env.BSI_OAUTH_CLIENT_ID) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  const bridgeState = randomId32();
  await putOauthState(env, bridgeState, {
    flow: "bridge",
    nonce: rec.nonce,
    verifier: "",
    intent,
    return: rec.return,
    pre_hash: rec.pre_hash,
    created: Date.now(),
  });

  const social = await bsiSocialAuth(
    {
      provider: "google",
      intent,
      access_token: idToken,
      client_id: env.BSI_OAUTH_CLIENT_ID,
      redirect_uri: METFIX_CALLBACK_URI,
      state: bridgeState,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl },
  );

  if (social.kind !== "ok") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  const bridgeUrl = (social.json as { bridge_url?: string }).bridge_url;
  if (typeof bridgeUrl !== "string") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  const followed = await bsiFollowBridge(bridgeUrl, fetchImpl);
  if (followed.kind !== "redirect") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  // Extract code from bridge redirect Location and exchange server-side.
  let wpCode: string | null = null;
  try {
    const loc = new URL(followed.location);
    wpCode = loc.searchParams.get("code");
  } catch {
    wpCode = null;
  }
  if (!wpCode) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  const exchanged = await bsiExchangeCode(
    {
      grant_type: "authorization_code",
      code: wpCode,
      client_id: env.BSI_OAUTH_CLIENT_ID,
      redirect_uri: METFIX_CALLBACK_URI,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl },
  );

  if (exchanged.kind !== "ok") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  const tok = exchanged.json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    public_name?: string;
    user_id?: string | number;
    can_moderate?: unknown;
  };
  if (typeof tok.access_token !== "string" || typeof tok.refresh_token !== "string") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?auth_error=google", "Cache-Control": "no-store" },
    });
  }

  const sid = randomId32();
  await createSession(env, sid, {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_in: tok.expires_in,
    public_name: typeof tok.public_name === "string" ? tok.public_name : "Member",
    user_id: tok.user_id ?? "0",
    can_moderate: normalizeCanModerate(tok.can_moderate),
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: rec.return || "/",
      "Cache-Control": "no-store",
      "Set-Cookie": setHostCookie(SID_COOKIE, sid, SID_MAX_AGE),
    },
  });
}

/** Browser GET to /api/auth/callback → 400 (R12); only server-side bridge follow consumes codes. */
export async function handleWpCallback(request: Request): Promise<Response> {
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed("GET");
  return authJson(BODY_INVALID_REQUEST, 400);
}
