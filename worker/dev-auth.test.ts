import { describe, expect, it, vi } from "vitest";
import { isAllowedAuthOrigin } from "./auth/csrf";
import {
  isAllowedRecaptchaHostname,
  isAuthHost,
  normalizeHost,
  normalizeHostname,
  parseStagingAuthHosts,
  stagingAuthHostsSet,
} from "./auth/host";
import { isLocalAuthEnabled, parseLocalBsiOrigin } from "./dev-auth";
import {
  assertBsiHost,
  BSI_ORIGIN,
  BSI_STAGING_ORIGIN,
  parsePreviewBsiOrigin,
  resolveBsiOrigin,
  resolveDailyFixBase,
  scopeEnvBsiOrigin,
  type Env,
} from "./upstream";

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

  it("table: empty var, case, trailing dot, ports, hostile Host forms", () => {
    const cases: Array<{
      name: string;
      env?: { STAGING_AUTH_HOSTS?: string; LOCAL_AUTH?: string };
      host?: string;
      origin?: string | null;
      authHost?: boolean;
      authOrigin?: boolean;
      normalizeHost?: string;
      normalizeHostname?: string;
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
        normalizeHost: PREVIEW_HOST,
      },
      {
        name: "Host :443",
        env: stagingEnv,
        host: `${PREVIEW_HOST}:443`,
        authHost: true,
        normalizeHost: PREVIEW_HOST,
      },
      {
        name: "Host :8443 rejected",
        env: stagingEnv,
        host: `${PREVIEW_HOST}:8443`,
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "metfix.org :8443 rejected",
        host: "metfix.org:8443",
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "evil.com@metfix.org",
        host: "evil.com@metfix.org",
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "metfix.org/x",
        host: "metfix.org/x",
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "metfix.org#a",
        host: "metfix.org#a",
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "metfix.org\\\\x",
        host: "metfix.org\\x",
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "https://metfix.org as Host",
        host: "https://metfix.org",
        authHost: false,
        normalizeHost: "",
      },
      {
        name: "uppercase Origin preview",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST.toUpperCase()}`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: true,
      },
      {
        name: "trailing-dot Origin preview",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST}.`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: true,
      },
      {
        name: "trailing-dot Origin metfix.org",
        origin: "https://metfix.org.",
        authOrigin: true,
      },
      {
        name: "uppercase Origin metfix.org",
        origin: "https://MetFix.ORG",
        authOrigin: true,
      },
      {
        // Raw Origin keeps :443; protocol//host omits it → reject (exact form).
        name: "Origin :443 rejected (raw ≠ protocol//host)",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST}:443`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: false,
      },
      {
        name: "Origin :8443 rejected",
        env: stagingEnv,
        origin: `https://${PREVIEW_HOST}:8443`,
        host: PREVIEW_HOST,
        authHost: true,
        authOrigin: false,
      },
      {
        name: "Origin userinfo rejected",
        origin: "https://evil.com@metfix.org",
        authOrigin: false,
      },
      {
        name: "Origin user:pass rejected",
        origin: "https://u:p@metfix.org",
        authOrigin: false,
      },
      {
        name: "Origin :password rejected",
        origin: "https://:p@metfix.org",
        authOrigin: false,
      },
      {
        name: "Origin evilmetfix.org lookalike rejected",
        origin: "https://evilmetfix.org",
        authOrigin: false,
      },
      {
        name: "Origin xmetfix.org lookalike rejected",
        origin: "https://xmetfix.org",
        authOrigin: false,
      },
      {
        name: "Origin trailing slash rejected",
        origin: "https://metfix.org/",
        authOrigin: false,
      },
      {
        name: "Origin path rejected",
        origin: "https://metfix.org/x",
        authOrigin: false,
      },
      {
        name: "Origin query rejected",
        origin: "https://metfix.org?q=1",
        authOrigin: false,
      },
      {
        name: "Origin hash rejected",
        origin: "https://metfix.org#a",
        authOrigin: false,
      },
      {
        name: "a..b hostname rejected",
        host: "a..b",
        authHost: false,
        normalizeHost: "",
      },
    ];

    for (const c of cases) {
      const env = c.env ?? {};
      if (c.host != null && c.authHost != null) {
        expect(isAuthHost(req(c.host), env), c.name).toBe(c.authHost);
      }
      if (c.authOrigin != null && c.origin !== undefined) {
        expect(
          isAllowedAuthOrigin(c.origin, { ...emptyEnv, ...env }),
          c.name,
        ).toBe(c.authOrigin);
      }
      if (c.normalizeHost != null && c.host != null) {
        expect(normalizeHost(c.host), c.name).toBe(c.normalizeHost);
      }
    }

    expect(parseStagingAuthHosts({ STAGING_AUTH_HOSTS: "" })).toEqual([]);
    expect(parseStagingAuthHosts({ STAGING_AUTH_HOSTS: " , " })).toEqual([]);
    expect(normalizeHost(`${PREVIEW_HOST}.`)).toBe(PREVIEW_HOST);
    expect(normalizeHost(`${PREVIEW_HOST}:443`)).toBe(PREVIEW_HOST);
    expect(normalizeHost(`${PREVIEW_HOST}:8443`)).toBe("");
    expect(normalizeHostname("metfix.org.")).toBe("metfix.org");
    expect(normalizeHostname("metfix.org:443")).toBe("");
    expect(normalizeHostname("https://metfix.org")).toBe("");
    expect(normalizeHostname("a..b")).toBe("");
    expect(isAllowedRecaptchaHostname("metfix.org:443", emptyEnv)).toBe(false);
  });

  it("caches STAGING_AUTH_HOSTS Set by raw value (same reference)", () => {
    const raw = `once-parse-${Date.now()}.example`;
    const env = { STAGING_AUTH_HOSTS: raw };
    const first = stagingAuthHostsSet(env);
    const second = stagingAuthHostsSet(env);
    expect(second).toBe(first);
    expect(first.has(raw)).toBe(true);
  });

  it("logs rejected STAGING_AUTH_HOSTS entries once per raw value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = `*.workers.dev,https://x.example,ok-${Date.now()}.example`;
    parseStagingAuthHosts({ STAGING_AUTH_HOSTS: raw });
    parseStagingAuthHosts({ STAGING_AUTH_HOSTS: raw });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("STAGING_AUTH_HOSTS rejected entries");
    expect(parseStagingAuthHosts({ STAGING_AUTH_HOSTS: raw })).toHaveLength(1);
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
    expect(isAllowedAuthOrigin("https://metfix.org.", emptyEnv)).toBe(true);
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

  it("production env with BSI_ORIGIN set still resolves brokenscience.org", () => {
    // Production has no STAGING_AUTH_HOSTS — even an exact staging override is ignored.
    const prodWithLeak = {
      ...emptyEnv,
      BSI_ORIGIN: BSI_STAGING_ORIGIN,
    };
    expect(resolveBsiOrigin(prodWithLeak)).toBe(BSI_ORIGIN);
    expect(resolveBsiOrigin(prodWithLeak, { request: req("metfix.org") })).toBe(BSI_ORIGIN);
    expect(parsePreviewBsiOrigin(prodWithLeak, { request: req("metfix.org") })).toBeNull();
    expect(scopeEnvBsiOrigin(prodWithLeak, req("metfix.org")).BSI_ORIGIN).toBeUndefined();
  });

  it("resolveBsiOrigin rejects any BSI_ORIGIN other than exact brokenstaging", () => {
    const previewReq = req(PREVIEW_HOST);
    const cases = [
      "https://evil.example",
      "https://brokenscience.org",
      "http://brokenstaging.wpengine.com",
      "https://brokenstaging.wpengine.com/",
      "https://brokenstaging.wpengine.com/path",
      "https://BrokenStaging.wpengine.com",
      " https://brokenstaging.wpengine.com",
    ];
    for (const bad of cases) {
      const env = { ...emptyEnv, ...stagingEnv, BSI_ORIGIN: bad };
      expect(resolveBsiOrigin(env, { request: previewReq })).toBe(BSI_ORIGIN);
      expect(parsePreviewBsiOrigin(env, { request: previewReq })).toBeNull();
      expect(scopeEnvBsiOrigin(env, previewReq).BSI_ORIGIN).toBeUndefined();
    }
  });

  it("preview with exact brokenstaging + STAGING_AUTH_HOSTS host resolves staging BSI", () => {
    const previewEnv = {
      ...emptyEnv,
      ...stagingEnv,
      BSI_ORIGIN: BSI_STAGING_ORIGIN,
    };
    const previewReq = req(PREVIEW_HOST);
    expect(parsePreviewBsiOrigin(previewEnv, { request: previewReq })).toBe(BSI_STAGING_ORIGIN);
    expect(resolveBsiOrigin(previewEnv, { request: previewReq })).toBe(BSI_STAGING_ORIGIN);
    // Does not require LOCAL_AUTH.
    expect(previewEnv.LOCAL_AUTH).toBeUndefined();
    expect(resolveDailyFixBase(previewEnv, { request: previewReq })).toBe(
      `${BSI_STAGING_ORIGIN}/wp-json/metfix/v1/daily-fix`,
    );
    // After request-boundary scoping, downstream resolve (no Request) still sees staging.
    const scoped = scopeEnvBsiOrigin(previewEnv, previewReq);
    expect(scoped.BSI_ORIGIN).toBe(BSI_STAGING_ORIGIN);
    expect(resolveBsiOrigin(scoped)).toBe(BSI_STAGING_ORIGIN);
    // Non-allowlisted Host never gets staging even when both preview vars are set.
    expect(resolveBsiOrigin(previewEnv, { request: req("metfix.org") })).toBe(BSI_ORIGIN);
    expect(scopeEnvBsiOrigin(previewEnv, req("metfix.org")).BSI_ORIGIN).toBeUndefined();
  });
});
