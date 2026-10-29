import { useEffect, useState } from "react";
import {
  loadNotifications,
  updateNotifications,
  type NotificationsPayload,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

export default function AccountNotifications() {
  const [data, setData] = useState<NotificationsPayload | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const n = await loadNotifications({ signal: ac.signal });
        if (cancelled) return;
        setData(n);
        setPrefs({ ...(n.preferences ?? {}) });
        setNewsletter(n.newsletter === true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load notifications.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const next = await updateNotifications({
        preferences: prefs,
        newsletter,
      });
      setData(next);
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const keys = Object.keys(prefs).length > 0 ? Object.keys(prefs) : ["email_digest", "product_updates"];

  return (
    <DashboardLayout
      title="Notifications"
      description="Choose how MetFix reaches you, including the newsletter."
    >
      {error ? <p className="account-error">{error}</p> : null}
      <section className="account-card">
        <h2>Preferences</h2>
        {keys.map((key) => (
          <div className="account-toggle-row" key={key}>
            <span>{key.replace(/_/g, " ")}</span>
            <input
              type="checkbox"
              checked={prefs[key] === true}
              onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              aria-label={key}
            />
          </div>
        ))}
        <div className="account-toggle-row">
          <span>Newsletter</span>
          <input
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
            aria-label="newsletter"
          />
        </div>
        <button
          type="button"
          className="account-btn"
          style={{ marginTop: "1rem" }}
          disabled={busy}
          onClick={() => void onSave()}
        >
          Save preferences
        </button>
        {data ? null : null}
      </section>
    </DashboardLayout>
  );
}
