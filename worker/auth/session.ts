import type { Env } from "../upstream";
import { normalizeCanModerate } from "../upstream";
import { randomId32, sha256Hex } from "./crypto";
import type { SessionRecord } from "../do/session";

export type MeCache = {
  public_name: string;
  moderator: boolean;
  user_public_name: string;
  created: number;
  last_seen: number;
  can_moderate: boolean;
  bsi_user_id: string;
};

export async function sessionKeyHex(rawId: string): Promise<string> {
  return sha256Hex(rawId);
}

export function sessKvKey(hex: string): string {
  return `sess:${hex}`;
}

export function sessionAad(hex: string): string {
  return `sess:${hex}`;
}

export function sessionStub(env: Env, hex: string): DurableObjectStub {
  return env.SESSION.get(env.SESSION.idFromName(sessionAad(hex)));
}

async function doFetch(
  stub: DurableObjectStub,
  path: string,
  init: RequestInit & { aad: string },
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Session-AAD", init.aad);
  return stub.fetch(
    new Request(`https://session.do${path}`, {
      method: init.method,
      headers,
      body: init.body,
    }),
  );
}

type TokenInput = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  public_name?: string;
  user_id?: string | number;
  can_moderate?: unknown;
};

/** Overload: createSession(env, tokens) → sid; createSession(env, sid, tokens) → {hex, record}. */
export async function createSession(env: Env, tokens: TokenInput): Promise<string>;
export async function createSession(
  env: Env,
  rawId: string,
  tokens: TokenInput,
): Promise<{ hex: string; record: SessionRecord }>;
export async function createSession(
  env: Env,
  a: string | TokenInput,
  b?: TokenInput,
): Promise<string | { hex: string; record: SessionRecord }> {
  const rawId = typeof a === "string" ? a : randomId32();
  const tokens = typeof a === "string" ? b! : a;
  const hex = await sessionKeyHex(rawId);
  const now = Date.now();
  const record: SessionRecord = {
    bsi_access: tokens.access_token,
    bsi_refresh: tokens.refresh_token,
    access_exp: now + (typeof tokens.expires_in === "number" ? tokens.expires_in * 1000 : 3600_000),
    user_public_name:
      typeof tokens.public_name === "string" && tokens.public_name.trim()
        ? tokens.public_name.trim()
        : "Member",
    bsi_user_id: String(tokens.user_id ?? "0"),
    can_moderate: normalizeCanModerate(tokens.can_moderate),
    created: now,
    last_seen: now,
  };
  const stub = sessionStub(env, hex);
  const res = await doFetch(stub, "/session", {
    method: "PUT",
    aad: sessionAad(hex),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error("session_put_failed");
  await putMeCache(env, hex, record);
  if (typeof a === "string") return { hex, record };
  return rawId;
}

export async function putMeCache(env: Env, hex: string, record: SessionRecord): Promise<void> {
  const value: MeCache = {
    public_name: record.user_public_name,
    moderator: record.can_moderate === true,
    user_public_name: record.user_public_name,
    created: record.created,
    last_seen: record.last_seen,
    can_moderate: record.can_moderate === true,
    bsi_user_id: record.bsi_user_id,
  };
  await env.AUTH_SESSIONS.put(sessKvKey(hex), JSON.stringify(value), {
    expirationTtl: 60,
  });
}

export async function deleteMeCache(env: Env, hex: string): Promise<void> {
  await env.AUTH_SESSIONS.delete(sessKvKey(hex));
}

export async function getMeCache(env: Env, hex: string): Promise<MeCache | null> {
  const raw = await env.AUTH_SESSIONS.get(sessKvKey(hex), "text");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MeCache;
  } catch {
    return null;
  }
}

export async function loadSession(
  env: Env,
  rawId: string,
): Promise<{ hex: string; record: SessionRecord } | null> {
  const hex = await sessionKeyHex(rawId);
  const stub = sessionStub(env, hex);
  try {
    const res = await doFetch(stub, "/session", { method: "GET", aad: sessionAad(hex) });
    if (!res.ok) return null;
    const data = (await res.json()) as { present?: boolean; record?: SessionRecord | null };
    if (!data.record) return null;
    return { hex, record: data.record };
  } catch {
    return null;
  }
}

export async function destroySession(env: Env, rawId: string): Promise<SessionRecord | null> {
  const loaded = await loadSession(env, rawId);
  const hex = await sessionKeyHex(rawId);
  const stub = sessionStub(env, hex);
  try {
    await doFetch(stub, "/session", { method: "DELETE", aad: sessionAad(hex) });
  } catch {
    /* best-effort */
  }
  try {
    await deleteMeCache(env, hex);
  } catch {
    /* best-effort */
  }
  return loaded?.record ?? null;
}

export async function touchSession(
  env: Env,
  rawId: string,
): Promise<{ record: SessionRecord; reissued: boolean } | null> {
  const hex = await sessionKeyHex(rawId);
  const stub = sessionStub(env, hex);
  try {
    const res = await doFetch(stub, "/touch", {
      method: "POST",
      aad: sessionAad(hex),
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { record: SessionRecord; reissued: boolean };
    if (data.reissued) await putMeCache(env, hex, data.record);
    return { record: data.record, reissued: data.reissued === true };
  } catch {
    return null;
  }
}

export async function applyRefreshResult(
  env: Env,
  rawId: string,
  tokens: TokenInput & { refresh_token?: string },
): Promise<SessionRecord | null> {
  const hex = await sessionKeyHex(rawId);
  const stub = sessionStub(env, hex);
  try {
    const res = await doFetch(stub, "/refresh", {
      method: "POST",
      aad: sessionAad(hex),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokens),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { record: SessionRecord };
    await putMeCache(env, hex, data.record);
    return data.record;
  } catch {
    return null;
  }
}

export async function rebuildMeFromDo(env: Env, rawId: string): Promise<MeCache | null> {
  const loaded = await loadSession(env, rawId);
  if (!loaded) return null;
  await putMeCache(env, loaded.hex, loaded.record);
  return getMeCache(env, loaded.hex);
}
