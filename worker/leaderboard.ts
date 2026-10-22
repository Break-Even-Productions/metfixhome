import { isIsoDate } from "../shared/daily-fix";
import {
  bsiFetchLeaderboard,
  fetchDailyFixDay,
  type Env,
  type FetchImpl,
  type RateLimitBinding,
} from "./upstream";
import { parseCookies, SID_COOKIE, sidCookieClear } from "./auth/cookies";
import { jsonNoStore, unavailable } from "./auth/http";
import { resolveActingSession } from "./auth/acting";
import { publicDisplayName } from "./auth/public-name";

const VALID_TYPES = new Set(["belly", "body", "brain"]);
const VALID_SCALING = new Set(["all", "rx", "scaled"]);

const L5_TOP_KEYS = [
  "total",
  "limit",
  "offset",
  "scoring_field",
  "score_unit_id",
  "scoring_direction",
  "dfx_date",
  "live_at",
  "window_end",
  "leaderboard",
] as const;

function hasDuplicateQueryParam(url: URL, keys: string[]): boolean {
  const counts = new Map<string, number>();
  for (const key of url.searchParams.keys()) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.some((k) => (counts.get(k) ?? 0) > 1);
}

/** L6.3 / S-G5: Rate Limiting binding only; missing binding → deny. */
async function allowLb(env: { LEADERBOARD_LIMITER?: RateLimitBinding }, userId: string): Promise<boolean> {
  const binding = env.LEADERBOARD_LIMITER;
  if (!binding) return false;
  const r = await binding.limit({ key: `lb:${userId}` });
  return r.success === true;
}

type ComponentMeta = {
  daily_workout_id: string | number;
  scoring_field: string;
  scoring_direction: string;
  order: string;
};

function componentMeta(raw: unknown, type: string): ComponentMeta | "no_leaderboard" | null {
  if (!raw || typeof raw !== "object") return null;
  const day = raw as Record<string, unknown>;
  const comp = day[type];
  if (!comp || typeof comp !== "object") return "no_leaderboard";
  const c = comp as Record<string, unknown>;
  const scoring =
    typeof c.scoring_field === "string" && c.scoring_field.trim()
      ? c.scoring_field.trim()
      : null;
  if (!scoring) return "no_leaderboard";
  const id =
    c.daily_workout_id ??
    day.daily_workout_id ??
    (typeof c.id === "number" || typeof c.id === "string" ? c.id : null);
  if (id == null || id === "") return null;
  const direction =
    typeof c.scoring_direction === "string" && c.scoring_direction
      ? c.scoring_direction
      : "higher_better";
  const order =
    typeof c.order === "string" && c.order
      ? c.order
      : direction === "lower_better"
        ? "asc"
        : "desc";
  return {
    daily_workout_id: id as string | number,
    scoring_field: scoring,
    scoring_direction: direction,
    order,
  };
}

function shapeLeaderboard(
  raw: unknown,
  selfUserId: string | undefined,
): Record<string, unknown> {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rowsIn = Array.isArray(src.leaderboard)
    ? src.leaderboard
    : Array.isArray(src.rows)
      ? src.rows
      : [];
  const leaderboard = rowsIn.slice(0, 25).map((row, i) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const uid =
      r.user_id != null
        ? String(r.user_id)
        : r.bsi_user_id != null
          ? String(r.bsi_user_id)
          : "";
    const is_self = Boolean(selfUserId && uid && uid === selfUserId);
    return {
      rank: typeof r.rank === "number" ? r.rank : i + 1,
      public_name: publicDisplayName({ display_name: r.display_name }),
      score_value: r.score_value ?? null,
      scaling_mode: r.scaling_mode ?? null,
      logged_at: r.logged_at ?? null,
      is_self,
    };
  });
  const out: Record<string, unknown> = {};
  for (const k of L5_TOP_KEYS) {
    if (k === "leaderboard") {
      out.leaderboard = leaderboard;
      continue;
    }
    if (k === "limit") {
      out.limit = 25;
      continue;
    }
    if (k === "offset") {
      out.offset = 0;
      continue;
    }
    if (k === "total") {
      out.total = typeof src.total === "number" ? src.total : leaderboard.length;
      continue;
    }
    if (k in src) out[k] = src[k];
    else out[k] = null;
  }
  return out;
}

