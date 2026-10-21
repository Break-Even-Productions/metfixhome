import type { Env, FetchImpl } from "../upstream";
import { oauthRevokeToken } from "../upstream";
import { requireCsrf } from "./csrf";
import { SID_COOKIE, clearHostCookie, getSid } from "./cookies";
import { sha256Prefix12 } from "./crypto";
import { isAuthHost } from "./host";
import { BODY_NOT_FOUND, authEmpty, methodNotAllowed } from "./responses";
import { destroySession, sessionKeyHex } from "./session";

export async function handleLogout(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { bsiBaseUrl?: string; baseUrl?: string },
): Promise<Response> {
  if (!isAuthHost(request)) {
    return new Response(JSON.stringify(BODY_NOT_FOUND), {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  const method = request.method.toUpperCase();
  if (method !== "POST") return methodNotAllowed("POST");

  const csrf = await requireCsrf(request, env);
  if (!csrf.ok) return csrf.response;

  const sid = getSid(request);
  const clear = clearHostCookie(SID_COOKIE);

  // G9: always 204 + clear cookie even if SESSION DO is down.
  if (!sid) {
    return authEmpty(204, {}, [clear]);
  }

  let refresh: string | null = null;
  let access: string | null = null;
  try {
    const rec = await destroySession(env, sid);
    refresh = rec?.bsi_refresh ?? null;
    access = rec?.bsi_access ?? null;
  } catch {
    const hex = await sessionKeyHex(sid);
    console.log("session_logout_do_failed", await sha256Prefix12(hex));
    try {
      await env.AUTH_SESSIONS.delete(`sess:${hex}`);
    } catch {
      /* best-effort */
    }
  }

  const baseUrl = opts?.bsiBaseUrl ?? opts?.baseUrl;
  // §0v.1 Q6: two /oauth/revoke calls — refresh first, then access; no secret.
  if (refresh) {
    try {
      await oauthRevokeToken(
        { token: refresh, token_type_hint: "refresh_token" },
        env,
        fetchImpl,
        { baseUrl },
      );
    } catch {
      console.log("bsi_revoke_failed");
    }
  }
  if (access) {
    try {
      await oauthRevokeToken(
        { token: access, token_type_hint: "access_token" },
        env,
        fetchImpl,
        { baseUrl },
      );
    } catch {
      console.log("bsi_revoke_failed");
    }
  }

  return authEmpty(204, {}, [clear]);
}
