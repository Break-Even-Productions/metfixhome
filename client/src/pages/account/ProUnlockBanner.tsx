import { Link } from "wouter";
import { basePath } from "@/const";

type Props = {
  photo?: string;
};

export function ProUnlockBanner({
  photo = "/Stills/group-bodyweight-stand-gym-6.jpg",
}: Props) {
  return (
    <aside className="dash-unlock" aria-label="MetFix Pro">
      <img src={photo} alt="" className="dash-unlock__photo" />
      <div className="dash-unlock__inner">
        <div>
          <p className="dash-unlock__kicker">MetFix Pro</p>
          <p className="dash-unlock__title">Unlock the tools. First month free.</p>
        </div>
        <Link href={basePath("/join")} className="account-btn account-btn--accent">
          Start my free month
        </Link>
      </div>
    </aside>
  );
}