function mapUpstreamError(upstream: {
  kind: string;
  status?: number;
  bodyText?: string;
}): Response {
  if (upstream.kind === "nokey") return unavailable();
  if (upstream.kind === "rate_limited") {
    return jsonNoStore({ error: "unavailable" }, 503, { "Retry-After": "60" });
  }
  if (upstream.kind === "http") {
    const status = upstream.status ?? 0;
    if (status === 400) return jsonNoStore({ error: "invalid_request" }, 400);
    if (status === 404) return jsonNoStore({ error: "no_leaderboard" }, 404);
    // 401/403/5xx/others → unavailable; never relay upstream body
    return unavailable();
  }
  return unavailable();
}

/** GET /api/daily-fix/leaderboard — signed-in only, no-store, scaling_filter validated. */
export async function handleLeaderboard(
  request: Request,
  env: Env,
  fetchImpl: FetchImpl,
  opts?: { baseUrl?: string },
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return jsonNoStore({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" });
  }

  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies[SID_COOKIE];
  if (!sid) {
    return jsonNoStore({ error: "signed_out" }, 401, { "Set-Cookie": sidCookieClear() });
  }
  const ctx = await resolveActingSession(request, env, fetchImpl, opts);
  if (ctx instanceof Response) return ctx;

  const url = new URL(request.url);
  if (hasDuplicateQueryParam(url, ["date", "type", "scaling_filter"])) {
    return jsonNoStore({ error: "invalid_request" }, 400);
  }

  const date = url.searchParams.get("date");
  const type = url.searchParams.get("type");
  const scalingRaw = url.searchParams.get("scaling_filter");
  const scaling_filter = scalingRaw == null || scalingRaw === "" ? "all" : scalingRaw;

  if (!date || !isIsoDate(date)) return jsonNoStore({ error: "invalid_date" }, 400);
  if (!type || !VALID_TYPES.has(type)) return jsonNoStore({ error: "invalid_type" }, 400);
  if (!VALID_SCALING.has(scaling_filter)) {
    return jsonNoStore({ error: "invalid_scaling_filter" }, 400);
  }

  const userId = ctx.record.bsi_user_id ? String(ctx.record.bsi_user_id) : "";
  if (userId && !(await allowLb(env, userId))) {
    return jsonNoStore({ error: "rate_limited" }, 429, { "Retry-After": "60" });
  }

  // N7: day-data read for workout id / scoring_field (never trust client extras).
  const dayOutcome = await fetchDailyFixDay(date, env, fetchImpl, { baseUrl: opts?.baseUrl });
  if (dayOutcome.kind === "nokey") return unavailable();
  if (
    dayOutcome.kind === "timeout" ||
    dayOutcome.kind === "throw" ||
    dayOutcome.kind === "upstream_error" ||
    dayOutcome.kind === "unmappable" ||
    dayOutcome.kind === "mismatch" ||
    dayOutcome.kind === "not_found"
  ) {
    return unavailable();
  }
  if (dayOutcome.kind !== "ok") return unavailable();

  const meta = componentMeta(dayOutcome.json, type);
  if (meta === "no_leaderboard") {
    return jsonNoStore({ error: "no_leaderboard" }, 404);
  }
  if (meta == null) return unavailable();

  const upstream = await bsiFetchLeaderboard(meta.daily_workout_id, ctx.access, env, fetchImpl, {
    baseUrl: opts?.baseUrl,
    query: {
      date,
      scoring_field: meta.scoring_field,
      scoring_direction: meta.scoring_direction,
      order: meta.order,
      scaling_filter,
      limit: "25",
      offset: "0",
      leaderboard_mode: "official",
    },
  });

  if (upstream.kind !== "ok") return mapUpstreamError(upstream);

  let json: unknown;
  try {
    json = JSON.parse(upstream.bodyText);
  } catch {
    return unavailable();
  }

  const shaped = shapeLeaderboard(json, userId || undefined);
  const body = JSON.stringify(shaped);
  if (method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
