/**
 * @vitest-environment jsdom
 *
 * CQ r2 NB2: CSRF cache is session-tied; 403 retries once with a fresh token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCsrfCache,
  csrfSessionKey,
  fetchCsrf,
  postJsonWithCsrf,
} from "./authRequest";

afterEach(() => {
  clearCsrfCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.cookie = "mfx_sid=; Max-Age=0; path=/";
});

beforeEach(() => {
  clearCsrfCache();
  document.cookie = "mfx_sid=; Max-Age=0; path=/";
});

describe("csrfSessionKey", () => {
  it("returns anon when no sid cookie", () => {
    expect(csrfSessionKey("")).toBe("anon");
    expect(csrfSessionKey("other=1")).toBe("anon");
  });

  it("reads mfx_sid and __Host-mfx_sid", () => {
    expect(csrfSessionKey("mfx_sid=abc123; path=/")).toBe("abc123");
    expect(csrfSessionKey("__Host-mfx_sid=host-sid")).toBe("host-sid");
  });
});

describe("fetchCsrf session binding (NB2)", () => {
  it("caches token per session and refetches when sid changes", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return Response.json({ csrf: `tok-${n}` });
      }),
    );

    document.cookie = "mfx_sid=sid-a; path=/";
    expect(await fetchCsrf()).toBe("tok-1");
    expect(await fetchCsrf()).toBe("tok-1");
    expect(n).toBe(1);

    document.cookie = "mfx_sid=sid-b; path=/";
    expect(await fetchCsrf()).toBe("tok-2");
    expect(n).toBe(2);
  });

  it("clearCsrfCache forces refetch (sign-in/out)", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return Response.json({ csrf: `tok-${n}` });
      }),
    );
    document.cookie = "mfx_sid=sid-a; path=/";
    expect(await fetchCsrf()).toBe("tok-1");
    clearCsrfCache();
    expect(await fetchCsrf()).toBe("tok-2");
    expect(n).toBe(2);
  });
});

describe("postJsonWithCsrf (NB2)", () => {
  it("retries once on 403 with a forced fresh CSRF token", async () => {
    const tokensSeen: string[] = [];
    let csrfN = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) {
          csrfN += 1;
          return Response.json({ csrf: `csrf-${csrfN}` });
        }
        const headers = new Headers(init?.headers);
        tokensSeen.push(headers.get("X-CSRF-Token") ?? "");
        if (tokensSeen.length === 1) {
          return Response.json({ error: "csrf" }, { status: 403 });
        }
        return Response.json({ ok: true });
      }),
    );

    document.cookie = "mfx_sid=sid-a; path=/";
    const res = await postJsonWithCsrf("/api/account/onboarding", { first_name: "Pat" });
    expect(res.status).toBe(200);
    expect(tokensSeen).toEqual(["csrf-1", "csrf-2"]);
    expect(csrfN).toBe(2);
  });
});
