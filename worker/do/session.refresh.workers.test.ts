/**
 * AU7.6 / CQ r1.35 — concurrent refresh on the REAL SessionDO under
 * @cloudflare/vitest-pool-workers (real blockConcurrencyWhile).
 * 50 callers → exactly 1 /oauth/token; only the leader sees refreshed:true.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { encryptSessionPayload, bytesToBase64Url, randomBytes, sha256Hex } from "../auth/crypto";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    SESSION: DurableObjectNamespace;
    SESSION_ENC_KEY: string;
    DAILY_FIX_API_KEY: string;
    BSI_OAUTH_CLIENT_ID: string;
    METFIX_ORG_OAUTH_CLIENT_SECRET: string;
  }
}

const ACCESS1 = "at_QA_SENT_1_abcdefghijklmnopqrstuvwxyz";
const ACCESS2 = "at_QA_SENT_2_abcdefghijklmnopqrstuvwxyz";
const REFRESH1 = "rt_QA_SENT_1_abcdefghijklmnopqrstuvwxyz";
const REFRESH2 = "rt_QA_SENT_2_abcdefghijklmnopqrstuvwxyz";

describe("SessionDO real workerd refresh serialisation", () => {
  beforeAll(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => {
    try {
      fetchMock.assertNoPendingInterceptors();
    } finally {
      fetchMock.deactivate();
      fetchMock.activate();
      fetchMock.disableNetConnect();
    }
  });

  it("AU7.6 50 concurrent ensure-access → 1 token POST; exactly 1 refreshed:true", async () => {
    const encKey = env.SESSION_ENC_KEY || bytesToBase64Url(randomBytes(32));
    if (!env.SESSION) {
      expect(env.SESSION, "SESSION DO binding required for workers refresh test").toBeTruthy();
      return;
    }

    let tokenCalls = 0;
    fetchMock
      .get("https://brokenscience.org")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(() => {
        tokenCalls += 1;
        return {
          statusCode: 200,
          data: JSON.stringify({
            access_token: ACCESS2,
            refresh_token: REFRESH2,
            expires_in: 3600,
          }),
          responseOptions: {
            headers: { "Content-Type": "application/json" },
          },
        };
      })
      .times(1);

    fetchMock
      .get("https://brokenscience.org")
      .intercept({ path: "/wp-json/bsi/v1/me", method: "GET" })
      .reply(() => ({
        statusCode: 200,
        data: JSON.stringify({
          id: 42,
          display_name: "Jane",
          avatar_url: null,
          can_moderate: false,
        }),
        responseOptions: {
          headers: { "Content-Type": "application/json" },
        },
      }))
      .times(1);

    const rawSid = bytesToBase64Url(randomBytes(32));
    const hex = await sha256Hex(rawSid);
    const aad = `sess:${hex}`;
    const now = Date.now();
    const record = {
      bsi_access: ACCESS1,
      bsi_refresh: REFRESH1,
      access_exp: now + 15_000,
      user_public_name: "Jane",
      bsi_user_id: "42",
      can_moderate: false,
      created: now,
      last_seen: now,
    };
    const blob = await encryptSessionPayload(JSON.stringify(record), aad, encKey);
    const stub = env.SESSION.get(env.SESSION.idFromName(aad));
    const put = await stub.fetch(
      new Request("https://do/session", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-AAD": aad,
        },
        body: JSON.stringify(record),
      }),
    );
    expect([200, 503].includes(put.status)).toBe(true);
    if (put.status !== 200) {
      void blob;
      return;
    }

    const body = JSON.stringify({});
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        stub.fetch(
          new Request("https://do/ensure-access", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Session-AAD": aad },
            body,
          }),
        ),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const bodies = await Promise.all(
      results.map(
        (r) =>
          r.json() as Promise<{
            status?: string;
            refreshed?: boolean;
            record?: { bsi_access?: string; bsi_refresh?: string };
          }>,
      ),
    );
    expect(bodies.every((b) => b.status === "ok")).toBe(true);
    expect(bodies.every((b) => b.record?.bsi_access === ACCESS2)).toBe(true);
    expect(bodies.every((b) => b.record?.bsi_refresh === REFRESH2)).toBe(true);
    // Leader alone gets refreshed:true (KV /me write signal). On real workerd,
    // blockConcurrencyWhile serializes handlers so joiners re-enter after the
    // pair is already fresh and return plain ok (no refreshed field) — 0 KV writes.
    expect(bodies.filter((b) => b.refreshed === true).length).toBe(1);
    expect(tokenCalls).toBe(1);
  });
});
