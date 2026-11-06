import { useRef } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";
import { formatUsdFromCents } from "@shared/account/ltv";
import { tierDisplayLabel, type LegacySubscriptionSource } from "@shared/account/tiers";
import type { LtvCertificates, MembershipStatusLabel } from "@/lib/account";
import { DashAsteriskFallback, useDashHeroGlass } from "./DashHeroGlass";
import { metfixToolsUnlocked } from "./metfixAppTools";

type Stat = {
  label: string;
  value: string;
  note?: string;
};

type Props = {
  photo: string;
  date: string;
  greeting: string;
  status: MembershipStatusLabel;
  nextPayment: string | null;
  tier: CanonicalSubscriptionTier;
  legacySource?: LegacySubscriptionSource;
  ltv: LtvCertificates | null;
  showUpgradeCta: boolean;
};

export function GreetingHero({
  photo,
  date,
  greeting,
  status,
  nextPayment,
  tier,
  legacySource,
  ltv,
  showUpgradeCta,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const glassReady = useDashHeroGlass(rootRef, barRef, markRef, photo);

  const unlocked = metfixToolsUnlocked(tier);
  const available = ltv ? formatUsdFromCents(ltv.available_certificate_ltv_cents) : "$0.00";
  const total = ltv ? formatUsdFromCents(ltv.total_ltv_cents) : "$0.00";
  const claimed = ltv ? formatUsdFromCents(ltv.claimed_courses_value_cents) : "$0.00";

  const stats: Stat[] = [
    { label: "Status", value: status },
    {
      label: "Membership Tier",
      value: tierDisplayLabel(tier, { legacy_source: legacySource ?? null }),
    },
    {
      label: "Certificate LTV Available",
      value: `${available} available (${total} total LTV · ${claimed} claimed)`,
    },
  ];
  if (nextPayment) {
    stats.splice(1, 0, { label: "Next Payment", value: nextPayment });
  }

  return (
    <section
      ref={rootRef}
      className={`dash-greet${glassReady ? " is-glass" : ""}`}
      aria-label="Account greeting"
    >
      {/*
        Glass root: mark + stats must be direct children (LiquidGlass skips nested).
        Photo lives in a media wrapper; markChanged re-samples after load.
      */}
      <div className="dash-greet__media" aria-hidden="true">
        <img src={photo} alt="" className="dash-greet__photo" />
        <div className="dash-greet__shade dash-greet__shade--x" />
        <div className="dash-greet__shade dash-greet__shade--y" />
      </div>
      <div
        ref={markRef}
        className="dash-greet__mark"
        data-config='{"shape":1}'
        role="img"
        aria-label="MetFix"
      >
        {glassReady ? null : <DashAsteriskFallback />}
      </div>
      <div className="dash-greet__copy">
        <p className="dash-greet__date">{date}</p>
        <h2 className="dash-greet__hello">{greeting}</h2>
        {showUpgradeCta && !unlocked ? (
          <Link href={basePath("/join")} className="account-btn account-btn--accent dash-greet__cta">
            Start my free month
          </Link>
        ) : null}
      </div>
      <div
        ref={barRef}
        className="dash-greet__stats"
        data-config='{"cornerRadius":16}'
        role="group"
        aria-label="Account status"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="dash-greet__stat">
            <p className="dash-greet__stat-label">{stat.label}</p>
            <p className="dash-greet__stat-value account-metric">{stat.value}</p>
            {stat.note ? <p className="dash-greet__stat-note">{stat.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
