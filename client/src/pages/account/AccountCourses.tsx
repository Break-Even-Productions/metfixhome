import { useEffect, useState } from "react";
import {
  evaluateCourseCertificateEligibility,
  formatUsdFromCents,
} from "@shared/account/ltv";
import {
  assignBillingUrl,
  claimCertificate,
  isClaimInFlight,
  loadCourses,
  loadLtvCertificates,
  loadOverview,
  purchaseCourseCheckout,
  type CourseItem,
  type LtvCertificates,
} from "@/lib/account";
import { readStoredBsiRef } from "@/lib/referralAttribution";
import DashboardLayout from "./DashboardLayout";
import { LtvVisualizer } from "./LtvVisualizer";
import { FoundationsCoachCard } from "./FoundationsCoachCard";

function statusLabel(
  course: CourseItem,
  available: number,
): { text: string; eligibility: ReturnType<typeof evaluateCourseCertificateEligibility> } {
  const eligibility = evaluateCourseCertificateEligibility(
    {
      course_price_cents: course.course_price_cents,
      completed: course.completed,
      certificate_claimed: course.certificate_claimed,
      claim_method: course.certificate_claim_method,
      purchased_directly: course.purchased_directly,
    },
    available,
  );
  const cost = formatUsdFromCents(course.course_price_cents);
  switch (eligibility.status) {
    case "claimed":
      return { text: "Claimed", eligibility };
    case "eligible_ltv":
      return { text: `Eligible to Claim with LTV (${cost})`, eligibility };
    case "eligible_direct_purchase":
      return { text: `Eligible to Claim with LTV (${cost})`, eligibility };
    case "insufficient_ltv":
      return {
        text: `Needs ${formatUsdFromCents(eligibility.shortfall_cents)} more LTV`,
        eligibility,
      };
    case "incomplete":
      return { text: "Incomplete", eligibility };
    default:
      return { text: "Buy Course for Certificate", eligibility };
  }
}

export default function AccountCourses() {
  const [ltv, setLtv] = useState<LtvCertificates | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [claimPending, setClaimPending] = useState(false);
  const [buyLock, setBuyLock] = useState(false);
  const [attributionSource, setAttributionSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [lt, cs] = await Promise.all([
      loadLtvCertificates({ force: true }),
      loadCourses({ force: true }),
    ]);
    setLtv(lt);
    setCourses(cs.items);
  }

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        await loadOverview({ signal: ac.signal });
        const [lt, cs] = await Promise.all([
          loadLtvCertificates({ signal: ac.signal }),
          loadCourses({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setLtv(lt);
        setCourses(cs.items);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load courses.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  async function onClaim(course: CourseItem) {
    if (!course.id || claimPending || isClaimInFlight()) return;
    setClaimPending(true);
    setError(null);
    setMessage(null);
    try {
      await claimCertificate(course.id);
      await refresh();
      setMessage("Certificate claimed.");
    } catch (err) {
      const body = (err as { body?: { error?: string; shortfall_cents?: number } })?.body;
      if (body?.error === "insufficient_ltv" && typeof body.shortfall_cents === "number") {
        setError(`Needs ${formatUsdFromCents(body.shortfall_cents)} more LTV`);
      } else {
        setError("Claim failed.");
      }
    } finally {
      setClaimPending(false);
    }
  }

  async function onBuy(course: CourseItem) {
    if (!course.id || buyLock) return;
    setBuyLock(true);
    setError(null);
    try {
      const bsi_ref = readStoredBsiRef() ?? undefined;
      const res = await purchaseCourseCheckout(course.id, bsi_ref ? { bsi_ref } : undefined);
      if (res.attribution?.attribution_source) {
        setAttributionSource(res.attribution.attribution_source);
      }
      if (!assignBillingUrl(res.checkout_url, "whop_only")) {
        setError("Checkout unavailable.");
      }
    } catch {
      setError("Checkout unavailable.");
    } finally {
      setBuyLock(false);
    }
  }

  const available = ltv?.available_certificate_ltv_cents ?? 0;
  const coach = ltv?.foundations_coach;
  const lockClaims = claimPending || isClaimInFlight();

  return (
    <DashboardLayout
      title="My Courses & Certificates"
      description="Claim certificates with subscription LTV or buy a course directly."
    >
      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {attributionSource ? (
        <p className="account-mono" data-testid="attribution-source" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {attributionSource}
        </p>
      ) : null}
      {ltv ? <LtvVisualizer ltv={ltv} /> : null}
      {coach ? <FoundationsCoachCard coach={coach} /> : null}

      <div className="account-course-grid">
        {courses.map((course) => {
          const { text, eligibility } = statusLabel(course, available);
          const cost = formatUsdFromCents(course.course_price_cents);
          const ltvEnabled =
            !lockClaims &&
            !course.certificate_claimed &&
            (eligibility.status === "eligible_ltv" ||
              eligibility.status === "eligible_direct_purchase");
          const shortfallText =
            eligibility.status === "insufficient_ltv"
              ? `Needs ${formatUsdFromCents(eligibility.shortfall_cents)} more LTV`
              : eligibility.status === "incomplete"
                ? "Complete the course before claiming"
                : null;

          return (
            <article key={String(course.id)} className="account-course-card">
              <h2 style={{ fontSize: "1.2rem", marginBottom: "0.35rem" }}>
                {course.title ?? "Course"}
              </h2>
              <p className="account-muted">
                Listed value{" "}
                <span className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  {cost}
                </span>
                {" · "}
                {course.completed ? "Completed" : `${course.progress_percent}% complete`}
                {" · "}
                {text}
              </p>
              {!course.certificate_claimed ? (
                <div className="account-course-card__actions">
                  <button
                    type="button"
                    className="account-btn"
                    disabled={!ltvEnabled}
                    title={shortfallText ?? undefined}
                    onClick={() => void onClaim(course)}
                  >
                    {`Claim Certificate with LTV (-${cost})`}
                  </button>
                  <button
                    type="button"
                    className="account-btn account-btn--ghost"
                    disabled={buyLock}
                    data-testid={course.id != null ? `buy-course-${course.id}` : undefined}
                    onClick={() => void onBuy(course)}
                  >
                    {`Buy Course for Certificate ($${Math.floor(course.course_price_cents / 100)})`}
                  </button>
                </div>
              ) : course.certificate_url ? (
                <p>
                  <a href={course.certificate_url} rel="noreferrer">
                    View certificate
                  </a>
                </p>
              ) : (
                <p className="account-muted">Certificate claimed.</p>
              )}
              {shortfallText && !course.certificate_claimed ? (
                <p className="account-error" style={{ marginTop: "0.5rem" }}>
                  {shortfallText}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
