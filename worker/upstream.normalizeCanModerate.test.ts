import { describe, expect, it } from "vitest";
import { normalizeCanModerate } from "./upstream";
import {
  createHarness,
  setupAuthHooks,
} from "../tools/pr2/harness/realauth-harness";

setupAuthHooks();

describe("normalizeCanModerate (CM6 / CW12.2)", () => {
  it("CW12.2 only JSON true is moderator; role strings stay false", () => {
    expect(normalizeCanModerate(true)).toBe(true);
    expect(normalizeCanModerate(false)).toBe(false);
    expect(normalizeCanModerate(undefined)).toBe(false);
    expect(normalizeCanModerate(null)).toBe(false);
    expect(normalizeCanModerate("true")).toBe(false);
    expect(normalizeCanModerate(1)).toBe(false);
    expect(normalizeCanModerate({})).toBe(false);
    // M-CW28: must not derive moderator from BSI role labels
    expect(normalizeCanModerate("administrator")).toBe(false);
    expect(normalizeCanModerate("Daily Fix admin")).toBe(false);
  });

  it("CW12.2 /me moderator only from session can_moderate, never X-Moderator", async () => {
    const h = createHarness();
    const { sid } = await h.login();
    const res = await h.call("/api/auth/me", {
      headers: {
        Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}`,
        "X-Moderator": "1",
        "X-Role": "administrator",
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual({ signed_in: true, public_name: "Jane" });
  });
});
