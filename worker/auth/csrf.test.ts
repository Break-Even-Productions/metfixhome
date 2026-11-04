import { describe, expect, it } from "vitest";
import { PRE_COOKIE, SID_COOKIE } from "./cookies";
import { csrfForPre, csrfForSid } from "./crypto";
import { handleCsrf } from "./csrf";
import type { Env } from "../upstream";

const SECRET = "csrf-secret-test";
const ENV = { CSRF_SECRET: SECRET } as Env;
const SID = "sid_QA_SIGNED_IN";
const PRE = "pre_QA_SIGNED_OUT";

function csrfRequest(cookie?: string): Request {
  const headers = new Headers({ Host: "metfix.org" });
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://metfix.org/api/auth/csrf", { headers });
}

function cookiePair(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}`;
}

describe("GET /api/auth/csrf token binding", () => {
  it("returns the sid token and does not mint a pre cookie when the sid cookie is present", async () => {
    const sidOnly = await handleCsrf(csrfRequest(cookiePair(SID_COOKIE, SID)), ENV);
    expect(sidOnly.status).toBe(200);
    expect(await sidOnly.json()).toEqual({ csrf: await csrfForSid(SECRET, SID) });
    expect(sidOnly.headers.get("Set-Cookie")).toBeNull();

    const sidAndPre = await handleCsrf(
      csrfRequest(`${cookiePair(SID_COOKIE, SID)}; ${cookiePair(PRE_COOKIE, PRE)}`),
      ENV,
    );
    const body = (await sidAndPre.json()) as { csrf: string };
    expect(body).toEqual({ csrf: await csrfForSid(SECRET, SID) });
    expect(body.csrf).not.toBe(await csrfForPre(SECRET, PRE));
    expect(sidAndPre.headers.get("Set-Cookie")).toBeNull();
  });

  it("returns the pre token when there is no sid cookie", async () => {
    const existing = await handleCsrf(csrfRequest(cookiePair(PRE_COOKIE, PRE)), ENV);
    expect(existing.status).toBe(200);
    expect(await existing.json()).toEqual({ csrf: await csrfForPre(SECRET, PRE) });
    expect(existing.headers.get("Set-Cookie")).toBeNull();

    const minted = await handleCsrf(csrfRequest(), ENV);
    expect(minted.status).toBe(200);
    const setCookie = minted.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain(`${PRE_COOKIE}=`);
    const match = setCookie.match(/__Host-mfx_pre=([^;]+)/);
    expect(match).toBeTruthy();
    const pre = decodeURIComponent(match![1]!);
    expect(await minted.json()).toEqual({ csrf: await csrfForPre(SECRET, pre) });
  });
});
