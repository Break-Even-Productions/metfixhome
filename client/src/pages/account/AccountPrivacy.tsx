import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import {
  confirmEmailChange,
  loadPrivacy,
  requestEmailChange,
  requestPasswordReset,
  updatePrivacy,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import NotificationSettings from "./NotificationSettings";

type SettingsPanel = "account" | "privacy" | "notifications";

const PANELS: Array<{ id: SettingsPanel; title: string; detail: string }> = [
  { id: "account", title: "Your account", detail: "Email and password" },
  { id: "privacy", title: "Privacy", detail: "Who can see your profile" },
  { id: "notifications", title: "Notifications", detail: "Email, push, and in-app alerts" },
];

export default function AccountPrivacy() {
  const [panel, setPanel] = useState<SettingsPanel>("account");
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
        const privacy = await loadPrivacy({ signal: ac.signal });
        if (cancelled) return;
        setDirectoryVisible(privacy.directory_visible === true);
        setProfilePublic(privacy.profile_public === true);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
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
    setMessage(null);
    try {
      await updatePrivacy({
        directory_visible: directoryVisible,
        profile_public: profilePublic,
      });
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
    <DashboardLayout title="Settings" description="Account, privacy, and how MetFix reaches you.">
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
          {panel === "privacy" ? (
            <>
              <p className="settings-detail__lede">Control how you appear to other MetFix members.</p>
              <div className="settings-pref">
                <div>
                  <p className="settings-pref__title">Show in directory</p>
                  <p className="settings-pref__detail">List this account in the member directory.</p>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    aria-label="Show in directory"
                    checked={directoryVisible}
                    onChange={(e) => setDirectoryVisible(e.target.checked)}
                  />
                  <span className="settings-switch__track" aria-hidden="true" />
                </label>
              </div>
              <div className="settings-pref">
                <div>
                  <p className="settings-pref__title">Public profile</p>
                  <p className="settings-pref__detail">Let anyone with the link view your profile.</p>
                </div>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    aria-label="Public profile"
                    checked={profilePublic}
                    onChange={(e) => setProfilePublic(e.target.checked)}
                  />
                  <span className="settings-switch__track" aria-hidden="true" />
                </label>
              </div>
              <button
                type="button"
                className="account-btn"
                style={{ marginTop: "1.25rem" }}
                disabled={busy}
                onClick={() => void onSavePrivacy()}
              >
                Save privacy
              </button>
            </>
          ) : null}
          {panel === "notifications" ? <NotificationSettings /> : null}
        </section>
      </div>
    </DashboardLayout>
  );
}
