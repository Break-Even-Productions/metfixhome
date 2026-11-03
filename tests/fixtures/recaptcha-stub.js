/**
 * Offline reCAPTCHA stub for T-F-70 / prod-badge (SI-F15).
 * Injects badge markup and defines grecaptcha.ready/execute.
 */
(function () {
  const badge = document.createElement("div");
  badge.className = "grecaptcha-badge";
  badge.style.cssText =
    "width:256px;height:60px;position:fixed;right:-186px;bottom:14px;visibility:visible;display:block;opacity:1;z-index:9999;";
  const iframe = document.createElement("iframe");
  iframe.title = "reCAPTCHA";
  iframe.width = "256";
  iframe.height = "60";
  iframe.style.border = "0";
  badge.appendChild(iframe);
  (document.body || document.documentElement).appendChild(badge);

  const api = {
    ready(cb) {
      if (typeof cb === "function") cb();
    },
    execute() {
      return Promise.resolve("test-recaptcha-token");
    },
  };
  globalThis.grecaptcha = api;
  if (typeof window !== "undefined") window.grecaptcha = api;
})();
