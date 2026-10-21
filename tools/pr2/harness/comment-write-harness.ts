/**
 * PR2 Round 1 — comment write/like gate harness (R-realauth + recording cache/limiters).
 */
import { afterEach, beforeEach, vi } from "vitest";
import { handleCommentsRoutes } from "../../../worker/comments";
import type { Env, FetchImpl } from "../../../worker/upstream";
import { LoginThrottleDO } from "../../../worker/do/login-throttle";
import { OauthStateDO } from "../../../worker/do/oauth-state";
import { SessionDO } from "../../../worker/do/session";
import { handleRequest } from "../../../worker/index";
import { bytesToBase64Url, csrfForSid, randomBytes } from "../../../worker/auth/crypto";
import { SID_COOKIE, PRE_COOKIE } from "../../../worker/auth/cookies";
import { makeCache } from "./harness";
import type { RateLimitBinding } from "../../../worker/auth/comment-rate-limit";
import { sessionAad, sessionKeyHex } from "../../../worker/auth/session";

/** Always-allow binding for harnesses that do not exercise rate limits. */
export function makeAllowAllLimiter(): RateLimitBinding {
  return { async limit() { return { success: true }; } };
}

export const ORIGIN = "https://metfix.org";
export const IP = "203.0.113.7";
export const IP2 = "198.51.100.9";
export const ACCESS1 = "at_QA_SENT_1_abcdefghijklmnopqrstuvwxyz";
export const ACCESS2 = "at_QA_SENT_2_abcdefghijklmnopqrstuvwxyz";
export const REFRESH1 = "rt_QA_SENT_1_abcdefghijklmnopqrstuvwxyz";
export const KEY = "k_QA_SENT_KEY";
export const RSECRET = "rsecret_QA_SENT";
export const ENCKEY = bytesToBase64Url(randomBytes(32));
export const PW = "pw_QA_SENT";
export const CID = "cid_QA_SENT_CLIENT";
export const TOK = "recaptcha_tok_QA_SENT";

function makeDoState() {
  const map = new Map<string, unknown>();
  let alarmAt: number | null = null;
  const storage = {
    get: async (key: string) => map.get(key),
    put: async (key: string, value: unknown) => map.set(key, value),
    delete: async (key: string) => map.delete(key),
    deleteAll: async () => map.clear(),
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
  /** Serialize like workerd's real blockConcurrencyWhile (not a pass-through). */
  let concurrencyChain: Promise<unknown> = Promise.resolve();
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
  return { state, map };
}

function makeNamespace<T extends { fetch: (r: Request) => Promise<Response> }>(
  ctor: new (s: DurableObjectState, e: never) => T,
  envKeys: Record<string, unknown>,
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
        instances.set(name, { obj: new ctor(st.state, envKeys as never), st });
      }
      const entry = instances.get(name)!;
      return {
        fetch: async (req: Request) => entry.obj.fetch(req),
      };
    },
    getStorage(name: string) {
      return instances.get(name)?.st.map;
    },
  };
}

function makeRecordingKv(clockMs: () => number) {
  const data = new Map<string, { value: string; expiresAt: number | null }>();
  const puts: Array<{ key: string; value: string; options?: KVNamespacePutOptions }> = [];
  const kv = {
    puts,
    data,
    async get(key: string) {
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
      data.delete(key);
    },
    async list() {
      return { keys: [...data.keys()].map((k) => ({ name: k })), list_complete: true };
    },
  } as unknown as KVNamespace & { puts: typeof puts; data: typeof data };
  return kv;
}

export function makeBindingLimiter(limit: number): RateLimitBinding & {
  calls: string[];
  counts: Map<string, number>;
} {
  const counts = new Map<string, number>();
  const calls: string[] = [];
  return {
    counts,
    calls,
    async limit({ key }) {
      calls.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    },
  };
}

