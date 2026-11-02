import { computeLtvBudget, formatUsdFromCents } from "@shared/account/ltv";
import type { LtvCertificates } from "@/lib/account";

type Props = {
  ltv: LtvCertificates;
};

export function LtvVisualizer({ ltv }: Props) {
  const budget = computeLtvBudget(ltv.total_ltv_cents, ltv.claimed_courses_value_cents);
  const allocatedPct =
    budget.total_ltv_cents > 0
      ? (Math.min(budget.claimed_courses_value_cents, budget.total_ltv_cents) * 100) /
        budget.total_ltv_cents
      : 0;
  const availablePct = Math.max(0, 100 - allocatedPct);
  const claimedLtv = ltv.claimed_certificates.filter((c) => c.claim_method === "ltv");

  return (
    <section className="account-card" aria-labelledby="ltv-visualizer-heading">
      <h2 id="ltv-visualizer-heading">LTV Certificate Budget</h2>
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
              {claimedLtv.map((c) => (
                <li key={`${c.course_id}-${c.claimed_at}`}>
                  {c.course_title ?? "Course"}{" "}
                  <span className="account-mono">{formatUsdFromCents(c.allocated_cents)}</span>
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
