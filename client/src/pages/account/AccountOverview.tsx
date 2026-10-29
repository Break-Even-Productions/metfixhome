import { useEffect, useMemo, useState } from "react";
import {
  deriveMembershipStatus,
  formatNextPayment,
  loadLtvCertificates,
  loadOverview,
  loadSubscriptions,
  type AccountOverview as OverviewDto,
  type AccountSubscriptions,
  type LtvCertificates,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { MetricStrip } from "./MetricStrip";
import { ConversionBanner } from "./ConversionBanner";
import { LtvVisualizer } from "./LtvVisualizer";
import { FoundationsCoachCard } from "./FoundationsCoachCard";

export default function AccountOverview() {
  const [overview, setOverview] = useState<OverviewDto | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [ltv, setLtv] = useState<LtvCertificates | null>(null);
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
        setError("Unable to load overview.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);
  const nextPayment = useMemo(() => formatNextPayment(subs, status), [subs, status]);
  const legacySource =
    subs?.items.find((i) => i.legacy_source === "medical_society_stripe")?.legacy_source ??
    subs?.items.find((i) => i.legacy_source)?.legacy_source ??
    null;
  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const coach = ltv?.foundations_coach ?? overview?.foundations_coach;

  return (
    <DashboardLayout
      title="Overview"
      description="Your membership status, certificate LTV budget, and Foundations Coach qualification."
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
      {ltv ? <LtvVisualizer ltv={ltv} /> : null}
      {coach ? <FoundationsCoachCard coach={coach} /> : null}
    </DashboardLayout>
  );
}
