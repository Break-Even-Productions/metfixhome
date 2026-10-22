const RECAPTCHA_SRC_NEEDLE = "recaptcha";

/**
 * Lazy-load reCAPTCHA v3 (AU19.5 / R18). Call only when JoinModal opens or the
 * signed-in composer is focused — never on plain page mount.
 */
export function ensureRecaptchaScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src*="${RECAPTCHA_SRC_NEEDLE}"]`)) return;
  const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })
    .__MFX_RECAPTCHA_SITE_KEY__;
  if (!siteKey) return;
  const script = document.createElement("script");
  script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  script.async = true;
  document.head.appendChild(script);
}
