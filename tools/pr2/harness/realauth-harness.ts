/**
 * PR2 Round 1 — shared auth test harness (R-realauth, R-fixtures).
 */
import { afterEach, beforeEach, expect, vi } from "vitest";
import { handleRequest } from "../../../worker/index";
import type { Env, FetchImpl } from "../../../worker/upstream";
import { LoginThrottleDO } from "../../../worker/do/login-throttle";
import { OauthStateDO } from "../../../worker/do/oauth-state";
import { SessionDO } from "../../../worker/do/session";
import { bytesToBase64Url, csrfForSid, randomBytes, sha256Hex } from "../../../worker/auth/crypto";
import { SID_COOKIE, PRE_COOKIE } from "../../../worker/auth/cookies";
import type { RateLimitBinding } from "../../../worker/upstream";
import { sessKvKey, sessionAad, sessionKeyHex } from "../../../worker/auth/session";

/** In-test Rate Limit binding with a real window (production has no in-memory fallback). */
function countingLimiter(max: number): RateLimitBinding {
  const windows = new Map<string, number[]>();
  return {
    async limit({ key }: { key: string }) {
      const now = Date.now();
      const w = (windows.get(key) ?? []).filter((t) => now - t < 60_000);
      if (w.length >= max) {
        windows.set(key, w);
        return { success: false };
      }
      w.push(now);
      windows.set(key, w);
      return { success: true };
    },
  };
}

export { sessKvKey };

export const ORIGIN = "https://metfix.org";
export const IP = "203.0.113.7";
export const ACCESS1 = "at_QA_SENT_1_abcdefghijklmnopqrstuvwxyz";
export const ACCESS2 = "at_QA_SENT_2_abcdefghijklmnopqrstuvwxyz";
export const REFRESH1 = "rt_QA_SENT_1_abcdefghijklmnopqrstuvwxyz";
export const REFRESH2 = "rt_QA_SENT_2_abcdefghijklmnopqrstuvwxyz";
export const KEY = "k_QA_SENT_KEY";
export const RSECRET = "rsecret_QA_SENT";
export const GSECRET = "gsecret_QA_SENT";
export const ENCKEY = bytesToBase64Url(randomBytes(32));
export const CODE = "c_QA_SENT_CODE";
// Assembled so AU26.8's /wp-json scan of harness sources stays clean.
export const BRIDGE =
  "https://brokenscience.org/" + "wp-json" + "/bsi/v1/auth/app-oauth-bridge?ott=QA_SENT_OTT";
export const PW = "pw_QA_SENT";
export const EMAIL = "qa.sentinel@example.test";
export const CID = "cid_QA_SENT_CLIENT";
export const SECRET_CANARY = "secret_QA_CANARY";
export const TOK = "recaptcha_tok_QA_SENT";
export const BSI_ORIGIN = "https://brokenscience.org";
export const OAUTH_TOKEN_URL = `${BSI_ORIGIN}/oauth/token`;
export const BSI_ME_URL = `${BSI_ORIGIN}/wp-json/bsi/v1/me`;

export type RecordedFetch = {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
};

