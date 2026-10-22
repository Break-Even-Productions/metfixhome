/** R18 / AU19.2 Daily Fix HTML CSP. */
export const DAILY_FIX_CSP = [
  "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
  "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
  "connect-src 'self' https://www.google.com/recaptcha/",
  "frame-ancestors 'none'",
].join("; ");
