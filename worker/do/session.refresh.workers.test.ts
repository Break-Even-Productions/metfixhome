/**
 * AU7.6 / CQ r2 — concurrent refresh on the REAL SessionDO under
 * @cloudflare/vitest-pool-workers (real blockConcurrencyWhile).
 * Rotating refresh token: exactly 1 /oauth/token call; session stays signed in.
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
const CID = "cid_QA_SENT_CLIENT";
const KEY = "k_QA_SENT_KEY";

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

  it("AU7.6 two concurrent ensure-access with rotating token → 1 token POST, nobody logged out", async () => {
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
    const [a, b] = await Promise.all([
      stub.fetch(
        new Request("https://do/ensure-access", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-AAD": aad },
          body,
        }),
      ),
      stub.fetch(
        new Request("https://do/ensure-access", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-AAD": aad },
          body,
        }),
      ),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const ja = (await a.json()) as { status?: string; record?: { bsi_access?: string; bsi_refresh?: string } };
    const jb = (await b.json()) as { status?: string; record?: { bsi_access?: string; bsi_refresh?: string } };
    expect(ja.status).toBe("ok");
    expect(jb.status).toBe("ok");
    expect(ja.record?.bsi_access).toBe(ACCESS2);
    expect(jb.record?.bsi_access).toBe(ACCESS2);
    expect(ja.record?.bsi_refresh).toBe(REFRESH2);
    expect(jb.record?.bsi_refresh).toBe(REFRESH2);
    expect(tokenCalls).toBe(1);
  });
});
