/**
 * PR2 Round 1 — shared auth test harness (R-realauth, R-fixtures).
 */
import { afterEach, beforeEach, expect, vi } from "vitest";
import { handleRequest } from "../index";
import type { Env, FetchImpl } from "../upstream";
import { LoginThrottleDO } from "../do/login-throttle";
import { OauthStateDO } from "../do/oauth-state";
import { SessionDO } from "../do/session";
import { bytesToBase64Url, csrfForSid, randomBytes } from "./crypto";
import { SID_COOKIE, PRE_COOKIE } from "./cookies";
import { sessKvKey, sessionAad, sessionKeyHex } from "./session";

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
export const BRIDGE =
  "https://brokenscience.org/wp-json/bsi/v1/auth/app-oauth-bridge?ott=QA_SENT_OTT";
export const PW = "pw_QA_SENT";
export const EMAIL = "qa.sentinel@example.test";
export const CID = "cid_QA_SENT_CLIENT";
export const TOK = "recaptcha_tok_QA_SENT";

export type RecordedFetch = {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
};

function makeDoState() {
  const map = new Map<string, unknown>();
  let alarmAt: number | null = null;
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
    blockConcurrencyWhile: async <T>(fn: () => Promise<T>) => fn(),
    waitUntil: () => {},
    id: { toString: () => "test-do" },
  } as unknown as DurableObjectState;
  return { state, map, getAlarm: () => alarmAt };
}

function makeNamespace<T extends { fetch: (r: Request) => Promise<Response> }>(
  ctor: new (s: DurableObjectState, e: Record<string, string | undefined>) => T,
  envKeys: Record<string, string | undefined>,
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
        instances.set(name, { obj: new ctor(st.state, envKeys), st });
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

export function createHarness(opts?: {
  googleEnabled?: boolean;
  sessionOutage?: "throw";
  /** Optional previous session encryption key (ENC.T2). */
  sessionEncKeyPrev?: string;
  webLogin?: (req: Request) => Response | Promise<Response>;
  /** Optional BSI-C4 revoke mock (`throw` rejects the fetch). */
  revoke?: "throw" | ((req: Request) => Response | Promise<Response>);
  /** Optional override for BSI-C3 /oauth/token refresh. */
  refresh?: (req: Request) => Response | Promise<Response>;
  /** Optional siteverify mock. */
  siteverify?: (req: Request) => Response | Promise<Response>;
}) {
  let now = Date.now();
  const kv = makeRecordingKv(() => now);
  const sessionNs = makeNamespace(
    SessionDO,
    {
      SESSION_ENC_KEY: ENCKEY,
      SESSION_ENC_KEY_PREV: opts?.sessionEncKeyPrev,
    },
    {
      throwAll: opts?.sessionOutage === "throw",
    },
  );
  const throttleNs = makeNamespace(LoginThrottleDO, {});
  const oauthNs = makeNamespace(OauthStateDO, {});

  const cache = {
    puts: [] as unknown[],
    async match() {
      return undefined;
    },
    async put(k: unknown, v: unknown) {
      cache.puts.push({ k, v });
    },
    async delete() {
      return false;
    },
  } as unknown as Cache & { puts: unknown[] };

  const fetches: RecordedFetch[] = [];
  const siteverifyCalls: RecordedFetch[] = [];

  const fetchImpl: FetchImpl = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();
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
      // Default action `comment` for write routes; signup/login tests override via `siteverify`.
      return Response.json({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" });
    }
    if (!url.includes("brokenscience.org") && !url.includes("oauth2.googleapis.com")) {
      return new Response("x", { status: 502 });
    }
    if (url.includes("/auth/web-login")) {
      if (opts?.webLogin) return opts.webLogin(new Request(url, { method, headers, body: bodyText }));
      return Response.json({
        access_token: ACCESS1,
        refresh_token: REFRESH1,
        expires_in: 3600,
        public_name: "Jane",
        user_id: 42,
      });
    }
    if (url.includes("/proxy/oauth/token")) {
      if (opts?.refresh) return opts.refresh(new Request(url, { method, headers, body: bodyText }));
      const parsed = JSON.parse(bodyText || "{}") as { refresh_token?: string };
      if (parsed.refresh_token === REFRESH1) {
        return Response.json({
          access_token: ACCESS2,
          refresh_token: REFRESH2,
          expires_in: 3600,
          public_name: "Jane",
          user_id: 42,
        });
      }
      return Response.json({ code: "invalid_grant" }, { status: 400 });
    }
    if (url.includes("/proxy/oauth/revoke")) {
      if (opts?.revoke === "throw") throw new Error("revoke_timeout");
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
        belly: { title: "b" },
        body: { title: "b", scoring_field: "reps" },
        brain: { title: "b" },
        daily_workout_id: 99,
      });
    }
    if (url.includes("/register-direct")) return new Response("{}", { status: 202 });
    if (url.includes("/check-username")) return Response.json({ available: true });
    return new Response("{}", { status: 404 });
  };

  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("global fetch"); }));

  const env: Env = {
    ASSETS: { fetch: async () => new Response("x") } as unknown as Fetcher,
    DAILY_FIX_API_KEY: KEY,
    AUTH_SESSIONS: kv,
    SESSION: sessionNs as unknown as DurableObjectNamespace,
    LOGIN_THROTTLE: throttleNs as unknown as DurableObjectNamespace,
    OAUTH_STATE: oauthNs as unknown as DurableObjectNamespace,
    BSI_OAUTH_CLIENT_ID: CID,
    SESSION_ENC_KEY: ENCKEY,
    CSRF_SECRET: "csrf_secret_QA_32bytes___________",
    RECAPTCHA_SECRET: RSECRET,
    GOOGLE_WEB_CLIENT_ID: "google-web-client-QA",
    GOOGLE_WEB_CLIENT_SECRET: GSECRET,
    GOOGLE_AUTH_ENABLED: opts?.googleEnabled ? "1" : undefined,
  };

  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

  async function call(path: string, init: RequestInit = {}, host = "metfix.org") {
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
    fetches,
    siteverifyCalls,
    call,
    login,
    csrf,
    setNow(ms: number) {
      now = ms;
      vi.setSystemTime(new Date(now));
    },
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
