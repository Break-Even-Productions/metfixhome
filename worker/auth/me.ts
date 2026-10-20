import type { Env } from "../upstream";
import { SID_COOKIE, clearHostCookie, countCookie, getSid, setHostCookie } from "./cookies";
import { isAuthHost } from "./host";
import {
  BODY_NOT_FOUND,
  BODY_SIGNED_OUT,
  BODY_UNAVAILABLE,
  authJson,
  methodNotAllowed,
} from "./responses";
import {
  getMeCache,
  rebuildMeFromDo,
  sessionKeyHex,
  touchSession,
} from "./session";

const SID_MAX_AGE = 2_592_000;

export async function handleMe(request: Request, env: Env): Promise<Response> {
  if (!isAuthHost(request)) return authJson(BODY_NOT_FOUND, 404);
  const method = request.method.toUpperCase();
  if (method === "HEAD") return methodNotAllowed("GET");
  if (method !== "GET") return methodNotAllowed("GET");

  const cookieHeader = request.headers.get("Cookie");
  if (countCookie(cookieHeader, SID_COOKIE) > 1) {
    return authJson(BODY_SIGNED_OUT, 401, {}, [clearHostCookie(SID_COOKIE)]);
  }

  const sid = getSid(request);
  // R5: no cookie → {signed_in:false}, 0 KV reads.
  if (!sid) {
    return authJson({ signed_in: false }, 200);
  }

  const hex = await sessionKeyHex(sid);
  let me = await getMeCache(env, hex);
  if (!me) {
    try {
      me = await rebuildMeFromDo(env, sid);
    } catch {
      return authJson(BODY_UNAVAILABLE, 503, { "Retry-After": "300" });
    }
  }
  if (!me) {
    return authJson(BODY_SIGNED_OUT, 401, {}, [clearHostCookie(SID_COOKIE)]);
  }

  let setCookies: string[] = [];
  try {
    const touched = await touchSession(env, sid);
    if (touched?.reissued) {
      setCookies = [setHostCookie(SID_COOKIE, sid, SID_MAX_AGE)];
    }
  } catch {
    /* display from KV is fine */
  }

  const body: { signed_in: true; public_name: string; moderator?: boolean } = {
    signed_in: true,
    public_name: me.user_public_name,
  };
  if (me.can_moderate === true) body.moderator = true;
  return authJson(body, 200, {}, setCookies);
}
