/**
 * AU26.* leftover gates after r1.31 direct-token remap.
 * Retired AU26.1/2/3/5/6/7/9 gate IDs are not used in it() titles (gate-ids dropped them).
 * AU26.8 / AU26.11 live elsewhere; AU26.10 kept and retargeted to /oauth/token.
 */
import { describe, expect, it, vi } from "vitest";
import {
  IP,
  KEY,
  ORIGIN,
  PW,
  RSECRET,
  TOK,
  createHarness,
  setupAuthHooks,
} from "../harness/realauth-harness";

setupAuthHooks();

type LoginOpts = {
  identifier?: string;
  password?: string;
  recaptcha?: unknown;
  ip?: string;
  client_id?: string;
  omitRecaptcha?: boolean;
};

async function loginPost(h: ReturnType<typeof createHarness>, opts: LoginOpts = {}) {
  const { csrf: token, setCookie } = await h.csrf();
  const body: Record<string, unknown> = {
    identifier: opts.identifier ?? "jane",
    password: opts.password ?? PW,
  };
  if (!opts.omitRecaptcha) body.recaptcha = opts.recaptcha ?? TOK;
  if (opts.client_id !== undefined) body.client_id = opts.client_id;
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

describe("retired-web-login-rows", () => {
  it("former web-login-only rows are covered by AU27 (IDs not reused)", () => {
    // Placeholders so the file still loads; gate-ids no longer list AU26.1/2/3/5/6/7/9.
    expect(true).toBe(true);
  });
});

describe("AU26.10", () => {
  it("AU26.10 Worker clamp of /oauth/token Retry-After", async () => {
    const table: Array<[string | null, string]> = [
      ["1", "1"],
      ["0", "1"],
      ["0000017", "17"],
      ["0000000", "1"],
      ["600", "600"],
      ["601", "600"],
      ["99999", "600"],
      ["999999", "600"],
      ["1000000", "600"],
      ["123456789012345678901234567890", "600"],
      ["1".repeat(400), "600"],
      [null, "60"],
      ["", "60"],
      ["-5", "60"],
      ["abc", "60"],
      ["1.5", "60"],
      ["1e30", "60"],
      ["17abc", "60"],
      ["Wed, 21 Oct 2026 07:28:00 GMT", "60"],
    ];
    for (const [ra, expectRa] of table) {
      const h = createHarness({
        oauthToken: () =>
          new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
            status: 429,
            headers:
              ra == null
                ? { "Content-Type": "application/json" }
                : { "Content-Type": "application/json", "Retry-After": ra },
          }),
      });
      const res = await loginPost(h, { identifier: `clamp-${ra}` });
      const out = res.headers.get("Retry-After")!;
      expect(out).toBe(expectRa);
      expect(out).toMatch(/^[1-9][0-9]*$/);
      expect(Number(out)).toBeLessThanOrEqual(600);
    }
  });
});

void KEY;
void RSECRET;
void vi;
