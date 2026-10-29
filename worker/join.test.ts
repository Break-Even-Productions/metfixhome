/**
 * WJ21 / WJ22 / WT-J* worker gates for onboarding + Whop checkout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS1,
  H_OK,
  seedSession,
  setupGate,
  useGateHooks,
  type GateCtx,
} from "../tools/pr2/harness/comment-write-harness";
import {
  bsiAccountBearerHeaders,
  handleAccountOnboarding,
  handleWhopCheckoutSession,
  jsonPrivateNoStore,
  validateOnboardingBody,
} from "./join";
import type { FetchImpl, RateLimitBinding } from "./upstream";

useGateHooks();

function countingLimiter(max: number): RateLimitBinding & { calls: string[]; n: number } {
  const calls: string[] = [];
  let n = 0;
  return {
    calls,
    get n() {
      return n;
    },
    async limit({ key }) {
      calls.push(key);
      n += 1;
      return { success: n <= max };
    },
  };
}

function attachJoinLimiters(g: GateCtx, opts?: { writeMax?: number; checkoutMax?: number }) {
  const write = countingLimiter(opts?.writeMax ?? 100);
  const checkout = countingLimiter(opts?.checkoutMax ?? 100);
  (g.env as { ACCOUNT_WRITE_LIMITER?: RateLimitBinding }).ACCOUNT_WRITE_LIMITER = write;
  (g.env as { WHOP_CHECKOUT_LIMITER?: RateLimitBinding }).WHOP_CHECKOUT_LIMITER = checkout;
  return { write, checkout };
}

function privateNoStore(res: Response) {
  expect(res.headers.get("Cache-Control")).toBe("private, no-store");
}

async function callOnboarding(g: GateCtx, init: RequestInit) {
  const req = new Request("https://metfix.org/api/account/onboarding", init);
  return handleAccountOnboarding(req, g.env, {
    fetchImpl: g.fetchMock as unknown as FetchImpl,
  });
}

async function callCheckout(g: GateCtx, init: RequestInit) {
  const req = new Request("https://metfix.org/api/billing/whop/checkout-session", init);
  return handleWhopCheckoutSession(req, g.env, {
    fetchImpl: g.fetchMock as unknown as FetchImpl,
  });
}

const ONBOARD_OK = {
  first_name: "Pat",
  last_name: "Lee",
  roles: ["individual"],
  has_physical_gym: null,
  has_physical_clinic: null,
};

describe("validateOnboardingBody", () => {
  it("rejects empty roles and unknown slugs", () => {
    expect(validateOnboardingBody({ ...ONBOARD_OK, roles: [] })).toBeNull();
    expect(validateOnboardingBody({ ...ONBOARD_OK, roles: ["admin"] })).toBeNull();
    expect(
      validateOnboardingBody({
        ...ONBOARD_OK,
        first_name: "x".repeat(81),
      }),
    ).toBeNull();
  });

  it("requires boolean gym/clinic when those roles selected", () => {
    expect(
      validateOnboardingBody({
        ...ONBOARD_OK,
        roles: ["gym_owner"],
        has_physical_gym: null,
      }),
    ).toBeNull();
    expect(
      validateOnboardingBody({
        ...ONBOARD_OK,
        roles: ["gym_owner"],
        has_physical_gym: true,
      }),
    ).toMatchObject({ roles: ["gym_owner"], has_physical_gym: true });
  });
});

describe("bsiAccountBearerHeaders WT-J2", () => {
  it("never includes X-API-Key", () => {
    const h = bsiAccountBearerHeaders(ACCESS1, "application/json");
    expect(Object.keys(h).map((k) => k.toLowerCase()).sort()).toEqual([
      "accept",
      "authorization",
      "content-type",
      "user-agent",
    ]);
    expect(h.Authorization).toBe(`Bearer ${ACCESS1}`);
    expect((h as Record<string, string>)["X-API-Key"]).toBeUndefined();
  });
});

describe("WJ21 POST /api/account/onboarding", () => {
  it("off-auth-host → 403 private no-store", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const res = await handleAccountOnboarding(
      new Request("https://evil.example/api/account/onboarding", { method: "POST" }),
      g.env,
      { fetchImpl: g.fetchMock as unknown as FetchImpl },
    );
    expect(res.status).toBe(403);
    privateNoStore(res);
  });

  it("signed out → 401 unauthenticated, 0 BSI", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    g.fetchMock.mockClear();
    const res = await callOnboarding(g, {
      method: "POST",
      headers: {
        Origin: "https://metfix.org",
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify(ONBOARD_OK),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
    privateNoStore(res);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("/me/onboarding")).length,
    ).toBe(0);
  });

  it("bad CSRF / cross-site → 403, 0 BSI", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    for (const headers of [
      { ...H_OK(s), "X-CSRF-Token": "wrong" },
      { ...H_OK(s), Origin: "https://evil.com" },
      { ...H_OK(s), "Sec-Fetch-Site": "cross-site" },
    ]) {
      const res = await callOnboarding(g, {
        method: "POST",
        headers,
        body: JSON.stringify(ONBOARD_OK),
      });
      expect(res.status).toBe(403);
      privateNoStore(res);
    }
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("/me/onboarding")).length,
    ).toBe(0);
  });

  it("invalid body → 400, 0 BSI", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    const res = await callOnboarding(g, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ ...ONBOARD_OK, roles: [] }),
    });
    expect(res.status).toBe(400);
    privateNoStore(res);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length,
    ).toBe(0);
  });

  it("ok → exactly 1 Bearer-only upstream POST", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    g.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/wp-json/bsi/v1/me/onboarding")) {
        const hdrs = new Headers(init?.headers);
        const keys = [...hdrs.keys()].map((k) => k.toLowerCase()).sort();
        expect(keys).toEqual(["accept", "authorization", "content-type", "user-agent"]);
        expect(hdrs.get("Authorization")).toBe(`Bearer ${ACCESS1}`);
        expect(hdrs.get("X-API-Key")).toBeNull();
        expect(JSON.parse(String(init?.body))).toMatchObject({
          first_name: "Pat",
          roles: ["individual"],
        });
        return Response.json({ ok: true }, { status: 200 });
      }
      if (url.includes("/wp-json/bsi/v1/me")) {
        return Response.json({ id: 42, display_name: "Jane" });
      }
      return new Response("{}", { status: 404 });
    });
    const res = await callOnboarding(g, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(ONBOARD_OK),
    });
    expect(res.status).toBe(200);
    privateNoStore(res);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("/me/onboarding")).length,
    ).toBe(1);
  });

  it("rate limit → 429 Retry-After 60, 0 BSI", async () => {
    const g = setupGate();
    const { write } = attachJoinLimiters(g, { writeMax: 0 });
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    const res = await callOnboarding(g, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(ONBOARD_OK),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    privateNoStore(res);
    expect(write.calls.length).toBe(1);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("/me/onboarding")).length,
    ).toBe(0);
  });
});

describe("WJ22 POST /api/billing/whop/checkout-session", () => {
  it("invalid plan → 400 invalid_plan", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    const res = await callCheckout(g, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ plan: "society" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_plan" });
    privateNoStore(res);
  });

  it("invalid return_path → 400", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    for (const return_path of ["//evil.com", "https://evil.com"]) {
      const res = await callCheckout(g, {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ plan: "pro", return_path }),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_return_path" });
      privateNoStore(res);
    }
  });

  it("ok pro → checkout_url allowlisted; Bearer-only", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    g.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/me/whop/checkout-session")) {
        const hdrs = new Headers(init?.headers);
        expect(hdrs.get("X-API-Key")).toBeNull();
        expect(hdrs.get("Authorization")).toMatch(/^Bearer /);
        expect(JSON.parse(String(init?.body))).toEqual({ plan: "pro" });
        return Response.json({
          checkout_url: "https://whop.com/c/bep-pro",
          expires_at: "2026-11-01T00:00:00Z",
        });
      }
      if (url.includes("/wp-json/bsi/v1/me")) {
        return Response.json({ id: 42, display_name: "Jane" });
      }
      return new Response("{}", { status: 404 });
    });
    const res = await callCheckout(g, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ plan: "pro" }),
    });
    expect(res.status).toBe(200);
    privateNoStore(res);
    expect(await res.json()).toEqual({
      checkout_url: "https://whop.com/c/bep-pro",
      expires_at: "2026-11-01T00:00:00Z",
    });
  });

  it("tampered/evil checkout_url → 502 upstream_error (WT-J4)", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    const evil = [
      "http://whop.com/x",
      "https://evilwhop.com",
      "https://whop.com.evil.io",
      "https://u:p@whop.com",
      "https://curie.whop.com/x",
      "javascript:alert(1)",
    ];
    for (const checkout_url of evil) {
      g.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/me/whop/checkout-session")) {
          return Response.json({ checkout_url });
        }
        if (url.includes("/wp-json/bsi/v1/me")) {
          return Response.json({ id: 42, display_name: "Jane" });
        }
        return new Response("{}", { status: 404 });
      });
      const res = await callCheckout(g, {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ plan: "org" }),
      });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "upstream_error" });
      privateNoStore(res);
    }
  });

  it("checkout rate limit → 429", async () => {
    const g = setupGate();
    attachJoinLimiters(g, { checkoutMax: 0 });
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    const res = await callCheckout(g, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ plan: "pro" }),
    });
    expect(res.status).toBe(429);
    privateNoStore(res);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("checkout-session")).length,
    ).toBe(0);
  });
});

describe("jsonPrivateNoStore helper", () => {
  it("always sets private, no-store", () => {
    const res = jsonPrivateNoStore({ error: "x" }, 400);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

void beforeEach;
void afterEach;
void vi;
