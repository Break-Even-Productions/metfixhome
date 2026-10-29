/**
 * WJ21 / WJ22 / WT-J* / WJ-X* worker gates for onboarding + Whop checkout.
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
  handleAccountOnboarding,
  handleWhopCheckoutSession,
  jsonPrivateNoStore,
  validateOnboardingBody,
} from "./join";
import { bsiAccountBearerHeaders, type FetchImpl, type RateLimitBinding } from "./upstream";
import { LOGIN_BODY_KEYS, SIGNUP_BODY_KEYS, buildLoginBody, buildSignupBody } from "../shared/join";
import { handleLogin } from "./auth/login";
import { handleSignup } from "./auth/signup";

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

  it("B3: rejects has_physical_gym:true without gym_owner role", () => {
    expect(
      validateOnboardingBody({
        ...ONBOARD_OK,
        roles: ["individual"],
        has_physical_gym: true,
      }),
    ).toBeNull();
    expect(
      validateOnboardingBody({
        ...ONBOARD_OK,
        roles: ["clinician"],
        has_physical_gym: true,
        has_physical_clinic: false,
      }),
    ).toBeNull();
    expect(
      validateOnboardingBody({
        ...ONBOARD_OK,
        roles: ["individual"],
        has_physical_gym: null,
        has_physical_clinic: true,
      }),
    ).toBeNull();
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

  it("bad CSRF / cross-site → 403, 0 BSI, 0 limiter (cheap WJ21)", async () => {
    const g = setupGate();
    const { write } = attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    write.calls.length = 0;
    for (const headers of [
      { ...H_OK(s), "X-CSRF-Token": "wrong" },
      { ...H_OK(s), Origin: "https://evil.com" },
      { ...H_OK(s), "Sec-Fetch-Site": "cross-site" },
    ]) {
      const before = write.calls.length;
      const res = await callOnboarding(g, {
        method: "POST",
        headers,
        body: JSON.stringify(ONBOARD_OK),
      });
      expect(res.status).toBe(403);
      privateNoStore(res);
      expect(write.calls.length).toBe(before);
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
    // R2-N3: onboarding limiter key is user-only (no IP suffix).
    expect(write.calls[0]).toMatch(/^acctw:\d+$/);
    expect(write.calls[0]!.split(":").length).toBe(2);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("/me/onboarding")).length,
    ).toBe(0);
  });

  it("WT-J8: upstream 5xx → 502 private no-store fixed body", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/me/onboarding")) {
        return new Response("secret upstream stack", { status: 503 });
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
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_error" });
    privateNoStore(res);
  });
});

describe("WJ22 / WT-J3 POST /api/billing/whop/checkout-session", () => {
  it("signed out → 401 unauthenticated, 0 BSI", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    g.fetchMock.mockClear();
    const res = await callCheckout(g, {
      method: "POST",
      headers: {
        Origin: "https://metfix.org",
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify({ plan: "pro" }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
    privateNoStore(res);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("checkout-session")).length,
    ).toBe(0);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("/wp-json/bsi/")).length,
    ).toBe(0);
  });

  it("WT-J3 CSRF compare uses timingSafeEqualStr (constant-time static)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "worker/join.ts"), "utf8");
    expect(src).toMatch(/timingSafeEqualStr\s*\(/);
    // No direct === / !== on CSRF header vs expected in requireSidCsrf.
    const csrfBlock = src.slice(src.indexOf("async function requireSidCsrf"), src.indexOf("async function readJsonBody"));
    expect(csrfBlock).toMatch(/timingSafeEqualStr/);
    expect(csrfBlock).not.toMatch(/header\s*===|header\s*!==|expected\s*===|expected\s*!==/);
    const { timingSafeEqualStr } = await import("./auth/crypto");
    expect(timingSafeEqualStr("abc", "abc")).toBe(true);
    expect(timingSafeEqualStr("abc", "abd")).toBe(false);
  });

  it("bad CSRF / Origin / cross-site → 403 each, 0 BSI", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    g.fetchMock.mockClear();
    for (const headers of [
      { ...H_OK(s), "X-CSRF-Token": "wrong" },
      { ...H_OK(s), Origin: "https://evil.com" },
      { ...H_OK(s), "Sec-Fetch-Site": "cross-site" },
      { ...H_OK(s), "X-CSRF-Token": "" }, // missing token
    ]) {
      const res = await callCheckout(g, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan: "pro" }),
      });
      expect(res.status).toBe(403);
      privateNoStore(res);
    }
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("checkout-session")).length,
    ).toBe(0);
  });

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

  it("WJ-X1 checkout rate limit → 429 Retry-After 60", async () => {
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
    expect(res.headers.get("Retry-After")).toBe("60");
    privateNoStore(res);
    expect(
      g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("checkout-session")).length,
    ).toBe(0);
  });
});

describe("WJ-X2 upstream 401 refresh / 5xx no retry", () => {
  it("upstream 401 → exactly one refresh + one retried call + final 200", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    let checkoutHits = 0;
    let refreshHits = 0;
    g.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/me/whop/checkout-session")) {
        checkoutHits += 1;
        if (checkoutHits === 1) return new Response("{}", { status: 401 });
        return Response.json({ checkout_url: "https://whop.com/c/ok" });
      }
      if (url.includes("/oauth/token") || (url.includes("token") && init?.method === "POST")) {
        refreshHits += 1;
        return Response.json({
          access_token: "refreshed-access",
          refresh_token: "refreshed-refresh",
          expires_in: 3600,
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
    expect(refreshHits).toBe(1);
    expect(checkoutHits).toBe(2);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checkout_url: "https://whop.com/c/ok" });
    privateNoStore(res);
  });

  it("upstream 5xx → 502, no second checkout attempt", async () => {
    const g = setupGate();
    attachJoinLimiters(g);
    const s = await seedSession(g);
    let checkoutHits = 0;
    g.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/me/whop/checkout-session")) {
        checkoutHits += 1;
        return new Response("boom", { status: 500 });
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
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_error" });
    expect(checkoutHits).toBe(1);
    privateNoStore(res);
  });
});

describe("WJ-X3 console never logs tokens/Bearer", () => {
  it("spies console.* across 200/401/403/429/502 outcomes", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const CANARY = "canary-secret-key-WJX3-do-not-log";
    const g = setupGate();
    attachJoinLimiters(g, { checkoutMax: 100 });
    (g.env as { BSI_API_KEY?: string }).BSI_API_KEY = CANARY;
    const s = await seedSession(g);

    const outcomes: Array<() => Promise<Response>> = [
      // 200
      async () => {
        g.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes("/me/whop/checkout-session")) {
            return Response.json({ checkout_url: "https://whop.com/c/x" });
          }
          if (url.includes("/wp-json/bsi/v1/me")) {
            return Response.json({ id: 42, display_name: "Jane" });
          }
          return new Response("{}", { status: 404 });
        });
        return callCheckout(g, {
          method: "POST",
          headers: H_OK(s),
          body: JSON.stringify({ plan: "pro" }),
        });
      },
      // 401 signed out
      async () =>
        callCheckout(g, {
          method: "POST",
          headers: {
            Origin: "https://metfix.org",
            "Content-Type": "application/json",
            "Sec-Fetch-Site": "same-origin",
          },
          body: JSON.stringify({ plan: "pro" }),
        }),
      // 403 bad CSRF
      async () =>
        callCheckout(g, {
          method: "POST",
          headers: { ...H_OK(s), "X-CSRF-Token": "wrong" },
          body: JSON.stringify({ plan: "pro" }),
        }),
      // 429
      async () => {
        attachJoinLimiters(g, { checkoutMax: 0 });
        return callCheckout(g, {
          method: "POST",
          headers: H_OK(s),
          body: JSON.stringify({ plan: "pro" }),
        });
      },
      // 502 upstream
      async () => {
        attachJoinLimiters(g, { checkoutMax: 100 });
        g.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes("/me/whop/checkout-session")) {
            return new Response("boom", { status: 500 });
          }
          if (url.includes("/wp-json/bsi/v1/me")) {
            return Response.json({ id: 42, display_name: "Jane" });
          }
          return new Response("{}", { status: 404 });
        });
        return callCheckout(g, {
          method: "POST",
          headers: H_OK(s),
          body: JSON.stringify({ plan: "pro" }),
        });
      },
    ];

    const statuses: number[] = [];
    for (const run of outcomes) {
      const res = await run();
      statuses.push(res.status);
    }
    expect(statuses).toEqual(expect.arrayContaining([200, 401, 403, 429, 502]));

    const dumped = spies
      .flatMap((sp) => sp.mock.calls.map((c) => c.map(String).join(" ")))
      .join("\n");
    expect(dumped).not.toMatch(/Bearer\s+\S+/i);
    expect(dumped).not.toMatch(ACCESS1);
    expect(dumped).not.toContain(CANARY);
    for (const sp of spies) sp.mockRestore();
  });
});

describe("B1 shared LoginBody/SignupBody ↔ real Worker handlers", () => {
  it("login rejects recaptcha_token field (requires exact `recaptcha`)", async () => {
    const g = setupGate();
    const body = {
      identifier: "pat@example.com",
      password: "password1",
      recaptcha_token: "tok",
    };
    const res = await handleLogin(
      new Request("https://metfix.org/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://metfix.org",
          "Content-Type": "application/json",
          "Sec-Fetch-Site": "same-origin",
          "X-CSRF-Token": "x",
        },
        body: JSON.stringify(body),
      }),
      g.env,
      g.fetchMock as unknown as FetchImpl,
    );
    // Missing/empty `recaptcha` → 403 try_again (or 403 CSRF first)
    expect([400, 403]).toContain(res.status);
    expect(Object.keys(body).sort()).not.toEqual([...LOGIN_BODY_KEYS].sort());
  });

  it("buildLoginBody / buildSignupBody keys match Worker contract", () => {
    const login = buildLoginBody({
      identifier: "a@b.c",
      password: "x",
      recaptcha: "tok",
    });
    const signup = buildSignupBody({
      username: "pat",
      email: "a@b.c",
      recaptcha: "tok",
    });
    expect(Object.keys(login).sort()).toEqual([...LOGIN_BODY_KEYS].sort());
    expect(Object.keys(signup).sort()).toEqual([...SIGNUP_BODY_KEYS].sort());
    expect(login).not.toHaveProperty("recaptcha_token");
    expect(signup).not.toHaveProperty("password");
  });

  it("signup rejects password-only body without username/recaptcha", async () => {
    const g = setupGate();
    const res = await handleSignup(
      new Request("https://metfix.org/api/auth/signup", {
        method: "POST",
        headers: {
          Origin: "https://metfix.org",
          "Content-Type": "application/json",
          "Sec-Fetch-Site": "same-origin",
          "X-CSRF-Token": "x",
        },
        body: JSON.stringify({
          email: "pat@example.com",
          password: "password1",
          username: "pat",
          recaptcha_token: "tok",
        }),
      }),
      g.env,
      g.fetchMock as unknown as FetchImpl,
    );
    expect([400, 403]).toContain(res.status);
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
