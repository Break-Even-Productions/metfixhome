import { describe, expect, it } from "vitest";
import {
  BSI_ME_URL,
  CID,
  IP,
  KEY,
  OAUTH_TOKEN_URL,
  PW,
  SECRET_CANARY,
  TOK,
  createHarness,
  leakFree,
  sessKvKey,
  setupAuthHooks,
  sidHex,
} from "../harness/realauth-harness";

setupAuthHooks();

describe("AU2", () => {
  it("AU2.1 oauth/token + /me contract", async () => {
    const h = createHarness();
    const { res, sid } = await h.login();
    expect(res.status).toBe(200);
    expect(await res.clone().json()).toStrictEqual({ signed_in: true, public_name: "Jane" });
    expect(sid.length).toBeGreaterThan(0);

    const tokenFetches = h.fetches.filter(
      (x) => x.url.includes("/oauth/token") && !x.url.includes("/proxy/oauth/token"),
    );
    const meFetches = h.fetches.filter((x) => x.url.includes("/wp-json/bsi/v1/me"));
    expect(tokenFetches.length).toBe(1);
    expect(meFetches.length).toBe(1);
    expect(tokenFetches[0]!.url).toBe(OAUTH_TOKEN_URL);
    expect(meFetches[0]!.url).toBe(BSI_ME_URL);
    const tokenIdx = h.fetches.indexOf(tokenFetches[0]!);
    const meIdx = h.fetches.indexOf(meFetches[0]!);
    expect(tokenIdx).toBeLessThan(meIdx);

    const f = tokenFetches[0]!;
    expect(f.method).toBe("POST");
    const form = Object.fromEntries(new URLSearchParams(f.bodyText));
    expect(form).toStrictEqual({
      grant_type: "password",
      username: "jane",
      password: PW,
      client_id: CID,
      client_secret: SECRET_CANARY,
    });
    // CQ D4: client_id from env.BSI_OAUTH_CLIENT_ID, not browser body
    expect(form.client_id).toBe(h.env.BSI_OAUTH_CLIENT_ID);
    expect(Object.keys(f.headers).sort()).toStrictEqual([
      "accept",
      "content-type",
      "user-agent",
    ]);
    expect(f.headers.accept).toBe("application/json");
    expect(f.headers["user-agent"]).toBe("metfixhome-worker/1.0");
    expect(f.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(f.headers.authorization).toBeUndefined();
    expect(f.headers["x-api-key"]).toBeUndefined();
    expect(f.headers["x-forwarded-for"]).toBeUndefined();
    expect(f.headers["cf-connecting-ip"]).toBeUndefined();
    expect(Object.values(f.headers).includes(IP)).toBe(false);

    const me = meFetches[0]!;
    expect(me.method).toBe("GET");
    expect(me.headers.authorization).toMatch(/^Bearer /);
    expect(me.headers["x-api-key"]).toBe(KEY);

    expect(h.fetches.filter((x) => x.url.includes("/auth/web-login")).length).toBe(0);
    expect(
      h.fetches.filter((x) => x.url.includes("/bsi/v1/auth/login") && !x.url.includes("web-login"))
        .length,
    ).toBe(0);
  });

  it("AU2.2 login 200 sess put", async () => {
    const h = createHarness();
    const { res, sid } = await h.login();
    const text = await res.clone().text();
    expect(JSON.parse(text)).toStrictEqual({ signed_in: true, public_name: "Jane" });
    leakFree(text);
    expect(h.kv.puts.filter((p) => p.key.startsWith("sess:")).length).toBe(1);
    expect(h.kv.puts[0]!.key).toBe(sessKvKey(await sidHex(sid)));
  });

  it("AU2.3 bad JSON 400 no BSI", async () => {
    const h = createHarness();
    const { csrf: token, setCookie } = await h.csrf();
    const n = h.fetches.length;
    const res = await h.call("/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://metfix.org",
        "X-CSRF-Token": token,
        Cookie: setCookie?.split(";")[0] ?? "",
      },
      body: "x",
    });
    expect(res.status).toBe(400);
    expect(h.fetches.length).toBe(n);
  });

  it("AU2.4 concurrent distinct sids", async () => {
    const h = createHarness();
    const a = await h.login();
    const b = await h.login();
    expect(a.sid).not.toBe(b.sid);
  });
});
