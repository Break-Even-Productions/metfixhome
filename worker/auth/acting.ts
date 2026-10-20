/**
 * User-acting session access: load SESSION DO, proactive refresh, 401 retry (AU7.x).
 */
import type { Env, FetchImpl } from "../upstream";
import { bsiRefreshToken } from "../upstream";
import { SID_COOKIE, sidCookieClear } from "./cookies";
import { parseCookies } from "./cookies";
import { jsonNoStore, unavailable } from "./http";
import {
  applyRefreshResult,
  destroySession,
  loadSession,
  type MeCache,
} from "./session";
import type { SessionRecord } from "../do/session";

const REFRESH_WINDOW_MS = 60_000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type ActingContext = {
  sid: string;
  hex: string;
  access: string;
  record: SessionRecord;
};

function signedOut(): Response {
  return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
}

async function sessionExpired(env: Env, sid: string): Promise<Response> {
  try {
    await destroySession(env, sid);
  } catch {
    /* best-effort */
  }
  return signedOut();
}

async function refreshIfNeeded(
  env: Env,
  sid: string,
  record: SessionRecord,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<SessionRecord | null> {
  const now = Date.now();
  if (now - record.created >= NINETY_DAYS_MS) return null;
  if (record.access_exp - now > REFRESH_WINDOW_MS) return record;
  const clientId = env.BSI_OAUTH_CLIENT_ID;
  if (!clientId) return null;
  const upstream = await bsiRefreshToken(
    {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: record.bsi_refresh,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.baseUrl },
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
    if (typeof tok.access_token !== "string") return null;
    const updated = await applyRefreshResult(env, sid, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? record.bsi_refresh,
      expires_in: tok.expires_in,
      public_name: tok.public_name,
      user_id: tok.user_id,
      can_moderate: tok.can_moderate,
    });
    return updated;
  }
  if (
    upstream.kind === "http" &&
    (upstream.status === 400 || upstream.status === 401)
  ) {
    return null;
  }
  throw new Error("refresh_unavailable");
}

/**
 * Resolve session for a user-acting route (comments write, leaderboard).
 * Proactive refresh when access expires within 60 s (AU7.1).
 */
export async function resolveActingSession(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) return signedOut();

  let loaded: Awaited<ReturnType<typeof loadSession>>;
  try {
    loaded = await loadSession(env, sid);
  } catch {
    return unavailable();
  }
  if (!loaded) return signedOut();

  const now = Date.now();
  if (now - loaded.record.created >= NINETY_DAYS_MS) {
    return sessionExpired(env, sid);
  }

  let record = loaded.record;
  if (!record.bsi_access) return unavailable();
  try {
    const refreshed = await refreshIfNeeded(env, sid, record, fetchImpl, opts);
    if (!refreshed) return sessionExpired(env, sid);
    record = refreshed;
  } catch {
    return unavailable();
  }

  return {
    sid,
    hex: loaded.hex,
    access: record.bsi_access,
    record,
  };
}

/** One refresh attempt after BSI 401 on a user-acting call (AU7.2). */
export async function refreshAfterUnauthorized(
  env: Env,
  ctx: ActingContext,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | null> {
  const clientId = env.BSI_OAUTH_CLIENT_ID;
  if (!clientId) return null;
  const upstream = await bsiRefreshToken(
    {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: ctx.record.bsi_refresh,
    },
    env,
    fetchImpl,
    { baseUrl: opts?.baseUrl },
  );
  if (upstream.kind !== "ok") return null;
  const tok = upstream.json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    public_name?: string;
    user_id?: string | number;
    can_moderate?: unknown;
  };
  if (typeof tok.access_token !== "string") return null;
  const updated = await applyRefreshResult(env, ctx.sid, {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? ctx.record.bsi_refresh,
    expires_in: tok.expires_in,
    public_name: tok.public_name,
    user_id: tok.user_id,
    can_moderate: tok.can_moderate,
  });
  if (!updated) return null;
  return {
    sid: ctx.sid,
    hex: ctx.hex,
    access: updated.bsi_access,
    record: updated,
  };
}

function isBsiUnauthorized(
  upstream: { kind: string; status?: number },
): boolean {
  return upstream.kind === "http" && upstream.status === 401;
}

/** Run a BSI user call with proactive refresh + one 401 retry. */
export async function runUserBsiCall<T extends { kind: string; status?: number }>(
  ctx: ActingContext,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  call: (access: string) => Promise<T>,
): Promise<{ ctx: ActingContext; result: T } | Response> {
  let result = await call(ctx.access);
  if (!isBsiUnauthorized(result)) return { ctx, result };
  const next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);
  if (!next) return sessionExpired(env, ctx.sid);
  result = await call(next.access);
  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);
  return { ctx: next, result };
}

export type { MeCache };
