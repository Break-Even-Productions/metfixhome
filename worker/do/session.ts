/**
 * SESSION Durable Object — source of truth for session tokens (G1 / R7).
 * Instance name / AAD: sess:<sha256hex(id)>.
 */
import { decryptSessionPayload, encryptSessionPayload } from "../auth/crypto";
import { bsiRefreshToken, type Env, type FetchImpl } from "../upstream";

export type SessionRecord = {
  bsi_access: string;
  bsi_refresh: string;
  access_exp: number;
  user_public_name: string;
  bsi_user_id: string;
  can_moderate: boolean;
  created: number;
  last_seen: number;
};

type Stored = { blob: string };

const REFRESH_WINDOW_MS = 60_000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export class SessionDO {
  private refreshChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: {
      SESSION_ENC_KEY?: string;
      SESSION_ENC_KEY_PREV?: string;
      DAILY_FIX_API_KEY?: string;
      BSI_OAUTH_CLIENT_ID?: string;
    },
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const aad =
      request.headers.get("X-Session-AAD") ?? url.searchParams.get("aad") ?? "";
    if (!aad.startsWith("sess:")) {
      return json({ error: "unavailable" }, 503, { "Retry-After": "300" });
    }

    try {
      if (path === "/session" && request.method === "GET") return this.get(aad);
      if (path === "/session" && request.method === "PUT") {
        const body = (await request.json()) as SessionRecord;
        return this.put(aad, body);
      }
      if (path === "/session" && request.method === "DELETE") {
        await this.state.storage.deleteAll();
        return new Response(null, { status: 204 });
      }
      if (path === "/touch" && request.method === "POST") return this.touch(aad);
      if (path === "/ensure-access" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          force?: boolean;
          baseUrl?: string;
        };
        return this.withRefreshLock(() => this.ensureAccess(aad, body));
      }
      if (path === "/refresh" && request.method === "POST") {
        return this.withRefreshLock(async () => {
          const body = (await request.json()) as {
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
            public_name?: string;
            user_id?: string | number;
            can_moderate?: unknown;
          };
          return this.applyRefresh(aad, body);
        });
      }
      if (path === "/get" || path === "/get/") return this.get(aad);
      if ((path === "/put" || path === "/put/") && request.method === "POST") {
        const body = (await request.json()) as SessionRecord;
        return this.put(aad, body);
      }
      if ((path === "/clear" || path === "/clear/") && request.method === "POST") {
        await this.state.storage.deleteAll();
        return new Response(null, { status: 204 });
      }
      return json({ error: "not_found" }, 404);
    } catch {
      return json({ error: "unavailable" }, 503, { "Retry-After": "300" });
    }
  }

  private async withRefreshLock<T extends Response>(fn: () => Promise<T>): Promise<T> {
    const run = this.refreshChain.then(fn, fn);
    this.refreshChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async get(aad: string): Promise<Response> {
    const key = this.env.SESSION_ENC_KEY;
    if (!key) return json({ error: "unavailable" }, 503, { "Retry-After": "300" });
    const stored = await this.state.storage.get<Stored>("rec");
    if (!stored?.blob) return json({ present: false, record: null }, 200);
    const pt = await decryptSessionPayload(
      stored.blob,
      aad,
      key,
      this.env.SESSION_ENC_KEY_PREV,
    );
    if (pt == null) {
      await this.state.storage.deleteAll();
      return json({ present: false, record: null }, 200);
    }
    let record: SessionRecord;
    try {
      record = JSON.parse(pt) as SessionRecord;
    } catch {
      await this.state.storage.deleteAll();
      return json({ present: false, record: null }, 200);
    }
    if (this.env.SESSION_ENC_KEY_PREV) {
      const blob = await encryptSessionPayload(pt, aad, key);
      await this.state.storage.put("rec", { blob });
    }
    return json({ present: true, record });
  }

  private async put(aad: string, record: SessionRecord): Promise<Response> {
    const key = this.env.SESSION_ENC_KEY;
    if (!key) return json({ error: "unavailable" }, 503, { "Retry-After": "300" });
    const blob = await encryptSessionPayload(JSON.stringify(record), aad, key);
    await this.state.storage.put("rec", { blob });
    const idleMs = 30 * 24 * 60 * 60 * 1000;
    const absMs = 90 * 24 * 60 * 60 * 1000;
    const until = Math.min(record.last_seen + idleMs, record.created + absMs);
    await this.state.storage.setAlarm(until);
    return json({ ok: true });
  }

  private async touch(aad: string): Promise<Response> {
    const got = await this.get(aad);
    const body = (await got.json()) as { present?: boolean; record?: SessionRecord };
    if (!body.present || !body.record) return json({ record: null }, 404);
    const now = Date.now();
    const prev = body.record.last_seen;
    const reissued = now - prev > DAY_MS;
    if (reissued) {
      body.record.last_seen = now;
      await this.put(aad, body.record);
    }
    return json({ record: body.record, reissued });
  }

  private async ensureAccess(
    aad: string,
    opts: { force?: boolean; baseUrl?: string },
  ): Promise<Response> {
    const got = await this.get(aad);
    const body = (await got.json()) as { present?: boolean; record?: SessionRecord };
    if (!body.present || !body.record) return json({ status: "absent" }, 404);
    const record = body.record;
    const now = Date.now();
    if (now - record.created >= NINETY_DAYS_MS) {
      await this.state.storage.deleteAll();
      return json({ status: "expired" }, 401);
    }
    const needsRefresh =
      opts.force === true || record.access_exp - now <= REFRESH_WINDOW_MS;
    if (!needsRefresh) return json({ status: "ok", record });
    const clientId = this.env.BSI_OAUTH_CLIENT_ID;
    if (!clientId || !this.env.DAILY_FIX_API_KEY) {
      return json({ status: "unavailable" }, 503, { "Retry-After": "300" });
    }
    const fetchImpl = globalThis.fetch.bind(globalThis) as FetchImpl;
    const upstream = await bsiRefreshToken(
      {
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: record.bsi_refresh,
      },
      this.env as Env,
      fetchImpl,
      { baseUrl: opts.baseUrl, timeoutMs: 5000 },
    );
    if (upstream.kind === "ok") {
      const tok = upstream.json as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        public_name?: string;
        user_id?: string | number;
        can_moderate?: unknown;
      };
      if (typeof tok.access_token !== "string") {
        await this.state.storage.deleteAll();
        return json({ status: "expired" }, 401);
      }
      record.bsi_access = tok.access_token;
      if (typeof tok.refresh_token === "string" && tok.refresh_token) {
        record.bsi_refresh = tok.refresh_token;
      }
      record.access_exp =
        now + (typeof tok.expires_in === "number" ? tok.expires_in * 1000 : 3600_000);
      record.last_seen = now;
      if (typeof tok.public_name === "string" && tok.public_name.trim()) {
        record.user_public_name = tok.public_name.trim();
      }
      if (tok.user_id != null) record.bsi_user_id = String(tok.user_id);
      if (tok.can_moderate !== undefined) {
        record.can_moderate = tok.can_moderate === true;
      }
      await this.put(aad, record);
      return json({ status: "ok", record, refreshed: true });
    }
    if (upstream.kind === "http" && (upstream.status === 400 || upstream.status === 401)) {
      await this.state.storage.deleteAll();
      return json({ status: "expired" }, 401);
    }
    return json({ status: "unavailable" }, 503, { "Retry-After": "300" });
  }

  private async applyRefresh(
    aad: string,
    tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      public_name?: string;
      user_id?: string | number;
      can_moderate?: unknown;
    },
  ): Promise<Response> {
    const got = await this.get(aad);
    const body = (await got.json()) as { present?: boolean; record?: SessionRecord };
    if (!body.present || !body.record) return json({ record: null }, 404);
    const now = Date.now();
    body.record.bsi_access = tokens.access_token;
    if (typeof tokens.refresh_token === "string" && tokens.refresh_token) {
      body.record.bsi_refresh = tokens.refresh_token;
    }
    body.record.access_exp =
      now + (typeof tokens.expires_in === "number" ? tokens.expires_in * 1000 : 3600_000);
    body.record.last_seen = now;
    if (typeof tokens.public_name === "string" && tokens.public_name.trim()) {
      body.record.user_public_name = tokens.public_name.trim();
    }
    if (tokens.user_id != null) body.record.bsi_user_id = String(tokens.user_id);
    if (tokens.can_moderate !== undefined) {
      body.record.can_moderate = tokens.can_moderate === true;
    }
    await this.put(aad, body.record);
    return json({ record: body.record });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}
