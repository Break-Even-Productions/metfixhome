/** Client helpers for onboarding + Whop checkout (no credential storage). */

export { fetchCsrf, getRecaptchaToken, clearCsrfCache } from "@/lib/authRequest";

export type OnboardingBody = {
  first_name: string;
  last_name: string;
  roles: string[];
  has_physical_gym: boolean | null;
  has_physical_clinic: boolean | null;
};

export async function postOnboarding(
  body: OnboardingBody,
  csrf: string,
): Promise<{ ok: true } | { ok: false; status: number; error?: string }> {
  const res = await fetch("/api/account/onboarding", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let error: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      error = j.error;
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error };
  }
  return { ok: true };
}

export async function postWhopCheckout(
  plan: "pro" | "org",
  csrf: string,
  returnPath?: string,
): Promise<
  | { ok: true; checkout_url: string; expires_at?: string }
  | { ok: false; status: number; error?: string }
> {
  const body: Record<string, string> = { plan };
  if (returnPath) body.return_path = returnPath;
  const res = await fetch("/api/billing/whop/checkout-session", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let error: string | undefined;
    try {
      const j = (await res.json()) as { error?: string };
      error = j.error;
    } catch {
      /* ignore */
    }
    return { ok: false, status: res.status, error };
  }
  const json = (await res.json()) as { checkout_url?: unknown; expires_at?: unknown };
  if (typeof json.checkout_url !== "string") {
    return { ok: false, status: 502, error: "upstream_error" };
  }
  return {
    ok: true,
    checkout_url: json.checkout_url,
    expires_at: typeof json.expires_at === "string" ? json.expires_at : undefined,
  };
}
