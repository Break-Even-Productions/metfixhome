import { useEffect, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  assignBillingUrl,
  loadCoachingClient,
  loadCoachingCoach,
  loadOverview,
  loadSubscriptions,
  portalLink,
  type AccountOverview,
  type AccountSubscriptions,
} from "@/lib/account";
import { accountRead } from "@/lib/affiliateAccount";
import DashboardLayout from "./DashboardLayout";
import AffiliateWorkspace from "./AffiliateWorkspace";

type Choice = { id: number; name: string };

export default function AccountOrganization() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [affiliates, setAffiliates] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [ov, su, client, coach] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
          loadCoachingClient({ signal: ac.signal }).catch(() => null),
          loadCoachingCoach({ signal: ac.signal }).catch(() => null),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
        const byId = new Map<number, string>();
        for (const row of [...(client?.affiliates ?? []), ...(coach?.affiliates ?? [])]) {
          if (row.affiliate_id > 0) byId.set(row.affiliate_id, row.name || `Affiliate ${row.affiliate_id}`);
        }
        try {
          const primary = await accountRead<{
            affiliate?: { id?: number; name?: string };
          }>("/api/account/affiliates/primary", ac.signal);
          const id = primary.affiliate?.id;
          if (typeof id === "number" && id > 0) {
            byId.set(id, primary.affiliate?.name || byId.get(id) || `Affiliate ${id}`);
          }
        } catch {
          /* no primary affiliate */
        }
        setAffiliates([...byId.entries()].map(([id, name]) => ({ id, name })));
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError("Unable to load organization.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

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
      description="Manage your affiliate: settings, team, feed, insurance, and payments."
    >
      {error ? <p className="account-error">{error}</p> : null}
      {ready && affiliates.length === 0 ? (
        <section className="account-card">
          <h2>Organization tools</h2>
          <p className="account-muted">
            Affiliate tools appear here when you are on a gym roster. Organization Owner billing stays in the Whop portal.
          </p>
          <div className="account-course-card__actions">
            <button type="button" className="account-btn" disabled={busy} onClick={() => void onPortal()}>
              Manage organization billing
            </button>
            <Link href={basePath("/account/billing")} className="account-btn account-btn--ghost">
              Open Billing
            </Link>
          </div>
        </section>
      ) : null}
      {affiliates.length > 0 ? (
        <AffiliateWorkspace
          affiliates={affiliates}
          overview={overview}
          onPortal={() => void onPortal()}
          portalBusy={busy}
        />
      ) : null}
    </DashboardLayout>
  );
}
