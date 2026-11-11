import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMetfixLoginUrl } from "@/const";
import { sanitizeReturnPath } from "@shared/account/returnPath";

const loginSrc = readFileSync(path.join(import.meta.dirname, "Login.tsx"), "utf8");

describe("Login ?next redirect", () => {
  it("getMetfixLoginUrl encodes next for the login page", () => {
    expect(getMetfixLoginUrl("/library")).toBe("/login?next=%2Flibrary");
    expect(getMetfixLoginUrl("/account/billing")).toBe("/login?next=%2Faccount%2Fbilling");
  });

  it("shared sanitizeReturnPath accepts login next targets", () => {
    expect(sanitizeReturnPath("/library")).toBe("/library");
    expect(sanitizeReturnPath("/checkout/complete")).toBe("/checkout/complete");
    expect(sanitizeReturnPath("/account?tab=billing")).toBe("/account?tab=billing");
  });

  it("Login maps ?next into Google OAuth return and hard-redirects after password login", () => {
    expect(loginSrc).toMatch(/sanitizeReturnPath/);
    expect(loginSrc).toMatch(/params\.get\("next"\)/);
    expect(loginSrc).toMatch(/URLSearchParams\(\{\s*return:\s*nextPath\s*\}\)/);
    expect(loginSrc).toMatch(/\/api\/auth\/google\/start/);
    expect(loginSrc).toMatch(/window\.location\.assign\(basePath\(nextPath\)\)/);
    // Must not start Google without forwarding return/next.
    expect(loginSrc).not.toMatch(
      /window\.location\.assign\(\s*["']\/api\/auth\/google\/start["']\s*\)/,
    );
  });
});
