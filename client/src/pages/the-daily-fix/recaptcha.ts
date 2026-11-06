/** Matches Google’s api.js only — not `/api/recaptcha-site-key.js` in the shell. */
const RECAPTCHA_API_SRC_NEEDLE = "google.com/recaptcha";

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
};

function siteKey(): string | undefined {
  return (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string }).__MFX_RECAPTCHA_SITE_KEY__;
}

function grecaptchaApi(): Grecaptcha | undefined {
  return (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
}

export async function getRecaptchaToken(action: string): Promise<string> {
  const g = grecaptchaApi();
  const key = siteKey();
  // Empty when grecaptcha / site key missing — Worker rejects empty (same as authRequest).
  if (!g || !key) return "";
  await new Promise<void>((resolve) => g.ready(() => resolve()));
  return g.execute(key, { action });
}

let loadPromise: Promise<boolean> | null = null;

/**
 * Lazy-load reCAPTCHA v3 (AU19.5 / R18). Call only when JoinModal opens or the
 * signed-in composer is focused — never on plain Daily Fix page mount.
 * Resolves true once `grecaptcha` is ready; false if the site key or script is missing.
 */
export function ensureRecaptchaScript(): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  const key = siteKey();
  if (!key) return Promise.resolve(false);

  const existing = grecaptchaApi();
  if (existing) {
    return new Promise((resolve) => existing.ready(() => resolve(true)));
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => {
      if (!ok) loadPromise = null;
      resolve(ok);
    };

    const waitReady = () => {
      const g = grecaptchaApi();
      if (!g) {
        finish(false);
        return;
      }
      g.ready(() => finish(true));
    };

    let script = document.querySelector(
      `script[src*="${RECAPTCHA_API_SRC_NEEDLE}"]`,
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      script.async = true;
      script.onload = () => waitReady();
      script.onerror = () => finish(false);
      document.head.appendChild(script);
      return;
    }

    // Tag already present (e.g. prior call) but grecaptcha not ready yet.
    if (grecaptchaApi()) {
      waitReady();
      return;
    }
    script.addEventListener("load", () => waitReady(), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
  });

  return loadPromise;
}
