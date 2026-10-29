import { useEffect, useState, type FormEvent } from "react";
import {
  confirmEmailChange,
  loadPrivacy,
  requestEmailChange,
  requestPasswordReset,
  updatePrivacy,
  type PrivacyPayload,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

export default function AccountPrivacy() {
  const [privacy, setPrivacy] = useState<PrivacyPayload | null>(null);
  const [directoryVisible, setDirectoryVisible] = useState(false);
  const [profilePublic, setProfilePublic] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "awaiting_code">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const p = await loadPrivacy({ signal: ac.signal });
        if (cancelled) return;
        setPrivacy(p);
        setDirectoryVisible(p.directory_visible === true);
        setProfilePublic(p.profile_public === true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load privacy settings.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  async function onSavePrivacy() {
    setBusy(true);
    setError(null);
    try {
      const next = await updatePrivacy({
        directory_visible: directoryVisible,
        profile_public: profilePublic,
      });
      setPrivacy(next);
      setMessage("Privacy settings saved.");
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordReset() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset();
      setMessage("Password reset email sent.");
    } catch {
      setError("Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onEmailStart(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestEmailChange(email);
      setStep("awaiting_code");
      setMessage("Check your inbox for a confirmation code.");
    } catch {
      setError("Email change request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onEmailConfirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmEmailChange(code);
      setStep("idle");
      setCode("");
      setMessage("Email updated.");
    } catch {
      setError("Confirmation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      title="Privacy & Security"
      description="Directory visibility, password reset, and email change."
    >
      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <section className="account-card">
        <h2>Privacy</h2>
        <div className="account-toggle-row">
          <span>Show in directory</span>
          <input
            type="checkbox"
            checked={directoryVisible}
            onChange={(e) => setDirectoryVisible(e.target.checked)}
            aria-label="directory_visible"
          />
        </div>
        <div className="account-toggle-row">
          <span>Public profile</span>
          <input
            type="checkbox"
            checked={profilePublic}
            onChange={(e) => setProfilePublic(e.target.checked)}
            aria-label="profile_public"
          />
        </div>
        <button
          type="button"
          className="account-btn"
          style={{ marginTop: "1rem" }}
          disabled={busy}
          onClick={() => void onSavePrivacy()}
        >
          Save privacy
        </button>
        {privacy ? null : null}
      </section>

      <section className="account-card">
        <h2>Password</h2>
        <button
          type="button"
          className="account-btn"
          disabled={busy}
          onClick={() => void onPasswordReset()}
        >
          Send password reset email
        </button>
      </section>

      <section className="account-card">
        <h2>Change email</h2>
        {step === "idle" ? (
          <form className="account-form" onSubmit={onEmailStart}>
            <label>
              New email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="account-btn" disabled={busy}>
              Send confirmation code
            </button>
          </form>
        ) : (
          <form className="account-form" onSubmit={onEmailConfirm}>
            <label>
              Confirmation code
              <input value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <button type="submit" className="account-btn" disabled={busy}>
              Confirm email
            </button>
          </form>
        )}
      </section>
    </DashboardLayout>
  );
}
