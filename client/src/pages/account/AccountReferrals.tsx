import { useEffect, useState } from "react";
import {
  loadCourseGifts,
  loadReferrals,
  referralCodeAction,
  type CourseGiftsPayload,
  type ReferralsPayload,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

export default function AccountReferrals() {
  const [referrals, setReferrals] = useState<ReferralsPayload | null>(null);
  const [gifts, setGifts] = useState<CourseGiftsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [r, g] = await Promise.all([
          loadReferrals({ signal: ac.signal }),
          loadCourseGifts({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setReferrals(r);
        setGifts(g);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load referrals.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  async function onAction(action: "generate" | "rotate" | "revoke") {
    setBusy(true);
    setError(null);
    try {
      const next = await referralCodeAction(action);
      setReferrals(next);
    } catch {
      setError(`Could not ${action} referral code.`);
    } finally {
      setBusy(false);
    }
  }

  const code =
    typeof referrals?.referral_code === "string" ? referrals.referral_code : null;

  return (
    <DashboardLayout
      title="Referrals & Gifts"
      description="Share your referral code and view course gifts."
    >
      {error ? <p className="account-error">{error}</p> : null}

      <section className="account-card">
        <h2>Referral code</h2>
        <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {code ?? "No code yet"}
        </p>
        <div className="account-course-card__actions">
          <button
            type="button"
            className="account-btn"
            disabled={busy}
            onClick={() => void onAction("generate")}
          >
            Generate
          </button>
          <button
            type="button"
            className="account-btn account-btn--ghost"
            disabled={busy}
            onClick={() => void onAction("rotate")}
          >
            Rotate
          </button>
          <button
            type="button"
            className="account-btn account-btn--ghost"
            disabled={busy}
            onClick={() => void onAction("revoke")}
          >
            Revoke
          </button>
        </div>
        {referrals?.earnings != null ? (
          <pre
            className="account-mono"
            style={{ marginTop: "1rem", whiteSpace: "pre-wrap", fontSize: "0.85rem" }}
          >
            {typeof referrals.earnings === "string"
              ? referrals.earnings
              : JSON.stringify(referrals.earnings, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="account-card">
        <h2>Course gifts</h2>
        {(gifts?.items ?? []).length === 0 ? (
          <p className="account-muted">No gift codes.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {(gifts?.items ?? []).map((g, i) => (
              <li key={`${g.code ?? i}`}>
                <span className="account-mono">{g.code ?? "—"}</span>
                {" · "}
                {g.course_title ?? "Course"}
                {" · "}
                {g.status ?? "unknown"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardLayout>
  );
}