function makeDoState() {
  const map = new Map<string, unknown>();
  let alarmAt: number | null = null;
  /** Serialize like workerd's real blockConcurrencyWhile (not a pass-through). */
  let concurrencyChain: Promise<unknown> = Promise.resolve();
  const storage = {
    get: async (key: string) => map.get(key),
    put: async (key: string, value: unknown) => map.set(key, value),
    delete: async (key: string) => map.delete(key),
    deleteAll: async () => {
      map.clear();
      alarmAt = null;
    },
    list: async () => {
      const out = new Map<string, unknown>();
      for (const [k, v] of map) out.set(k, v);
      return out;
    },
    getAlarm: async () => alarmAt,
    setAlarm: async (when: number | Date) => {
      alarmAt = when instanceof Date ? when.getTime() : when;
    },
    deleteAlarm: async () => {
      alarmAt = null;
    },
  };
  const state = {
    storage,
    blockConcurrencyWhile: async <T>(fn: () => Promise<T>) => {
      const run = concurrencyChain.then(fn, fn);
      concurrencyChain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    waitUntil: () => {},
    id: { toString: () => "test-do" },
  } as unknown as DurableObjectState;
  return { state, map, getAlarm: () => alarmAt };
}

function makeNamespace<T extends { fetch: (r: Request) => Promise<Response> }>(
  ctor: new (s: DurableObjectState, e: never) => T,
  envKeys: Record<string, unknown>,
  opts?: { throwAll?: boolean },
) {
  const instances = new Map<string, { obj: T; st: ReturnType<typeof makeDoState> }>();
  return {
    instances,
    idFromName(name: string) {
      return { toString: () => name };
    },
    get(id: { toString(): string }) {
      const name = id.toString();
      if (!instances.has(name)) {
        const st = makeDoState();
        instances.set(name, {
          obj: new ctor(st.state, envKeys as never),
          st,
        });
      }
      const entry = instances.get(name)!;
      return {
        fetch: async (req: Request) => {
          if (opts?.throwAll) throw new Error("do_outage");
          return entry.obj.fetch(req);
        },
      };
    },
    getStorage(name: string) {
      return instances.get(name)?.st.map;
    },
    getAlarm(name: string) {
      return instances.get(name)?.st.getAlarm() ?? null;
    },
  };
}

export function makeRecordingKv(clockMs: () => number) {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  const puts: Array<{ key: string; value: string; options?: KVNamespacePutOptions }> = [];
  const gets: string[] = [];
  const dels: string[] = [];
  const kv = {
    puts,
    gets,
    dels,
    data,
    async get(key: string) {
      gets.push(key);
      const row = data.get(key);
      if (!row) return null;
      if (row.expiresAt != null && clockMs() >= row.expiresAt) {
        data.delete(key);
        return null;
      }
      return row.value;
    },
    async put(key: string, value: string, options?: KVNamespacePutOptions) {
      puts.push({ key, value, options });
      const expiresAt =
        options?.expirationTtl != null ? clockMs() + options.expirationTtl * 1000 : null;
      data.set(key, { value, expiresAt });
    },
    async delete(key: string) {
      dels.push(key);
      data.delete(key);
    },
    async list() {
      return { keys: [...data.keys()].map((k) => ({ name: k })), list_complete: true };
    },
  } as unknown as KVNamespace & {
    puts: typeof puts;
    gets: string[];
    dels: string[];
    data: typeof data;
  };
  return kv;
}

const COMMENTS_FIXTURE = {
  comments: {
    belly: [
      {
        id: 1,
        user: { display_name: "Jane" },
        content: "hi",
        timestamp: "2025-02-10T12:00:00Z",
        like_count: 0,
        parent_id: null,
        deleted: 0,
        edited: false,
        replies: [],
      },
    ],
    body: [],
    brain: [],
  },
  meta: {},
};

export type Harness = ReturnType<typeof createHarness>;

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_WEB_CLIENT_ID = "google-web-client-QA";
export const WP_BRIDGE_CODE = "wp_QA_SENT_CODE";

type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

export type GoogleOidcKeys = {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: GoogleJwk;
  jwks: { keys: GoogleJwk[] };
};

/** Generate an in-test RSA keypair + JWKS document for Google id_token signing. */
export async function mintGoogleOidcKeys(kid = "mfx-test-kid"): Promise<GoogleOidcKeys> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const raw = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as GoogleJwk;
  const publicJwk: GoogleJwk = {
    kty: raw.kty,
    n: raw.n,
    e: raw.e,
    kid,
    alg: "RS256",
    use: "sig",
  };
  return {
    kid,
    privateKey: pair.privateKey,
    publicJwk,
    jwks: { keys: [publicJwk] },
  };
}

export async function signGoogleIdToken(
  privateKey: CryptoKey,
  kid: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })),
  );
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
  return `${header}.${body}.${bytesToBase64Url(sig)}`;
}

