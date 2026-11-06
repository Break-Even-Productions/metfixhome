import { formatUsdFromCents } from "@shared/account/ltv";
import { tierDisplayLabel, type CanonicalSubscriptionTier } from "@shared/account/tiers";
import type { LegacySubscriptionSource } from "@shared/account/tiers";
import type { LtvCertificates, MembershipStatusLabel } from "@/lib/account";

type Props = {
  status: MembershipStatusLabel;
  /** Omit the next-payment block when the account has no scheduled payment. */
  nextPayment: string | null;
  tier: CanonicalSubscriptionTier;
  legacySource?: LegacySubscriptionSource;
  ltv: LtvCertificates | null;
  /** Only set when a real portal session is available — never a guessed Whop URL. */
  onManageTier?: (() => void) | null;
  manageBusy?: boolean;
};

export function MetricStrip({
  status,
  nextPayment,
  tier,
  legacySource,
  ltv,
  onManageTier,
  manageBusy,
}: Props) {
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
      {nextPayment ? (
        <div className="account-metric-card">
          <div className="account-metric-card__label">Next Payment</div>
          <div className="account-metric-card__value account-metric">{nextPayment}</div>
        </div>
      ) : null}
      <div className="account-metric-card">
        <div className="account-metric-card__label">Membership Tier</div>
        <div className="account-metric-card__value account-metric">
          {tierDisplayLabel(tier, { legacy_source: legacySource ?? null })}
        </div>
        {onManageTier ? (
          <button
            type="button"
            className="account-btn account-btn--ghost"
            style={{ marginTop: "0.55rem" }}
            disabled={manageBusy}
            onClick={onManageTier}
          >
            Manage membership
          </button>
        ) : null}
      </div>
      <div className="account-metric-card">
        <div className="account-metric-card__label">Certificate LTV Available</div>
        <div className="account-metric-card__value account-metric">{ltvLabel}</div>
      </div>
    </section>
  );
}
