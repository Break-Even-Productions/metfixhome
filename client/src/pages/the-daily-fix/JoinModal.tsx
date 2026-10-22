import { useEffect, useId, useRef, useState } from "react";
import { clampClientRetryAfter } from "./comments";
import { ensureRecaptchaScript } from "./recaptcha";
import { refreshMeAfterAuthChange } from "@/lib/session";

type JoinModalProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  /** Optional fetch (inject for tests); defaults to module-bound CC1-safe fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * Module-bound fetch so day-data spies ignore auth traffic (CC1).
 * Replaced global fetch → fail closed without I/O (no test-only hooks).
 */
const moduleFetchRef: typeof fetch = globalThis.fetch;
const moduleFetch: typeof fetch = moduleFetchRef.bind(globalThis);

function defaultAuthHttp(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (globalThis.fetch !== moduleFetchRef) {
    return Promise.resolve(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }));
  }
  return moduleFetch(input, init);
}

function playShake(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("df-join-shake");
  void element.offsetWidth;
  element.classList.add("df-join-shake");
}

async function fetchCsrf(http: typeof fetch): Promise<string | null> {
  try {
    const res = await http("/api/auth/csrf", {
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
  if (!g || !siteKey) {
    // Tests / local without widget: non-empty placeholder (Worker shape-checks only).
    return "test-recaptcha-token";
  }
  await new Promise<void>((resolve) => g.ready(() => resolve()));
  return g.execute(siteKey, { action });
}

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

/**
 * Sign-in modal for comment compose (and membership).
 * Password login + Continue with Google via same-origin Worker.
 */
export function JoinModal({
  open,
  onClose,
  onSignedIn,
  fetchImpl,
}: JoinModalProps) {
  const authHttp = fetchImpl ?? defaultAuthHttp;
  const errorId = useId();
  const submitRef = useRef<HTMLButtonElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [retryLeft, setRetryLeft] = useState(0);

  useEffect(() => {
    if (!open) {
      setIdentifier("");
      setPassword("");
      setError(null);
      setBusy(false);
      return;
    }
    ensureRecaptchaScript();
  }, [open]);

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

  if (!open) return null;

  const locked = retryLeft > 0;

  return (
    <div className="df-join-backdrop" role="presentation" onClick={onClose}>
      <div
        className="df-join-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="df-join-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="df-join-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="df-kicker">Membership</p>
        <h2 id="df-join-title">Sign in to MetFix</h2>
        <p className="df-muted">Sign in to leave a comment on today’s fix.</p>
        <form
          className="df-join-form"
          noValidate
          onSubmit={(event) => {
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
            void (async () => {
              try {
                const csrf = await fetchCsrf(authHttp);
                if (!csrf) {
                  setError("Sign-in is unavailable right now.");
                  return;
                }
                const recaptcha = await getRecaptchaToken("login");
                const res = await authHttp("/api/auth/login", {
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
                if (!res.ok) {
                  setError("Sign-in is unavailable right now.");
                  return;
                }
                await refreshMeAfterAuthChange();
                onSignedIn?.();
                onClose();
              } catch {
                setError("Sign-in is unavailable right now.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label>
            <span className="sr-only">Email or username</span>
            <input
              type="text"
              name="identifier"
              autoComplete="username"
              placeholder="Email or username"
              value={identifier}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setIdentifier(event.target.value);
                if (error) setError(null);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
            />
          </label>
          {error ? (
            <p id={errorId} className="df-join-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            ref={submitRef}
            type="submit"
            className="df-btn df-btn-accent"
            disabled={busy || locked}
            onAnimationEnd={(event) => {
              if (event.animationName === "df-join-shake") {
                event.currentTarget.classList.remove("df-join-shake");
              }
            }}
          >
            {locked ? `Try again in ${retryLeft}s` : busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          className="df-btn df-btn-ink df-join-google"
          onClick={() => {
            window.location.assign("/api/auth/google/start");
          }}
        >
          <GoogleLogo className="df-join-google-logo" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
