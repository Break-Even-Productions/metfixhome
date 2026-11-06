import { useId, useState } from "react";
import { computeLtvBudget, formatUsdFromCents } from "@shared/account/ltv";
import type { LtvCertificates } from "@/lib/account";

type Props = {
  ltv: LtvCertificates;
};

const LTV_INFO =
  "Your certificate LTV budget grows with MetFix subscription spend. When you claim a course certificate, MetFix can allocate lifetime spend toward that course’s listed value (redeem LTV), let you prepay any shortfall, or buy the certificate outright. Claimed certificates reduce available balance. This is separate from membership tier and onboarding audience attributes.";

export function LtvVisualizer({ ltv }: Props) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const budget = computeLtvBudget(ltv.total_ltv_cents, ltv.claimed_courses_value_cents);
  const allocatedPct =
    budget.total_ltv_cents > 0
      ? (Math.min(budget.claimed_courses_value_cents, budget.total_ltv_cents) * 100) /
        budget.total_ltv_cents
      : 0;
  const availablePct = Math.max(0, 100 - allocatedPct);
  const claimedLtv = ltv.claimed_certificates.filter(
    (c) =>
      c.claim_method === "redeem_ltv" ||
      c.claim_method === "prepay_credit" ||
      c.claim_method === "buy_outright",
  );

  return (
    <section className="account-card account-ltv" aria-labelledby="ltv-visualizer-heading">
      <div className="account-ltv__head">
        <h2 id="ltv-visualizer-heading">LTV Certificate Budget</h2>
        <button
          type="button"
          className="account-info-btn"
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="account-info-btn__glyph" aria-hidden="true">
            i
          </span>
          <span className="sr-only">How course claim and LTV works</span>
        </button>
      </div>
      {open ? (
        <p id={dialogId} className="account-ltv__info" role="note">
          {LTV_INFO}
        </p>
      ) : null}
      <dl className="account-ltv-figures">
        <div>
          <dt>Total Subscription LTV</dt>
          <dd className="account-mono">
            {formatUsdFromCents(budget.total_ltv_cents)}
          </dd>
        </div>
        <div>
          <dt>Allocated to Claimed Certificates</dt>
          <dd className="account-mono">
            {formatUsdFromCents(budget.claimed_courses_value_cents)}
          </dd>
          {claimedLtv.length > 0 ? (
            <ul className="account-muted" style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
              {claimedLtv.map((c, i) => (
                <li key={`claimed-${c.course_id ?? "x"}-${c.claimed_at ?? "t"}-${i}`}>
                  {c.course_title ?? "Course"}{" "}
                  <span className="account-mono">
                    {c.allocated_cents == null ? "—" : formatUsdFromCents(c.allocated_cents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <dt>Available Certificate LTV Balance</dt>
          <dd className="account-mono">
            {formatUsdFromCents(budget.available_certificate_ltv_cents)}
          </dd>
        </div>
      </dl>
      <div
        className="account-ltv-bar"
        role="img"
        aria-label={`Allocated ${allocatedPct.toFixed(2)} percent, available ${availablePct.toFixed(2)} percent`}
      >
        <div
          className="account-ltv-bar__allocated"
          style={{ width: `${allocatedPct}%` }}
          data-width-pct={allocatedPct.toFixed(2)}
        />
        <div
          className="account-ltv-bar__available"
          style={{ width: `${availablePct}%` }}
          data-width-pct={availablePct.toFixed(2)}
        />
      </div>
    </section>
  );
}
