import { Link } from "wouter";
import {
  isProIntroOfferEligible,
  proMembershipCta,
  proUnlockTitle,
  type ProIntroOfferSource,
} from "@shared/account/pro-intro-offer";
import { basePath } from "@/const";

type Props = {
  photo?: string;
  introOffer?: ProIntroOfferSource | null;
};

export function ProUnlockBanner({
  photo = "/Stills/group-bodyweight-stand-gym-6.jpg",
  introOffer = null,
}: Props) {
  const eligible = isProIntroOfferEligible(introOffer);
  return (
    <aside className="dash-unlock" aria-label="MetFix Pro">
      <img src={photo} alt="" className="dash-unlock__photo" />
      <div className="dash-unlock__inner">
        <div>
          <p className="dash-unlock__kicker">MetFix Pro</p>
          <p className="dash-unlock__title">{proUnlockTitle(eligible)}</p>
        </div>
        <Link href={basePath("/join")} className="account-btn account-btn--accent">
          {proMembershipCta(eligible)}
        </Link>
      </div>
    </aside>
  );
}
