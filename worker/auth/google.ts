/**
 * Google OAuth scaffolding (R9: gated until GOOGLE_AUTH_ENABLED).
 * Routes return 404 when the gate is off.
 */

import type { Env, FetchImpl } from "../upstream";
import { checkGoogleLimit } from "./auth-rate-limit";
import {
  METFIX_CALLBACK_URI,
  bsiFetchMe,
  bsiFollowBridge,
  bsiSocialAuth,
  oauthAuthorizationCodeGrant,
  parseBsiMeProfile,
  parseRetryAfter,
  requireAuthConfig,
} from "../upstream";
import { PRE_COOKIE, SID_COOKIE, getPre, getSid, setHostCookie } from "./cookies";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  randomBytes,
  randomId32,
  sha256Hex,
} from "./crypto";
import { isAuthHost } from "./host";
import {
  AUTH_HEADERS,
  BODY_INVALID_LOGIN,
  BODY_INVALID_REQUEST,
  BODY_NOT_FOUND,
  BODY_RATE_LIMITED,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";
import { attemptR8b, clientIp } from "./throttle";
import { createSession, destroySession } from "./session";
import type { OauthStateRecord } from "../do/oauth-state";
import { sanitizeReturnPath } from "../../shared/account/returnPath";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const JWKS_CACHE_URL = GOOGLE_JWKS_URL;
const JWKS_KID_MISS_URL = `${GOOGLE_JWKS_URL}#kid-miss`;
const SID_MAX_AGE = 2_592_000;
const OAUTH_DO_TIMEOUT_MS = 1000;
const CLOCK_SKEW_SEC = 60;

/** Google JWKS entry — DOM JsonWebKey omits `kid`. */
type GoogleJwk = JsonWebKey & { kid?: string };

function authRedirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": AUTH_HEADERS["Cache-Control"]!,
    Pragma: AUTH_HEADERS.Pragma!,
    "Referrer-Policy": AUTH_HEADERS["Referrer-Policy"]!,
    "X-Content-Type-Options": AUTH_HEADERS["X-Content-Type-Options"]!,
  });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}


function googleEnabled(env: Env): boolean {
  const v = (env.GOOGLE_AUTH_ENABLED ?? "").toLowerCase();
  return (
    (v === "1" || v === "true") &&
    !!env.GOOGLE_WEB_CLIENT_ID &&
    !!env.GOOGLE_WEB_CLIENT_SECRET
  );
}

function sanitizeReturn(raw: string | null): string {
  return sanitizeReturnPath(raw) ?? "/";
}

function authErrorRedirect(code: "state" | "google" | "unavailable"): Response {
  return authRedirect(`/?auth_error=${code}`);
}

function cachesDefault(): Cache | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).caches?.default as Cache | undefined;
  } catch {
    return undefined;
  }
}

async function withOauthTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("oauth_timeout")), OAUTH_DO_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function putOauthState(env: Env, state: string, rec: OauthStateRecord): Promise<void> {
  if (!env.OAUTH_STATE) throw new Error("oauth_unbound");
  const name = `oauth:${await sha256Hex(state)}`;
  const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
  const res = await withOauthTimeout(
    stub.fetch(
      new Request("https://oauth.do/put", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      }),
    ),
  );
  if (!res.ok) throw new Error("oauth_put_failed");
}

async function takeOauthState(
  env: Env,
  state: string,
): Promise<OauthStateRecord | null | "unavailable"> {
  try {
    if (!env.OAUTH_STATE) return "unavailable";
    const name = `oauth:${await sha256Hex(state)}`;
    const stub = env.OAUTH_STATE.get(env.OAUTH_STATE.idFromName(name));
    const res = await withOauthTimeout(
      stub.fetch(new Request("https://oauth.do/take", { method: "POST" })),
    );
    if (res.status === 503) return "unavailable";
    if (!res.ok) return null;
    const data = (await res.json()) as { record?: OauthStateRecord };
    return data.record ?? null;
  } catch {
    return "unavailable";
  }
}

