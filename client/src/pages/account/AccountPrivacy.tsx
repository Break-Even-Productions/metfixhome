import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { basePath } from "@/const";
import {
  confirmEmailChange,
  requestEmailChange,
  requestPasswordReset,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import NotificationSettings from "./NotificationSettings";

type SettingsPanel = "account" | "notifications";

const PANELS: Array<{ id: SettingsPanel; title: string; detail: string }> = [
  { id: "account", title: "Your account", detail: "Email and password" },
  { id: "notifications", title: "Notifications", detail: "Email, push, and in-app alerts" },
];

export default function AccountPrivacy() {
  const [panel, setPanel] = useState<SettingsPanel>("account");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "awaiting_code">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPasswordReset() {
    setBusy(true);
    setError(null);
    setMessage(null);
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
    setMessage(null);
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
    setMessage(null);
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

  const current = PANELS.find((item) => item.id === panel) ?? PANELS[0]!;

  return (
    <DashboardLayout title="Settings" description="Account email, password, and how MetFix reaches you.">
      <div className="settings-shell">
        <nav className="settings-menu" aria-label="Settings">
          {PANELS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={panel === item.id}
              onClick={() => {
                setPanel(item.id);
                setMessage(null);
              }}
            >
              <span>
                <span className="settings-menu__title">{item.title}</span>
                <span className="settings-menu__detail">{item.detail}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <section className="settings-detail" aria-labelledby="settings-detail-title">
          <h2 id="settings-detail-title">{current.title}</h2>
          {error ? <p className="account-error">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          {panel === "account" ? (
            <>
              <p className="settings-detail__lede">Update the email and password on this account.</p>
              <div className="settings-block">
                <h3>Email</h3>
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
              </div>
              <p className="account-muted">
                Coach directory visibility is on{" "}
                <Link href={basePath("/account/coaching")}>Coaching</Link>.
              </p>
              <div className="settings-block">
                <h3>Password</h3>
                <p className="settings-pref__detail">We’ll email a link to choose a new password.</p>
                <button
                  type="button"
                  className="account-btn"
                  disabled={busy}
                  onClick={() => void onPasswordReset()}
                >
                  Send password reset email
                </button>
              </div>
            </>
          ) : null}
          {panel === "notifications" ? <NotificationSettings /> : null}
        </section>
      </div>
    </DashboardLayout>
  );
}