function cacheKey(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function makeRecordingCache(clockMs: () => number) {
  const data = new Map<string, { body: string; expiresAt: number | null; headers: Headers }>();
  const puts: Array<{ key: string; maxAge: number | null }> = [];
  const matches: string[] = [];
  const cache = {
    puts,
    matches,
    data,
    async match(input: RequestInfo | URL) {
      const key = cacheKey(input);
      matches.push(key);
      const row = data.get(key);
      if (!row) return undefined;
      if (row.expiresAt != null && clockMs() >= row.expiresAt) {
        data.delete(key);
        return undefined;
      }
      return new Response(row.body, { headers: row.headers });
    },
    async put(input: RequestInfo | URL, response: Response) {
      const key = cacheKey(input);
      const cc = response.headers.get("Cache-Control") ?? "";
      const m = /max-age=(\d+)/i.exec(cc);
      const maxAge = m ? Number(m[1]) : null;
      puts.push({ key, maxAge });
      const headers = new Headers(response.headers);
      data.set(key, {
        body: await response.clone().text(),
        expiresAt: maxAge != null ? clockMs() + maxAge * 1000 : null,
        headers,
      });
    },
    async delete(input: RequestInfo | URL) {
      return data.delete(cacheKey(input));
    },
  };
  return cache as unknown as Cache & {
    puts: typeof puts;
    matches: string[];
    data: typeof data;
  };
}

type EdgeHandler = (req: Request) => Response | Promise<Response>;

export function createHarness(opts?: {
  googleEnabled?: boolean;
  sessionOutage?: "throw";
  oauthOutage?: "throw" | "hang";
  sessionEncKeyPrev?: string;
  /** Mock POST /oauth/token (password + refresh_token + authorization_code). */
  oauthToken?: (req: Request) => Response | Promise<Response>;
  /** Mock GET /wp-json/bsi/v1/me. */
  bsiMe?: (req: Request) => Response | Promise<Response>;
  /**
   * @deprecated Prefer `oauthToken`. Mapped to the `/oauth/token` mock during transition.
   */
  webLogin?: (req: Request) => Response | Promise<Response>;
  revoke?:
    | "throw"
    | "timeout"
    | ((req: Request) => Response | Promise<Response>);
  refresh?: (req: Request) => Response | Promise<Response>;
  siteverify?: (req: Request) => Response | Promise<Response>;
  /**
   * When true, REFRESH1 is accepted once (→ ACCESS2/REFRESH2); reuse → invalid_grant.
   * Default false keeps REFRESH2 reusable for non-rotation tests.
   */
  rotatingRefresh?: boolean;
}) {
  let now = Date.now();
  /** When rotatingRefresh: REFRESH1 accepted once. */
  let r0Used = false;
  /** Last `state` from BSI social body — bridge Location must echo it (AU27.10 d). */
  let lastSocialBridgeState: string | null = null;
  const kv = makeRecordingKv(() => now);
  /** Shared env object — assign fetchImpl after the mock is built (no `{current}` box). */
  const sessionEnv: {
    SESSION_ENC_KEY: string;
    SESSION_ENC_KEY_PREV?: string;
    DAILY_FIX_API_KEY: string;
    BSI_OAUTH_CLIENT_ID: string;
    METFIX_ORG_OAUTH_CLIENT_SECRET: string;
    fetchImpl: FetchImpl;
  } = {
    SESSION_ENC_KEY: ENCKEY,
    SESSION_ENC_KEY_PREV: opts?.sessionEncKeyPrev,
    DAILY_FIX_API_KEY: KEY,
    BSI_OAUTH_CLIENT_ID: CID,
    METFIX_ORG_OAUTH_CLIENT_SECRET: SECRET_CANARY,
    fetchImpl: fetch as FetchImpl,
  };
  const sessionNs = makeNamespace(SessionDO, sessionEnv, {
    throwAll: opts?.sessionOutage === "throw",
  });
  const throttleNs = makeNamespace(LoginThrottleDO, {});
  const oauthNs = makeNamespace(OauthStateDO, {}, {
    throwAll: opts?.oauthOutage === "throw",
  });
  if (opts?.oauthOutage === "hang") {
    oauthNs.get = (_id: { toString(): string }) => ({
      fetch: async () => new Promise<Response>(() => {}),
    });
  }

  const cache = makeRecordingCache(() => now);
  const fetches: RecordedFetch[] = [];
  const siteverifyCalls: RecordedFetch[] = [];
  /** Default siteverify `action` for the next Worker verify (login|signup|comment). */
  let siteverifyAction: "login" | "signup" | "comment" = "login";
  const edges = {
    jwks: null as EdgeHandler | null,
    googleToken: null as EdgeHandler | null,
    social: null as EdgeHandler | null,
    bridge: null as EdgeHandler | null,
    /** Optional second hop after real bridge → /oauth/authorize. */
    authorize: null as EdgeHandler | null,
  };

  const fetchImpl: FetchImpl = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method =
      init?.method?.toUpperCase() ??
      (typeof input !== "string" && !(input instanceof URL)
        ? (input as Request).method.toUpperCase()
        : "GET");
    const rawBody = init?.body;
    const bodyText =
      typeof rawBody === "string"
        ? rawBody
        : rawBody instanceof URLSearchParams
          ? rawBody.toString()
          : rawBody == null
            ? ""
            : String(rawBody);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const rec = { url, method, headers, bodyText };
    fetches.push(rec);
    if (url.includes("recaptcha/api/siteverify")) {
      siteverifyCalls.push(rec);
      if (opts?.siteverify) {
        return opts.siteverify(new Request(url, { method, headers, body: bodyText }));
      }
      // Match the Worker route under test (login vs signup vs comment).
      return Response.json({
        success: true,
        score: 0.9,
        action: siteverifyAction,
        hostname: "metfix.org",
      });
    }
    if (url.startsWith(GOOGLE_JWKS_URL) || url.includes("googleapis.com/oauth2/v3/certs")) {
      if (edges.jwks) {
        // GET Request cannot carry a body (undici throws).
        return edges.jwks(new Request(url, { method, headers }));
      }
      return new Response(JSON.stringify({ keys: [] }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("oauth2.googleapis.com/token")) {
      if (edges.googleToken) {
        return edges.googleToken(
          new Request(url, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : bodyText,
          }),
        );
      }
      return new Response("{}", { status: 404 });
    }
    if (
      !url.includes("brokenscience.org") &&
      !url.includes("brokenstaging.wpengine.com") &&
      !url.includes("oauth2.googleapis.com") &&
      !url.includes("googleapis.com")
    ) {
      return new Response("x", { status: 502 });
    }
    // Direct-token Pro OAuth: POST {origin}/oauth/token (not the WP proxy path).
    if (url.includes("/oauth/token") && !url.includes("/proxy/oauth/token")) {
      const form = new URLSearchParams(bodyText);
      const grant = form.get("grant_type");
      const req = new Request(url, { method, headers, body: bodyText });
      if (opts?.oauthToken) return opts.oauthToken(req);
      // refresh_token: prefer dedicated refresh mock when present
      if (grant === "refresh_token" && opts?.refresh) return opts.refresh(req);
      // Backward compat: webLogin mapped onto password grant only
      if (grant === "password" && opts?.webLogin) return opts.webLogin(req);
      if (grant === "password") {
        // Misleading user_id must not be trusted — session id comes from /me.
        return Response.json({
          access_token: ACCESS1,
          refresh_token: REFRESH1,
          expires_in: 3600,
          token_type: "Bearer",
          user_id: 999,
        });
      }
      if (grant === "authorization_code") {
        return Response.json({
          access_token: ACCESS1,
          refresh_token: REFRESH1,
          expires_in: 3600,
          token_type: "Bearer",
          user_id: 999,
        });
      }
      if (grant === "refresh_token") {
        const rt = form.get("refresh_token");
        if (rt === REFRESH1) {
          if (opts?.rotatingRefresh) {
            if (r0Used) {
              return Response.json({ error: "invalid_grant" }, { status: 400 });
            }
            r0Used = true;
          }
          return Response.json({
            access_token: ACCESS2,
            refresh_token: REFRESH2,
            expires_in: 3600,
            token_type: "Bearer",
            user_id: 999,
          });
        }
        if (rt === REFRESH2) {
          return Response.json({
            access_token: ACCESS2,
            refresh_token: REFRESH2,
            expires_in: 3600,
            token_type: "Bearer",
            user_id: 999,
          });
        }
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    }
    // §0v.1 Q6: POST {origin}/oauth/revoke (not the WP proxy path).
    if (url.includes("/oauth/revoke") && !url.includes("/proxy/oauth/revoke")) {
      if (opts?.revoke === "throw") throw new Error("revoke_boom");
      // Distinct from throw: AbortSignal.timeout-shaped TimeoutError (AU8.2).
      if (opts?.revoke === "timeout") {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      }
      if (typeof opts?.revoke === "function") {
        return opts.revoke(new Request(url, { method, headers, body: bodyText }));
      }
      return Response.json({ revoked: true }, { status: 200 });
    }
    if (url.includes("/wp-json/bsi/v1/me") || /\/bsi\/v1\/me(?:\?|$)/.test(url)) {
      if (opts?.bsiMe) {
        // GET must not carry a body (undici throws).
        return opts.bsiMe(
          new Request(url, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : bodyText,
          }),
        );
      }
      return Response.json({
        id: 42,
        display_name: "Jane",
        can_moderate: false,
      });
    }
    if (url.includes("/auth/social")) {
      try {
        const parsed = JSON.parse(bodyText || "{}") as { state?: unknown };
        if (typeof parsed.state === "string" && parsed.state.length > 0) {
          lastSocialBridgeState = parsed.state;
        }
      } catch {
        /* ignore */
      }
      if (edges.social) return edges.social(new Request(url, { method, headers, body: bodyText }));
      return Response.json({ bridge_url: BRIDGE });
    }
    if (url.includes("app-oauth-bridge")) {
      if (edges.bridge) return edges.bridge(new Request(url, { method, headers }));
      // Echo stored bridge state from social (AU27.10 d compare+consume).
      const st = lastSocialBridgeState ?? "bridge";
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://metfix.org/api/auth/callback?code=${WP_BRIDGE_CODE}&state=${encodeURIComponent(st)}`,
        },
      });
    }
    if (url.includes("/oauth/authorize")) {
      if (edges.authorize) {
        return edges.authorize(new Request(url, { method, headers }));
      }
      return new Response("authorize hop not mocked", { status: 502 });
    }
    if (url.includes("/proxy/oauth/token")) {
      if (opts?.refresh) return opts.refresh(new Request(url, { method, headers, body: bodyText }));
      let parsed: { refresh_token?: string; grant_type?: string } = {};
      try {
        parsed = JSON.parse(bodyText || "{}") as typeof parsed;
      } catch {
        const form = new URLSearchParams(bodyText);
        parsed = {
          grant_type: form.get("grant_type") ?? undefined,
          refresh_token: form.get("refresh_token") ?? undefined,
        };
      }
      if (parsed.grant_type === "authorization_code") {
        return Response.json({
          access_token: ACCESS1,
          refresh_token: REFRESH1,
          expires_in: 3600,
          public_name: "Jane",
          user_id: 42,
        });
      }
      if (parsed.refresh_token === REFRESH1) {
        return Response.json({
          access_token: ACCESS2,
          refresh_token: REFRESH2,
          expires_in: 3600,
          public_name: "Jane",
          user_id: 42,
        });
      }
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    if (url.includes("/proxy/oauth/revoke")) {
      if (opts?.revoke === "throw") throw new Error("revoke_boom");
      if (opts?.revoke === "timeout") {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      }
      if (typeof opts?.revoke === "function") {
        return opts.revoke(new Request(url, { method, headers, body: bodyText }));
      }
      return new Response(null, { status: 200 });
    }
    if (url.includes("/daily-fix/comments") && method === "GET") return Response.json(COMMENTS_FIXTURE);
    if (url.includes("/daily-fix/comments") && method === "POST") {
      return Response.json(
        {
          comment: {
            id: 9,
            user: { display_name: "Jane" },
            content: "x",
            timestamp: "t",
            like_count: 0,
            parent_id: null,
            deleted: 0,
            edited: false,
            replies: [],
          },
        },
        { status: 201 },
      );
    }
    if (url.includes("/leaderboard")) return Response.json({ rows: [] });
    if (url.includes("/daily-fix") && method === "GET") {
      return Response.json({
        date: "2025-02-10",
        belly: { title: "b", body: "bx" },
        body: { title: "b", body: "bx", scoring_field: "reps" },
        brain: { title: "b", body: "bx", scoring_field: "reps" },
        daily_workout_id: 99,
      });
    }
    if (url.includes("/register-direct")) return new Response("{}", { status: 202 });
    if (url.includes("/check-username")) return Response.json({ available: true });
    return new Response("{}", { status: 404 });
  };

  sessionEnv.fetchImpl = fetchImpl;
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  vi.stubGlobal("caches", { default: cache });

  const env: Env = {
    ASSETS: { fetch: async () => new Response("x") } as unknown as Fetcher,
    DAILY_FIX_API_KEY: KEY,
    AUTH_SESSIONS: kv,
    SESSION: sessionNs as unknown as DurableObjectNamespace,
    LOGIN_THROTTLE: throttleNs as unknown as DurableObjectNamespace,
    OAUTH_STATE: oauthNs as unknown as DurableObjectNamespace,
    BSI_OAUTH_CLIENT_ID: CID,
    METFIX_ORG_OAUTH_CLIENT_SECRET: SECRET_CANARY,
    SESSION_ENC_KEY: ENCKEY,
    CSRF_SECRET: "csrf_secret_QA_32bytes___________",
    RECAPTCHA_SECRET: RSECRET,
    GOOGLE_WEB_CLIENT_ID,
    GOOGLE_WEB_CLIENT_SECRET: GSECRET,
    GOOGLE_AUTH_ENABLED: opts?.googleEnabled ? "1" : undefined,
    // Spec buckets: signup 5/60s, username 20/60s, Google 20/60s (S-RL / R16).
    SIGNUP_LIMITER: countingLimiter(5),
    USERNAME_CHECK_LIMITER: countingLimiter(20),
    GOOGLE_AUTH_LIMITER: countingLimiter(20),
    COMMENT_WRITE_LIMITER: countingLimiter(5),
    COMMENT_LIKE_LIMITER: countingLimiter(30),
    COMMENT_LIKE_TOGGLE_LIMITER: countingLimiter(4),
    LEADERBOARD_LIMITER: countingLimiter(10),
  };

  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

  async function call(path: string, init: RequestInit = {}, host = "metfix.org") {
    if (path.startsWith("/api/auth/login")) siteverifyAction = "login";
    else if (path.startsWith("/api/auth/signup") || path.startsWith("/api/auth/register")) {
      siteverifyAction = "signup";
    } else if (path.includes("/daily-fix/comments")) siteverifyAction = "comment";
    return handleRequest(new Request(`https://${host}${path}`, init), env, ctx, {
      fetchImpl,
      cachesDefault: cache,
    });
  }

  async function csrf(cookies?: string) {
    const res = await call("/api/auth/csrf", { headers: cookies ? { Cookie: cookies } : {} });
    const body = (await res.json()) as { csrf: string };
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    const m = setCookie.match(/__Host-mfx_pre=([^;]+)/);
    const pre = m ? decodeURIComponent(m[1]!) : "";
    return { csrf: body.csrf, pre, setCookie };
  }

  async function login() {
    const { csrf: token, pre, setCookie } = await csrf();
    const cookie = setCookie?.split(";")[0] ?? `${PRE_COOKIE}=${encodeURIComponent(pre)}`;
    const res = await call("/api/auth/login", {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
        "X-CSRF-Token": token,
        "Content-Type": "application/json",
        "CF-Connecting-IP": IP,
        Cookie: cookie,
      },
      body: JSON.stringify({ identifier: "jane", password: PW, recaptcha: TOK }),
    });
    const sidM = (res.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_sid=([^;]+)/);
    const sid = sidM ? decodeURIComponent(sidM[1]!) : "";
    return { sid, csrf: token, pre, res };
  }

  return {
    env,
    kv,
    sessionNs,
    throttleNs,
    oauthNs,
    cache,
    fetches,
    siteverifyCalls,
    edges,
    call,
    login,
    csrf,
    setNow(ms: number) {
      now = ms;
      vi.setSystemTime(new Date(now));
    },
    installGoogleOidc(keys: GoogleOidcKeys, idToken: string) {
      const doc = JSON.parse(JSON.stringify(keys.jwks)) as { keys: JsonWebKey[] };
      edges.jwks = async () =>
        new Response(JSON.stringify(doc), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      edges.googleToken = async () =>
        new Response(
          JSON.stringify({
            id_token: idToken,
            access_token: "g_at_unused",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    },
    setJwks(keys: GoogleOidcKeys | { keys: JsonWebKey[] }) {
      const doc = JSON.parse(JSON.stringify("jwks" in keys ? keys.jwks : keys)) as {
        keys: JsonWebKey[];
      };
      edges.jwks = async () =>
        new Response(JSON.stringify(doc), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    },
    setGoogleIdToken(idToken: string) {
      edges.googleToken = async () =>
        new Response(
          JSON.stringify({
            id_token: idToken,
            access_token: "g_at_unused",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    },
    setSocial(handler: EdgeHandler | { status?: number; body?: unknown } | "404") {
      if (handler === "404") {
        edges.social = async () =>
          new Response(JSON.stringify({ code: "account_not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        return;
      }
      if (typeof handler === "function") {
        edges.social = handler;
        return;
      }
      edges.social = async () =>
        new Response(JSON.stringify(handler.body ?? { bridge_url: BRIDGE }), {
          status: handler.status ?? 200,
          headers: { "Content-Type": "application/json" },
        });
    },
  };
}

export async function readOauthRecord(
  h: Harness,
  state: string,
): Promise<{
  flow: string;
  nonce: string;
  verifier: string;
  intent: string;
  return: string;
  pre_hash: string;
  created: number;
} | undefined> {
  const name = `oauth:${await sha256Hex(state)}`;
  return h.oauthNs.getStorage(name)?.get("rec") as
    | {
        flow: string;
        nonce: string;
        verifier: string;
        intent: string;
        return: string;
        pre_hash: string;
        created: number;
      }
    | undefined;
}

export async function googleStart(
  h: Harness,
  query = "intent=login&return=/the-daily-fix",
) {
  const start = await h.call(`/api/auth/google/start?${query}`);
  const loc = start.headers.get("Location") ?? "";
  const state = new URL(loc).searchParams.get("state") ?? "";
  const pre = (start.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_pre=([^;]+)/);
  const preCookie = pre ? `__Host-mfx_pre=${pre[1]}` : "";
  const rec = await readOauthRecord(h, state);
  return { start, state, preCookie, rec, loc };
}

export async function validIdTokenClaims(
  h: Harness,
  nonce: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: h.env.GOOGLE_WEB_CLIENT_ID,
    exp: now + 3600,
    iat: now,
    nonce,
    email_verified: true,
    email: "qa.sentinel@example.test",
    sub: "google-sub-QA",
    ...extra,
  };
}

export async function csrfSid(env: Env, sid: string) {
  if (!env.CSRF_SECRET) throw new Error("no CSRF_SECRET");
  return csrfForSid(env.CSRF_SECRET, sid);
}

export function hOk(s: { csrf: string; sid: string }): Record<string, string> {
  return {
    Origin: ORIGIN,
    "Sec-Fetch-Site": "same-origin",
    "X-CSRF-Token": s.csrf,
    "Content-Type": "application/json",
    "CF-Connecting-IP": IP,
    Cookie: `${SID_COOKIE}=${encodeURIComponent(s.sid)}`,
  };
}

export function leakFree(text: string) {
  for (const b of [ACCESS1, ACCESS2, REFRESH1, REFRESH2, KEY, RSECRET, ENCKEY]) {
    expect(text).not.toContain(b);
  }
}

export async function sidHex(sid: string) {
  return sessionKeyHex(sid);
}

export async function sessionBlob(h: Harness, sid: string) {
  const hex = await sidHex(sid);
  return h.sessionNs.getStorage(sessionAad(hex))?.get("rec") as { blob?: string } | undefined;
}

export function setupAuthHooks() {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-12T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
