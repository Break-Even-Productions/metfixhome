import { useState } from "react";
import { buildLoginBody, buildSignupBody } from "@shared/join";
import { ensureRecaptchaScript } from "@/pages/the-daily-fix/recaptcha";
import { refreshMeAfterAuthChange } from "@/lib/session";
import { getRecaptchaToken, postJsonWithCsrf } from "@/lib/authRequest";
import type { AuthView } from "../types";
import { Field, GhostButton, GoldButton, Kicker, Question, ScreenForm } from "../ui";

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

export function AuthScreen({
  firstName,
  email,
  view,
  onView,
  onEmail,
  onAuthenticated,
}: {
  firstName: string;
  email: string;
  view: AuthView;
  onView: (view: AuthView) => void;
  onEmail: (value: string) => void;
  onAuthenticated: (provider: "google" | "email", email?: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startGoogle = () => {
    // Worker Google start uses `return` (not return_to).
    const ret = encodeURIComponent("/join?step=roles");
    window.location.assign(`/api/auth/google/start?return=${ret}`);
  };

  const submitEmail = async (mode: "signin" | "signup") => {
    if (busy) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await ensureRecaptchaScript();
      const recaptcha = await getRecaptchaToken(mode === "signup" ? "signup" : "login");
      if (!recaptcha) {
        // R2-N2: grecaptcha / site key missing — do not silently post empty token
        setError("Could not load the security check. Refresh and try again.");
        return;
      }
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? buildSignupBody({ username, email, recaptcha })
          : buildLoginBody({ identifier: email, password, recaptcha });
      // NB2: postJsonWithCsrf retries once on 403 with a forced fresh token
      const res = await postJsonWithCsrf(path, body);
      if (res.status === 503) {
        setError("Could not start a secure session. Refresh and try again.");
        return;
      }
      if (mode === "signup") {
        if (res.status === 202 || res.ok) {
          setSuccess("Check your email to finish creating your account.");
          setPassword("");
          onView("email-signin");
          return;
        }
        setError("Could not create your account.");
        return;
      }
      if (!res.ok) {
        setError("Could not sign in.");
        return;
      }
      await refreshMeAfterAuthChange();
      onAuthenticated("email", email.trim());
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (view === "email-signin" || view === "email-signup") {
    const isSignup = view === "email-signup";
    const canSubmit = isSignup
      ? email.includes("@") && username.trim().length >= 1
      : email.includes("@") && password.length >= 8;
    return (
      <ScreenForm onSubmit={() => void submitEmail(isSignup ? "signup" : "signin")}>
        <Kicker>{isSignup ? "Create your account." : `Welcome back${firstName ? `, ${firstName}` : ""}.`}</Kicker>
        <Question>{isSignup ? "Sign up with email" : "Sign in with email"}</Question>
        <div className="mt-10 space-y-4">
          {isSignup ? (
            <Field label="Username" type="text" value={username} onChange={setUsername} autoFocus />
          ) : null}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={onEmail}
            autoFocus={!isSignup}
          />
          {!isSignup ? (
            <Field label="Password" type="password" value={password} onChange={setPassword} />
          ) : null}
        </div>
        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 text-sm text-emerald-800" role="status">
            {success}
          </p>
        ) : null}
        <div className="mt-10 space-y-3">
          <GoldButton type="submit" disabled={busy || !canSubmit}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </GoldButton>
          <GhostButton onClick={() => onView(isSignup ? "email-signin" : "email-signup")}>
            {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </GhostButton>
          <GhostButton onClick={() => onView("choose")}>Back</GhostButton>
        </div>
      </ScreenForm>
    );
  }

  return (
    <div>
      <Kicker>Nice to meet you{firstName ? `, ${firstName}` : ""}.</Kicker>
      <Question>How would you like to continue?</Question>
      <p className="mt-4 text-sm text-[var(--join-muted)]">
        Your first month of MetFix is free.
      </p>
      <div className="mt-10 space-y-3">
        <GhostButton onClick={startGoogle}>
          <GoogleLogo className="h-5 w-5" />
          Continue with Google
        </GhostButton>
        <GoldButton onClick={() => onView("email-signin")}>Continue with email</GoldButton>
      </div>
    </div>
  );
}
