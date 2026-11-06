import { useEffect, useState } from "react";
import { type ReferralsDto } from "@shared/account/courseReferrals";
import { formatUsdFromCents } from "@shared/account/ltv";
import {
  assignBillingUrl,
  loadCourseGifts,
  loadReferrals,
  loadSubscriptions,
  portalLink,
  referralCodeAction,
  type AccountSubscriptions,
  type CourseGiftsPayload,
  type ReferralsPayload,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";

type Props = {
  fetchImpl?: typeof fetch;
  // wouter Route injects params — accept and ignore.
  params?: Record<string, string | undefined>;
};

function commissionBadge(percent: number): string {
  return `${percent}% referral commission`;
}

function courseLinkImage(link: ReferralsDto["course_links"][number]): string | null {
  const raw =
    ("image_url" in link && typeof link.image_url === "string" && link.image_url) ||
    ("product_image" in link &&
      typeof (link as { product_image?: unknown }).product_image === "string" &&
      (link as { product_image: string }).product_image) ||
    ("thumbnail_url" in link &&
      typeof (link as { thumbnail_url?: unknown }).thumbnail_url === "string" &&
      (link as { thumbnail_url: string }).thumbnail_url) ||
    ("featured_image" in link &&
      typeof (link as { featured_image?: unknown }).featured_image === "string" &&
      (link as { featured_image: string }).featured_image) ||
    null;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * E4 / R2-N3/N6: no client defaults (??0 / ??USD / missing eligible ≠ eligible).
 * Incomplete earnings → omit; missing eligible → not eligible.
 * R4-N1: course_links_dropped required — missing → throw (bad response).
 */
function asDto(payload: ReferralsPayload): ReferralsDto {
  if (typeof payload.course_links_dropped !== "number") {
    throw new Error("bad_referrals_dto");
  }
  const eligible = payload.eligible === true;
  let earnings: ReferralsDto["earnings"] | undefined;
  const e = payload.earnings;
  if (
    e &&
    typeof e.pending_cents === "number" &&
    typeof e.ready_cents === "number" &&
    typeof e.paid_total_cents === "number" &&
    typeof e.currency === "string" &&
    (e.connect_status === "none" ||
      e.connect_status === "pending" ||
      e.connect_status === "active")
  ) {
    earnings = {
      pending_cents: e.pending_cents,
      ready_cents: e.ready_cents,
      paid_total_cents: e.paid_total_cents,
      currency: e.currency,
      connect_status: e.connect_status,
    };
  }
  return {
    eligible,
    eligibility_type: eligible ? (payload.eligibility_type ?? null) : null,
    reason_code: payload.reason_code ?? null,
    payee_display_name: payload.payee_display_name ?? null,
    foundations_coach_expires_at: payload.foundations_coach_expires_at ?? null,
    join_code: payload.join_code ?? null,
    course_links: payload.course_links ?? [],
    course_links_dropped: payload.course_links_dropped,
    join_code_dropped: payload.join_code_dropped === true,
    ...(earnings ? { earnings } : {}),
  };
}

function CopyLinkBox(props: { url: string; onCopy: (text: string) => void }) {
  const { url, onCopy } = props;
  return (
    <div className="account-copy-box">
      <code className="account-copy-box__url account-mono">{url}</code>
      <button
        type="button"
        className="account-btn account-btn--ghost account-mono"
        onClick={() => void onCopy(url)}
      >
        Copy Referral Link
      </button>
    </div>
  );
}

export default function AccountReferrals(_props: Props) {
  const [data, setData] = useState<ReferralsDto | null>(null);
  const [gifts, setGifts] = useState<CourseGiftsPayload | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [r, g, s] = await Promise.all([
          loadReferrals({ signal: ac.signal }),
          loadCourseGifts({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }).catch(() => null),
        ]);
        if (cancelled) return;
        setData(asDto(r));
        setGifts(g);
        setSubs(s);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load referrals.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  async function onAction(action: "generate" | "rotate" | "revoke") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // R3-N2: single preserve path lives in referralCodeAction / preserveReferralEarnings.
      const next = await referralCodeAction(action, {
        previousEarnings: data?.earnings,
      });
      setData(asDto(next));
    } catch {
      setError(`Could not ${action} referral code.`);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const portalSub =
    (subs?.items ?? []).find((i) => i.can_open_portal === true) ?? null;

  async function onManageWhop() {
    if (!portalSub || portalBusy) return;
    setPortalBusy(true);
    setError(null);
    try {
      const res = await portalLink({
        sub_ref: portalSub.sub_ref,
        intent: "manage",
      });
      if (!assignBillingUrl(res.url, "billing_portal")) {
        setError("Whop portal is unavailable right now.");
      }
    } catch {
      setError("Whop portal is unavailable right now.");
    } finally {
      setPortalBusy(false);
    }
  }

  // R3-N1: Worker `eligible` is authoritative — no client canGenerate re-check.
  const eligible = data?.eligible === true;
  const showMutedNotice = Boolean(
    data && (data.course_links_dropped > 0 || data.join_code_dropped),
  );
  const showBareGenerate =
    eligible &&
    data != null &&
    data.join_code === null &&
    data.course_links.length === 0 &&
    !showMutedNotice;

  return (
    <DashboardLayout
      title="Referrals & Gifts"
      description="Share course referral links with your stored commission rate."
    >
      {error ? <p className="account-error">{error}</p> : null}

      {portalSub ? (
        <section className="account-card">
          <h2>Whop affiliate tools</h2>
          <p className="account-muted">
            Open your Whop portal for product links, referral stats, and payouts. Pending
            commissions stay on Whop — this page does not rebuild that UI.
          </p>
          <button
            type="button"
            className="account-btn"
            disabled={portalBusy}
            onClick={() => void onManageWhop()}
          >
            Manage on Whop
          </button>
        </section>
      ) : null}

      {data && !eligible ? (
        <section className="account-card">
          <h2>Referral links locked</h2>
          <p>
            Generating course referral links requires either an active Organization
            Owner membership ($170/mo Affiliate or Clinical Practice), or an active
            (non-expired) Foundations Coach credential (valid for 3 years from
            in-person seminar check-in or claiming the online MetFix Essentials
            certificate).
          </p>
          {data.reason_code === "bsi_referral_coach_expired" &&
          data.foundations_coach_expires_at ? (
            <p className="account-mono">
              Foundations Coach expired{" "}
              <span className="font-mono">
                {data.foundations_coach_expires_at}
              </span>
              .{" "}
              <a className="underline" href="/account/courses">
                Renew qualification
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {data?.earnings ? (
        <section className="account-card">
          <h2>Earnings</h2>
          <p className="account-mono font-mono">
            Pending {formatUsdFromCents(data.earnings.pending_cents)} · Ready{" "}
            {formatUsdFromCents(data.earnings.ready_cents)} · Paid{" "}
            {formatUsdFromCents(data.earnings.paid_total_cents)}
          </p>
        </section>
      ) : null}

      {eligible && data ? (
        <>
          {showMutedNotice ? (
            <p className="account-muted">
              {data.join_code_dropped
                ? "Your join link couldn't be shown right now."
                : "Some course links couldn't be shown right now."}
            </p>
          ) : null}

          {showBareGenerate ? (
            <section className="account-card">
              <button
                type="button"
                className="account-btn"
                disabled={busy}
                onClick={() => void onAction("generate")}
              >
                Generate Referral Link
              </button>
            </section>
          ) : null}

          {data.join_code ? (
            <section className="account-card">
              <h2>Join code</h2>
              <p className="account-mono">
                {data.join_code.slug}
              </p>
              <p className="account-mono font-mono">
                {commissionBadge(data.join_code.commission_percent)}
              </p>
              {data.join_code.join_url ? (
                <CopyLinkBox url={data.join_code.join_url} onCopy={copy} />
              ) : null}
              <div className="account-course-card__actions" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="account-btn account-btn--ghost"
                  disabled={busy}
                  onClick={() => void onAction("rotate")}
                >
                  Rotate
                </button>
                <button
                  type="button"
                  className="account-btn account-btn--ghost"
                  disabled={busy}
                  onClick={() => void onAction("revoke")}
                >
                  Revoke
                </button>
              </div>
            </section>
          ) : null}

          {eligible &&
          data.join_code === null &&
          data.course_links.length === 0 &&
          showMutedNotice ? (
            <section className="account-card">
              <button
                type="button"
                className="account-btn"
                disabled={busy}
                onClick={() => void onAction("generate")}
              >
                Generate Referral Link
              </button>
            </section>
          ) : null}

          {data.course_links.length > 0 ? (
            <section className="account-card">
              <h2>Course referral links</h2>
              <ul className="account-referral-list">
                {data.course_links.map((link) => {
                  const image = courseLinkImage(link);
                  return (
                    <li key={link.course_id} className="account-course-card account-referral-card">
                      {image ? (
                        <img
                          className="account-referral-card__image"
                          src={image}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <div className="account-referral-card__body">
                        <div className="account-course-card__title">{link.course_title}</div>
                        <div className="account-mono">
                          {formatUsdFromCents(link.course_price_cents)} ·{" "}
                          {commissionBadge(link.commission_percent)} · est.{" "}
                          {formatUsdFromCents(link.estimated_commission_cents)}
                        </div>
                        <CopyLinkBox url={link.share_url} onCopy={copy} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="account-card">
        <h2>Course gifts</h2>
        {(gifts?.items ?? []).length === 0 ? (
          <p className="account-muted">No gift codes.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {(gifts?.items ?? []).map((g, i) => (
              <li key={`${g.code ?? i}`}>
                <span className="account-mono">{g.code ?? "—"}</span>
                {" · "}
                {g.course_title ?? "Course"}
                {" · "}
                {g.status ?? "unknown"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardLayout>
  );
}
