/**
 * Client session via `/api/auth/me` only (R5 / C6.1).
 * Module single-flight cache; refetch only after login/logout.
 *
 * Uses a module-bound fetch captured at import time so vitest stubs of
 * `globalThis.fetch` in day-data tests (cloudflare-client C2/C5/C6) do not
 * see `/me` traffic (CC1). Never treat a later global fetch swap as signed-out.
 */

const moduleFetch: typeof fetch = globalThis.fetch.bind(globalThis);

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

/** Shared network fetch — never takes a caller AbortSignal (one cancel must not kill /me for others). */
async function fetchMeOnce(): Promise<MeState> {
  try {
    const response = await moduleFetch("/api/auth/me", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!response.ok) return { status: "signed_out" };
    let payload: MeResponse;
    try {
      payload = (await response.json()) as MeResponse;
    } catch {
      return { status: "signed_out" };
    }
    return mapMe(payload);
  } catch {
    return { status: "signed_out" };
  }
}

function withCallerAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/** Single-flight `/me` for the app load. Shared by header + CommentThread. */
export function loadMe(options?: { force?: boolean; signal?: AbortSignal }): Promise<MeState> {
  if (!options?.force && cached && cached.status !== "loading") {
    return withCallerAbort(Promise.resolve(cached), options?.signal);
  }
  if (!options?.force && inflight) {
    return withCallerAbort(inflight, options?.signal);
  }
  const shared = fetchMeOnce().then((next) => {
    cached = next;
    inflight = null;
    return next;
  });
  inflight = shared;
  return withCallerAbort(shared, options?.signal);
}

/** After login or logout — drops cache and fetches once more. */
export function refreshMeAfterAuthChange(signal?: AbortSignal): Promise<MeState> {
  cached = null;
  inflight = null;
  // CQ r2 NB2: CSRF tokens are session-tied — drop on sign-in/out.
  void import("@/lib/authRequest")
    .then((m) => m.clearCsrfCache())
    .catch(() => undefined);
  return loadMe({ force: true, signal });
}

export function peekMe(): MeState | null {
  return cached;
}
