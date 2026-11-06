import { useEffect, useMemo, useState } from "react";
import { canUseBellyCoachingTools } from "@shared/account/bellyCoaching";
import {
  loadCoachingCoach,
  publishMealPlan,
  scheduleMealPlanForClient,
  shareMealPlanWithClient,
  type AccountOverview,
  type CoachingCoachOverview,
  type CoachingRelationship,
  type MealPlanSummary,
} from "@/lib/account";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";

function clientName(row: CoachingRelationship): string {
  return row.counterparty.display_name || row.counterparty.name || "Client";
}

function clientUserId(row: CoachingRelationship): number | null {
  const n = Number(row.counterparty.user_id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

type Props = {
  overview: AccountOverview | null;
  tier: CanonicalSubscriptionTier | string;
  plans: MealPlanSummary[];
};

/** Permission-gated Belly coaching: share / schedule a plan onto a client (Body #41 hub shape). */
export function BellyCoachingPanel({ overview, tier, plans }: Props) {
  const [hub, setHub] = useState<CoachingCoachOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planId, setPlanId] = useState<number | "">("");
  const [clientId, setClientId] = useState<number | "">("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  });
  const [mode, setMode] = useState<"share" | "schedule">("share");

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const coach = await loadCoachingCoach({ force: true, signal: ac.signal });
        if (!cancelled) setHub(coach);
      } catch {
        if (!cancelled) setHub({ affiliates: [], clients: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const allowed = useMemo(
    () => canUseBellyCoachingTools(overview, tier, hub),
    [overview, tier, hub],
  );

  const activeClients = useMemo(
    () => (hub?.clients ?? []).filter((c) => c.status === "active" || c.status === "pending"),
    [hub],
  );

  const shareablePlans = useMemo(
    () =>
      plans.filter(
        (p) => p.status === "published" || p.can_schedule === true || p.usage_status === "used",
      ),
    [plans],
  );

  if (loading) return null;
  if (!allowed) return null;

  async function onSubmit() {
    if (planId === "" || clientId === "") {
      setMessage("Pick a plan and a client.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const plan = plans.find((p) => p.id === planId);
      if (plan && plan.can_schedule === false) {
        await publishMealPlan(planId);
      }
      if (mode === "share") {
        await shareMealPlanWithClient(planId, clientId, "view");
        setMessage("Plan shared to the client’s library.");
      } else {
        await scheduleMealPlanForClient(planId, {
          start_date: startDate,
          target_user_id: clientId,
        });
        setMessage(`Plan scheduled for the client from ${startDate}.`);
      }
    } catch {
      setMessage("Could not share or schedule that plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="belly-panel" aria-labelledby="belly-coaching-heading">
      <div className="belly-panel__head">
        <div>
          <h2 id="belly-coaching-heading" className="dash-section-title">
            Coaching tools
          </h2>
          <p className="account-muted">
            Share a published plan into a client’s library or schedule it onto their calendar —
            same ACL / schedule path as the MetFix app.
          </p>
        </div>
      </div>

      {activeClients.length === 0 ? (
        <p className="account-muted">
          No active coaching clients yet. Accept a client request from the Body coaching hub, then
          return here to share a meal plan.
        </p>
      ) : (
        <div className="belly-coach-form">
          <label className="belly-field">
            <span>Plan</span>
            <select
              value={planId === "" ? "" : String(planId)}
              onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose a plan…</option>
              {shareablePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="belly-field">
            <span>Client</span>
            <select
              value={clientId === "" ? "" : String(clientId)}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose a client…</option>
              {activeClients.map((c) => {
                const uid = clientUserId(c);
                if (uid == null) return null;
                return (
                  <option key={c.id} value={uid}>
                    {clientName(c)}
                    {c.status === "pending" ? " (pending)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="belly-tabs" role="tablist" aria-label="Share mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "share"}
              className={mode === "share" ? "belly-tabs__btn belly-tabs__btn--on" : "belly-tabs__btn"}
              onClick={() => setMode("share")}
            >
              Share to library
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "schedule"}
              className={
                mode === "schedule" ? "belly-tabs__btn belly-tabs__btn--on" : "belly-tabs__btn"
              }
              onClick={() => setMode("schedule")}
            >
              Schedule on calendar
            </button>
          </div>
          {mode === "schedule" ? (
            <label className="belly-field">
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          ) : null}
          <button
            type="button"
            className="account-btn account-btn--accent"
            disabled={busy}
            onClick={() => void onSubmit()}
          >
            {busy ? "Working…" : mode === "share" ? "Share plan" : "Schedule for client"}
          </button>
          {message ? <p className="account-muted">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
