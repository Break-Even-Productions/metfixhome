import { describe, expect, it } from "vitest";
import { ORIGIN, createHarness, leakFree, setupAuthHooks } from "./realauth-harness.test";

setupAuthHooks();

describe("AU1", () => {
  it("AU1.1 §5.1 routes return non-404 from handler", async () => {
    const h = createHarness();
    for (const [path, method] of [
      ["/api/auth/csrf", "GET"],
      ["/api/auth/login", "POST"],
      ["/api/auth/me", "GET"],
      ["/api/auth/callback", "GET"],
    ] as const) {
      const res = await h.call(path, { method, headers: { Origin: ORIGIN }, body: method === "POST" ? "{}" : undefined });
      expect(res.status).not.toBe(404);
      leakFree(await res.clone().text());
    }
  });

  it("AU1.2 retired paths 404 NW", async () => {
    const h = createHarness();
    for (const p of ["/api/auth/session", "/api/auth/refresh", "/api/auth/login/"]) {
      const n = h.fetches.length;
      expect((await h.call(p)).status).toBe(404);
      expect(h.fetches.length).toBe(n);
    }
  });

  it("AU1.3 wrong methods 405 Allow", async () => {
    const h = createHarness();
    const res = await h.call("/api/auth/csrf", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
  });

  it("AU1.4 OPTIONS 405 no CORS", async () => {
    const h = createHarness();
    const res = await h.call("/api/auth/login", { method: "OPTIONS" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("AU1.6 Google off 404", async () => {
    const h = createHarness({ googleEnabled: false });
    expect((await h.call("/api/auth/google/start")).status).toBe(404);
  });

  it("AU1.5 AUTH-HOST blocks auth not comment GET", async () => {
    const h = createHarness();
    expect((await h.call("/api/auth/csrf", {}, "localhost")).status).toBe(404);
    expect(
      (await h.call("/api/daily-fix/comments?date=2025-02-10&type=all", {}, "www.metfix.org")).status,
    ).toBe(200);
  });
});
