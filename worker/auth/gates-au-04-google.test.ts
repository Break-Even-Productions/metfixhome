/**
 * AU10–AU13 Google / OAuth / return-URL gates.
 */
import { describe, expect, it, vi } from "vitest";
import {
  BRIDGE,
  CID,
  CODE,
  GOOGLE_JWKS_URL,
  GOOGLE_WEB_CLIENT_ID,
  ORIGIN,
  WP_BRIDGE_CODE,
  createHarness,
  googleStart,
  mintGoogleOidcKeys,
  setupAuthHooks,
  signGoogleIdToken,
  validIdTokenClaims,
} from "./realauth-harness";
import { sha256Hex, bytesToBase64Url, base64UrlToBytes, randomBytes } from "./crypto";

setupAuthHooks();

function b64urlJson(obj: object): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function signedCallback(
  h: ReturnType<typeof createHarness>,
  opts?: {
    intent?: "login" | "register";
    returnPath?: string;
    claims?: Record<string, unknown>;
    keys?: Awaited<ReturnType<typeof mintGoogleOidcKeys>>;
    cookieExtra?: string;
    callbackQueryExtra?: string;
  },
) {
  const keys = opts?.keys ?? (await mintGoogleOidcKeys());
  const q = new URLSearchParams({
    intent: opts?.intent ?? "login",
    return: opts?.returnPath ?? "/the-daily-fix",
  });
  const { state, preCookie, rec } = await googleStart(h, q.toString());
  expect(rec?.nonce).toBeTruthy();
  const claims = await validIdTokenClaims(h, rec!.nonce, opts?.claims ?? {});
  const idToken = await signGoogleIdToken(keys.privateKey, keys.kid, claims);
  h.installGoogleOidc(keys, idToken);
  const cookie = [preCookie, opts?.cookieExtra].filter(Boolean).join("; ");
  const extra = opts?.callbackQueryExtra ? `&${opts.callbackQueryExtra}` : "";
  const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}${extra}`, {
    headers: { Cookie: cookie },
  });
  return { res, state, preCookie, rec, keys, idToken, claims };
}

describe("AU10", () => {
  it("AU10.1 callback missing state → auth_error=state", async () => {
    const h = createHarness({ googleEnabled: true });
    const n = h.fetches.length;
    const res = await h.call(`/api/auth/google/callback?code=${CODE}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/?auth_error=state");
    expect(h.fetches.length).toBe(n);
    expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
  });

  it("AU10.2 unknown state → auth_error=state", async () => {
    const h = createHarness({ googleEnabled: true });
    const n = h.fetches.length;
    const res = await h.call(
      `/api/auth/google/callback?code=${CODE}&state=wellformed_never_issued_________`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/?auth_error=state");
    expect(h.fetches.length).toBe(n);
  });

  it("AU10.3 state replay rejected (second take)", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start?intent=login&return=/the-daily-fix");
    expect(start.status).toBe(302);
    const loc = start.headers.get("Location")!;
    const state = new URL(loc).searchParams.get("state")!;
    const pre = (start.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_pre=([^;]+)/);
    const cookie = pre ? `__Host-mfx_pre=${pre[1]}` : "";
    const first = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: cookie },
    });
    const second = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: cookie },
    });
    expect(second.status).toBe(302);
    expect(second.headers.get("Location")).toBe("/?auth_error=state");
    const googleTok = h.fetches.filter((f) => f.url.includes("oauth2.googleapis.com/token"));
    // First may fail google/BSI without JWKS; token calls ≤1 total
    expect(googleTok.length).toBeLessThanOrEqual(1);
    void first;
  });

  it("AU10.4 unclaimed state expires at 600s", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const name = `oauth:${await sha256Hex(state)}`;
    h.setNow(Date.now() + 601_000);
    const inst = h.oauthNs.instances.get(name);
    await (inst?.obj as { alarm?: () => Promise<void> })?.alarm?.();
    const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`);
    expect(res.headers.get("Location")).toBe("/?auth_error=state");
    expect(h.fetches.filter((f) => f.url.includes("oauth2.googleapis.com")).length).toBe(0);
  });

  it("AU10.5 pre cookie mismatch → state error", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: `__Host-mfx_pre=${encodeURIComponent("different_pre_value____________")}` },
    });
    expect(res.headers.get("Location")).toBe("/?auth_error=state");
    const none = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`);
    expect(none.headers.get("Location")).toBe("/?auth_error=state");
  });

  it("AU10.6 flow mismatch rejected", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const pre = (start.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_pre=([^;]+)/);
    const cookie = pre ? `__Host-mfx_pre=${pre[1]}` : "";
    // WP callback with google state
    const wp = await h.call(`/api/auth/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: cookie },
    });
    expect(wp.status).toBe(400);
    expect(await wp.json()).toStrictEqual({ error: "invalid_request" });
    expect(h.fetches.filter((f) => f.url.includes("oauth2.googleapis.com")).length).toBe(0);
  });

  it("AU10.7 start puts oauth DO by hashed state; 0 KV oauth:", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const name = `oauth:${await sha256Hex(state)}`;
    expect(h.oauthNs.instances.has(name)).toBe(true);
    expect(name).not.toContain(state);
    expect(h.kv.puts.every((p) => !p.key.startsWith("oauth:"))).toBe(true);
    expect(h.kv.gets.every((k) => !k.startsWith("oauth:"))).toBe(true);
  });

  it("AU10.8 concurrent callback replay → one success", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const pre = (start.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_pre=([^;]+)/);
    const cookie = pre ? `__Host-mfx_pre=${pre[1]}` : "";
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
          headers: { Cookie: cookie },
        }),
      ),
    );
    const locs = results.map((r) => r.headers.get("Location") ?? "");
    const stateErrs = locs.filter((l) => l.includes("auth_error=state")).length;
    expect(stateErrs).toBeGreaterThanOrEqual(1);
    expect(h.fetches.filter((f) => f.url.includes("oauth2.googleapis.com/token")).length).toBeLessThanOrEqual(1);
  });

  it("AU10.9 OAUTH_STATE outage → unavailable", async () => {
    const hThrow = createHarness({ googleEnabled: true, oauthOutage: "throw" });
    const startThrow = await hThrow.call("/api/auth/google/start");
    expect(startThrow.status).toBe(302);
    expect(startThrow.headers.get("Location")).toBe("/?auth_error=unavailable");
    expect(hThrow.fetches.filter((f) => f.url.includes("oauth2.googleapis.com")).length).toBe(0);
    expect(hThrow.fetches.filter((f) => f.url.includes("brokenscience.org")).length).toBe(0);
    expect(startThrow.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);

    const hUnbound = createHarness({ googleEnabled: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (hUnbound.env as any).OAUTH_STATE = undefined;
    const startUnbound = await hUnbound.call("/api/auth/google/start");
    expect(startUnbound.headers.get("Location")).toBe("/?auth_error=unavailable");

    const hHang = createHarness({ googleEnabled: true });
    const { state, preCookie } = await googleStart(hHang);
    const origGet = hHang.env.OAUTH_STATE.get.bind(hHang.env.OAUTH_STATE);
    hHang.env.OAUTH_STATE.get = () => ({
      fetch: async () => new Promise<Response>(() => {}),
    });
    const cbPromise = hHang.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: preCookie },
    });
    await vi.advanceTimersByTimeAsync(1000);
    const cb = await cbPromise;
    expect(cb.headers.get("Location")).toBe("/?auth_error=unavailable");
    expect(hHang.fetches.filter((f) => f.url.includes("oauth2.googleapis.com/token")).length).toBe(0);
    hHang.env.OAUTH_STATE.get = origGet;
  });
});

describe("AU11", () => {
  it("AU11.1 google start Location PKCE shape", async () => {
    const h = createHarness({ googleEnabled: true });
    const res = await h.call("/api/auth/google/start?intent=login");
    expect(res.status).toBe(302);
    const u = new URL(res.headers.get("Location")!);
    expect(u.host).toBe("accounts.google.com");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "https://metfix.org/api/auth/google/callback",
    );
    expect(u.searchParams.get("code_challenge")).toBeTruthy();
    expect(u.toString()).not.toContain("code_verifier");
    const text = await res.clone().text();
    expect(text).not.toMatch(/verifier/);
  });

  it("AU11.2 google token body includes code_verifier + client_secret", async () => {
    const h = createHarness({ googleEnabled: true });
    const start = await h.call("/api/auth/google/start");
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!;
    const pre = (start.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_pre=([^;]+)/);
    const cookie = pre ? `__Host-mfx_pre=${pre[1]}` : "";
    // Inject google token response via fetch — harness returns 502 for non-bsi; google URL allowed
    // Without id_token the callback errors; still may attempt token POST
    await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: cookie },
    });
    const tok = h.fetches.find((f) => f.url.includes("oauth2.googleapis.com/token"));
    if (!tok) {
      expect(tok, "AU11.2 expects Google token request").toBeTruthy();
      return;
    }
    expect(tok.bodyText).toContain("code_verifier=");
    expect(tok.bodyText).toContain("client_secret=");
  });

  it("AU11.3 WP code exchange body 4 keys no code_verifier", async () => {
    const h = createHarness({ googleEnabled: true });
    const { res } = await signedCallback(h);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/the-daily-fix");
    const c3 = h.fetches.filter((f) => f.url.includes("/proxy/oauth/token"));
    expect(c3.length).toBe(1);
    const body = JSON.parse(c3[0]!.bodyText) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toStrictEqual(
      ["client_id", "code", "grant_type", "redirect_uri"].sort(),
    );
    expect(body).toStrictEqual({
      grant_type: "authorization_code",
      code: WP_BRIDGE_CODE,
      client_id: CID,
      redirect_uri: "https://metfix.org/api/auth/callback",
    });
    expect(c3[0]!.bodyText).not.toContain("code_verifier");
  });

  it("AU11.4 browser GET /api/auth/callback rejects", async () => {
    const h = createHarness({ googleEnabled: true });
    const res = await h.call(`/api/auth/callback?code=${CODE}&state=valid_wp_state__________`, {
      headers: { "X-MFX-Internal": "1", "CF-Worker": "metfix.org" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toStrictEqual({ error: "invalid_request" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(h.fetches.filter((f) => f.url.includes("/proxy/oauth/token")).length).toBe(0);
  });
});

describe("AU12", () => {
  type RejectMode = "claims" | "wrong-key" | "alg-none" | "alg-hs256" | "unknown-kid";

  async function assertGoogleReject(
    claimOverrides: Record<string, unknown>,
    opts?: { mode?: RejectMode; intent?: "login" | "register"; omitNonce?: boolean },
  ) {
    const h = createHarness({ googleEnabled: true });
    const keys = await mintGoogleOidcKeys();
    const intent = opts?.intent ?? "login";
    const { state, preCookie, rec } = await googleStart(
      h,
      `intent=${intent}&return=/the-daily-fix`,
    );
    expect(rec?.nonce).toBeTruthy();
    const claims = await validIdTokenClaims(h, rec!.nonce, claimOverrides);
    if (opts?.omitNonce) delete claims.nonce;

    const mode = opts?.mode ?? "claims";
    if (mode === "wrong-key") {
      const evil = await mintGoogleOidcKeys(keys.kid);
      const idToken = await signGoogleIdToken(evil.privateKey, keys.kid, claims);
      h.setJwks(keys);
      h.setGoogleIdToken(idToken);
    } else if (mode === "alg-none") {
      const idToken = `${b64urlJson({ alg: "none", kid: keys.kid })}.${b64urlJson(claims)}.`;
      h.setJwks(keys);
      h.setGoogleIdToken(idToken);
    } else if (mode === "alg-hs256") {
      const header = b64urlJson({ alg: "HS256", kid: keys.kid });
      const body = b64urlJson(claims);
      const n = keys.publicJwk.n;
      expect(typeof n).toBe("string");
      const raw = base64UrlToBytes(n!);
      const hk = await crypto.subtle.importKey(
        "raw",
        toArrayBuffer(raw),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = bytesToBase64Url(
        new Uint8Array(
          await crypto.subtle.sign("HMAC", hk, new TextEncoder().encode(`${header}.${body}`)),
        ),
      );
      h.setJwks(keys);
      h.setGoogleIdToken(`${header}.${body}.${sig}`);
    } else if (mode === "unknown-kid") {
      const idToken = await signGoogleIdToken(keys.privateKey, "unknown-kid-nope", claims);
      h.installGoogleOidc(keys, idToken);
    } else {
      const idToken = await signGoogleIdToken(keys.privateKey, keys.kid, claims);
      h.installGoogleOidc(keys, idToken);
    }

    const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: preCookie },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/?auth_error=google");
    expect(h.fetches.filter((f) => f.url.includes("/auth/social")).length).toBe(0);
    expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
  }

  it("AU12.1 wrong RSA key same kid → auth_error=google, 0 BSI, no sid", async () => {
    await assertGoogleReject({}, { mode: "wrong-key" });
  });

  it("AU12.2 alg none and HS256 → auth_error=google, 0 BSI, no sid", async () => {
    await assertGoogleReject({}, { mode: "alg-none" });
    await assertGoogleReject({}, { mode: "alg-hs256" });
  });

  it("AU12.3 unknown kid → auth_error=google, 0 BSI, no sid", async () => {
    await assertGoogleReject({}, { mode: "unknown-kid" });
  });

  it("AU12.4 evil iss → auth_error=google, 0 BSI, no sid", async () => {
    await assertGoogleReject({ iss: "https://evil.example" });
    await assertGoogleReject({ iss: "https://accounts.google.com.evil" });
  });

  it("AU12.5 aud matrix reject wrong client id", async () => {
    await assertGoogleReject({ aud: "other-client" });
  });

  it("AU12.6 exp now-61s rejected", async () => {
    const now = Math.floor(Date.now() / 1000);
    await assertGoogleReject({ exp: now - 61, iat: now - 120 });
  });

  it("AU12.7 iat now+61s rejected", async () => {
    const now = Math.floor(Date.now() / 1000);
    await assertGoogleReject({ iat: now + 61 });
  });

  it("AU12.8 nonce missing or different rejected", async () => {
    await assertGoogleReject({}, { omitNonce: true });
    await assertGoogleReject({ nonce: "different_nonce_value________" });
  });

  it("AU12.9 email_verified false or string true rejected on link path", async () => {
    for (const ev of [false, "true"] as const) {
      const h = createHarness({ googleEnabled: true });
      const keys = await mintGoogleOidcKeys();
      const { state, preCookie, rec } = await googleStart(
        h,
        "intent=register&return=/the-daily-fix",
      );
      const claims = await validIdTokenClaims(h, rec!.nonce, { email_verified: ev });
      const idToken = await signGoogleIdToken(keys.privateKey, keys.kid, claims);
      h.installGoogleOidc(keys, idToken);
      await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
        headers: { Cookie: preCookie },
      });
      const social = h.fetches.filter((f) => f.url.includes("/auth/social"));
      expect(social.filter((f) => JSON.parse(f.bodyText).intent === "register").length).toBe(0);
      expect(social.length).toBeLessThanOrEqual(1);
      if (social.length === 1) {
        expect(JSON.parse(social[0]!.bodyText).intent).toBe("login");
      }
    }
  });

  it("AU12.12 azp present and not web client id rejected", async () => {
    await assertGoogleReject({ azp: "other" });
  });

  it("AU12.10 valid token → 1 BSI-C5 social call", async () => {
    const h = createHarness({ googleEnabled: true });
    const { res } = await signedCallback(h);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/the-daily-fix");
    expect(res.headers.get("Set-Cookie") ?? "").toMatch(/__Host-mfx_sid=/);
    const social = h.fetches.filter((f) => f.url.includes("/auth/social"));
    expect(social.length).toBe(1);
  });

  it("AU12.11 JWKS cache TTL 3600 / kid-miss 300", async () => {
    const h = createHarness({ googleEnabled: true });
    const keys = await mintGoogleOidcKeys("cache-kid");
    h.setJwks(keys);

    const s1 = await googleStart(h);
    const t1 = await signGoogleIdToken(
      keys.privateKey,
      keys.kid,
      await validIdTokenClaims(h, s1.rec!.nonce),
    );
    h.setGoogleIdToken(t1);
    const r1 = await h.call(`/api/auth/google/callback?code=${CODE}&state=${s1.state}`, {
      headers: { Cookie: s1.preCookie },
    });
    expect(r1.headers.get("Location")).toBe("/the-daily-fix");
    const jwksFetches = () =>
      h.fetches.filter((f) => f.url.includes("googleapis.com/oauth2/v3/certs"));
    expect(jwksFetches().length).toBe(1);

    const s2 = await googleStart(h);
    const t2 = await signGoogleIdToken(
      keys.privateKey,
      keys.kid,
      await validIdTokenClaims(h, s2.rec!.nonce),
    );
    h.setGoogleIdToken(t2);
    const nAfterFirst = jwksFetches().length;
    await h.call(`/api/auth/google/callback?code=${CODE}&state=${s2.state}`, {
      headers: { Cookie: s2.preCookie },
    });
    expect(jwksFetches().length).toBe(nAfterFirst);

    h.setNow(Date.now() + 3601_000);
    const s3 = await googleStart(h);
    const t3 = await signGoogleIdToken(
      keys.privateKey,
      keys.kid,
      await validIdTokenClaims(h, s3.rec!.nonce),
    );
    h.setGoogleIdToken(t3);
    await h.call(`/api/auth/google/callback?code=${CODE}&state=${s3.state}`, {
      headers: { Cookie: s3.preCookie },
    });
    expect(jwksFetches().length).toBe(nAfterFirst + 1);

    const nBeforeMiss = jwksFetches().length;
    const sMiss1 = await googleStart(h);
    const badKidToken = await signGoogleIdToken(
      keys.privateKey,
      "unknown-kid-AAAA",
      await validIdTokenClaims(h, sMiss1.rec!.nonce),
    );
    h.setJwks(keys);
    h.setGoogleIdToken(badKidToken);
    const miss1 = await h.call(`/api/auth/google/callback?code=${CODE}&state=${sMiss1.state}`, {
      headers: { Cookie: sMiss1.preCookie },
    });
    expect(miss1.headers.get("Location")).toBe("/?auth_error=google");
    expect(jwksFetches().length).toBeGreaterThan(nBeforeMiss);

    const sMiss2 = await googleStart(h);
    const badKidToken2 = await signGoogleIdToken(
      keys.privateKey,
      "unknown-kid-BBBB",
      await validIdTokenClaims(h, sMiss2.rec!.nonce),
    );
    h.setGoogleIdToken(badKidToken2);
    const nBeforeMiss2 = jwksFetches().length;
    await h.call(`/api/auth/google/callback?code=${CODE}&state=${sMiss2.state}`, {
      headers: { Cookie: sMiss2.preCookie },
    });
    expect(jwksFetches().length).toBe(nBeforeMiss2);

    h.setNow(Date.now() + 301_000);
    const sMiss3 = await googleStart(h);
    const badKidToken3 = await signGoogleIdToken(
      keys.privateKey,
      "unknown-kid-CCCC",
      await validIdTokenClaims(h, sMiss3.rec!.nonce),
    );
    h.setGoogleIdToken(badKidToken3);
    const nBeforeMiss3 = jwksFetches().length;
    await h.call(`/api/auth/google/callback?code=${CODE}&state=${sMiss3.state}`, {
      headers: { Cookie: sMiss3.preCookie },
    });
    expect(jwksFetches().length).toBe(nBeforeMiss3 + 1);
    void GOOGLE_JWKS_URL;
  });

  it("AU12.c aud must be web client id", async () => {
    const hOk = createHarness({ googleEnabled: true });
    const ok = await signedCallback(hOk, { claims: { aud: GOOGLE_WEB_CLIENT_ID } });
    expect(ok.res.headers.get("Location")).toBe("/the-daily-fix");
    expect(hOk.fetches.filter((f) => f.url.includes("/auth/social")).length).toBe(1);

    const rejects: Array<Record<string, unknown>> = [
      { aud: "metfix-android-client" },
      { aud: "metfix-other-web" },
      { aud: [GOOGLE_WEB_CLIENT_ID, "other"] },
      { aud: GOOGLE_WEB_CLIENT_ID, azp: "not-the-web-client" },
    ];
    for (const claims of rejects) {
      const h = createHarness({ googleEnabled: true });
      const keys = await mintGoogleOidcKeys();
      const { state, preCookie, rec } = await googleStart(h);
      const idToken = await signGoogleIdToken(
        keys.privateKey,
        keys.kid,
        await validIdTokenClaims(h, rec!.nonce, claims),
      );
      h.installGoogleOidc(keys, idToken);
      const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
        headers: { Cookie: preCookie },
      });
      expect(res.headers.get("Location")).toBe("/?auth_error=google");
      expect(h.fetches.filter((f) => f.url.includes("/auth/social")).length).toBe(0);
    }
  });

  it("AU12.v email_verified gates register social", async () => {
    const hReg = createHarness({ googleEnabled: true });
    const reg = await signedCallback(hReg, {
      intent: "register",
      claims: { email_verified: true },
    });
    expect(reg.res.headers.get("Set-Cookie") ?? "").toMatch(/__Host-mfx_sid=/);
    const socialReg = hReg.fetches.filter((f) => f.url.includes("/auth/social"));
    expect(socialReg.length).toBe(1);
    expect(JSON.parse(socialReg[0]!.bodyText).intent).toBe("register");

    for (const ev of [false, "true", undefined] as const) {
      const h = createHarness({ googleEnabled: true });
      const keys = await mintGoogleOidcKeys();
      const { state, preCookie, rec } = await googleStart(h, "intent=register&return=/");
      const claims = await validIdTokenClaims(h, rec!.nonce, {});
      if (ev === undefined) delete claims.email_verified;
      else claims.email_verified = ev;
      const idToken = await signGoogleIdToken(keys.privateKey, keys.kid, claims);
      h.installGoogleOidc(keys, idToken);
      await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
        headers: { Cookie: preCookie },
      });
      const social = h.fetches.filter((f) => f.url.includes("/auth/social"));
      expect(social.filter((f) => JSON.parse(f.bodyText).intent === "register").length).toBe(0);
      expect(social.length).toBeLessThanOrEqual(1);
      if (social.length === 1) {
        expect(JSON.parse(social[0]!.bodyText).intent).toBe("login");
      }
    }
  });

  it("AU12.u unverified login 404 → auth_error=google", async () => {
    const h = createHarness({ googleEnabled: true });
    h.setSocial("404");
    const keys = await mintGoogleOidcKeys();
    const { state, preCookie, rec } = await googleStart(h, "intent=login&return=/");
    const claims = await validIdTokenClaims(h, rec!.nonce, { email_verified: false });
    const idToken = await signGoogleIdToken(keys.privateKey, keys.kid, claims);
    h.installGoogleOidc(keys, idToken);
    const puts0 = h.kv.puts.filter((p) => p.key.startsWith("sess:")).length;
    const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
      headers: { Cookie: preCookie },
    });
    expect(res.headers.get("Location")).toBe("/?auth_error=google");
    expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
    const social = h.fetches.filter((f) => f.url.includes("/auth/social"));
    expect(social.length).toBe(1);
    expect(JSON.parse(social[0]!.bodyText).intent).toBe("login");
    expect(social.every((f) => JSON.parse(f.bodyText).intent !== "register")).toBe(true);
    expect(h.kv.puts.filter((p) => p.key.startsWith("sess:")).length).toBe(puts0);
  });

  it("AU12.e social body key set exact; no browser email leak", async () => {
    const h = createHarness({ googleEnabled: true });
    const keys = await mintGoogleOidcKeys();
    const { start, state, preCookie, rec, loc } = await googleStart(
      h,
      "intent=login&return=/&email=evil@x.test&login_hint=evil@x.test&sub=evil&user_id=9",
    );
    expect(loc).not.toContain("login_hint");
    expect(new URL(loc).searchParams.get("login_hint")).toBeNull();
    const idToken = await signGoogleIdToken(
      keys.privateKey,
      keys.kid,
      await validIdTokenClaims(h, rec!.nonce),
    );
    h.installGoogleOidc(keys, idToken);
    const res = await h.call(
      `/api/auth/google/callback?code=${CODE}&state=${state}&email=browser@x.test&login_hint=browser@x.test&sub=browser&user_id=99`,
      {
        headers: {
          Cookie: `${preCookie}; email=cookie@x.test; login_hint=cookie@x.test`,
        },
      },
    );
    expect(res.headers.get("Location")).toBe("/");
    const social = h.fetches.filter((f) => f.url.includes("/auth/social"));
    expect(social.length).toBe(1);
    const body = JSON.parse(social[0]!.bodyText) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toStrictEqual(
      ["access_token", "client_id", "intent", "provider", "redirect_uri", "state"].sort(),
    );
    expect(body.provider).toBe("google");
    expect(body.client_id).toBe(CID);
    expect(body.redirect_uri).toBe("https://metfix.org/api/auth/callback");
    const blob = JSON.stringify(body);
    expect(blob).not.toContain("evil@x.test");
    expect(blob).not.toContain("browser@x.test");
    expect(blob).not.toContain("cookie@x.test");
    expect(blob).not.toContain("login_hint");
    void start;
  });
});

describe("AU13", () => {
  it("AU13.1 return sanitization", async () => {
    const evil = [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "\\/evil.com",
      "javascript:alert(1)",
      "/%2F%2Fevil.com",
      "/x\r\nSet-Cookie:a=b",
      "%09//evil",
      "/" + "a".repeat(512),
    ];
    for (const ret of evil) {
      const h = createHarness({ googleEnabled: true });
      const { res } = await signedCallback(h, { returnPath: ret });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/");
    }
    const hGood = createHarness({ googleEnabled: true });
    const good = await signedCallback(hGood, {
      returnPath: "/the-daily-fix/250210#brain",
    });
    expect(good.res.headers.get("Location")).toBe("/the-daily-fix/250210#brain");
  });

  it("AU13.2 query return ignored vs stored", async () => {
    const h = createHarness({ googleEnabled: true });
    const { res } = await signedCallback(h, {
      returnPath: "/the-daily-fix/safe",
      callbackQueryExtra: "return=https://evil.com",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/the-daily-fix/safe");
    expect(res.headers.get("Location")).not.toContain("evil.com");
  });
});

void ORIGIN;
void randomBytes;
void BRIDGE;