export type GateCtx = {
  env: Env & {
    COMMENT_WRITE_LIMITER?: RateLimitBinding;
    COMMENT_LIKE_LIMITER?: RateLimitBinding;
    COMMENT_LIKE_TOGGLE_LIMITER?: RateLimitBinding;
  };
  cache: ReturnType<typeof makeCache>;
  fetchMock: ReturnType<typeof vi.fn>;
  /** Default edge mock (auth + comments). Restored around seedSession logins. */
  defaultFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  sessionNs: ReturnType<typeof makeNamespace<SessionDO>>;
  writeLimiter: ReturnType<typeof makeBindingLimiter>;
  likeLimiter: ReturnType<typeof makeBindingLimiter>;
  toggleLimiter: ReturnType<typeof makeBindingLimiter>;
  lbLimiter: ReturnType<typeof makeBindingLimiter>;
  setUserId: (id: string | number) => void;
  setAccessToken: (token: string) => void;
  setCanModerate: (value: unknown) => void;
};

export function setupGate(opts?: { useWriteBinding?: boolean }): GateCtx {
  let now = Date.now();
  let userId: string | number = 42;
  let accessToken = ACCESS1;
  let canModerate: unknown = undefined;
  const kv = makeRecordingKv(() => now);
  const sessionFetch = { current: fetch as FetchImpl };
  const sessionNs = makeNamespace(SessionDO, {
    SESSION_ENC_KEY: ENCKEY,
    DAILY_FIX_API_KEY: KEY,
    BSI_OAUTH_CLIENT_ID: CID,
    METFIX_ORG_OAUTH_CLIENT_SECRET: "secret_QA_CANARY",
    fetchImpl: sessionFetch,
  });
  const throttleNs = makeNamespace(LoginThrottleDO, {});
  const oauthNs = makeNamespace(OauthStateDO, {});
  const cache = makeCache();
  const writeLimiter = makeBindingLimiter(5);
  const likeLimiter = makeBindingLimiter(30);
  const toggleLimiter = makeBindingLimiter(4);
  const lbLimiter = makeBindingLimiter(10);

  const defaultFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("recaptcha/api/siteverify")) {
      return Response.json({
        success: true,
        score: 0.9,
        action: "comment",
        hostname: "metfix.org",
      });
    }
    if (!url.includes("brokenscience.org")) return new Response("x", { status: 502 });
    if (url.includes("/auth/web-login")) {
      if (accessToken === "") {
        return Response.json({
          access_token: "",
          refresh_token: REFRESH1,
          expires_in: 3600,
          public_name: "Jane",
          user_id: userId,
        });
      }
      const loginBody: Record<string, unknown> = {
        access_token: accessToken,
        refresh_token: REFRESH1,
        expires_in: 3600,
        public_name: "Jane",
        user_id: userId,
      };
      if (canModerate !== undefined) loginBody.can_moderate = canModerate;
      return Response.json(loginBody);
    }
    if (url.includes("/proxy/oauth/token")) {
      const tokBody: Record<string, unknown> = {
        access_token: ACCESS2,
        refresh_token: REFRESH1,
        expires_in: 3600,
        public_name: "Jane",
        user_id: userId,
      };
      if (canModerate !== undefined) tokBody.can_moderate = canModerate;
      return Response.json(tokBody);
    }
    if (url.includes("/proxy/oauth/revoke")) return new Response(null, { status: 200 });
    if (url.includes("/daily-fix/comments") && method === "GET") {
      return Response.json({ comments: { belly: [], body: [], brain: [] }, meta: {} });
    }
    if (url.includes("/daily-fix/comments") && method === "POST" && !url.includes("/like")) {
      return Response.json(
        {
          comment: {
            id: 9,
            user: { display_name: "Jane" },
            content: "hello",
            timestamp: "2025-02-10T12:00:00Z",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        },
        { status: 201 },
      );
    }
    if (url.includes("/like") && method === "POST") {
      return Response.json({ liked: true, like_count: 1 }, { status: 200 });
    }
    if (method === "PATCH" && url.includes("/daily-fix/comments/")) {
      return Response.json({
        comment: {
          id: 101,
          user: { display_name: "Jane" },
          content: "edit",
          timestamp: "2025-02-10T12:00:00Z",
          parent_id: null,
          like_count: 0,
          deleted: 0,
          edited: 1,
          replies: [],
        },
      });
    }
    if (method === "DELETE" && url.includes("/daily-fix/comments/")) {
      return Response.json({ deleted: true }, { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };

  const fetchMock = vi.fn(defaultFetch);
  sessionFetch.current = fetchMock as unknown as FetchImpl;

  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("global fetch");
  }));
  vi.stubGlobal("caches", { default: cache });

  const env = {
    ASSETS: { fetch: async () => new Response("x") } as unknown as Fetcher,
    DAILY_FIX_API_KEY: KEY,
    AUTH_SESSIONS: kv,
    SESSION: sessionNs as unknown as DurableObjectNamespace,
    LOGIN_THROTTLE: throttleNs as unknown as DurableObjectNamespace,
    OAUTH_STATE: oauthNs as unknown as DurableObjectNamespace,
    BSI_OAUTH_CLIENT_ID: CID,
    METFIX_ORG_OAUTH_CLIENT_SECRET: "secret_QA_CANARY",
    SESSION_ENC_KEY: ENCKEY,
    CSRF_SECRET: "csrf_secret_QA_32bytes___________",
    RECAPTCHA_SECRET: RSECRET,
    ...(opts?.useWriteBinding === false
      ? {}
      : {
          COMMENT_WRITE_LIMITER: writeLimiter,
          COMMENT_LIKE_LIMITER: likeLimiter,
          COMMENT_LIKE_TOGGLE_LIMITER: toggleLimiter,
          LEADERBOARD_LIMITER: lbLimiter,
        }),
  } as GateCtx["env"];

  return {
    env,
    cache,
    fetchMock,
    defaultFetch,
    sessionNs,
    writeLimiter,
    likeLimiter,
    toggleLimiter,
    lbLimiter,
    setUserId(id) {
      userId = id;
    },
    setAccessToken(token) {
      accessToken = token;
    },
    setCanModerate(value) {
      canModerate = value;
    },
  };
}

