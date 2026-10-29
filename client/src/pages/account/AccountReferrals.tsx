import { useCallback, useEffect, useState } from "react";
import {
  canGenerateCourseReferrals,
  type ReferralsDto,
} from "@shared/account/courseReferrals";
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
  nowMs?: number;
  // wouter Route injects params — accept and ignore.
  params?: Record<string, string | undefined>;
};

function commissionBadge(percent: number): string {
  return `${percent}% referral commission`;
}

function asDto(payload: ReferralsPayload): ReferralsDto {
  return {
    eligible: payload.eligible !== false,
    eligibility_type: payload.eligibility_type ?? null,
    reason_code: payload.reason_code ?? null,
    payee_display_name: payload.payee_display_name ?? null,
    foundations_coach_expires_at: payload.foundations_coach_expires_at ?? null,
    join_code: payload.join_code ?? null,
    course_links: payload.course_links ?? [],
    course_links_dropped: payload.course_links_dropped ?? 0,
    join_code_dropped: payload.join_code_dropped === true,
    earnings: payload.earnings
      ? {
          pending_cents: payload.earnings.pending_cents ?? 0,
          ready_cents: payload.earnings.ready_cents ?? 0,
          paid_total_cents: payload.earnings.paid_total_cents ?? 0,
          currency: payload.earnings.currency ?? "USD",
        }
      : undefined,
  };
}

export default function AccountReferrals({ nowMs }: Props) {
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

  const onAction = useCallback(async (action: "generate" | "rotate" | "revoke") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await referralCodeAction(action);
      setData(asDto(next));
    } catch {
      setError(`Could not ${action} referral code.`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, []);

  const now = nowMs ?? Date.now();
  const pred = data
    ? canGenerateCourseReferrals(
        {
          eligibility_type: data.eligibility_type,
          foundations_coach_expires_at: data.foundations_coach_expires_at,
        },
        now,
      )
    : null;
  const eligible = Boolean(data?.eligible && pred?.eligible);
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

      {eligible && data ? (
        <>
          {showMutedNotice ? (
            <p
              className="account-muted"
              data-testid="referrals-dropped-notice"
            >
              Some course links couldn&apos;t be shown right now.
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
              <h2>Course links</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}>
                {data.course_links.map((link) => (
                  <li key={link.course_id} data-testid={`course-link-${link.course_id}`}>
                    <p style={{ fontWeight: 600 }}>{link.course_title}</p>
                    <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {formatUsdFromCents(link.course_price_cents)}
                    </p>
                    <p className="account-mono font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {commissionBadge(link.commission_percent)}
                    </p>
                    <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {formatUsdFromCents(link.estimated_commission_cents)}
                    </p>
                    <p
                      className="account-mono"
                      style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "0.8rem", wordBreak: "break-all" }}
                    >
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
