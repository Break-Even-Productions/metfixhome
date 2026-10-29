import type { Env } from "../upstream";
import { csrfForSid, timingSafeEqualStr } from "./crypto";
import { isAllowedAuthOrigin } from "./csrf";

export type JsonErrorFn = (
  body: unknown,
  status: number,
  extra?: HeadersInit,
) => Response;

/**
 * Shared sid CSRF check (Origin + Sec-Fetch-Site + constant-time token).
 * Callers supply their JSON error Response builder.
 */
export async function requireSidCsrf(
  request: Request,
  env: Env,
  sid: string,
  jsonError: JsonErrorFn,
): Promise<Response | null> {
  if (!env.CSRF_SECRET) {
    return jsonError({ error: "unavailable" }, 503, { "Retry-After": "300" });
  }
  const origin = request.headers.get("Origin");
  if (!isAllowedAuthOrigin(origin, env)) return jsonError({ error: "forbidden" }, 403);
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs != null && sfs !== "same-origin") return jsonError({ error: "forbidden" }, 403);
  const header = request.headers.get("X-CSRF-Token") ?? "";
  const expected = await csrfForSid(env.CSRF_SECRET, sid);
  if (!timingSafeEqualStr(header, expected)) return jsonError({ error: "forbidden" }, 403);
  return null;
}

const DEFAULT_MAX_BODY = 8_192;

/**
 * Shared JSON body reader with size + content-type checks.
 */
export async function readJsonBody(
  request: Request,
  jsonError: JsonErrorFn,
  maxBytes: number = DEFAULT_MAX_BODY,
): Promise<{ ok: true; json: unknown } | Response> {
  const ct = request.headers.get("Content-Type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return jsonError({ error: "unsupported_media_type" }, 415);
  }
  const cl = request.headers.get("Content-Length");
  if (cl != null) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > maxBytes) {
      return jsonError({ error: "payload_too_large" }, 413);
    }
  }
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    return jsonError({ error: "payload_too_large" }, 413);
  }
  try {
    const text = new TextDecoder().decode(buf);
    return { ok: true, json: text ? JSON.parse(text) : null };
  } catch {
    return jsonError({ error: "invalid_request" }, 400);
  }
}
