/**
 * Dedicated MetFix member login — visual language matches the member-access
 * design (dark canvas, Playfair + DM Sans, gold accent). Auth posts to the
 * same-origin Worker (/api/auth/*). No third-party telemetry.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { assetUrl, basePath } from "@/const";
import { usePageMeta } from "@/hooks/usePageMeta";
import { refreshMeAfterAuthChange } from "@/lib/session";
import { clampClientRetryAfter } from "@/pages/the-daily-fix/comments";
import { ensureRecaptchaScript } from "@/pages/the-daily-fix/recaptcha";
import "./login.css";

type Mode = "signin" | "signup" | "forgot";

const TICKER_ITEMS = [
  "Global affiliate network — gyms on every continent",
  "Affiliate dashboard — track your referrals",
  "Daily Fix — recipe, workout, and reading every morning",
  "Free What Is MetFix? course — 6 chapters, 15 lessons",
  "BSI research library — evidence behind the method",
];

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

async function fetchCsrf(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/csrf", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { csrf?: unknown };
    return typeof json.csrf === "string" && json.csrf ? json.csrf : null;
  } catch {
    return null;
  }
}

async function getRecaptchaToken(action: string): Promise<string> {
  const g = (
    window as unknown as {
      grecaptcha?: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, opts: { action: string }) => Promise<string>;
      };
    }
  ).grecaptcha;
  const siteKey = (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: string })
    .__MFX_RECAPTCHA_SITE_KEY__;
  if (!g || !siteKey) return "test-recaptcha-token";
  await new Promise<void>((resolve) => g.ready(() => resolve()));
  return g.execute(siteKey, { action });
}

function safeNextPath(raw: string | null): string {
  if (!raw) return "/the-daily-fix";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/the-daily-fix";
  return raw;
}

function playShake(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("login-shake");
  void element.offsetWidth;
  element.classList.add("login-shake");
}

export default function Login() {
  usePageMeta({
    title: "Member Login — MetFix",
    description:
      "Sign in to access your MetFix courses, affiliate dashboard, and the Daily Fix.",
  });

  const [, setLocation] = useLocation();
  const search = useSearch();
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return safeNextPath(params.get("next"));
  }, [search]);

  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [retryLeft, setRetryLeft] = useState(0);
  const errorId = useId();
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ensureRecaptchaScript();
  }, []);

  useEffect(() => {
    const id = "login-jakarta-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [mode]);

  useEffect(() => {
    if (retryUntil == null) {
      setRetryLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetryLeft(left);
      if (left <= 0) setRetryUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [retryUntil]);

  const locked = retryLeft > 0;

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    if (busy || locked) return;
    const id = identifier.trim();
    if (!id || !password) {
      setError("Add your email/username and password to continue.");
      playShake(submitRef.current);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setError("Sign-in is unavailable right now.");
        return;
      }
      const recaptcha = await getRecaptchaToken("login");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ identifier: id, password, recaptcha }),
      });
      if (res.status === 429) {
        const wait = clampClientRetryAfter(res.headers.get("Retry-After"));
        setRetryUntil(Date.now() + wait * 1000);
        setError(`Too many attempts. Try again in ${wait}s.`);
        return;
      }
      if (res.status === 401) {
        setError("Email/username or password is incorrect.");
        playShake(submitRef.current);
        return;
      }
      if (res.status === 404) {
        setError("Sign-in is only available on metfix.org.");
        return;
      }
      if (!res.ok) {
        setError("Sign-in is unavailable right now.");
        return;
      }
      await refreshMeAfterAuthChange();
      setLocation(basePath(nextPath));
    } catch {
      setError("Sign-in is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  async function onSignUp(event: FormEvent) {
    event.preventDefault();
    if (busy || locked) return;
    const u = username.trim();
    const e = email.trim();
    if (!u || !e) {
      setError("Add a username and email to continue.");
      playShake(submitRef.current);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const csrf = await fetchCsrf();
      if (!csrf) {
        setError("Sign-up is unavailable right now.");
        return;
      }
      const recaptcha = await getRecaptchaToken("signup");
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ username: u, email: e, recaptcha }),
      });
      if (res.status === 429) {
        const wait = clampClientRetryAfter(res.headers.get("Retry-After"));
        setRetryUntil(Date.now() + wait * 1000);
        setError(`Too many attempts. Try again in ${wait}s.`);
        return;
      }
      if (res.status === 404) {
        setError("Sign-up is only available on metfix.org.");
        return;
      }
      if (res.status === 400) {
        setError("Choose a username with letters, numbers, or underscores (max 32).");
        playShake(submitRef.current);
        return;
      }
      if (res.status === 202) {
        setSuccess("Check your email to finish creating your account.");
        setMode("signin");
        setIdentifier(e);
        return;
      }
      if (!res.ok) {
        setError("Sign-up is unavailable right now.");
        return;
      }
      setSuccess("Check your email to finish creating your account.");
      setMode("signin");
    } catch {
      setError("Sign-up is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <header className="login-topnav">
        <Link href="/" className="login-brand" aria-label="MetFix home">
          <img src={assetUrl("/metfix-lockup.png")} alt="MetFix" />
        </Link>
        <div className="login-topnav-actions">
          <button
            type="button"
            className="login-topnav-login"
            onClick={() => setMode("signin")}
          >
            Login
          </button>
          <a className="login-topnav-cta" href="https://whatis.metfix.org/">
            Start Free <span aria-hidden="true">→</span>
          </a>
        </div>
      </header>

      <div className="login-ticker" aria-hidden="true">
        <div className="login-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span className="login-ticker-item" key={`${item}-${i}`}>
              <span className="login-ticker-text">{item}</span>
              <span className="login-ticker-dot">·</span>
            </span>
          ))}
        </div>
      </div>

      <main className="login-main">
        <p className="login-eyebrow">— Member Access</p>
        <h1 className="login-hero-title">
          Welcome, BSI &amp; MetFix <em>Members.</em>
        </h1>
        <p className="login-hero-copy">
          Sign in to access your courses, affiliate dashboard, and the full MetFix learning
          platform.
        </p>

        <section className="login-card" aria-labelledby="login-card-title">
          <div className="login-brands">
            <div className="login-brand-pill">
              <span className="login-brand-mark" aria-hidden="true">
                MF
              </span>
              <span>
                <strong>MetFix</strong>
                <small>The Metabolic Fix</small>
              </span>
            </div>
            <div className="login-brand-pill">
              <span className="login-brand-mark login-brand-mark-bsi" aria-hidden="true">
                BSI
              </span>
              <span>
                <strong>Broken Science</strong>
                <small>Initiative</small>
              </span>
            </div>
          </div>

          {mode === "signin" ? (
            <>
              <h2 id="login-card-title">Sign In to Your Account</h2>
              <p className="login-card-sub">
                Access your courses, affiliate dashboard, and the Daily Fix.
              </p>

              <button
                type="button"
                className="login-btn login-btn-google"
                onClick={() => {
                  window.location.assign("/api/auth/google/start");
                }}
              >
                <GoogleLogo className="login-google-logo" />
                Continue with Google
              </button>

              <div className="login-divider">
                <span>Or sign in with email</span>
              </div>

              <form className="login-form" noValidate onSubmit={onSignIn}>
                <label className="login-field">
                  <span>Email Address</span>
                  <input
                    type="text"
                    name="identifier"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={identifier}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </label>
                <label className="login-field">
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </label>
                {success ? (
                  <p className="login-success" role="status">
                    {success}
                  </p>
                ) : null}
                {error ? (
                  <p id={errorId} className="login-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  ref={submitRef}
                  type="submit"
                  className="login-btn login-btn-primary"
                  disabled={busy || locked}
                  onAnimationEnd={(event) => {
                    if (event.animationName === "login-shake") {
                      event.currentTarget.classList.remove("login-shake");
                    }
                  }}
                >
                  {locked
                    ? `Try again in ${retryLeft}s`
                    : busy
                      ? "Signing in…"
                      : "Log In →"}
                </button>
              </form>

              <button
                type="button"
                className="login-text-btn"
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>

              <button
                type="button"
                className="login-btn login-btn-outline"
                onClick={() => setMode("signup")}
              >
                Create a Free Account →
              </button>

              <p className="login-affiliate-note">
                <strong>MetFix Affiliates:</strong> Your affiliate dashboard is accessible after
                login. If you haven&apos;t received your affiliate credentials,{" "}
                <a href="mailto:courses@metfix.org">contact support</a>.
              </p>
            </>
          ) : null}

          {mode === "signup" ? (
            <>
              <h2 id="login-card-title">Create Your Free Account</h2>
              <p className="login-card-sub">
                Register for access to the MetFix learning platform and the Daily Fix. We&apos;ll
                email you to finish setup.
              </p>
              <form className="login-form" noValidate onSubmit={onSignUp}>
                <label className="login-field">
                  <span>Username</span>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    placeholder="letters, numbers, underscores"
                    value={username}
                    maxLength={32}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </label>
                <label className="login-field">
                  <span>Email Address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </label>
                {error ? (
                  <p id={errorId} className="login-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  ref={submitRef}
                  type="submit"
                  className="login-btn login-btn-primary"
                  disabled={busy || locked}
                >
                  {locked
                    ? `Try again in ${retryLeft}s`
                    : busy
                      ? "Creating…"
                      : "Create Free Account"}
                </button>
              </form>
              <p className="login-switch">
                Already have an account?{" "}
                <button type="button" className="login-text-btn inline" onClick={() => setMode("signin")}>
                  Sign in here
                </button>
              </p>
            </>
          ) : null}

          {mode === "forgot" ? (
            <>
              <h2 id="login-card-title">Reset Your Password</h2>
              <p className="login-card-sub">
                Password resets are handled through member support. Email us from the address on
                your account and we&apos;ll help you get back in.
              </p>
              <a className="login-btn login-btn-primary" href="mailto:courses@metfix.org">
                Email Support →
              </a>
              <button
                type="button"
                className="login-text-btn"
                onClick={() => setMode("signin")}
              >
                ← Back to Sign In
              </button>
            </>
          ) : null}
        </section>

        <section className="login-next" aria-labelledby="login-next-title">
          <h3 id="login-next-title">Not a member yet? Start here.</h3>
          <p>Everything below is available to registered MetFix members.</p>
          <div className="login-next-grid">
            <a className="login-next-card" href="https://whatis.metfix.org/">
              <span className="login-next-step">Step 01 · Start Here</span>
              <strong>Take the Free Class</strong>
              <span>What Is MetFix? — 6 chapters, 15 lessons. Free, always.</span>
            </a>
            <Link className="login-next-card" href="/the-daily-fix">
              <span className="login-next-step">Daily · Free</span>
              <strong>The Daily Fix</strong>
              <span>A recipe, a workout, and a reading every morning.</span>
            </Link>
            <Link className="login-next-card" href="/become-an-affiliate">
              <span className="login-next-step">Affiliate Program</span>
              <strong>Become a MetFix Affiliate</strong>
              <span>Join the network and help fight chronic disease locally.</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="login-footer">
        <Link href="/">MetFix</Link>
        <a href="https://brokenscience.org/privacy-policy/">Privacy</a>
        <a href="https://brokenscience.org/terms-of-use/">Terms</a>
        <a href="mailto:courses@metfix.org">Support</a>
        <Link href="/become-an-affiliate">Affiliates</Link>
      </footer>
    </div>
  );
}
