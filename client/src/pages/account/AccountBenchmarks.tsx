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
 * PR & benchmarks dashboard shell matching the Mia mockup.
 * Live PR/lab tracking is not yet on metfix.org — Pro users get the UI shell;
 * non-Pro see preview + upgrade CTA. Do not treat placeholder figures as truth.
 */
export default function AccountBenchmarks() {
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
      title={`${firstName}’s PRs, benchmarks & body markers`}
      description="Keep 1RM lifts, Daily Fix benchmark times, and metabolic markers in one place."
      hideChromeTitle
    >
      <section className="dash-tool-hero">
        <img
          src="/Stills/athlete-bodyweight-deadlift-indoors-sunt-tropics-hydration.jpg"
          alt=""
          className="dash-tool-hero__photo"
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
          <h1 className="dash-tool-hero__title">
            {firstName}’s PRs, benchmarks & body markers.
          </h1>
          <p className="dash-tool-hero__lede">
            Keep your 1RM lifts, repeat Daily Fix benchmark times, and metabolic blood work
            in one place — with live working-set percentages and zero spreadsheets.
          </p>
          {!pro ? (
            <Link href={basePath("/join")} className="account-btn account-btn--accent">
              Unlock PR & Benchmark Tracking — 1 Month Free
            </Link>
          ) : null}
        </div>
        <div className="dash-tool-hero__stats">
          {[
            {
              label: "Strength index",
              value: pro ? "Your lifts" : "Preview lifts",
              note: pro
                ? "Live PR log from BSI/app is not wired yet — shell only."
                : "🔒 Auto-% working sets with Pro",
            },
            {
              label: "Benchmark conditioning",
              value: "Daily Fix repeats",
              note: pro
                ? "Repeat WOD history pending data surface"
                : "🔒 Compare repeat dates with Pro",
            },
            {
              label: "Metabolic markers",
              value: "Labs & waist",
              note: pro
                ? "Marker log pending BSI/app API"
                : "🔒 Lab & body marker log with Pro",
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
          Data gap: no live PR / benchmark / lab API on MetFix.org yet. This page matches the
          mockup shell without inventing production metrics.
        </p>
        {!pro ? <ProUnlockBanner /> : null}
      </div>
    </DashboardLayout>
  );
}
