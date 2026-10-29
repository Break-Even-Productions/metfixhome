import { useCallback, useEffect, useState } from "react";
import { type ReferralsDto } from "@shared/account/courseReferrals";
import { formatUsdFromCents } from "@shared/account/ltv";
import {
  loadCourseGifts,
  loadReferrals,
  referralCodeAction,
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

export default function AccountReferrals(_props: Props) {
  const [data, setData] = useState<ReferralsDto | null>(null);
  const [gifts, setGifts] = useState<CourseGiftsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [r, g] = await Promise.all([
          loadReferrals({ signal: ac.signal }),
          loadCourseGifts({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setData(asDto(r));
        setGifts(g);
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

  const onAction = useCallback(
    async (action: "generate" | "rotate" | "revoke") => {
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
    },
    [busy, data?.earnings],
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, []);

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

      {data && !eligible ? (
        <section className="account-card" data-testid="referrals-locked">
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
            <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              Foundations Coach expired{" "}
              <span className="font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
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
        <section className="account-card" data-testid="referrals-earnings">
          <h2>Earnings</h2>
          <p className="account-mono font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            Pending {formatUsdFromCents(data.earnings.pending_cents)} · Ready{" "}
            {formatUsdFromCents(data.earnings.ready_cents)} · Paid{" "}
            {formatUsdFromCents(data.earnings.paid_total_cents)}
          </p>
        </section>
      ) : null}

      {eligible && data ? (
        <>
          {showMutedNotice ? (
            <p
              className="account-muted"
              data-testid="referrals-dropped-notice"
            >
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
                data-testid="generate-referral"
                onClick={() => void onAction("generate")}
              >
                Generate Referral Link
              </button>
            </section>
          ) : null}

          {data.join_code ? (
            <section className="account-card" data-testid="join-code-card">
              <h2>Join code</h2>
              <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                {data.join_code.slug}
              </p>
              <p className="account-mono font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                {commissionBadge(data.join_code.commission_percent)}
              </p>
              {data.join_code.join_url ? (
                <button
                  type="button"
                  className="account-btn account-btn--ghost account-mono"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  onClick={() => void copy(data.join_code!.join_url!)}
                >
                  Copy Referral Link
                </button>
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
                data-testid="generate-referral-after-drop"
                onClick={() => void onAction("generate")}
              >
                Generate Referral Link
              </button>
            </section>
          ) : null}

          {data.course_links.length > 0 ? (
            <section className="account-card">
              <h2>Course referral links</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
                {data.course_links.map((link) => (
                  <li key={link.course_id} className="account-course-card">
                    <div className="account-course-card__title">{link.course_title}</div>
                    <div className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {formatUsdFromCents(link.course_price_cents)} ·{" "}
                      {commissionBadge(link.commission_percent)} · est.{" "}
                      {formatUsdFromCents(link.estimated_commission_cents)}
                    </div>
                    <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {link.share_url}
                    </p>
                    <button
                      type="button"
                      className="account-btn account-btn--ghost account-mono"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      onClick={() => void copy(link.share_url)}
                    >
                      Copy Referral Link
                    </button>
                  </li>
                ))}
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
