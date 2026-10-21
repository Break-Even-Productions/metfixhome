import type { Env } from "../upstream";
import { sha256Hex } from "./crypto";

export class ThrottleUnavailableError extends Error {
  constructor() {
    super("throttle_unavailable");
    this.name = "ThrottleUnavailableError";
  }
}

function stub(env: Env, name: string): DurableObjectStub {
  if (!env.LOGIN_THROTTLE) throw new ThrottleUnavailableError();
  return env.LOGIN_THROTTLE.get(env.LOGIN_THROTTLE.idFromName(name));
}

async function post(
  env: Env,
  name: string,
  path: string,
): Promise<{ allowed: boolean; retryAfter?: number; count?: number; failures?: number }> {
  let res: Response;
  try {
    res = await stub(env, name).fetch(
      new Request(`https://throttle.do${path}`, { method: "POST" }),
    );
  } catch {
    throw new ThrottleUnavailableError();
  }
  if (res.status === 503) throw new ThrottleUnavailableError();
  return (await res.json()) as {
    allowed: boolean;
    retryAfter?: number;
    count?: number;
    failures?: number;
  };
}

export async function r8aName(identifier: string): Promise<string> {
  const norm = identifier.trim().toLowerCase();
  return `id:${await sha256Hex(norm)}`;
}

export async function r8bName(ip: string): Promise<string> {
  return `ip:${await sha256Hex(ip)}`;
}

export const R8C_NAME = "login:global";

export async function checkR8a(
  env: Env,
  identifier: string,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const data = await post(env, await r8aName(identifier), "/r8a/check");
  if (!data.allowed) return { allowed: false, retryAfter: data.retryAfter ?? 1 };
  return { allowed: true };
}

export async function failR8a(env: Env, identifier: string): Promise<void> {
  await post(env, await r8aName(identifier), "/r8a/fail");
}

export async function clearR8a(env: Env, identifier: string): Promise<void> {
  await post(env, await r8aName(identifier), "/r8a/clear");
}

export async function attemptR8b(
  env: Env,
  ip: string,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const data = await post(env, await r8bName(ip), "/r8b/attempt");
  if (!data.allowed) return { allowed: false, retryAfter: data.retryAfter ?? 1 };
  return { allowed: true };
}

export async function reserveR8c(
  env: Env,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const data = await post(env, R8C_NAME, "/r8c/reserve");
  if (!data.allowed) return { allowed: false, retryAfter: data.retryAfter ?? 1 };
  return { allowed: true };
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
}
