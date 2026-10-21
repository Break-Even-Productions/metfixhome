/**
 * PR2 Round 1 test harness (KV / Cache / DO stubs, comment GET helpers).
 * Lives under tools/pr2/harness/ (PR0.3 tools/pr2/**).
 */
import { vi } from "vitest";
import type { Env } from "../../../worker/upstream";

export type CacheStore = Map<string, Response>;

export function makeCache(): Cache & {
  store: CacheStore;
  puts: Array<{ key: string; res: Response }>;
  matches: string[];
  deletes: string[];
} {
  const store: CacheStore = new Map();
  const puts: Array<{ key: string; res: Response }> = [];
  const matches: string[] = [];
  const deletes: string[] = [];
  return {
    store,
    puts,
    matches,
    deletes,
    async match(request: RequestInfo) {
      const key = typeof request === "string" ? request : (request as Request).url;
      matches.push(key);
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    },
    async put(request: RequestInfo, response: Response) {
      const key = typeof request === "string" ? request : (request as Request).url;
      puts.push({ key, res: response.clone() });
      store.set(key, response.clone());
    },
    async delete(request: RequestInfo) {
      const key = typeof request === "string" ? request : (request as Request).url;
      deletes.push(key);
      return store.delete(key);
    },
    async keys() {
      return [];
    },
    async matchAll() {
      return [];
    },
  } as unknown as Cache & {
    store: CacheStore;
    puts: Array<{ key: string; res: Response }>;
    matches: string[];
    deletes: string[];
  };
}

export type KvRecord = {
  puts: Array<{ key: string; value: string; options?: KVNamespacePutOptions }>;
  deletes: string[];
  store: Map<string, string>;
};

export function makeKv(): KVNamespace & { record: KvRecord } {
  const store = new Map<string, string>();
  const record: KvRecord = { puts: [], deletes: [], store };
  const ns = {
    record,
    async get(key: string, type?: string) {
      const v = store.get(key);
      if (v == null) return null;
      if (type === "json") return JSON.parse(v);
      return v;
    },
    async put(key: string, value: string, options?: KVNamespacePutOptions) {
      record.puts.push({ key, value, options });
      store.set(key, value);
    },
    async delete(key: string) {
      record.deletes.push(key);
      store.delete(key);
    },
    async list() {
      return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true, cacheStatus: null };
    },
    async getWithMetadata() {
      return { value: null, metadata: null };
    },
  };
  return ns as unknown as KVNamespace & { record: KvRecord };
}

export function stubNamespace(
  handler?: (req: Request) => Promise<Response>,
): DurableObjectNamespace {
  return {
    idFromName: (name: string) => ({ toString: () => `id:${name}` }),
    idFromString: (id: string) => ({ toString: () => id }),
    newUniqueId: () => ({ toString: () => "unique" }),
    get: () => ({
      fetch: async (input: RequestInfo, init?: RequestInit) => {
        const req = input instanceof Request ? input : new Request(String(input), init);
        if (handler) return handler(req);
        return new Response(null, { status: 503 });
      },
    }),
  } as unknown as DurableObjectNamespace;
}

export function makeEnv(overrides: Partial<Env> & { ASSETS?: Fetcher } = {}): Env {
  const assets =
    overrides.ASSETS ??
    ({
      fetch: async () => new Response("ASSET", { status: 200 }),
    } as unknown as Fetcher);
  return {
    ASSETS: assets,
    DAILY_FIX_API_KEY: "k_QA_SENT_KEY",
    AUTH_SESSIONS: makeKv(),
    SESSION: stubNamespace(),
    LOGIN_THROTTLE: stubNamespace(),
    OAUTH_STATE: stubNamespace(),
    BSI_OAUTH_CLIENT_ID: "cid_QA",
    METFIX_ORG_OAUTH_CLIENT_SECRET: "secret_QA_CANARY",
    SESSION_ENC_KEY: "0123456789abcdef0123456789abcdef",
    CSRF_SECRET: "csrf_QA_SECRET_32_bytes_minimum!!",
    RECAPTCHA_SECRET: "RSECRET",
    ...overrides,
  };
}

export function headersObject(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of res.headers) {
    if (k === "content-length" || k === "date") continue;
    out[k] = v;
  }
  return out;
}

export const KEY = "k_QA_SENT_KEY";
export const ORIGIN = "https://metfix.org";
export const UPSTREAM_LEAK_BODY = "UPSTREAM_LEAK_BODY";

export function emptyAllFixture() {
  return {
    comments: { belly: [], body: [], brain: [] },
    meta: { date: "2025-02-10", type: "all", count: { belly: 0, body: 0, brain: 0, total: 0 } },
  };
}

export function richAllFixture() {
  return {
    comments: {
      belly: [
        {
          id: 1,
          user: { id: 9, display_name: "Jane", email: "a@b.co" },
          content: "hi",
          timestamp: "2025-02-10T12:00:00Z",
          like_count: 0,
          parent_id: null,
          deleted: 0,
          edited: 0,
          liked: true,
          replies: [
            {
              id: 11,
              user: { id: 2, display_name: "Bo" },
              content: "reply",
              timestamp: "2025-02-10T12:01:00Z",
              like_count: 0,
              parent_id: 1,
              deleted: 1,
              edited: 0,
              replies: [],
            },
          ],
        },
        {
          id: 2,
          user: { id: 3, display_name: "Gone" },
          content: "removed row",
          timestamp: "2025-02-10T12:02:00Z",
          like_count: 0,
          parent_id: null,
          deleted: 1,
          edited: 0,
          replies: [
            {
              id: 21,
              user: { id: 4, display_name: "LiveUnderDeleted" },
              content: "orphan",
              timestamp: "2025-02-10T12:03:00Z",
              like_count: 0,
              parent_id: 2,
              deleted: 0,
              edited: 0,
              replies: [],
            },
          ],
        },
        {
          id: 3,
          user: { id: 5, display_name: "[Anonymous]" },
          content: "anon content",
          timestamp: "2025-02-10T12:04:00Z",
          like_count: 1,
          parent_id: null,
          deleted: 2,
          edited: 0,
          replies: [],
        },
      ],
      body: [],
      brain: [],
    },
    meta: { date: "2025-02-10", type: "all" },
  };
}

export { vi };
