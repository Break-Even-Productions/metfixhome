/**
 * T21 (pool-workers): waiter time-box for overlapping sitemap builds (spec rev 1.1.1 CQ2).
 * Requires `npm run build:cf` first.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SELF, fetchMock } from "cloudflare:test";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    ASSETS: Fetcher;
    DAILY_FIX_API_KEY: string;
  }
}

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  // Aborted delayed upstream calls can leave pending interceptors; don't fail the suite on that.
  fetchMock.deactivate();
});

describe("pool-workers sitemap waiter time-box (T21)", () => {
  it(
    "overlapping cold sitemap requests resolve by the 20s build budget (503, no hang)",
    async () => {
      // Upstream hangs past the budget. Waiters Promise.race remaining budget → 503.
      fetchMock
        .get("https://brokenscience.org")
        .intercept({ path: /\/wp-json\/metfix\/v1\/daily-fix/, method: "GET" })
        .reply(200, JSON.stringify({ items: [{ date: "2026-10-04" }], meta: { total: 1 } }), {
          headers: { "Content-Type": "application/json" },
        })
        .delay(60_000);

      const started = Date.now();
      const [a, b] = await Promise.all([
        SELF.fetch("https://metfix.org/sitemap-daily-fix.xml"),
        SELF.fetch("https://metfix.org/sitemap-daily-fix.xml"),
      ]);
      const elapsed = Date.now() - started;

      expect(a.status).toBe(503);
      expect(b.status).toBe(503);
      expect(a.headers.get("Retry-After")).toBe("300");
      expect(a.headers.get("Cache-Control")).toBe("no-store");
      expect(b.headers.get("Retry-After")).toBe("300");
      expect(b.headers.get("Cache-Control")).toBe("no-store");
      // Must not hang past the 20s budget (allow small scheduling slack).
      expect(elapsed).toBeLessThan(25_000);
    },
    30_000,
  );
});
