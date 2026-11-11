import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { basePath } from "@/const";
import {
  isProIntroOfferEligible,
  proMembershipCta,
  type ProIntroOfferSource,
} from "@shared/account/pro-intro-offer";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";
import { formatUsdFromCents } from "@shared/account/ltv";
import { tierDisplayLabel, type LegacySubscriptionSource } from "@shared/account/tiers";
import type { LtvCertificates, MembershipStatusLabel } from "@/lib/account";
import { DashAsteriskFallback, useDashHeroGlass } from "./DashHeroGlass";
import { metfixToolsUnlocked } from "./metfixAppTools";

const CERTIFICATE_CREDIT_INFO =
  "Every dollar you spend on MetFix subscriptions and merch contributes to your Certificate Credit. You can use this credit to claim the certificate for courses you redeemed as part of your included subscription usage.";

type Stat = {
  label: string;
  value: string;
  note?: string;
  info?: boolean;
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
  introOffer?: ProIntroOfferSource | null;
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
  introOffer = null,
}: Props) {
  const introEligible = isProIntroOfferEligible(introOffer);
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const glassReady = useDashHeroGlass(rootRef, barRef, markRef, photo);
  const [ltvOpen, setLtvOpen] = useState(false);

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
      label: "Certificate Credit Available",
      value: available,
      note: `${total} total · ${claimed} claimed`,
      info: true,
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
            {proMembershipCta(introEligible)}
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
            <div className="dash-greet__stat-label-row">
              <p className="dash-greet__stat-label">{stat.label}</p>
              {stat.info ? (
                <button
                  type="button"
                  className="account-info-btn account-info-btn--on-dark"
                  aria-haspopup="dialog"
                  aria-expanded={ltvOpen}
                  onClick={() => setLtvOpen(true)}
                >
                  <span className="account-info-btn__glyph" aria-hidden="true">
                    i
                  </span>
                  <span className="sr-only">How Certificate Credit works</span>
                </button>
              ) : null}
            </div>
            <p className="dash-greet__stat-value account-metric">{stat.value}</p>
            {stat.note ? <p className="dash-greet__stat-note">{stat.note}</p> : null}
          </div>
        ))}
      </div>
      <Dialog open={ltvOpen} onOpenChange={setLtvOpen}>
        <DialogContent className="dash-greet__credit-dialog">
          <DialogHeader>
            <DialogTitle>Certificate Credit</DialogTitle>
            <DialogDescription>{CERTIFICATE_CREDIT_INFO}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </section>
  );
}
