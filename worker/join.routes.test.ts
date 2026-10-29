/**
 * WJ30: join routes registered before /api/ catch-all; CSP does not allow foreign Whop.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAILY_FIX_CSP } from "./csp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("WJ30 Worker routing + CSP", () => {
  it("account/onboarding + whop checkout registered before /api/ catch-all", () => {
    const src = readFileSync(`${ROOT}/worker/index.ts`, "utf8");
    const joinIdx = src.indexOf("/api/account/onboarding");
    const catchIdx = src.indexOf('path.startsWith("/api/")');
    // There may be multiple /api/ checks; find the catch-all 404 one
    const catchAllIdx = src.indexOf('jsonResponse({ error: "not_found" }, 404');
    expect(joinIdx).toBeGreaterThan(-1);
    expect(catchAllIdx).toBeGreaterThan(joinIdx);
    expect(src).toMatch(/handleJoinRoutes/);
    void catchIdx;
  });

  it("CSP does not allowlist curie.whop or foreign Whop company frames", () => {
    expect(DAILY_FIX_CSP).not.toMatch(/curie/i);
    expect(DAILY_FIX_CSP).not.toMatch(/whop\.com/);
    // Checkout navigates top-level to whop.com — no need to widen frame-src
  });

  it("wrangler binds ACCOUNT_WRITE + WHOP_CHECKOUT limiters (lockstep)", () => {
    const raw = readFileSync(`${ROOT}/wrangler.jsonc`, "utf8");
    expect(raw).toMatch(/ACCOUNT_WRITE_LIMITER/);
    expect(raw).toMatch(/WHOP_CHECKOUT_LIMITER/);
    expect(raw).toMatch(/27113/);
    expect(raw).toMatch(/27115/);
    expect(raw).toMatch(/27213/);
    expect(raw).toMatch(/27215/);
  });
});
