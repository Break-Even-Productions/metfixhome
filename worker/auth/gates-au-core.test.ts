import { describe, expect, it } from "vitest";
import {
  ACCESS1,
  CID,
  ENCKEY,
  ORIGIN,
  REFRESH1,
  createHarness,
  csrfSid,
  hOk,
  leakFree,
  sessKvKey,
  sessionBlob,
  setupAuthHooks,
  sidHex,
} from "./realauth-harness";
import { encryptSessionPayload } from "./crypto";
import { sessionAad } from "./session";

setupAuthHooks();

describe("AU4", () => {
  it("AU4.1 sid cookie shape", async () => {
    const { res } = await createHarness().login();
    const sc = res.headers.get("Set-Cookie") ?? "";
    expect(sc).toMatch(/Max-Age=2592000/);
    expect(sc).not.toContain("Domain=");
  });

  it("AU4.2 csrf pre and body", async () => {
    const h = createHarness();
    const a = await h.csrf();
    expect(a.setCookie).toContain("__Host-mfx_pre=");
    const res = await h.call("/api/auth/csrf");
    expect(Object.keys(await res.json()).sort()).toStrictEqual(["csrf"]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("AU8", () => {
  it("AU8.1 logout 204 revoke", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    const token = await csrfSid(h.env, sid);
    const hex = await sidHex(sid);
    const res = await h.call("/api/auth/logout", { method: "POST", headers: hOk({ sid, csrf: token }) });
    expect(res.status).toBe(204);
    expect(await h.kv.get(sessKvKey(hex))).toBeNull();
    const revoke = h.fetches.find((f) => f.url.includes("/oauth/revoke"))!;
    expect(JSON.parse(revoke.bodyText)).toStrictEqual({ client_id: CID, refresh_token: REFRESH1 });
  });

  it("AU8.3 logout no session", async () => {
    const h = createHarness();
    const { csrf: token, setCookie } = await h.csrf();
    const res = await h.call("/api/auth/logout", {
      method: "POST",
      headers: { Origin: ORIGIN, "X-CSRF-Token": token, Cookie: setCookie?.split(";")[0] ?? "" },
    });
    expect(res.status).toBe(204);
  });

  it("AU8.4 old sid me signed out", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    const token = await csrfSid(h.env, sid);
    await h.call("/api/auth/logout", { method: "POST", headers: hOk({ sid, csrf: token }) });
    const me = await h.call("/api/auth/me", { headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` } });
    expect(me.status).toBe(401);
    expect(await me.json()).toStrictEqual({ error: "signed_out" });
  });
});

describe("AU21", () => {
  it("AU21.1 me signed in", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    const res = await h.call("/api/auth/me", { headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` } });
    const text = await res.clone().text();
    expect(JSON.parse(text)).toStrictEqual({ signed_in: true, public_name: "Jane" });
    leakFree(text);
  });

  it("AU21.3 no cookie", async () => {
    const h = createHarness();
    const g0 = h.kv.gets.length;
    expect(await (await h.call("/api/auth/me")).json()).toStrictEqual({ signed_in: false });
    expect(h.kv.gets.length).toBe(g0);
  });

  it("AU21.2 bad cookie 401", async () => {
    const h = createHarness();
    const res = await h.call("/api/auth/me", {
      headers: { Cookie: "__Host-mfx_sid=not_a_real_session___________________" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({ error: "signed_out" });
  });
});

describe("AU5", () => {
  it("AU5.1 sess key hex", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    expect(h.kv.puts[0]!.key).toBe(sessKvKey(await sidHex(sid)));
  });

  it("AU5.3 TTL 60 alarm", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    expect(h.kv.puts[0]!.options?.expirationTtl).toBe(60);
    expect(h.sessionNs.getAlarm(sessionAad(await sidHex(sid)))).not.toBeNull();
  });

  it("AU5.2 encrypted blob", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    const blob = (await sessionBlob(h, sid))?.blob ?? "";
    expect(blob).toMatch(/^v1\./);
    expect(blob).not.toContain(ACCESS1);
  });
});

describe("ENC", () => {
  it("ENC.T1 unique ciphertext", async () => {
    const aad = "sess:aa";
    const c1 = await encryptSessionPayload("{}", aad, ENCKEY);
    const c2 = await encryptSessionPayload("{}", aad, ENCKEY);
    expect(c1).not.toBe(c2);
  });
});

describe("AU16", () => {
  it("AU16.1 invalid_login", async () => {
    const h = createHarness({
      webLogin: () => Response.json({ code: "invalid_credentials" }, { status: 401 }),
    });
    const { csrf: token, setCookie } = await h.csrf();
    const res = await h.call("/api/auth/login", {
      method: "POST",
      headers: { Origin: ORIGIN, "X-CSRF-Token": token, Cookie: setCookie?.split(";")[0] ?? "" },
      body: JSON.stringify({ identifier: "j", password: "p", recaptcha: "t" }),
    });
    expect(await res.json()).toStrictEqual({ error: "invalid_login" });
  });
});

describe("AU23", () => {
  it("AU23.2 leaderboard signed out", async () => {
    const h = createHarness();
    const n = h.fetches.length;
    const res = await h.call("/api/daily-fix/leaderboard?date=2025-02-10&type=brain&daily_workout_id=1");
    expect(res.status).toBe(401);
    expect(h.fetches.length).toBe(n);
  });
});
