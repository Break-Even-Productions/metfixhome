import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import { formatUsdFromCents } from "@shared/account/ltv";
import {
  loadRewards,
  type AccountRewards as RewardsDto,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { LtvVisualizer } from "./LtvVisualizer";
import type { LtvCertificates } from "@/lib/account";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";

type Props = {
  fetchImpl?: typeof fetch;
  params?: Record<string, string | undefined>;
};

function personaLabels(rewards: RewardsDto): string[] {
  const p = rewards.tier.personas;
  const out: string[] = [];
  const fc = p.foundations_coach;
  if (
    fc &&
    typeof fc === "object" &&
    !Array.isArray(fc) &&
    (fc as { active?: unknown }).active === true
  ) {
    out.push("Foundations Coach");
  }
  if (p.metfix_medical === true) out.push("MetFix Medical");
  if (p.primary_owner === true || p.gym_owner === true) out.push("Gym Owner");
  if (p.metfix_pro === true) out.push("MetFix Pro");
  if (p.free === true && out.length === 0) out.push("Member");
  return out;
}

function claimsHeadline(rewards: RewardsDto): { title: string; detail: string } {
  const c = rewards.class_claims;
  const monthUsed = c.calendar_month.used;
  if (!c.enabled) {
    return {
      title: `${monthUsed} course redemption${monthUsed === 1 ? "" : "s"} this month`,
      detail:
        c.mode === "none"
          ? "Pro and organization memberships unlock free course claims when claims go live."
          : "Course claims are temporarily paused.",
    };
  }
  if (c.mode === "unlimited") {
    return {
      title: `${monthUsed} course redemption${monthUsed === 1 ? "" : "s"} this month`,
      detail: "Organization owners have unlimited course claims in the current policy.",
    };
  }
  if (c.mode === "windowed" && c.cap_n != null) {
    return {
      title: `${c.used} of ${c.cap_n} course claim${c.cap_n === 1 ? "" : "s"} this period`,
      detail:
        monthUsed === c.used
          ? "Counted from your membership billing window."
          : `${monthUsed} redemption${monthUsed === 1 ? "" : "s"} in the calendar month.`,
    };
  }
  return {
    title: `${monthUsed} course redemption${monthUsed === 1 ? "" : "s"} this month`,
    detail: "Redemptions from your MetFix membership benefits.",
  };
}

function toLtvCertificates(rewards: RewardsDto): LtvCertificates {
  const tier = (rewards.tier.canonical_tier || "free") as CanonicalSubscriptionTier;
  const claimed = Array.isArray(rewards.ltv.claimed_certificates)
    ? rewards.ltv.claimed_certificates
    : [];
  return {
    total_ltv_cents: rewards.ltv.total_cents,
    claimed_courses_value_cents: rewards.ltv.claimed_certificate_cents,
    available_certificate_ltv_cents: rewards.ltv.available_cents,
    claimed_certificates: claimed as LtvCertificates["claimed_certificates"],
    canonical_tier: tier,
    foundations_coach: (rewards.ltv.foundations_coach ?? {
      active: false,
      role: "foundation_certified",
      status: "none",
      grant_reason: null,
      granted_at: null,
      expires_at: null,
      seminar_checked_in: false,
      metfix_essentials_completed: false,
      metfix_essentials_certificate_claimed: false,
    }) as LtvCertificates["foundations_coach"],
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AccountRewards(_props: Props) {
  const [rewards, setRewards] = useState<RewardsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const data = await loadRewards({ signal: ac.signal });
        if (cancelled) return;
        setRewards(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load Rewards.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const labels = useMemo(() => (rewards ? personaLabels(rewards) : []), [rewards]);
  const claims = useMemo(
    () => (rewards ? claimsHeadline(rewards) : null),
    [rewards],
  );
  const ltv = useMemo(() => (rewards ? toLtvCertificates(rewards) : null), [rewards]);

  return (
    <DashboardLayout
      title="Rewards"
      description="Your MetFix status, lifetime value, course redemptions, and member offers."
      hideChromeTitle
    >
      {error ? <p className="account-error">{error}</p> : null}

      <section className="rewards-hero" aria-labelledby="rewards-hero-heading">
        <p className="rewards-hero__eyebrow">MetFix Rewards</p>
        <h1 id="rewards-hero-heading" className="rewards-hero__title">
          {rewards
            ? formatUsdFromCents(rewards.ltv.available_cents)
            : "—"}
        </h1>
        <p className="rewards-hero__sub">
          Available certificate LTV
          {rewards
            ? ` · ${formatUsdFromCents(rewards.ltv.total_cents)} lifetime`
            : ""}
        </p>
        {labels.length > 0 ? (
          <ul className="rewards-hero__pills" aria-label="Membership status">
            {labels.map((label) => (
              <li key={label}>
                <span className="rewards-hero__pill">{label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="dash-panel rewards-panel">
        {claims ? (
          <section className="account-card rewards-claims" aria-labelledby="rewards-claims-heading">
            <h2 id="rewards-claims-heading">Course redemptions</h2>
            <p className="rewards-claims__stat account-mono">{claims.title}</p>
            <p className="account-muted">{claims.detail}</p>
            <p className="account-muted">
              Claim courses from{" "}
              <Link href={basePath("/account/courses")}>My Courses &amp; Certificates</Link>.
            </p>
          </section>
        ) : null}

        {ltv ? <LtvVisualizer ltv={ltv} /> : null}

        <section className="account-card rewards-offers" aria-labelledby="rewards-offers-heading">
          <h2 id="rewards-offers-heading">Member offers</h2>
          {!rewards ? (
            <p className="account-muted">Loading offers…</p>
          ) : !rewards.offers_live ? (
            <p className="account-muted">
              Partner and seminar discount codes will appear here once Rewards
              offers go live. Existing Foundations Seminar codes remain on your
              seminar status page until then.
            </p>
          ) : rewards.offers.length === 0 ? (
            <p className="account-muted">
              No offers for your membership right now. Keep training — new
              partner perks unlock by role.
            </p>
          ) : (
            <ul className="rewards-offers__list">
              {rewards.offers.map((offer) => (
                <li key={offer.id} className="rewards-offer">
                  <div className="rewards-offer__body">
                    <h3 className="rewards-offer__title">{offer.title}</h3>
                    {offer.description ? (
                      <p className="account-muted">{offer.description}</p>
                    ) : null}
                    {offer.code ? (
                      <div className="rewards-offer__code-row">
                        <code className="rewards-offer__code account-mono">{offer.code}</code>
                        <button
                          type="button"
                          className="account-btn account-btn--ghost"
                          onClick={async () => {
                            const ok = await copyText(offer.code!);
                            if (ok) {
                              setCopied(offer.id);
                              window.setTimeout(() => setCopied(null), 2000);
                            }
                          }}
                        >
                          {copied === offer.id ? "Copied" : "Copy code"}
                        </button>
                      </div>
                    ) : null}
                    {offer.url ? (
                      <p>
                        <a href={offer.url} className="account-link">
                          View details
                        </a>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="account-card" aria-labelledby="rewards-more-heading">
          <h2 id="rewards-more-heading">More ways to earn</h2>
          <p className="account-muted">
            Referrals and course gifts stay on their dedicated tab.{" "}
            <Link href={basePath("/account/referrals")}>Open Referrals &amp; Gifts</Link>
            {" · "}
            <Link href={basePath("/account/billing")}>Billing &amp; Subscriptions</Link>
          </p>
        </section>
      </div>
    </DashboardLayout>
  );
}
