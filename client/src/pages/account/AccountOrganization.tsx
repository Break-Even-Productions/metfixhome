import { useEffect, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  assignBillingUrl,
  loadOverview,
  loadSubscriptions,
  portalLink,
  type AccountOverview,
  type AccountSubscriptions,
} from "@/lib/account";
import { tierDisplayLabel } from "@shared/account/tiers";
import DashboardLayout from "./DashboardLayout";

export default function AccountOrganization() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load organization.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const isOrg = tier === "organization_owner" || overview?.badges.affiliate === true;

  async function onPortal() {
    setBusy(true);
    setError(null);
    try {
      const orgItem = (subs?.items ?? []).find(
        (i) => i.tier === "organization_owner" && i.status === "active",
      );
      const res = await portalLink({
        sub_ref: orgItem?.sub_ref,
        tier: "organization_owner",
        intent: "manage",
      });
      if (!assignBillingUrl(res.url, "billing_portal")) {
        setError("Billing portal unavailable.");
      }
    } catch {
      setError("Billing portal unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      title="Organization"
      description="Manage Organization Owner membership, affiliate access, and related portals."
    >
      {error ? <p className="account-error">{error}</p> : null}

      {!isOrg ? (
        <section className="account-card">
          <h2>Organization tools</h2>
          <p className="account-muted">
            Organization management is available for Organization Owner members and affiliates.
            Upgrade on Billing when you operate a gym or clinical practice.
          </p>
          <div className="account-course-card__actions">
            <Link href={basePath("/account/billing")} className="account-btn">
              Open Billing
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="account-card">
            <h2>Organization status</h2>
            <p className="account-mono">{tierDisplayLabel(tier)}</p>
            <p className="account-muted" style={{ marginTop: "0.5rem" }}>
              Organization Owner covers gym affiliates and doctor practices and includes MetFix Pro
              access. Billing changes happen in the Break Even Productions Whop portal.
            </p>
            <div className="account-course-card__actions">
              <button
                type="button"
                className="account-btn"
                disabled={busy}
                onClick={() => void onPortal()}
              >
                Manage organization billing
              </button>
              <Link href={basePath("/account/referrals")} className="account-btn account-btn--ghost">
                Referral portal
              </Link>
              <Link href={basePath("/account/profile")} className="account-btn account-btn--ghost">
                Profile settings
              </Link>
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
