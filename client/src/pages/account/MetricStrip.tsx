import { formatUsdFromCents } from "@shared/account/ltv";
import { tierDisplayLabel, type CanonicalSubscriptionTier } from "@shared/account/tiers";
import type { LegacySubscriptionSource } from "@shared/account/tiers";
import type { LtvCertificates, MembershipStatusLabel } from "@/lib/account";

type Props = {
  status: MembershipStatusLabel;
  nextPayment: string;
  tier: CanonicalSubscriptionTier;
  legacySource?: LegacySubscriptionSource;
  ltv: LtvCertificates | null;
};

export function MetricStrip({ status, nextPayment, tier, legacySource, ltv }: Props) {
  const available = ltv ? formatUsdFromCents(ltv.available_certificate_ltv_cents) : "$0.00";
  const total = ltv ? formatUsdFromCents(ltv.total_ltv_cents) : "$0.00";
  const claimed = ltv ? formatUsdFromCents(ltv.claimed_courses_value_cents) : "$0.00";
  const ltvLabel = `${available} available (${total} total LTV · ${claimed} claimed)`;

  return (
    <section className="account-metric-strip" aria-label="Account status">
      <div className="account-metric-card">
        <div className="account-metric-card__label">Status</div>
        <div className="account-metric-card__value account-metric">{status}</div>
      </div>
      <div className="account-metric-card">
        <div className="account-metric-card__label">Next Payment</div>
        <div className="account-metric-card__value account-metric">{nextPayment}</div>
      </div>
      <div className="account-metric-card">
        <div className="account-metric-card__label">Membership Tier</div>
        <div className="account-metric-card__value account-metric">
          {tierDisplayLabel(tier, { legacy_source: legacySource ?? null })}
        </div>
      </div>
      <div className="account-metric-card">
        <div className="account-metric-card__label">Certificate LTV Available</div>
        <div className="account-metric-card__value account-metric">{ltvLabel}</div>
      </div>
    </section>
  );
}
