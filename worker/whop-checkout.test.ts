/**
 * Whop subscription checkout-session Worker gates (plan map + return_path + BEP URL).
 */
import { describe, expect, it } from "vitest";
import { handleWhopCheckoutSession } from "./whop-checkout";
import type { Env, FetchImpl, RateLimitBinding } from "./upstream";
import {
  BSI_ORIGIN,
  createHarness,
  csrfSid,
  setupAuthHooks,
  type Harness,
} from "../tools/pr2/harness/realauth-harness";
import { SID_COOKIE } from "./auth/cookies";

setupAuthHooks();

function countingLimiter(max: number): RateLimitBinding {
  const windows = new Map<string, number[]>();
  return {
    async limit({ key }: { key: string }) {
      const now = Date.now();
      const w = (windows.get(key) ?? []).filter((t) => now - t < 60_000);
      if (w.length >= max) {
        windows.set(key, w);
        return { success: false };
      }
      w.push(now);
      windows.set(key, w);
      return { success: true };
    },
  };
}

type Recorded = {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
};

async function withSession(h: Harness) {
  const { sid } = await h.login();
  const csrf = await csrfSid(h.env, sid);
  return { sid, csrf, cookie: `${SID_COOKIE}=${encodeURIComponent(sid)}` };
}

function makeFetchMock(
  handler: (rec: Recorded & { path: string }) => Response | Promise<Response>,
): { fetchImpl: FetchImpl; recorded: Recorded[] } {
  const recorded: Recorded[] = [];
  const fetchImpl: FetchImpl = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method =
      init?.method?.toUpperCase() ??
      (typeof input !== "string" && !(input instanceof URL)
        ? (input as Request).method.toUpperCase()
        : "GET");
    const bodyText = typeof init?.body === "string" ? init.body : "";
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const rec = { url, method, headers, bodyText };
    recorded.push(rec);
    return handler({ ...rec, path: new URL(url).pathname });
  };
  return { fetchImpl, recorded };
}

async function callCheckout(
  h: Harness,
  init: RequestInit,
  fetchImpl: FetchImpl,
): Promise<Response> {
  const req = new Request("https://metfix.org/api/billing/whop/checkout-session", init);
  return handleWhopCheckoutSession(req, h.env as Env, {
    fetchImpl,
    bsiBaseUrl: BSI_ORIGIN,
  });
}

describe("Whop subscription checkout-session", () => {
  it("invalid plan → 400, 0 upstream", async () => {
    const h = await createHarness();
    h.env.WHOP_CHECKOUT_LIMITER = countingLimiter(100);
    const { csrf, cookie } = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock(() =>
      Response.json({ checkout_url: "https://whop.com/checkout/x" }),
    );
    const res = await callCheckout(
      h,
      {
        method: "POST",
        headers: {
          Origin: "https://metfix.org",
          "Sec-Fetch-Site": "same-origin",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          Cookie: cookie,
        },
        body: JSON.stringify({ plan: "course" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_plan" });
    expect(recorded.filter((r) => r.url.includes("/whop/checkout-session"))).toHaveLength(0);
  });

  it("bad return_path → 400, 0 upstream", async () => {
    const h = await createHarness();
    h.env.WHOP_CHECKOUT_LIMITER = countingLimiter(100);
    const { csrf, cookie } = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock(() =>
      Response.json({ checkout_url: "https://whop.com/checkout/x" }),
    );
    const res = await callCheckout(
      h,
      {
        method: "POST",
        headers: {
          Origin: "https://metfix.org",
          "Sec-Fetch-Site": "same-origin",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          Cookie: cookie,
        },
        body: JSON.stringify({ plan: "pro", return_path: "//evil.com" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_return_path" });
    expect(recorded.filter((r) => r.url.includes("/whop/checkout-session"))).toHaveLength(0);
  });

  it("pro happy path defaults return_path to /checkout/complete and allowlists whop URL", async () => {
    const h = await createHarness();
    h.env.WHOP_CHECKOUT_LIMITER = countingLimiter(100);
    const { csrf, cookie } = await withSession(h);
    const { fetchImpl, recorded } = makeFetchMock((rec) => {
      if (rec.path.includes("/me/whop/checkout-session") && rec.method === "POST") {
        expect(JSON.parse(rec.bodyText)).toEqual({
          plan: "pro",
          return_path: "/checkout/complete",
        });
        expect(rec.headers.authorization).toMatch(/^Bearer /);
        expect(rec.headers["x-api-key"]).toBeUndefined();
        return Response.json({
          checkout_url: "https://whop.com/checkout/plan_be_pro",
          expires_at: "2026-12-01T00:00:00.000Z",
        });
      }
      return Response.json({ error: "mock_miss" }, { status: 404 });
    });
    const res = await callCheckout(
      h,
      {
        method: "POST",
        headers: {
          Origin: "https://metfix.org",
          "Sec-Fetch-Site": "same-origin",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          Cookie: cookie,
        },
        body: JSON.stringify({ plan: "pro" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      checkout_url: "https://whop.com/checkout/plan_be_pro",
      plan: "pro",
      expires_at: "2026-12-01T00:00:00.000Z",
    });
    expect(recorded.filter((r) => r.url.includes("/whop/checkout-session"))).toHaveLength(1);
  });

  it("org plan works; evil checkout_url → 502", async () => {
    const h = await createHarness();
    h.env.WHOP_CHECKOUT_LIMITER = countingLimiter(100);
    const { csrf, cookie } = await withSession(h);
    const { fetchImpl } = makeFetchMock((rec) => {
      if (rec.path.includes("/me/whop/checkout-session")) {
        expect(JSON.parse(rec.bodyText).plan).toBe("org");
        return Response.json({ checkout_url: "https://evil.example/phish" });
      }
      return Response.json({ error: "mock_miss" }, { status: 404 });
    });
    const res = await callCheckout(
      h,
      {
        method: "POST",
        headers: {
          Origin: "https://metfix.org",
          "Sec-Fetch-Site": "same-origin",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          Cookie: cookie,
        },
        body: JSON.stringify({ plan: "org", return_path: "/checkout/complete?from=billing" }),
      },
      fetchImpl,
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_error" });
  });
});
