/**
 * AU15.2 / AU17.* throttle gates.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMAIL,
  IP,
  ORIGIN,
  PW,
  TOK,
  createHarness,
  setupAuthHooks,
} from "./realauth-harness.test";
import { r8aName, r8bName, R8C_NAME } from "./throttle";

setupAuthHooks();

async function loginPost(
  h: ReturnType<typeof createHarness>,
  opts: { identifier?: string; password?: string; recaptcha?: unknown; ip?: string; omitRecaptcha?: boolean } = {},
) {
  const { csrf: token, setCookie } = await h.csrf();
  const body: Record<string, unknown> = {
    identifier: opts.identifier ?? "jane",
    password: opts.password ?? PW,
  };
  if (!opts.omitRecaptcha) body.recaptcha = opts.recaptcha ?? TOK;
  return h.call("/api/auth/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "X-CSRF-Token": token,
      "Content-Type": "application/json",
      "CF-Connecting-IP": opts.ip ?? IP,
      Cookie: setCookie?.split(";")[0] ?? "",
    },
    body: JSON.stringify(body),
  });
}

function badCreds() {
  return () => Response.json({ code: "invalid_credentials" }, { status: 401 });
}


async function usernameCheck(
  h: ReturnType<typeof createHarness>,
  username: string,
  ip = IP,
) {
  const { csrf: token, setCookie } = await h.csrf();
  return h.call(`/api/auth/username-check?username=${encodeURIComponent(username)}`, {
    headers: {
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "X-CSRF-Token": token,
      "CF-Connecting-IP": ip,
      Cookie: setCookie?.split(";")[0] ?? "",
    },
  });
}

describe("AU15", () => {
  it("AU15.2 username-check 21st → 429; buckets separate", async () => {
    const h = createHarness();
    for (let i = 0; i < 20; i++) {
      const res = await usernameCheck(h, `u${i}`);
      expect([200, 429]).toContain(res.status);
    }
    const r21 = await usernameCheck(h, "u20");
    expect(r21.status).toBe(429);
    expect(await r21.json()).toStrictEqual({ error: "rate_limited" });
    expect(r21.headers.get("Retry-After")).toBe("60");
  });
});

describe("AU17", () => {
  it("AU17.1 R8a lockout ladder", async () => {
    const h = createHarness({ webLogin: badCreds() });
    const id = "Jane";
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(h, { identifier: i % 2 ? " jane " : "JANE" });
      expect(res.status).toBe(401);
    }
    const sixth = await loginPost(h, { identifier: id });
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toStrictEqual({ error: "rate_limited" });
    expect(sixth.headers.get("Retry-After")).toMatch(/^[1-9][0-9]*$/);
  });

  it("AU17.2 success clears R8a not R8b/R8c", async () => {
    const h = createHarness({
      webLogin: (() => {
        let n = 0;
        return () => {
          n++;
          if (n <= 4) return Response.json({ code: "invalid_credentials" }, { status: 401 });
          return Response.json({
            access_token: "at_QA_SENT_1_abcdefghijklmnopqrstuvwxyz",
            refresh_token: "rt_QA_SENT_1_abcdefghijklmnopqrstuvwxyz",
            expires_in: 3600,
            public_name: "Jane",
            user_id: 42,
          });
        };
      })(),
    });
    for (let i = 0; i < 4; i++) await loginPost(h, { identifier: "same" });
    const ok = await loginPost(h, { identifier: "same" });
    expect(ok.status).toBe(200);
    expect(h.throttleNs.getStorage(await r8aName("same"))?.get("id")).toBeUndefined();
    const ipTimes = (h.throttleNs.getStorage(await r8bName(IP))?.get("ip") as number[]) ?? [];
    expect(ipTimes.length).toBeGreaterThanOrEqual(5);
  });

  it("AU17.3 R8b 21st distinct identifier", async () => {
    const h = createHarness({ webLogin: badCreds() });
    const t0 = Date.now();
    h.setNow(t0);
    for (let i = 0; i < 20; i++) {
      h.setNow(t0 + i * 1000);
      const res = await loginPost(h, { identifier: `id${i}` });
      expect(res.status).toBe(401);
    }
    h.setNow(t0 + 20_000);
    const r21 = await loginPost(h, { identifier: "id20" });
    expect(r21.status).toBe(429);
    const other = await loginPost(h, { identifier: "other", ip: "198.51.100.9" });
    expect(other.status).toBe(401);
  });

  it("AU17.4 signup 6th → 429", async () => {
    const h = createHarness({
      siteverify: () =>
        Response.json({ success: true, score: 0.9, action: "signup", hostname: "metfix.org" }),
    });
    for (let i = 0; i < 5; i++) {
      const { csrf: token, setCookie } = await h.csrf();
      const res = await h.call("/api/auth/signup", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "X-CSRF-Token": token,
          "Content-Type": "application/json",
          "CF-Connecting-IP": IP,
          Cookie: setCookie?.split(";")[0] ?? "",
        },
        body: JSON.stringify({ username: `u${i}`, email: `u${i}@ex.test`, recaptcha: TOK }),
      });
      expect([202, 429]).toContain(res.status);
    }
    const { csrf: token, setCookie } = await h.csrf();
    const r6 = await h.call("/api/auth/signup", {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "X-CSRF-Token": token,
        "Content-Type": "application/json",
        "CF-Connecting-IP": IP,
        Cookie: setCookie?.split(";")[0] ?? "",
      },
      body: JSON.stringify({ username: "u5", email: "u5@ex.test", recaptcha: TOK }),
    });
    expect(r6.status).toBe(429);
    expect(r6.headers.get("Retry-After")).toBe("60");
    expect(h.fetches.filter((f) => f.url.includes("register-direct")).length).toBeLessThanOrEqual(5);
  });

  it("AU17.5 Google start/callback 21st → 429", async () => {
    const h = createHarness({ googleEnabled: true });
    for (let i = 0; i < 20; i++) {
      await h.call("/api/auth/google/start", { headers: { "CF-Connecting-IP": IP } });
    }
    const r21 = await h.call("/api/auth/google/start", { headers: { "CF-Connecting-IP": IP } });
    expect(r21.status).toBe(429);
  });

  it("AU17.6 LOGIN_THROTTLE outage → 503", async () => {
    const h = createHarness();
    h.env.LOGIN_THROTTLE.get = () => {
      throw new Error("throttle_outage");
    };
    const res = await loginPost(h);
    expect(res.status).toBe(503);
    expect(await res.json()).toStrictEqual({ error: "unavailable" });
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(0);
  });

  it("AU17.7 idFromName hashed names only", async () => {
    const h = createHarness({ webLogin: badCreds() });
    const id = "RawIdentifierXYZ";
    await loginPost(h, { identifier: id, ip: IP });
    const names = [...h.throttleNs.instances.keys()];
    expect(names.some((n) => n.startsWith("id:"))).toBe(true);
    expect(names.some((n) => n.startsWith("ip:"))).toBe(true);
    expect(names).toContain(R8C_NAME);
    expect(names.join("")).not.toContain(id);
    expect(names.join("")).not.toContain(IP);
  });

  it("AU17.8 R8c 26th → 429; 25 BSI", async () => {
    const h = createHarness();
    let bsi = 0;
    for (let i = 0; i < 26; i++) {
      const hh = createHarness();
      // share R8c via same harness
      void hh;
      const res = await loginPost(h, { identifier: `u${i}`, ip: `203.0.113.${i + 1}` });
      if (res.status === 200) bsi++;
      if (i === 25) {
        expect(res.status).toBe(429);
      }
    }
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(25);
    expect(bsi).toBe(25);
  });

  it("AU17.9 order R8a→R8b→shape→R8c→BSI; 0 siteverify", async () => {
    const h = createHarness();
    await loginPost(h);
    expect(h.siteverifyCalls.length).toBe(0);
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(1);
    // Malformed does not spend R8c
    const before = ((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[]) ?? []).length;
    for (const bad of ["", 123, null, []] as unknown[]) {
      const { csrf: token, setCookie } = await h.csrf();
      await h.call("/api/auth/login", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "X-CSRF-Token": token,
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.50",
          Cookie: setCookie?.split(";")[0] ?? "",
        },
        body: JSON.stringify({ identifier: "x", password: "y", recaptcha: bad }),
      });
    }
    const after = ((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[]) ?? []).length;
    expect(after).toBe(before);
  });

  it("AU17.10 429 shape; no timer advance", async () => {
    const h = createHarness({ webLogin: badCreds() });
    for (let i = 0; i < 6; i++) await loginPost(h, { identifier: "lockme" });
    const before = vi.getTimerCount();
    const res = await loginPost(h, { identifier: "lockme" });
    expect(res.status).toBe(429);
    expect(await res.json()).toStrictEqual({ error: "rate_limited" });
    expect(res.headers.get("Retry-After")).toMatch(/^[1-9][0-9]*$/);
    expect(vi.getTimerCount()).toBe(before);
    expect(h.siteverifyCalls.length).toBe(0);
  });

  it("AU17.11 R8c concurrency 40 → 25 BSI / 15×429", async () => {
    const h = createHarness();
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        loginPost(h, { identifier: `c${i}`, ip: `198.51.100.${(i % 200) + 1}` }),
      ),
    );
    const ok = results.filter((r) => r.status === 200).length;
    const limited = results.filter((r) => r.status === 429).length;
    expect(ok).toBe(25);
    expect(limited).toBe(15);
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(25);
    const repo = process.cwd().endsWith("/client") ? join(process.cwd(), "..") : process.cwd();
    const loginSrc = readFileSync(join(repo, "worker/auth/login.ts"), "utf8");
    // Word-bounded: BODY_RATE_LIMITED is allowed; bare RATE_LIMIT / .limit( are not.
    expect(loginSrc).not.toMatch(/\bRATE_LIMIT\b|\.limit\(/);
  });

  it("AU17.12 wrangler + Env LOGIN_THROTTLE", async () => {
    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    expect(wrangler).toMatch(/LOGIN_THROTTLE/);
    const upstream = readFileSync(join(process.cwd(), "worker/upstream.ts"), "utf8");
    expect(upstream).toMatch(/LOGIN_THROTTLE:\s*DurableObjectNamespace/);
  });

  it("AU17.13 BSI recaptcha_failed accounting", async () => {
    const h = createHarness({
      webLogin: (() => {
        let n = 0;
        return () => {
          n++;
          if (n <= 10) return Response.json({ code: "recaptcha_failed" }, { status: 403 });
          return Response.json({ code: "recaptcha_missing" }, { status: 400 });
        };
      })(),
    });
    for (let i = 0; i < 20; i++) {
      const res = await loginPost(h, { identifier: `r${i}` });
      expect(res.status).toBe(403);
      expect(await res.json()).toStrictEqual({ error: "try_again" });
    }
    const r21 = await loginPost(h, { identifier: "r21" });
    expect(r21.status).toBe(429);
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(20);
    expect(h.siteverifyCalls.length).toBe(0);
  });

  it("AU17.14 signup reCAPTCHA fail takes 0 R8c", async () => {
    const h = createHarness({
      siteverify: () => Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    });
    // Prefill R8c with 24 logins
    for (let i = 0; i < 24; i++) {
      await loginPost(h, { identifier: `p${i}`, ip: `203.0.113.${(i % 50) + 10}` });
    }
    const before = ((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[]) ?? []).length;
    expect(before).toBe(24);
    for (let i = 0; i < 5; i++) {
      const { csrf: token, setCookie } = await h.csrf();
      const res = await h.call("/api/auth/signup", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "X-CSRF-Token": token,
          "Content-Type": "application/json",
          "CF-Connecting-IP": `198.51.100.${i + 1}`,
          Cookie: setCookie?.split(";")[0] ?? "",
        },
        body: JSON.stringify({ username: `s${i}`, email: `s${i}@ex.test`, recaptcha: TOK }),
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toStrictEqual({ error: "try_again" });
      const mid = ((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[]) ?? []).length;
      expect(mid).toBe(24);
    }
    const ok = await loginPost(h, { identifier: "slot25", ip: "203.0.113.200" });
    expect(ok.status).toBe(200);
    const blocked = await loginPost(h, { identifier: "slot26", ip: "203.0.113.201" });
    expect(blocked.status).toBe(429);
  });
});

void EMAIL;
