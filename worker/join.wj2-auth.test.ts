/**
 * WJ2 (r1.1): AuthScreen-built bodies through real Worker login/signup handlers.
 * Only Google reCAPTCHA siteverify is stubbed — no mocked fetch between client body and handler.
 */
import { describe, expect, it } from "vitest";
import {
  LOGIN_BODY_KEYS,
  SIGNUP_BODY_KEYS,
  buildLoginBody,
  buildSignupBody,
} from "../shared/join";
import {
  IP,
  ORIGIN,
  PW,
  TOK,
  createHarness,
  setupAuthHooks,
} from "../tools/pr2/harness/realauth-harness";

setupAuthHooks();

const AUTH_HEADERS = (csrf: string, cookie: string) => ({
  Origin: ORIGIN,
  "Sec-Fetch-Site": "same-origin",
  "Content-Type": "application/json",
  "X-CSRF-Token": csrf,
  "CF-Connecting-IP": IP,
  Cookie: cookie,
});

describe("WJ2 AuthScreen body ↔ real Worker handlers (r1.1)", () => {
  it("login: buildLoginBody posts through handleLogin; siteverify receives recaptcha token", async () => {
    const h = createHarness();
    const { csrf, setCookie } = await h.csrf();
    const cookie = setCookie?.split(";")[0] ?? "";
    const body = buildLoginBody({
      identifier: "jane",
      password: PW,
      recaptcha: TOK,
    });
    expect(Object.keys(body).sort()).toEqual([...LOGIN_BODY_KEYS].sort());
    expect(body).not.toHaveProperty("recaptcha_token");

    const beforeBsi = h.fetches.filter(
      (f) => f.url.includes("/oauth/token") || f.url.includes("/wp-json/bsi"),
    ).length;

    const res = await h.call("/api/auth/login", {
      method: "POST",
      headers: AUTH_HEADERS(csrf, cookie),
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ signed_in: true });

    const sv = h.siteverifyCalls.at(-1);
    expect(sv).toBeTruthy();
    const form = new URLSearchParams(sv!.bodyText);
    expect(form.get("response")).toBe(TOK);

    const bsiAfter = h.fetches.filter(
      (f) => f.url.includes("/oauth/token") || f.url.includes("/wp-json/bsi"),
    );
    expect(bsiAfter.length).toBeGreaterThan(beforeBsi);
  });

  it("login wrong field recaptcha_token → captcha failure, 0 BSI auth calls", async () => {
    const h = createHarness();
    const { csrf, setCookie } = await h.csrf();
    const cookie = setCookie?.split(";")[0] ?? "";
    const before = h.fetches.filter(
      (f) =>
        f.url.includes("/oauth/token") ||
        f.url.includes("/wp-json/bsi") ||
        f.url.includes("register-direct"),
    ).length;

    const res = await h.call("/api/auth/login", {
      method: "POST",
      headers: AUTH_HEADERS(csrf, cookie),
      body: JSON.stringify({
        identifier: "jane",
        password: PW,
        recaptcha_token: TOK,
      }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "try_again" });
    const after = h.fetches.filter(
      (f) =>
        f.url.includes("/oauth/token") ||
        f.url.includes("/wp-json/bsi") ||
        f.url.includes("register-direct"),
    ).length;
    expect(after).toBe(before);
  });

  it("signup: buildSignupBody through handleSignup; siteverify receives token", async () => {
    const h = createHarness();
    const { csrf, setCookie } = await h.csrf();
    const cookie = setCookie?.split(";")[0] ?? "";
    const body = buildSignupBody({
      username: "patlee",
      email: "pat@example.com",
      recaptcha: TOK,
    });
    expect(Object.keys(body).sort()).toEqual([...SIGNUP_BODY_KEYS].sort());
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("recaptcha_token");

    const res = await h.call("/api/auth/signup", {
      method: "POST",
      headers: AUTH_HEADERS(csrf, cookie),
      body: JSON.stringify(body),
    });

    expect([200, 202]).toContain(res.status);
    const sv = h.siteverifyCalls.at(-1);
    expect(sv).toBeTruthy();
    const form = new URLSearchParams(sv!.bodyText);
    expect(form.get("response")).toBe(TOK);
    expect(
      h.fetches.some((f) => f.url.includes("register-direct") || f.url.includes("/register")),
    ).toBe(true);
  });

  it("signup wrong field recaptcha_token → invalid/captcha, 0 BSI register calls", async () => {
    const h = createHarness();
    const { csrf, setCookie } = await h.csrf();
    const cookie = setCookie?.split(";")[0] ?? "";
    const before = h.fetches.filter(
      (f) => f.url.includes("register-direct") || f.url.includes("/check-username"),
    ).length;

    const res = await h.call("/api/auth/signup", {
      method: "POST",
      headers: AUTH_HEADERS(csrf, cookie),
      body: JSON.stringify({
        username: "patlee",
        email: "pat@example.com",
        password: "ignored",
        recaptcha_token: TOK,
      }),
    });

    expect([400, 403]).toContain(res.status);
    const after = h.fetches.filter(
      (f) => f.url.includes("register-direct") || f.url.includes("/check-username"),
    ).length;
    expect(after).toBe(before);
  });

  it("AuthScreen Google start uses Worker `return` query (not return_to)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "client/src/join/screens/AuthScreen.tsx"), "utf8");
    expect(src).toMatch(/\/api\/auth\/google\/start\?return=/);
    expect(src).not.toMatch(/return_to=/);
    expect(src).toMatch(/buildLoginBody|buildSignupBody/);
  });
});
