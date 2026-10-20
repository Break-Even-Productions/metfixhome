import { describe, expect, it } from "vitest";
import { CID, IP, KEY, PW, TOK, createHarness, leakFree, sessKvKey, setupAuthHooks, sidHex } from "./realauth-harness";

setupAuthHooks();

describe("AU2", () => {
  it("AU2.1 web-login contract", async () => {
    const h = createHarness();
    await h.login();
    const f = h.fetches.find((x) => x.url.includes("/auth/web-login"))!;
    expect(JSON.parse(f.bodyText)).toStrictEqual({
      username: "jane",
      password: PW,
      client_id: CID,
      recaptcha_token: TOK,
    });
    expect(Object.keys(f.headers).sort()).toStrictEqual(["accept", "content-type", "user-agent", "x-api-key"]);
    expect(f.headers["x-api-key"]).toBe(KEY);
    expect(f.headers["x-forwarded-for"]).toBeUndefined();
    expect(Object.values(f.headers).includes(IP)).toBe(false);
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
