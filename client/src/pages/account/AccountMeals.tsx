import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import {
  deriveMembershipStatus,
  loadOverview,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { metfixToolsUnlocked } from "./metfixAppTools";
import { ProUnlockBanner } from "./ProUnlockBanner";

/**
 * Meal plans dashboard shell matching the Mia mockup.
 * Live BSI meal-plan personalization is not yet exposed on metfix.org —
 * Pro users see the structural UI; metrics are labeled as preview/shell.
 */
export default function AccountMeals() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);

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
      } catch {
        /* layout handles account errors */
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const tier = subs?.canonical_tier ?? overview?.canonical_tier ?? "free";
  const pro = metfixToolsUnlocked(tier);
  const firstName =
    overview?.display_name?.trim().split(/\s+/).filter(Boolean)[0] || "Member";
  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);

  return (
    <DashboardLayout
      title={`${firstName}’s weekly metabolic meal plan`}
      description="High-protein, whole-food menus calibrated to training load — with swaps and an aisle-sorted grocery list."
      hideChromeTitle
    >
      <section className="dash-tool-hero">
        <img
          src="/daily-fix/260930-cilantro-lime-steak.jpg"
          alt=""
          className="dash-tool-hero__photo"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "/Stills/athlete-bodyweight-sit-gym.jpg";
          }}
        />
        <div className="dash-tool-hero__shade" aria-hidden="true" />
        <div className="dash-tool-hero__copy">
          <div className="dash-tool-hero__chips">
            <Link href={basePath("/account")} className="dash-chip">
              Overview
            </Link>
            {!pro ? (
              <span className="dash-chip dash-chip--accent">Preview · Included with MetFix Pro</span>
            ) : (
              <span className="dash-chip">Status · {status}</span>
            )}
          </div>
          <h1 className="dash-tool-hero__title">{firstName}’s weekly metabolic meal plan.</h1>
          <p className="dash-tool-hero__lede">
            High-protein, whole-food menus calibrated to your training load, insulin
            sensitivity, and kitchen schedule — with one-click swaps and an aisle-sorted
            grocery list.
          </p>
          {!pro ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock Meal Plans — 1 Month Free
            </Link>
          ) : null}
        </div>
        <div className="dash-tool-hero__stats">
          {[
            {
              label: "Daily metabolic target",
              value: pro ? "Personalized macros" : "165g P · 115g F · 24g C",
              note: pro
                ? "Live meal-plan macros from BSI are not wired yet — shell only."
                : "🔒 Custom macro dial with Pro",
            },
            {
              label: "Weekly structure",
              value: "21 meals · prep plan",
              note: pro ? "Cook once, eat twice (UI shell)" : "🔒 Sunday batch timeline with Pro",
            },
            {
              label: "Smart grocery list",
              value: "Whole-food items",
              note: pro ? "Grocery export pending BSI data" : "🔒 1-click grocery export with Pro",
            },
          ].map((s) => (
            <div key={s.label} className="dash-tool-hero__stat">
              <p className="dash-greet__stat-label">{s.label}</p>
              <p className="dash-greet__stat-value">{s.value}</p>
              <p className="dash-greet__stat-note">{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-panel">
        <p className="account-muted" role="note">
          Data gap: MetFix.org does not yet have a live BSI meal-plan API. This page matches
          the mockup shell; values above are structural placeholders, not production metrics.
        </p>
        {!pro ? <ProUnlockBanner /> : null}
      </div>
    </DashboardLayout>
  );
}
