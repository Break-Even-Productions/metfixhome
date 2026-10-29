/** Client helpers for onboarding + Whop checkout (no credential storage). */

export {
  clearCsrfCache,
  fetchCsrf,
  getRecaptchaToken,
  postJsonWithCsrf,
} from "@/lib/authRequest";

import { postJsonWithCsrf } from "@/lib/authRequest";

export type OnboardingBody = {
  first_name: string;
  last_name: string;
  roles: string[];
  has_physical_gym: boolean | null;
  has_physical_clinic: boolean | null;
};

export async function postOnboarding(
  body: OnboardingBody,
  _csrf?: string,
): Promise<{ ok: true } | { ok: false; status: number; error?: string }> {
  // `_csrf` retained for call-site compatibility; postJsonWithCsrf owns the token + 403 retry.
  void _csrf;
  const res = await postJsonWithCsrf("/api/account/onboarding", body);
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
  _csrf?: string,
  returnPath?: string,
): Promise<
  | { ok: true; checkout_url: string; expires_at?: string }
  | { ok: false; status: number; error?: string }
> {
  void _csrf;
  const body: Record<string, string> = { plan };
  if (returnPath) body.return_path = returnPath;
  const res = await postJsonWithCsrf("/api/billing/whop/checkout-session", body);
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
