/** R18 / AU19.2 Daily Fix HTML CSP. */
export const DAILY_FIX_CSP = [
  "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://t.whop.tw https://connect.facebook.net",
  "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
  "connect-src 'self' https://www.google.com/recaptcha/ https://t.whop.tw https://connect.facebook.net https://www.facebook.com",
  "frame-ancestors 'none'",
].join("; ");

/** Post/library detail HTML — video embeds + reCAPTCHA (TC14 / CQ-3). */
export const DETAIL_PAGE_CSP = [
  "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://t.whop.tw https://connect.facebook.net",
  "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "connect-src 'self' https://www.google.com/recaptcha/ https://t.whop.tw https://connect.facebook.net https://www.facebook.com",
  "media-src 'self' https://brokenscience.org",
  "frame-ancestors 'none'",
].join("; ");
