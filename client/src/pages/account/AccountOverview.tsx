import { useEffect, useMemo, useState } from "react";
import {
  deriveMembershipStatus,
  formatNextPayment,
  hasScheduledNextPayment,
  loadLtvCertificates,
  loadOverview,
  loadSubscriptions,
  type AccountOverview as OverviewDto,
  type AccountSubscriptions,
  type LtvCertificates,
} from "@/lib/account";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";
import DashboardLayout from "./DashboardLayout";
import { ConversionBanner } from "./ConversionBanner";
import { LtvVisualizer } from "./LtvVisualizer";
import { FoundationsCoachCard } from "./FoundationsCoachCard";
import { AppTools } from "./AppTools";
import { GreetingHero } from "./GreetingHero";
import { ProUnlockBanner } from "./ProUnlockBanner";
import { metfixToolsUnlocked } from "./metfixAppTools";

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/).filter(Boolean)[0];
  return part || "there";
}

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
  const nextPayment = useMemo(() => {
    if (!hasScheduledNextPayment(subs, status)) return null;
    return formatNextPayment(subs, status);
  }, [subs, status]);
  const legacySource =
    subs?.items.find((i) => i.legacy_source === "medical_society_stripe")?.legacy_source ??
    subs?.items.find((i) => i.legacy_source)?.legacy_source ??
    null;
  const tier: CanonicalSubscriptionTier =
    subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const coach = ltv?.foundations_coach ?? overview?.foundations_coach;
  const displayName = overview?.display_name ?? "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const unlocked = metfixToolsUnlocked(tier);

  return (
    <DashboardLayout
      title="Overview"
      description="Your membership status, certificate LTV budget, and Foundations Coach qualification."
      hideChromeTitle
    >
      {error ? <p className="account-error">{error}</p> : null}
      <GreetingHero
        photo="/Stills/athlete-bodyweight-sit-gym.jpg"
        date={today}
        greeting={`${greetingFor(new Date())}, ${firstName(displayName)}.`}
        status={status}
        nextPayment={nextPayment}
        tier={tier}
        legacySource={legacySource ?? undefined}
        ltv={ltv}
        showUpgradeCta
      />
      <div className="dash-panel">
        <AppTools tier={tier} />
        <ConversionBanner conversion={subs?.conversion} />
        {ltv ? <LtvVisualizer ltv={ltv} /> : null}
        {coach ? <FoundationsCoachCard coach={coach} /> : null}
        {!unlocked ? <ProUnlockBanner /> : null}
      </div>
    </DashboardLayout>
  );
}
