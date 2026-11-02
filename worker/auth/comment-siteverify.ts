import type { Env, FetchImpl } from "../upstream";
import { isAllowedRecaptchaHostname } from "./host";

/** reCAPTCHA v3 for comment POST/PATCH (action `comment`, hostname allowlist, score ≥ 0.5). */
export async function siteverifyComment(
  token: string,
  secret: string,
  fetchImpl: FetchImpl,
  env: Env,
): Promise<"pass" | "fail" | "outage"> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetchImpl("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "outage";
    const json = (await res.json()) as {
      success?: unknown;
      score?: unknown;
      action?: unknown;
      hostname?: unknown;
    };
    if (json.success !== true) return "fail";
    if (!isAllowedRecaptchaHostname(json.hostname, env)) return "fail";
    if (json.action !== "comment") return "fail";
    if (typeof json.score !== "number" || json.score < 0.5) return "fail";
    return "pass";
  } catch {
    return "outage";
  }
}
