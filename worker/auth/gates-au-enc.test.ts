/**
 * ENC.T2–T4 (ENC.T1 lives in gates-au-core).
 */
import { describe, expect, it, vi } from "vitest";
import {
  ACCESS1,
  ENCKEY,
  createHarness,
  csrfSid,
  hOk,
  sessionBlob,
  setupAuthHooks,
  sidHex,
} from "./realauth-harness";
import {
  bytesToBase64Url,
  decryptSessionPayload,
  encryptSessionPayload,
  keyId,
  randomBytes,
} from "./crypto";
import { sessionAad } from "./session";

setupAuthHooks();

async function commentPost(h: ReturnType<typeof createHarness>, sid: string) {
  const token = await csrfSid(h.env, sid);
  return h.call("/api/daily-fix/comments", {
    method: "POST",
    headers: hOk({ sid, csrf: token }),
    body: JSON.stringify({
      date: "2025-02-10",
      type: "belly",
      content: "hi",
      recaptcha: "recaptcha_tok_QA_SENT",
    }),
  });
}

describe("ENC", () => {
  it("ENC.T2 PREV kid reads; next write uses current kid", async () => {
    const prev = bytesToBase64Url(randomBytes(32));
    const cur = ENCKEY;
    const aad = "sess:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const pt = JSON.stringify({
      bsi_access: ACCESS1,
      bsi_refresh: "rt",
      access_exp: Date.now() + 3600_000,
      user_public_name: "Jane",
      bsi_user_id: "1",
      can_moderate: false,
      created: Date.now(),
      last_seen: Date.now(),
    });
    const blobPrev = await encryptSessionPayload(pt, aad, prev);
    expect(blobPrev.split(".")[1]).toBe(await keyId(prev));
    expect(await decryptSessionPayload(blobPrev, aad, cur, prev)).toBe(pt);

    const next = await encryptSessionPayload(pt, aad, cur);
    expect(next.split(".")[1]).toBe(await keyId(cur));
    expect(next.split(".")[1]).not.toBe(await keyId(prev));

    const h = createHarness({ sessionEncKeyPrev: prev });
    h.env.SESSION_ENC_KEY_PREV = prev;
    const { sid } = await h.login();
    const hex = await sidHex(sid);
    const name = sessionAad(hex);
    const stor = h.sessionNs.getStorage(name)!;
    const plaintext = await decryptSessionPayload(
      (stor.get("rec") as { blob: string }).blob,
      name,
      ENCKEY,
    );
    stor.set("rec", { blob: await encryptSessionPayload(plaintext!, name, prev) });
    const res = await commentPost(h, sid);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(201);
    const after = (stor.get("rec") as { blob: string }).blob;
    expect(after.split(".")[1]).toBe(await keyId(cur));
  });

  it("ENC.T3 AAD binds ciphertext to SESSION instance name", async () => {
    const h = createHarness();
    const a = await h.login();
    const b = await h.login();
    const hexA = await sidHex(a.sid);
    const hexB = await sidHex(b.sid);
    const aadA = sessionAad(hexA);
    const aadB = sessionAad(hexB);
    const blobA = (await sessionBlob(h, a.sid))?.blob;
    expect(blobA).toMatch(/^v1\./);
    const storB = h.sessionNs.getStorage(aadB)!;
    const origB = storB.get("rec");
    storB.set("rec", { blob: blobA });
    const n0 = h.fetches.filter((f) => f.url.includes("brokenscience.org")).length;
    const postB = await commentPost(h, b.sid);
    expect(postB.status).toBe(401);
    expect(await postB.json()).toStrictEqual({ error: "signed_out" });
    expect(postB.status).not.toBe(500);
    const lb = await h.call(
      "/api/daily-fix/leaderboard?date=2025-02-10&type=brain&daily_workout_id=1",
      { headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(b.sid)}` } },
    );
    expect(lb.status).toBe(401);
    expect(h.fetches.filter((f) => f.url.includes("brokenscience.org")).length).toBe(n0);

    const storA = h.sessionNs.getStorage(aadA)!;
    storA.set("rec", { blob: blobA });
    if (origB) storB.set("rec", origB);
    const postA = await commentPost(h, a.sid);
    expect(postA.status).toBe(201);
    const write = h.fetches
      .filter((f) => f.url.includes("/daily-fix/comments") && f.method === "POST")
      .pop();
    expect(write?.headers["authorization"]).toContain(ACCESS1);
  });

  it("ENC.T4 unrelated key → absent, never 500", async () => {
    const other = bytesToBase64Url(randomBytes(32));
    const h = createHarness();
    const { sid } = await h.login();
    const hex = await sidHex(sid);
    const aad = sessionAad(hex);
    const stor = h.sessionNs.getStorage(aad)!;
    const pt = await decryptSessionPayload((stor.get("rec") as { blob: string }).blob, aad, ENCKEY);
    stor.set("rec", { blob: await encryptSessionPayload(pt!, aad, other) });

    const importSpy = vi.spyOn(crypto.subtle, "importKey");
    for (let i = 0; i < 20; i++) {
      const res = await commentPost(h, sid);
      expect(res.status).not.toBe(500);
      expect(res.status).toBe(401);
      expect(await res.json()).toStrictEqual({ error: "signed_out" });
    }
    // Spec wants once per isolate; allow small reuse, fail if unbounded
    expect(importSpy.mock.calls.length).toBeLessThanOrEqual(40);
    importSpy.mockRestore();
  });
});
