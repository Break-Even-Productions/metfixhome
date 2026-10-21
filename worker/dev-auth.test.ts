import { describe, expect, it } from "vitest";
import { isAllowedAuthOrigin } from "./auth/csrf";
import { isAuthHost } from "./auth/host";
import { isLocalAuthEnabled, parseLocalBsiOrigin } from "./dev-auth";
import { assertBsiHost, resolveBsiOrigin, resolveDailyFixBase, type Env } from "./upstream";

function req(host: string): Request {
  return new Request("https://example.test/api/auth/login", {
    headers: { Host: host },
  });
}

const emptyEnv = {} as Env;

describe("local auth helpers", () => {
  it("LOCAL_AUTH off: only metfix.org is auth host", () => {
    expect(isAuthHost(req("metfix.org"))).toBe(true);
    expect(isAuthHost(req("localhost"), {})).toBe(false);
    expect(isAuthHost(req("127.0.0.1"), { LOCAL_AUTH: "0" })).toBe(false);
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
