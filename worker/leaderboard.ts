import { isIsoDate } from "../shared/daily-fix";
import { bsiFetchLeaderboard, type Env, type FetchImpl } from "./upstream";
import { parseCookies, SID_COOKIE, sidCookieClear } from "./auth/cookies";
import { jsonNoStore, unavailable } from "./auth/http";
import { resolveActingSession } from "./auth/acting";

/** GET /api/daily-fix/leaderboard — signed-in only, no-store. */
export async function handleLeaderboard(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  if (request.method.toUpperCase() !== "GET") {
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  }
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) {
    return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
  }
  const ctx = await resolveActingSession(request, env, fetchImpl, opts);
  if (ctx instanceof Response) return ctx;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const type = url.searchParams.get("type");
  const workoutId = url.searchParams.get("daily_workout_id");
  if (!date || !isIsoDate(date)) return jsonNoStore({ error: "invalid_date" }, 400);
  if (!type) return jsonNoStore({ error: "invalid_type" }, 400);
  if (!workoutId) return jsonNoStore({ error: "invalid_request" }, 400);

  const upstream = await bsiFetchLeaderboard(workoutId, ctx.access, env, fetchImpl, {
    baseUrl: opts?.baseUrl,
    query: { date, type },
  });
  if (upstream.kind === "ok") {
    return new Response(upstream.bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  if (upstream.kind === "http" && upstream.status === 404) {
    return jsonNoStore({ error: "no_leaderboard" }, 404);
  }
  if (upstream.kind === "rate_limited") {
    return jsonNoStore({ error: "rate_limited" }, 429, {
      "Retry-After": String(upstream.retryAfter),
    });
  }
  return unavailable();
}
