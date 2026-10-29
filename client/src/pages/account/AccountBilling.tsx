import { useEffect, useMemo, useState } from "react";
import { formatUsdFromCents } from "@shared/account/ltv";
import {
  assignBillingUrl,
  cancelDuplicate,
  convertToWhop,
  deriveMembershipStatus,
  formatNextPayment,
  loadLtvCertificates,
  loadOverview,
  loadPayments,
  loadSubscriptions,
  portalLink,
  safeBillingHref,
  type AccountOverview,
  type AccountSubscriptions,
  type LtvCertificates,
  type PaymentsPage,
  type SubscriptionItem,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { MetricStrip } from "./MetricStrip";
import { ConversionBanner } from "./ConversionBanner";

export default function AccountBilling() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [ltv, setLtv] = useState<LtvCertificates | null>(null);
  const [payments, setPayments] = useState<PaymentsPage | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su, lt] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
          loadLtvCertificates({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        setLtv(lt);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load billing.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        // N5: do not force-refetch — allow module cache for repeat mounts/page hits.
        const p = await loadPayments(page, 20, { signal: ac.signal });
        if (cancelled) return;
        setPayments(p);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load payments.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [page]);

  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);
  const nextPayment = useMemo(() => formatNextPayment(subs, status), [subs, status]);
  const legacySource =
    subs?.items.find((i) => i.legacy_source === "medical_society_stripe")?.legacy_source ?? null;
  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";

  const grandfathered = useMemo(
    () =>
      (subs?.items ?? []).filter(
        (i) =>
          i.legacy_source === "medical_society_stripe" &&
          i.provider === "stripe" &&
          (i.can_convert_to_whop || i.status === "active"),
      ),
    [subs],
  );

  const orgConvert = useMemo(
    () =>
      (subs?.items ?? []).filter(
        (i) =>
          i.tier === "organization_owner" &&
          i.provider === "stripe" &&
          (i.can_convert_to_whop || i.status === "active"),
      ),
    [subs],
  );

  const duplicates = useMemo(
    () => (subs?.items ?? []).filter((i) => i.is_duplicate_stripe),
    [subs],
  );

  async function onConvert(item: SubscriptionItem, target: "metfix_pro" | "organization_owner") {
    setBusy(`convert:${item.sub_ref}`);
    setError(null);
    try {
      const res = await convertToWhop({ sub_ref: item.sub_ref, target_tier: target });
      if (res.purchase_url) {
        assignBillingUrl(res.purchase_url, "whop_only");
      }
      const su = await loadSubscriptions({ force: true });
      setSubs(su);
    } catch {
      setError("Conversion failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onCancelDuplicate(item: SubscriptionItem) {
    setBusy(`cancel:${item.sub_ref}`);
    setError(null);
    try {
      await cancelDuplicate(item.sub_ref, true);
      const su = await loadSubscriptions({ force: true });
      setSubs(su);
    } catch {
      setError("Cancel failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onManage(item: SubscriptionItem) {
    setBusy(`portal:${item.sub_ref}`);
    try {
      const res = await portalLink({
        sub_ref: item.sub_ref,
        intent: "manage",
      });
      if (!assignBillingUrl(res.url, "billing_portal")) {
        setError("Billing portal unavailable.");
      }
    } catch {
      setError("Billing portal unavailable.");
    } finally {
      setBusy(null);
    }
  }

  const totalPages = payments
    ? Math.max(1, Math.ceil(payments.total / (payments.per_page || 20)))
    : 1;

  return (
    <DashboardLayout
      title="Billing & Subscriptions"
      description="Manage Whop and legacy Stripe subscriptions, convert when ready, and review payment history."
    >
      {error ? <p className="account-error">{error}</p> : null}
      <MetricStrip
        status={status}
        nextPayment={nextPayment}
        tier={tier}
        legacySource={legacySource}
        ltv={ltv}
      />
      <ConversionBanner conversion={subs?.conversion} />

      {grandfathered.map((item) => (
        <section key={`gf-${item.sub_ref}`} className="account-card">
          <h2>Grandfathered Med Society</h2>
          <p className="account-muted">
            You keep MetFix Pro access on your legacy Stripe rate. Switch to Whop MetFix Pro when
            you are ready (Break Even Productions).
          </p>
          <div className="account-course-card__actions">
            <button type="button" className="account-btn account-btn--ghost">
              Keep Current Legacy Stripe Rate
            </button>
            <button
              type="button"
              className="account-btn"
              disabled={busy === `convert:${item.sub_ref}`}
              onClick={() => void onConvert(item, "metfix_pro")}
            >
              Switch to Whop MetFix Pro
            </button>
          </div>
        </section>
      ))}

      {orgConvert.map((item) => (
        <section key={`org-${item.sub_ref}`} className="account-card">
          <h2>Organization Owner on Stripe</h2>
          <p className="account-muted">
            Switch your Organization Owner subscription to Whop ($170/mo) under Break Even
            Productions. Covers Gym Affiliates and Doctor Practices, and includes MetFix Pro
            access.
          </p>
          <div className="account-course-card__actions">
            <button
              type="button"
              className="account-btn"
              disabled={busy === `convert:${item.sub_ref}`}
              onClick={() => void onConvert(item, "organization_owner")}
            >
              Switch to Whop Organization Owner
            </button>
            <button
              type="button"
              className="account-btn account-btn--ghost"
              disabled={busy === `portal:${item.sub_ref}`}
              onClick={() => void onManage(item)}
            >
              Manage in billing portal
            </button>
          </div>
        </section>
      ))}

      {(subs?.items ?? []).length > 0 ? (
        <section className="account-card">
          <h2>Subscriptions</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
            {(subs?.items ?? []).map((item) => (
              <li
                key={item.sub_ref}
                style={{
                  border: item.is_duplicate_stripe
                    ? "1px solid #c45c3a"
                    : "1px solid var(--color-line)",
                  borderRadius: "0.5rem",
                  padding: "0.85rem",
                  background: item.is_duplicate_stripe ? "rgba(196,92,58,0.06)" : "transparent",
                }}
              >
                <div className="account-mono">
                  {item.provider} · {item.tier} · {item.status}
                  {item.is_duplicate_stripe ? " · duplicate Stripe" : ""}
                </div>
                {item.card ? (
                  <div className="account-muted">
                    {item.card.brand} ···· {item.card.last4}
                  </div>
                ) : null}
                {item.is_duplicate_stripe ? (
                  <button
                    type="button"
                    className="account-btn"
                    style={{ marginTop: "0.65rem" }}
                    disabled={busy === `cancel:${item.sub_ref}`}
                    onClick={() => void onCancelDuplicate(item)}
                  >
                    Cancel duplicate Stripe subscription
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {duplicates.length === 0 ? null : (
            <p className="account-muted" style={{ marginTop: "0.75rem" }}>
              Duplicate Stripe subscriptions are highlighted so you can cancel extras without losing
              your primary entitlement.
            </p>
          )}
        </section>
      ) : null}

      <section className="account-card">
        <h2>Payment History</h2>
        {payments && payments.items.length > 0 ? (
          <>
            <table className="account-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Provider</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.items.map((p) => {
                  const receipt = safeBillingHref(p.receipt_url, "billing_portal");
                  const date = p.created_at
                    ? new Date(p.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—";
                  return (
                    <tr key={String(p.id)}>
                      <td className="account-mono">{date}</td>
                      <td>{p.description}</td>
                      <td>
                        <span className="account-pill">{p.provider}</span>
                      </td>
                      <td className="account-mono">{formatUsdFromCents(p.amount_cents)}</td>
                      <td>
                        <span className="account-pill">{p.status}</span>
                      </td>
                      <td>
                        {receipt ? (
                          <a href={receipt} rel="noreferrer">
                            Receipt
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="account-course-card__actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="account-btn account-btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="account-mono">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                className="account-btn account-btn--ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="account-muted">No payments yet.</p>
        )}
      </section>
    </DashboardLayout>
  );
}
