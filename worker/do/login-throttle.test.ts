import { describe, expect, it } from "vitest";
import { LoginThrottleDO } from "./login-throttle";

function makeDo() {
  const store = new Map<string, unknown>();
  const state = {
    storage: {
      async get<T>(key: string) {
        return store.get(key) as T | undefined;
      },
      async put(key: string, value: unknown) {
        store.set(key, value);
      },
      async delete(key: string) {
        store.delete(key);
      },
      async deleteAll() {
        store.clear();
      },
    },
  } as unknown as DurableObjectState;
  return { do: new LoginThrottleDO(state), store };
}

describe("LoginThrottleDO (R8a/R8b/R8c)", () => {
  it("R8a: 5 free failures then lockout", async () => {
    const { do: throttle } = makeDo();
    // Failures 1–4 record as allowed; 5th records lock; subsequent /r8a/check denied.
    for (let i = 0; i < 4; i++) {
      const res = await throttle.fetch(
        new Request("https://t/r8a/fail", { method: "POST" }),
      );
      const body = (await res.json()) as { allowed: boolean };
      expect(body.allowed).toBe(true);
    }
    const fifth = await throttle.fetch(
      new Request("https://t/r8a/fail", { method: "POST" }),
    );
    expect(((await fifth.json()) as { allowed: boolean }).allowed).toBe(false);
    const check = await throttle.fetch(
      new Request("https://t/r8a/check", { method: "POST" }),
    );
    const locked = (await check.json()) as { allowed: boolean; retryAfter: number };
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfter).toBe(1);
  });

  it("R8b: 21st attempt in window is rejected", async () => {
    const { do: throttle } = makeDo();
    for (let i = 0; i < 20; i++) {
      const res = await throttle.fetch(
        new Request("https://t/r8b/attempt", { method: "POST" }),
      );
      expect(((await res.json()) as { allowed: boolean }).allowed).toBe(true);
    }
    const last = await throttle.fetch(
      new Request("https://t/r8b/attempt", { method: "POST" }),
    );
    const body = (await last.json()) as { allowed: boolean; retryAfter: number };
    expect(body.allowed).toBe(false);
    expect(body.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("R8c: 26th reserve is rejected", async () => {
    const { do: throttle } = makeDo();
    for (let i = 0; i < 25; i++) {
      const res = await throttle.fetch(
        new Request("https://t/r8c/reserve", { method: "POST" }),
      );
      expect(((await res.json()) as { allowed: boolean }).allowed).toBe(true);
    }
    const last = await throttle.fetch(
      new Request("https://t/r8c/reserve", { method: "POST" }),
    );
    expect(((await last.json()) as { allowed: boolean }).allowed).toBe(false);
  });
});