export type Seeded = { sid: string; csrf: string; userId: string; loginStatus?: number };

export async function seedSession(
  g: GateCtx,
  opts?: { user_id?: string | number; access_token?: string; ip?: string },
): Promise<Seeded> {
  if (opts?.user_id != null) g.setUserId(opts.user_id);
  if (opts?.access_token !== undefined) g.setAccessToken(opts.access_token);
  // Ensure non-empty token for normal logins (P4.5 may have cleared it).
  if (opts?.access_token === undefined) g.setAccessToken(ACCESS1);

  const loginIp = opts?.ip ?? IP;
  const ctx = {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;

  // Tests often replace fetchMock; restore defaults for the real login path.
  const prevImpl = g.fetchMock.getMockImplementation();
  g.fetchMock.mockImplementation(g.defaultFetch);

  try {
    const csrfRes = await handleRequest(
      new Request("https://metfix.org/api/auth/csrf"),
      g.env,
      ctx,
      { fetchImpl: g.fetchMock as unknown as FetchImpl, cachesDefault: g.cache },
    );
    const csrfBody = (await csrfRes.json()) as { csrf: string };
    const setCookie = csrfRes.headers.get("Set-Cookie") ?? "";
    const preM = setCookie.match(/__Host-mfx_pre=([^;]+)/);
    const pre = preM ? decodeURIComponent(preM[1]!) : "";
    const cookie = `${PRE_COOKIE}=${encodeURIComponent(pre)}`;

    const loginRes = await handleRequest(
      new Request("https://metfix.org/api/auth/login", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "Sec-Fetch-Site": "same-origin",
          "X-CSRF-Token": csrfBody.csrf,
          "Content-Type": "application/json",
          "CF-Connecting-IP": loginIp,
          Cookie: cookie,
        },
        body: JSON.stringify({
          identifier: `jane_${opts?.user_id ?? "42"}_${Date.now()}_${loginIp}`,
          password: PW,
          recaptcha: TOK,
        }),
      }),
      g.env,
      ctx,
      { fetchImpl: g.fetchMock as unknown as FetchImpl, cachesDefault: g.cache },
    );

    // P4.5: empty access_token → login 503, no sid cookie.
    if (opts?.access_token === "") {
      g.fetchMock.mockClear();
      return {
        sid: "",
        csrf: csrfBody.csrf,
        userId: String(opts?.user_id ?? 42),
        loginStatus: loginRes.status,
      };
    }

    const sidM = (loginRes.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_sid=([^;]+)/);
    const sid = sidM ? decodeURIComponent(sidM[1]!) : "";
    const csrf = sid ? await csrfForSid(g.env.CSRF_SECRET!, sid) : csrfBody.csrf;
    g.fetchMock.mockClear();
    g.writeLimiter.calls.length = 0;
    g.writeLimiter.counts.clear();
    g.likeLimiter.calls.length = 0;
    g.likeLimiter.counts.clear();
    g.toggleLimiter.calls.length = 0;
    g.toggleLimiter.counts.clear();
    g.lbLimiter.calls.length = 0;
    g.lbLimiter.counts.clear();
    return { sid, csrf, userId: String(opts?.user_id ?? 42), loginStatus: loginRes.status };
  } finally {
    if (prevImpl) g.fetchMock.mockImplementation(prevImpl);
    else g.fetchMock.mockImplementation(g.defaultFetch);
  }
}

