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
  noteCsrfSessionChange,
  postJsonWithCsrf,
} from "./authRequest";

afterEach(() => {
  clearCsrfCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  clearCsrfCache();
});

describe("csrfSessionKey", () => {
  it("returns a generation-tied key", () => {
    const a = csrfSessionKey();
    expect(a).toMatch(/^g\d+$/);
    noteCsrfSessionChange();
    expect(csrfSessionKey()).not.toBe(a);
  });
});

describe("fetchCsrf session binding (NB2)", () => {
  it("caches token per session and refetches when session changes", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return Response.json({ csrf: `tok-${n}` });
      }),
    );

    expect(await fetchCsrf()).toBe("tok-1");
    expect(await fetchCsrf()).toBe("tok-1");
    expect(n).toBe(1);

    noteCsrfSessionChange();
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

    const res = await postJsonWithCsrf("/api/account/onboarding", { first_name: "Pat" });
    expect(res.status).toBe(200);
    expect(tokensSeen).toEqual(["csrf-1", "csrf-2"]);
    expect(csrfN).toBe(2);
  });
});
