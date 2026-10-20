import { useEffect, useId, useRef, useState } from "react";

type JoinModalProps = {
  open: boolean;
  onClose: () => void;
};

function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function playShake(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("df-join-shake");
  // Restart the CSS animation on repeated invalid submits.
  void element.offsetWidth;
  element.classList.add("df-join-shake");
}

/**
 * Join prompt for logged-out comment submit.
 * Neither action creates a session, sends email, or starts OAuth.
 */
export function JoinModal({ open, onClose }: JoinModalProps) {
  const errorId = useId();
  const submitRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

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
        <h2 id="df-join-title">Join MetFix Today</h2>
        <p className="df-muted">Sign in to leave a comment on today’s fix.</p>
        <form
          className="df-join-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValidEmail(email)) {
              setError("Add your email to continue.");
              playShake(submitRef.current);
              return;
            }
            setError(null);
            submitRef.current?.classList.remove("df-join-shake");
            // Join with Email does not send the email and does not create a session.
          }}
        >
          <label>
            <span className="sr-only">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
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
            onAnimationEnd={(event) => {
              if (event.animationName === "df-join-shake") {
                event.currentTarget.classList.remove("df-join-shake");
              }
            }}
          >
            Join with Email
          </button>
        </form>
        <button
          type="button"
          className="df-btn df-btn-ink df-join-google"
          onClick={() => {
            // Continue with Google does not start OAuth and does not create a session.
          }}
        >
          <GoogleLogo className="df-join-google-logo" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
