/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { isAuthUiHost } from "./authHost";

describe("isAuthUiHost", () => {
  afterEach(() => {
    delete (window as unknown as { __MFX_STAGING_AUTH_HOSTS__?: unknown })
      .__MFX_STAGING_AUTH_HOSTS__;
  });

  it("allows metfix.org", () => {
    expect(isAuthUiHost("metfix.org")).toBe(true);
  });

  it("rejects unknown hosts without injection", () => {
    expect(isAuthUiHost("staging-metfixhome.wispy-mode-982d.workers.dev")).toBe(false);
    expect(isAuthUiHost("evil.example")).toBe(false);
  });

  it("allows exact injected staging hosts (case-insensitive)", () => {
    const host = "staging-metfixhome.wispy-mode-982d.workers.dev";
    (window as unknown as { __MFX_STAGING_AUTH_HOSTS__: string[] }).__MFX_STAGING_AUTH_HOSTS__ = [
      host,
    ];
    expect(isAuthUiHost(host)).toBe(true);
    expect(isAuthUiHost(host.toUpperCase())).toBe(true);
    expect(isAuthUiHost(`evil-${host}`)).toBe(false);
  });

  it("ignores non-array injection", () => {
    (window as unknown as { __MFX_STAGING_AUTH_HOSTS__: string }).__MFX_STAGING_AUTH_HOSTS__ =
      "staging-metfixhome.wispy-mode-982d.workers.dev";
    expect(isAuthUiHost("staging-metfixhome.wispy-mode-982d.workers.dev")).toBe(false);
  });
});
