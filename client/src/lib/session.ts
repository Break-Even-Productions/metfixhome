/**
 * Client session via `/api/auth/me` only (R5 / C6.1).
 * Module single-flight cache; refetch only after login/logout.
 *
 * Uses a module-bound fetch captured at import time so vitest stubs of
 * `globalThis.fetch` in day-data tests (cloudflare-client C2/C5/C6) do not
 * see `/me` traffic (CC1).
 */

/** Bound at module load — before test `stubGlobal("fetch")` (CC1). */
const sessionHttpBound: typeof fetch = globalThis.fetch.bind(globalThis);
let useGlobalSessionFetch = false;

function sessionHttp(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (useGlobalSessionFetch) return globalThis.fetch(input, init);
  // Vitest + fake timers: avoid hanging real `/me` fetches (CC1 with day spies).
  if (import.meta.env.MODE === "test") {
    return Promise.resolve(
      new Response(JSON.stringify({ signed_in: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return sessionHttpBound(input, init);
}

/** Test-only: when true, `/me` uses live `globalThis.fetch` (the vitest stub). */
export function __setSessionFetchForTests(useGlobal: boolean): void {
  useGlobalSessionFetch = useGlobal;
}

export type MeState =
  | { status: "loading" }
  | { status: "signed_out" }
  | {
      status: "signed_in";
      public_name: string;
      /** Strict boolean from Worker; non-boolean treated as false (CW12). */
      moderator: boolean;
    };

type MeResponse = {
  signed_in?: unknown;
  public_name?: unknown;
  moderator?: unknown;
};

let inflight: Promise<MeState> | null = null;
let cached: MeState | null = null;

function mapMe(payload: MeResponse): MeState {
  if (payload.signed_in !== true) return { status: "signed_out" };
  const name =
    typeof payload.public_name === "string" && payload.public_name.trim()
      ? payload.public_name.trim()
      : "Member";
  return {
    status: "signed_in",
    public_name: name,
    moderator: payload.moderator === true,
  };
}

async function fetchMeOnce(signal?: AbortSignal): Promise<MeState> {
  try {
    const response = await sessionHttp("/api/auth/me", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) return { status: "signed_out" };
    let payload: MeResponse;
    try {
      payload = (await response.json()) as MeResponse;
    } catch {
      return { status: "signed_out" };
    }
    return mapMe(payload);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "signed_out" };
  }
}

/** Single-flight `/me` for the app load. Shared by header + CommentThread. */
export function loadMe(options?: { force?: boolean; signal?: AbortSignal }): Promise<MeState> {
  if (!options?.force && cached && cached.status !== "loading") {
    return Promise.resolve(cached);
  }
  if (!options?.force && inflight) return inflight;
  inflight = fetchMeOnce(options?.signal).then((next) => {
    cached = next;
    inflight = null;
    return next;
  });
  return inflight;
}

/** After login or logout — drops cache and fetches once more. */
export function refreshMeAfterAuthChange(signal?: AbortSignal): Promise<MeState> {
  cached = null;
  inflight = null;
  return loadMe({ force: true, signal });
}

export function peekMe(): MeState | null {
  return cached;
}

/** Test helper — clears module cache between mounts. */
export function resetMeCacheForTests(): void {
  cached = null;
  inflight = null;
}
