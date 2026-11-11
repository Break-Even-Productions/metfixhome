/**
 * User-acting session access: load SESSION DO, proactive refresh, 401 retry (AU7.x).
 */
import type { Env, FetchImpl } from "../upstream";
import { SID_COOKIE, sidCookieClear } from "./cookies";
import { parseCookies } from "./cookies";
import { jsonNoStore, unavailable } from "./http";
import {
  destroySession,
  ensureActingAccess,
  loadActingAccess,
  SessionUnavailableError,
  type MeCache,
} from "./session";
import type { SessionRecord } from "../do/session";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type ActingContext = {
  sid: string;
  hex: string;
  access: string;
  record: SessionRecord;
};

const invalidGrantSignOuts = new WeakSet<Response>();

function signedOut(reason?: "invalid_grant"): Response {
  const res = jsonNoStore({ error: "signed_out" }, 401, {
    "Set-Cookie": sidCookieClear(),
  });
  if (reason === "invalid_grant") invalidGrantSignOuts.add(res);
  return res;
}

/** True only when the refresh grant itself was invalid_grant. */
export function isInvalidGrantSignOut(res: Response): boolean {
  return invalidGrantSignOuts.has(res);
}

async function sessionExpired(env: Env, sid: string): Promise<Response> {
  try {
    await destroySession(env, sid);
  } catch {
    /* best-effort */
  }
  return signedOut();
}

export async function resolveActingSession(
  request: Request,
  env: Env,
  _fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | Response> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) return signedOut();

  let loaded: Awaited<ReturnType<typeof loadActingAccess>>;
  try {
    loaded = await loadActingAccess(env, sid, { baseUrl: opts?.baseUrl });
  } catch (e) {
    // Forward DO Retry-After (AU27.3 non-grant → 60; 429/5xx clamp).
    if (e instanceof SessionUnavailableError && e.retryAfter != null) {
      return unavailable(e.retryAfter);
    }
    return unavailable();
  }
  if (!loaded.ok) {
    return signedOut(loaded.reason === "invalid_grant" ? "invalid_grant" : undefined);
  }

  const now = Date.now();
  if (now - loaded.record.created >= NINETY_DAYS_MS) {
    return sessionExpired(env, sid);
  }
  if (!loaded.record.bsi_access) return unavailable();

  return {
    sid,
    hex: loaded.hex,
    access: loaded.record.bsi_access,
    record: loaded.record,
  };
}

export async function refreshAfterUnauthorized(
  env: Env,
  ctx: ActingContext,
  _fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<ActingContext | null> {
  // Timeout and 5xx throw SessionUnavailableError. Callers must not treat that as a dead grant.
  const next = await ensureActingAccess(env, ctx.sid, {
    force: true,
    baseUrl: opts?.baseUrl,
  });
  if (!next) return null;
  return {
    sid: ctx.sid,
    hex: next.hex,
    access: next.record.bsi_access,
    record: next.record,
  };
}

function isBsiUnauthorized(
  upstream: { kind: string; status?: number },
): boolean {
  return upstream.kind === "http" && upstream.status === 401;
}

export async function runUserBsiCall<T extends { kind: string; status?: number }>(
  ctx: ActingContext,
  env: Env,
  fetchImpl: FetchImpl,
  opts: { baseUrl?: string } | undefined,
  call: (access: string) => Promise<T>,
): Promise<{ ctx: ActingContext; result: T } | Response> {
  let result = await call(ctx.access);
  if (!isBsiUnauthorized(result)) return { ctx, result };
  let next: ActingContext | null;
  try {
    next = await refreshAfterUnauthorized(env, ctx, fetchImpl, opts);
  } catch (e) {
    // Refresh timed out or the token endpoint returned 5xx. Keep the session.
    if (e instanceof SessionUnavailableError) {
      return unavailable(e.retryAfter ?? 300);
    }
    throw e;
  }
  if (!next) return sessionExpired(env, ctx.sid);
  result = await call(next.access);
  if (isBsiUnauthorized(result)) return sessionExpired(env, ctx.sid);
  return { ctx: next, result };
}

export type { MeCache };