export function H_OK(s: { sid: string; csrf: string }, ip = IP): Record<string, string> {
  return {
    Origin: ORIGIN,
    "Sec-Fetch-Site": "same-origin",
    "X-CSRF-Token": s.csrf,
    "Content-Type": "application/json",
    "CF-Connecting-IP": ip,
    Cookie: `${SID_COOKIE}=${encodeURIComponent(s.sid)}`,
  };
}

export async function callComments(
  g: GateCtx,
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const req = new Request(`https://metfix.org${path}`, init);
  return handleCommentsRoutes(req, g.env, {
    fetchImpl: g.fetchMock as unknown as FetchImpl,
    cachesDefault: g.cache,
  });
}

export function mockSiteverifyPass(g: GateCtx): void {
  // default fetchMock already returns action=comment success; keep for WIP API compat
  void g;
}

export function mockSiteverify(
  g: GateCtx,
  body: { success?: boolean; score?: number; action?: string; hostname?: string },
  status = 200,
): void {
  const prev = g.fetchMock.getMockImplementation();
  g.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes("siteverify")) {
      return new Response(JSON.stringify(body), { status });
    }
    if (prev) return prev(input, init);
    return new Response("{}", { status: 404 });
  });
}

export async function destroySession(g: GateCtx, sid: string): Promise<void> {
  const hex = await sessionKeyHex(sid);
  const aad = sessionAad(hex);
  const stub = g.env.SESSION.get(g.env.SESSION.idFromName(aad));
  await stub.fetch(
    new Request("https://session.do/session", {
      method: "DELETE",
      headers: { "X-Session-AAD": aad },
    }),
  );
}

export function useGateHooks(): void {
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

export const POST_BODY = {
  date: "2025-02-10",
  type: "belly",
  content: "hello",
  recaptcha: TOK,
};

export function okComment(overrides: Record<string, unknown> = {}) {
  return {
    comment: {
      id: 9,
      user: { display_name: "Jane" },
      content: "hello",
      timestamp: "2025-02-10T12:00:00Z",
      parent_id: null,
      like_count: 0,
      deleted: 0,
      edited: 0,
      replies: [],
      ...overrides,
    },
  };
}
