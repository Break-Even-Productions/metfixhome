/**
 * LOGIN_THROTTLE Durable Object — R8a / R8b / R8c.
 * Instances:
 *   idFromName("id:" + sha256hex(lower(trim(identifier))))  — R8a
 *   idFromName("ip:" + sha256hex(ip))                         — R8b
 *   idFromName("login:global")                                — R8c
 */

const WINDOW_MS = 60_000;
const R8B_LIMIT = 20;
const R8C_LIMIT = 25;
const R8A_FREE = 5;
const R8A_CAP_S = 60;

type IdState = {
  failures: number;
  lockUntil: number; // epoch ms
  lastLockSecs: number; // last applied lockout length
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function ceilRetryAfter(untilMs: number, now: number): number {
  return Math.max(1, Math.ceil((untilMs - now) / 1000));
}

export class LoginThrottleDO implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Date.now();
    try {
      if (request.method === "POST" && path === "/r8a/check") {
        return this.r8aCheck(now);
      }
      if (request.method === "POST" && path === "/r8a/fail") {
        return this.r8aFail(now);
      }
      if (request.method === "POST" && path === "/r8a/clear") {
        return this.r8aClear();
      }
      if (request.method === "POST" && path === "/r8b/attempt") {
        return this.r8bAttempt(now);
      }
      if (request.method === "POST" && path === "/r8c/reserve") {
        return this.r8cReserve(now);
      }
      return json({ error: "not_found" }, 404);
    } catch {
      return json({ error: "unavailable" }, 503);
    }
  }

  private async r8aCheck(now: number): Promise<Response> {
    const st = (await this.state.storage.get<IdState>("id")) ?? {
      failures: 0,
      lockUntil: 0,
      lastLockSecs: 0,
    };
    if (st.lockUntil > now) {
      return json({ allowed: false, retryAfter: ceilRetryAfter(st.lockUntil, now) });
    }
    return json({ allowed: true, failures: st.failures });
  }

  private async r8aFail(now: number): Promise<Response> {
    const st = (await this.state.storage.get<IdState>("id")) ?? {
      failures: 0,
      lockUntil: 0,
      lastLockSecs: 0,
    };
    st.failures += 1;
    // After 5 recorded failures, lock subsequent attempts (AU17.1: 6th login → 429).
    if (st.failures >= R8A_FREE) {
      const next =
        st.lastLockSecs <= 0 ? 1 : Math.min(R8A_CAP_S, st.lastLockSecs * 2);
      st.lastLockSecs = next;
      st.lockUntil = now + next * 1000;
      await this.state.storage.put("id", st);
      return json({ allowed: false, retryAfter: next, failures: st.failures });
    }
    await this.state.storage.put("id", st);
    return json({ allowed: true, failures: st.failures });
  }

  private async r8aClear(): Promise<Response> {
    await this.state.storage.delete("id");
    return json({ ok: true });
  }

  /** Count one attempt; reject when ≥ 20 in the rolling 60 s window. */
  private async r8bAttempt(now: number): Promise<Response> {
    const times = ((await this.state.storage.get<number[]>("ip")) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (times.length >= R8B_LIMIT) {
      const oldest = Math.min(...times);
      return json({
        allowed: false,
        retryAfter: ceilRetryAfter(oldest + WINDOW_MS, now),
        count: times.length,
      });
    }
    times.push(now);
    await this.state.storage.put("ip", times);
    return json({ allowed: true, count: times.length });
  }

  /** Reserve one site-wide BSI slot (25 / 60 s). */
  private async r8cReserve(now: number): Promise<Response> {
    const times = ((await this.state.storage.get<number[]>("global")) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (times.length >= R8C_LIMIT) {
      const oldest = Math.min(...times);
      return json({
        allowed: false,
        retryAfter: ceilRetryAfter(oldest + WINDOW_MS, now),
        count: times.length,
      });
    }
    times.push(now);
    await this.state.storage.put("global", times);
    return json({ allowed: true, count: times.length });
  }
}
