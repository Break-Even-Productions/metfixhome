/**
 * Upstream 401 still refreshes once. A refresh that only times out or 5xx
 * stays 503 and keeps the session. The session is destroyed when the grant
 * is dead, or when the retry is still 401.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, FetchImpl } from "../upstream";

const sessionState = vi.hoisted(() => ({
  ensure: vi.fn(),
  destroy: vi.fn(async () => null),
}));

vi.mock("./session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./session")>();
  return {
    ...actual,
    ensureActingAccess: (...args: unknown[]) => sessionState.ensure(...args),
    destroySession: (...args: unknown[]) => sessionState.destroy(...args),
  };
});

import { runUserBsiCall, type ActingContext } from "./acting";
import { SessionUnavailableError } from "./session";

function acting(): ActingContext {
  const now = Date.now();
  return {
    sid: "sid-1",
    hex: "hex-1",
    access: "access-1",
    record: {
      bsi_access: "access-1",
      bsi_refresh: "refresh-1",
      access_exp: now + 3_600_000,
      user_public_name: "Member",
      bsi_user_id: "42",
      can_moderate: false,
      created: now,
      last_seen: now,
    },
  };
}

function refreshed() {
  const ctx = acting();
  return {
    hex: ctx.hex,
    record: { ...ctx.record, bsi_access: "access-2", bsi_refresh: "refresh-2" },
  };
}

describe("runUserBsiCall refresh after 401", () => {
  beforeEach(() => {
    sessionState.ensure.mockReset();
    sessionState.destroy.mockReset();
    sessionState.destroy.mockResolvedValue(null);
  });

  it("does not refresh when the upstream call is not 401", async () => {
    const seen: string[] = [];
    const ran = await runUserBsiCall(
      acting(),
      {} as Env,
      vi.fn() as unknown as FetchImpl,
      undefined,
      async (access) => {
        seen.push(access);
        return { kind: "ok", status: 200 };
      },
    );
    expect(ran).toMatchObject({ result: { kind: "ok", status: 200 } });
    expect(seen).toEqual(["access-1"]);
    expect(sessionState.ensure).not.toHaveBeenCalled();
    expect(sessionState.destroy).not.toHaveBeenCalled();
  });

  it("refreshes once and retries with the new access token", async () => {
    sessionState.ensure.mockResolvedValue(refreshed());
    const seen: string[] = [];
    const ran = await runUserBsiCall(
      acting(),
      {} as Env,
      vi.fn() as unknown as FetchImpl,
      undefined,
      async (access) => {
        seen.push(access);
        if (access === "access-1") return { kind: "http", status: 401 };
        return { kind: "ok", status: 200 };
      },
    );
    expect(seen).toEqual(["access-1", "access-2"]);
    expect(ran).toMatchObject({ result: { status: 200 } });
    expect(sessionState.ensure).toHaveBeenCalledTimes(1);
    expect(sessionState.ensure.mock.calls[0]?.[2]).toMatchObject({ force: true });
    expect(sessionState.destroy).not.toHaveBeenCalled();
  });

  it("destroys the session when the refresh grant is dead", async () => {
    sessionState.ensure.mockResolvedValue(null);
    const seen: string[] = [];
    const ran = await runUserBsiCall(
      acting(),
      {} as Env,
      vi.fn() as unknown as FetchImpl,
      undefined,
      async (access) => {
        seen.push(access);
        return { kind: "http", status: 401 };
      },
    );
    expect(seen).toEqual(["access-1"]);
    expect(ran).toBeInstanceOf(Response);
    const res = ran as Response;
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "signed_out" });
    expect(res.headers.get("Set-Cookie")).toBeTruthy();
    expect(sessionState.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the session when the retry is still 401", async () => {
    sessionState.ensure.mockResolvedValue(refreshed());
    const seen: string[] = [];
    const ran = await runUserBsiCall(
      acting(),
      {} as Env,
      vi.fn() as unknown as FetchImpl,
      undefined,
      async (access) => {
        seen.push(access);
        return { kind: "http", status: 401 };
      },
    );
    expect(seen).toEqual(["access-1", "access-2"]);
    expect(ran).toBeInstanceOf(Response);
    expect((ran as Response).status).toBe(401);
    expect(await (ran as Response).json()).toEqual({ error: "signed_out" });
    expect(sessionState.destroy).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and keeps the session when refresh times out or returns 5xx", async () => {
    for (const retryAfter of [60, undefined]) {
      sessionState.ensure.mockReset();
      sessionState.destroy.mockClear();
      sessionState.ensure.mockRejectedValue(new SessionUnavailableError(retryAfter));
      const seen: string[] = [];
      const ran = await runUserBsiCall(
        acting(),
        {} as Env,
        vi.fn() as unknown as FetchImpl,
        undefined,
        async (access) => {
          seen.push(access);
          return { kind: "http", status: 401 };
        },
      );
      expect(seen).toEqual(["access-1"]);
      expect(ran).toBeInstanceOf(Response);
      const res = ran as Response;
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "unavailable" });
      expect(res.headers.get("Retry-After")).toBe(String(retryAfter ?? 300));
      expect(res.headers.get("Set-Cookie")).toBeNull();
      expect(sessionState.destroy).not.toHaveBeenCalled();
    }
  });
});
