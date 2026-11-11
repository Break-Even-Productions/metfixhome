import { fetchCsrf } from "@/lib/authRequest";

export class AccountApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`account_api_${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function accountRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await globalThis.fetch(path, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new AccountApiError(res.status, body);
  }
  return (await res.json()) as T;
}

export async function accountWrite<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const csrf = await fetchCsrf();
  if (!csrf) throw new AccountApiError(403, { error: "csrf_unavailable" });
  const res = await globalThis.fetch(path, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
    },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let errBody: unknown = null;
    try {
      errBody = await res.json();
    } catch {
      errBody = null;
    }
    throw new AccountApiError(res.status, errBody);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("Content-Type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export function affiliatePath(id: number, suffix = ""): string {
  return `/api/account/affiliates/${id}${suffix}`;
}

export function apiMessage(err: unknown, fallback: string): string {
  if (err instanceof AccountApiError && err.body && typeof err.body === "object") {
    const message = (err.body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