type IdTokenPayload = {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email_verified?: unknown;
};

function audOk(aud: unknown, clientId: string): boolean {
  if (aud === clientId) return true;
  if (Array.isArray(aud) && aud.length === 1 && aud[0] === clientId) return true;
  return false;
}

function issOk(iss: unknown): boolean {
  return iss === "https://accounts.google.com" || iss === "accounts.google.com";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function fetchJwksNetwork(fetchImpl: FetchImpl): Promise<{ keys: GoogleJwk[] } | null> {
  try {
    // No AbortSignal.timeout: vitest fake timers can abort it spuriously.
    const res = await fetchImpl(GOOGLE_JWKS_URL, { method: "GET" });
    if (!res.ok) return null;
    const text = await res.text();
    const json = JSON.parse(text) as { keys?: GoogleJwk[] };
    if (!Array.isArray(json.keys)) return null;
    return { keys: json.keys };
  } catch {
    return null;
  }
}

async function readCachedJson<T>(cache: Cache | undefined, url: string): Promise<T | null> {
  if (!cache) return null;
  try {
    const hit = await cache.match(url);
    if (!hit) return null;
    return (await hit.json()) as T;
  } catch {
    return null;
  }
}

async function writeCachedJson(
  cache: Cache | undefined,
  url: string,
  body: unknown,
  maxAgeSec: number,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(
      url,
      new Response(JSON.stringify(body), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${maxAgeSec}`,
        },
      }),
    );
  } catch {
    /* ignore */
  }
}

async function loadJwks(
  fetchImpl: FetchImpl,
  cache: Cache | undefined,
  forceNetwork: boolean,
): Promise<{ keys: GoogleJwk[] } | null> {
  if (!forceNetwork) {
    const cached = await readCachedJson<{ keys: GoogleJwk[] }>(cache, JWKS_CACHE_URL);
    if (cached?.keys) return cached;
  }
  const fresh = await fetchJwksNetwork(fetchImpl);
  if (fresh) await writeCachedJson(cache, JWKS_CACHE_URL, fresh, 3600);
  return fresh;
}

async function resolveJwkForKid(
  kid: string,
  fetchImpl: FetchImpl,
  cache: Cache | undefined,
): Promise<GoogleJwk | null> {
  let jwks = await loadJwks(fetchImpl, cache, false);
  let key = jwks?.keys.find((k) => k.kid === kid) ?? null;
  if (key) return key;

  const missMarker = await readCachedJson<{ t: number }>(cache, JWKS_KID_MISS_URL);
  if (missMarker) return null;

  await writeCachedJson(cache, JWKS_KID_MISS_URL, { t: Date.now() }, 300);
  jwks = await loadJwks(fetchImpl, cache, true);
  key = jwks?.keys.find((k) => k.kid === kid) ?? null;
  return key;
}

async function verifyGoogleIdToken(
  idToken: string,
  env: Env,
  fetchImpl: FetchImpl,
  expectedNonce: string,
): Promise<IdTokenPayload | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [hB64, pB64, sB64] = parts as [string, string, string];
  let header: { alg?: unknown; kid?: unknown };
  let payload: IdTokenPayload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(hB64))) as typeof header;
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(pB64))) as IdTokenPayload;
  } catch {
    return null;
  }
  if (header.alg !== "RS256") return null;
  if (typeof header.kid !== "string" || !header.kid) return null;

  const jwk = await resolveJwkForKid(header.kid, fetchImpl, cachesDefault());
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      toArrayBuffer(base64UrlToBytes(sB64)),
      new TextEncoder().encode(`${hB64}.${pB64}`),
    );
    if (!ok) return null;
  } catch {
    return null;
  }

  const clientId = env.GOOGLE_WEB_CLIENT_ID!;
  if (!issOk(payload.iss)) return null;
  if (!audOk(payload.aud, clientId)) return null;
  if (payload.azp !== undefined && payload.azp !== clientId) return null;
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp + CLOCK_SKEW_SEC < nowSec) return null;
  if (payload.iat > nowSec + CLOCK_SKEW_SEC) return null;
  if (payload.nonce !== expectedNonce) return null;
  return payload;
}

export async function handleGoogleStart(request: Request, env: Env): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
  if (!googleEnabled(env)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed("GET");

  const lim = await checkGoogleLimit(env, clientIp(request));
  if (!lim.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(parseRetryAfter(null)),
    });
  }

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

  try {
    await putOauthState(env, state, {
      flow: "google",
      nonce,
      verifier,
      intent,
      return: ret,
      pre_hash: await sha256Hex(pre),
      created: Date.now(),
    });
  } catch {
    return authErrorRedirect("unavailable");
  }

  const g = new URL(GOOGLE_AUTH);
  g.searchParams.set("client_id", env.GOOGLE_WEB_CLIENT_ID!);
  g.searchParams.set("redirect_uri", "https://metfix.org/api/auth/google/callback");
  g.searchParams.set("response_type", "code");
  g.searchParams.set("scope", "openid email profile");
  g.searchParams.set("state", state);
  g.searchParams.set("nonce", nonce);
  g.searchParams.set("code_challenge", challenge);
  g.searchParams.set("code_challenge_method", "S256");

  return authRedirect(g.toString(), cookies);
}

export async function handleGoogleCallback(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
  if (!googleEnabled(env)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed("GET");

  // CQ: missing OAuth client config → 503 before Google limiter (auth_config_missing).
  const cfg = requireAuthConfig(env, {
    needApiKey: false,
    baseUrl: opts?.bsiBaseUrl,
  });
  if (!cfg) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }

  const lim = await checkGoogleLimit(env, clientIp(request));
  if (!lim.allowed) {
    return authJson(BODY_RATE_LIMITED, 429, {
      "Retry-After": String(parseRetryAfter(null)),
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return authErrorRedirect("state");

  const taken = await takeOauthState(env, state);
  if (taken === "unavailable") return authErrorRedirect("unavailable");
  const rec = taken;
  const pre = getPre(request);
  if (!rec || !pre || (await sha256Hex(pre)) !== rec.pre_hash) {
    return authErrorRedirect("state");
  }
  if (rec.flow !== "google") return authErrorRedirect("state");

  /** Nextend expects a JSON *string* (same shape as the MetFix app), not a bare JWT. */
  let idToken: string;
  let socialAccessTokenJson: string;
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
    const tj = (await tokenRes.json()) as {
      id_token?: string;
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    if (typeof tj.id_token !== "string" || tj.id_token.length === 0) {
      throw new Error("no_id_token");
    }
    if (typeof tj.access_token !== "string" || tj.access_token.length === 0) {
      throw new Error("no_access_token");
    }
    idToken = tj.id_token;
    socialAccessTokenJson = JSON.stringify({
      access_token: tj.access_token,
      id_token: tj.id_token,
      token_type: typeof tj.token_type === "string" && tj.token_type ? tj.token_type : "Bearer",
      expires_in: typeof tj.expires_in === "number" ? tj.expires_in : 3600,
    });
  } catch {
    return authErrorRedirect("google");
  }

  const payload = await verifyGoogleIdToken(idToken, env, fetchImpl, rec.nonce);
  if (!payload) return authErrorRedirect("google");

  const verified = payload.email_verified === true;
  const intent = verified ? rec.intent : "login";

  const bridgeState = randomId32();
  try {
    await putOauthState(env, bridgeState, {
      flow: "bridge",
      nonce: rec.nonce,
      verifier: "",
      intent,
      return: rec.return,
      pre_hash: rec.pre_hash,
      created: Date.now(),
    });
  } catch {
    return authErrorRedirect("unavailable");
  }

  const social = await bsiSocialAuth(
    {
      provider: "google",
      intent,
      access_token: socialAccessTokenJson,
      client_id: cfg.clientId,
      redirect_uri: METFIX_CALLBACK_URI,
      state: bridgeState,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl },
  );

  if (social.kind !== "ok") return authErrorRedirect("google");

  const bridgeUrl = (social.json as { bridge_url?: string }).bridge_url;
  if (typeof bridgeUrl !== "string") return authErrorRedirect("google");

  const followed = await bsiFollowBridge(bridgeUrl, fetchImpl, { env });
  if (followed.kind !== "redirect") return authErrorRedirect("google");

  let wpCode: string | null = null;
  let bridgeLocState: string | null = null;
  try {
    const loc = new URL(followed.location);
    wpCode = loc.searchParams.get("code");
    bridgeLocState = loc.searchParams.get("state");
  } catch {
    wpCode = null;
  }
  // AU27.10 (d): compare and consume bridge state before any token exchange.
  const takenBridge = await takeOauthState(env, bridgeState);
  if (takenBridge === "unavailable") return authErrorRedirect("unavailable");
  if (
    !takenBridge ||
    takenBridge.flow !== "bridge" ||
    !bridgeLocState ||
    bridgeLocState !== bridgeState
  ) {
    return authErrorRedirect("state");
  }
  if (!wpCode) return authErrorRedirect("google");

  // §0w.1: exchange WP code at Pro /oauth/token (not BSI-C3 proxy).
  const exchanged = await oauthAuthorizationCodeGrant(
    { code: wpCode, redirect_uri: METFIX_CALLBACK_URI },
    env,
    fetchImpl,
    { baseUrl: opts?.bsiBaseUrl },
  );

  if (exchanged.kind === "nokey") {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }
  if (exchanged.kind === "http" && exchanged.code === "invalid_grant") {
    // AU27.10 (b): same body as password invalid_grant; R8b +1.
    try {
      await attemptR8b(env, clientIp(request));
    } catch {
      /* best-effort */
    }
    return authJson(BODY_INVALID_LOGIN, 401);
  }
  if (exchanged.kind !== "ok") {
    if (
      exchanged.kind === "http" &&
      (exchanged.status === 429 || exchanged.status >= 500)
    ) {
      const ra = exchanged.retryAfter ?? parseRetryAfter(null);
      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(ra) });
    }
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }

  const tok = exchanged.json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (
    typeof tok.access_token !== "string" ||
    tok.access_token.length === 0 ||
    typeof tok.refresh_token !== "string" ||
    tok.refresh_token.length === 0
  ) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }

  const meRes = await bsiFetchMe(tok.access_token, env, fetchImpl, {
    baseUrl: opts?.bsiBaseUrl,
    timeoutMs: 5000,
  });
  if (meRes.kind !== "ok") {
    const ra =
      meRes.kind === "http" || meRes.kind === "bad_json"
        ? (meRes.retryAfter ?? parseRetryAfter(null))
        : parseRetryAfter(null);
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": String(ra) });
  }
  const profile = parseBsiMeProfile(meRes.json);
  if (!profile) {
    return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "60" });
  }

  const incomingSid = getSid(request);
  if (incomingSid) {
    try {
      await destroySession(env, incomingSid);
    } catch {
      /* ignore */
    }
  }

  const sid = randomId32();
  await createSession(env, sid, {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_in: tok.expires_in,
    public_name: profile.display_name,
    user_id: profile.id,
    can_moderate: profile.can_moderate,
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
export async function handleWpCallback(
  request: Request,
  env?: { LOCAL_AUTH?: string },
): Promise<Response> {
  if (!isAuthHost(request, env)) return authJson(BODY_NOT_FOUND, 404);
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed("GET");
  return authJson(BODY_INVALID_REQUEST, 400);
}
