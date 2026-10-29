import { describe, expect, it, vi } from "vitest";
import { isAllowedAuthOrigin } from "./auth/csrf";
import {
  isAllowedRecaptchaHostname,
  isAuthHost,
  normalizeHost,
  parseStagingAuthHosts,
  stagingAuthHostsSet,
} from "./auth/host";
import { isLocalAuthEnabled, parseLocalBsiOrigin } from "./dev-auth";
import { assertBsiHost, resolveBsiOrigin, resolveDailyFixBase, type Env } from "./upstream";

function req(host: string): Request {
  return new Request("https://example.test/api/auth/login", {
    headers: { Host: host },
  });
}

const emptyEnv = {} as Env;

const PREVIEW_HOST = "staging-metfixhome.wispy-mode-982d.workers.dev";
const stagingEnv = { STAGING_AUTH_HOSTS: PREVIEW_HOST };

describe("local auth helpers", () => {
  it("LOCAL_AUTH off: only metfix.org is auth host", () => {
    expect(isAuthHost(req("metfix.org"))).toBe(true);
    expect(isAuthHost(req("localhost"), {})).toBe(false);
    expect(isAuthHost(req("127.0.0.1"), { LOCAL_AUTH: "0" })).toBe(false);
  });

  it("production config (no STAGING_AUTH_HOSTS) rejects the staging preview host", () => {
    expect(isAuthHost(req(PREVIEW_HOST), emptyEnv)).toBe(false);
    expect(isAuthHost(req(PREVIEW_HOST))).toBe(false);
    expect(isAuthHost(req(PREVIEW_HOST), { LOCAL_AUTH: "1" })).toBe(false);
    expect(isAllowedAuthOrigin(`https://${PREVIEW_HOST}`, emptyEnv)).toBe(false);
    expect(isAllowedRecaptchaHostname(PREVIEW_HOST, emptyEnv)).toBe(false);
  });

  it("STAGING_AUTH_HOSTS accepts exactly the listed host", () => {
    expect(parseStagingAuthHosts(stagingEnv)).toEqual([PREVIEW_HOST]);
    expect(stagingAuthHostsSet(stagingEnv).has(PREVIEW_HOST)).toBe(true);
    expect(isAuthHost(req(PREVIEW_HOST), stagingEnv)).toBe(true);
    expect(isAuthHost(req("metfix.org"), stagingEnv)).toBe(true);
    expect(isAllowedAuthOrigin(`https://${PREVIEW_HOST}`, {
      ...emptyEnv,
      ...stagingEnv,
    })).toBe(true);
    expect(isAllowedRecaptchaHostname(PREVIEW_HOST, stagingEnv)).toBe(true);
  });

  it("STAGING_AUTH_HOSTS rejects lookalike hosts (no suffix / wildcard)", () => {
    const env = stagingEnv;
    expect(isAuthHost(req(`evil-${PREVIEW_HOST}`), env)).toBe(false);
    expect(isAuthHost(req(`${PREVIEW_HOST}.evil.com`), env)).toBe(false);
    expect(isAuthHost(req("metfixhome.wispy-mode-982d.workers.dev"), env)).toBe(false);
    expect(isAuthHost(req("staging-metfixhome.evil.workers.dev"), env)).toBe(false);
    expect(isAuthHost(req("wispy-mode-982d.workers.dev"), env)).toBe(false);
    expect(isAllowedAuthOrigin(`https://evil-${PREVIEW_HOST}`, {
      ...emptyEnv,
      ...env,
    })).toBe(false);
    expect(isAllowedAuthOrigin(`http://${PREVIEW_HOST}`, {
      ...emptyEnv,
      ...env,
    })).toBe(false);
    expect(isAllowedRecaptchaHostname(`evil-${PREVIEW_HOST}`, env)).toBe(false);
    // Wildcard / URL tokens in the env var are ignored, not treated as matches.
    expect(
      parseStagingAuthHosts({ STAGING_AUTH_HOSTS: "*.workers.dev,https://x.example" }),
    ).toEqual([]);
    expect(
      isAuthHost(req("anything.workers.dev"), {
        STAGING_AUTH_HOSTS: "*.workers.dev",
      }),
    ).toBe(false);
  });

  it("table: empty var, case, trailing dot, Host port, Origin port", () => {
    const cases: Array<{
      name: string;
      env: { STAGING_AUTH_HOSTS?: string };
      host?: string;
      origin?: string | null;
      authHost: boolean;
      authOrigin?: boolean;
    }> = [
      { name: "empty string", env: { STAGING_AUTH_HOSTS: "" }, host: PREVIEW_HOST, authHost: false },
      { name: "comma/space only", env: { STAGING_AUTH_HOSTS: " , " }, host: PREVIEW_HOST, authHost: false },
      {
        name: "uppercase Host",
        env: stagingEnv,
        host: PREVIEW_HOST.toUpperCase(),
        authHost: true,
      },
      {
        name: "trailing-dot Host",
        env: stagingEnv,
        host: `${PREVIEW_HOST}.`,
        authHost: true,
      },
      {
        name: "Host with port",
        env: stagingEnv,
        host: `${PREVIEW_HOST}:443`,
        authHost: true,
      },
      {
        name: "uppercase Origin",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST.toUpperCase()}`,
        authHost: true,
        host: PREVIEW_HOST,
        authOrigin: true,
      },
      {
        name: "trailing-dot Origin",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST}.`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: true,
      },
      {
        name: "Origin :443",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST}:443`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: true,
      },
      {
        name: "Origin non-default port rejected",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST}:8443`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: false,
      },
    ];

    for (const c of cases) {
      if (c.host != null) {
        expect(isAuthHost(req(c.host), c.env), c.name).toBe(c.authHost);
      }
      if (c.authOrigin != null && c.origin !== undefined) {
        expect(
          isAllowedAuthOrigin(c.origin, { ...emptyEnv, ...c.env }),
          c.name,
        ).toBe(c.authOrigin);
      }
    }

    expect(parseStagingAuthHosts({ STAGING_AUTH_HOSTS: "" })).toEqual([]);
    expect(parseStagingAuthHosts({ STAGING_AUTH_HOSTS: " , " })).toEqual([]);
    expect(normalizeHost(`${PREVIEW_HOST}.`)).toBe(PREVIEW_HOST);
    expect(normalizeHost(`${PREVIEW_HOST}:443`)).toBe(PREVIEW_HOST);
  });

  it("logs rejected STAGING_AUTH_HOSTS entries once per raw value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = "*.workers.dev,https://x.example,ok.example";
    // First parse with this raw → one warn
    parseStagingAuthHosts({ STAGING_AUTH_HOSTS: raw });
    parseStagingAuthHosts({ STAGING_AUTH_HOSTS: raw });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("STAGING_AUTH_HOSTS rejected entries");
    expect(parseStagingAuthHosts({ STAGING_AUTH_HOSTS: raw })).toEqual(["ok.example"]);
    warn.mockRestore();
  });

  it("LOCAL_AUTH on: localhost and 127.0.0.1 allowed; other hosts still rejected", () => {
    const env = { LOCAL_AUTH: "1" };
    expect(isLocalAuthEnabled(env)).toBe(true);
    expect(isAuthHost(req("localhost"), env)).toBe(true);
    expect(isAuthHost(req("127.0.0.1:8787"), env)).toBe(true);
    expect(isAuthHost(req("metfix.org"), env)).toBe(true);
    expect(isAuthHost(req("evil.example"), env)).toBe(false);
    expect(isAuthHost(req("preview.pages.dev"), env)).toBe(false);
  });

  it("assertBsiHost allows only prod BSI unless LOCAL_AUTH + BSI_ORIGIN", () => {
    expect(() => assertBsiHost("https://brokenscience.org/x")).not.toThrow();
    expect(() => assertBsiHost("https://evil.example/x")).toThrow();
    expect(() =>
      assertBsiHost("http://127.0.0.1:8080/x", { LOCAL_AUTH: "1" }),
    ).toThrow();
    expect(() =>
      assertBsiHost("http://127.0.0.1:8080/wp-json/x", {
        LOCAL_AUTH: "1",
        BSI_ORIGIN: "http://127.0.0.1:8080",
      }),
    ).not.toThrow();
    // LOCAL_AUTH alone must not open arbitrary hosts
    expect(() =>
      assertBsiHost("https://attacker.test/x", {
        LOCAL_AUTH: "1",
        BSI_ORIGIN: "http://127.0.0.1:8080",
      }),
    ).toThrow();
  });

  it("CSRF Origin accepts localhost only when LOCAL_AUTH is on", () => {
    expect(isAllowedAuthOrigin("https://metfix.org", emptyEnv)).toBe(true);
    expect(isAllowedAuthOrigin("http://localhost:3000", emptyEnv)).toBe(false);
    expect(
      isAllowedAuthOrigin("http://localhost:3000", { ...emptyEnv, LOCAL_AUTH: "1" }),
    ).toBe(true);
    expect(
      isAllowedAuthOrigin("http://evil.example", { ...emptyEnv, LOCAL_AUTH: "1" }),
    ).toBe(false);
  });

  it("resolveBsiOrigin prefers explicit local origin only when LOCAL_AUTH is on", () => {
    expect(parseLocalBsiOrigin({})).toBeNull();
    expect(parseLocalBsiOrigin({ BSI_ORIGIN: "http://127.0.0.1:8080" })).toBeNull();
    expect(
      parseLocalBsiOrigin({ LOCAL_AUTH: "1", BSI_ORIGIN: "http://127.0.0.1:8080" }),
    ).toBe("http://127.0.0.1:8080");
    expect(resolveBsiOrigin(emptyEnv)).toBe("https://brokenscience.org");
    expect(
      resolveBsiOrigin({
        ...emptyEnv,
        LOCAL_AUTH: "1",
        BSI_ORIGIN: "http://127.0.0.1:8080",
      }),
    ).toBe("http://127.0.0.1:8080");
    expect(
      resolveDailyFixBase({
        ...emptyEnv,
        LOCAL_AUTH: "1",
        BSI_ORIGIN: "http://127.0.0.1:8080",
      }),
    ).toBe("http://127.0.0.1:8080/wp-json/metfix/v1/daily-fix");
  });
});
