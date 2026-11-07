/**
 * Authenticated Daily Fix compare-to prior log proxy.
 * Uses the member bearer so BSI can attach my_prior_log (exact ID + structure match).
 */
import { isIsoDate, mapDailyFixCompareTo } from "../shared/daily-fix";
import { resolveActingSession } from "./auth/acting";
import { parseCookies, SID_COOKIE } from "./auth/cookies";
import { jsonNoStore, unavailable } from "./auth/http";
import { fetchDailyFixDay, type Env, type FetchImpl } from "./upstream";

export async function handleCompareToRoute(
  request: Request,
  env: Env,
  opts?: { fetchImpl?: FetchImpl; bsiBaseUrl?: string },
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/daily-fix/compare-to" && url.pathname !== "/api/daily-fix/compare-to/") {
    return null;
  }

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" });
  }

  const date = url.searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return jsonNoStore({ error: "bad_date" }, 400);
  }

  const fetchImpl = opts?.fetchImpl ?? fetch;
  const cookies = parseCookies(request.headers.get("Cookie"));
  if (!cookies[SID_COOKIE]) {
    return jsonNoStore({ error: "unauthorized", compare_to: null }, 401);
  }
  const resolved = await resolveActingSession(request, env, fetchImpl, {
    baseUrl: opts?.bsiBaseUrl,
  });
  if (resolved instanceof Response) return resolved;

  const outcome = await fetchDailyFixDay(date, env, fetchImpl, {
    baseUrl: opts?.bsiBaseUrl,
    accessToken: resolved.access,
  });

  if (outcome.kind === "nokey") return unavailable();
  if (outcome.kind === "timeout" || outcome.kind === "throw") return unavailable();
  if (outcome.kind === "not_found") {
    return jsonNoStore({ error: "not_found", compare_to: null }, 404);
  }
  if (outcome.kind === "upstream_error") {
    return jsonNoStore({ error: "upstream_error", compare_to: null }, 502);
  }

  const compare_to = mapDailyFixCompareTo(outcome.json);
  const body = JSON.stringify({ date, compare_to });
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(body, { status: 200, headers });
}
