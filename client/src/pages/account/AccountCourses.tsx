import { useEffect, useRef, useState } from "react";
import { formatUsdFromCents } from "@shared/account/ltv";
import { formatAccessUntilLine } from "@shared/account/dates";
import {
  CLAIM_REASON_COPY,
  PATH_ACTIONS,
  PATH_TITLES,
  buyOutrightTitle,
  type ClaimCourseDto,
  type ClaimOptionsDto,
  type ClaimPathId,
  type ClaimPathDto,
} from "@shared/account/claimOptions";
import {
  claimCoursePath,
  loadClaimOptions,
  loadCourses,
  loadLtvCertificates,
  loadOverview,
  openWhopCheckout,
  type CourseItem,
  type LtvCertificates,
} from "@/lib/account";
import DashboardLayout from "./DashboardLayout";
import { LtvVisualizer } from "./LtvVisualizer";
import { FoundationsCoachCard } from "./FoundationsCoachCard";

function promoLine(credit: ClaimOptionsDto["credit"]): string | null {
  if (credit.promo_state === "none" || credit.pending_promo_cents <= 0) return null;
  const amount = formatUsdFromCents(credit.pending_promo_cents);
  if (credit.promo_state === "waiting_to_apply") {
    return `${amount} off your next renewal, waiting to be applied.`;
  }
  if (credit.promo_state === "applied_to_next_renewal") {
    return `${amount} off your next renewal is set.`;
  }
  return null;
}

function ClaimPathCard(props: {
  path: ClaimPathDto;
  busy: boolean;
  onClaim: (path: ClaimPathId) => void;
}) {
  const { path, busy, onClaim } = props;
  const reason =
    path.reason_code && path.reason_code !== "already_claimed"
      ? CLAIM_REASON_COPY[path.reason_code]
      : null;
  const title =
    path.path === "buy_outright" ? buyOutrightTitle(path.price_cents) : PATH_TITLES[path.path];
  return (
    <div className="account-course-card" data-testid={`claim-path-${path.path}`}>
      <h3 style={{ fontSize: "1.05rem", marginBottom: "0.25rem" }}>{title}</h3>
      <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        {formatUsdFromCents(path.price_cents)}
        {path.shortfall_cents > 0
          ? ` · shortfall ${formatUsdFromCents(path.shortfall_cents)}`
          : null}
      </p>
      {reason ? <p className="account-muted">{reason}</p> : null}
      <button
        type="button"
        className="account-btn"
        disabled={!path.eligible || busy}
        onClick={() => onClaim(path.path)}
      >
        {PATH_ACTIONS[path.path]}
      </button>
    </div>
  );
}

function ClaimScreen(props: {
  course: ClaimCourseDto;
  options: ClaimOptionsDto;
  busy: boolean;
  message: string | null;
  error: string | null;
  onClaim: (path: ClaimPathId) => void;
  onBack: () => void;
}) {
  const { course, options, busy, message, error, onClaim, onBack } = props;
  const access = formatAccessUntilLine(course.access_expires_at);
  const promo = promoLine(options.credit);

  return (
    <div data-testid="claim-screen">
      <button type="button" className="account-btn account-btn--ghost" onClick={onBack}>
        Back to courses
      </button>
      <h2 style={{ fontSize: "1.35rem", marginTop: "1rem" }}>{course.title}</h2>

      <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
        {formatUsdFromCents(options.ltv.available_cents)} available
        {options.credit.balance_cents > 0 || options.credit.days_granted > 0
          ? ` · credit ${formatUsdFromCents(options.credit.balance_cents)} · ${options.credit.days_granted} days granted`
          : null}
      </p>
      {promo ? (
        <p
          className="account-mono"
          data-testid="promo-line"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {promo}
        </p>
      ) : null}

      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      {course.already_claimed ? (
        <div>
          <p>Certificate claimed</p>
          {access ? (
            <p className="account-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {access}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="account-course-grid" style={{ marginTop: "1rem" }}>
          {course.paths.map((p) => (
            <ClaimPathCard key={p.path} path={p} busy={busy} onClaim={onClaim} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountCourses() {
  const [ltv, setLtv] = useState<LtvCertificates | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [claimOptions, setClaimOptions] = useState<ClaimOptionsDto | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const idemRef = useRef<string | null>(null);
  const inflightRef = useRef(false);
  const lockRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refreshLists() {
    const [lt, cs] = await Promise.all([
      loadLtvCertificates({ force: true }),
      loadCourses({ force: true }),
    ]);
    setLtv(lt);
    setCourses(cs.items);
  }

  async function refreshClaimOptions() {
    const opts = await loadClaimOptions({ force: true });
    setClaimOptions(opts);
    return opts;
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
      if (lockRefetchTimerRef.current != null) {
        clearTimeout(lockRefetchTimerRef.current);
        lockRefetchTimerRef.current = null;
      }
    };
  }, []);

  async function openClaim(course: CourseItem) {
    if (course.id == null) return;
    setError(null);
    setMessage(null);
    try {
      const opts = await refreshClaimOptions();
      const id = Number(course.id);
      if (!opts.courses.some((c) => c.course_id === id)) {
        setError("Course not found.");
        return;
      }
      setActiveCourseId(id);
    } catch {
      setError("Unable to load claim options.");
    }
  }

  async function onClaimPath(path: ClaimPathId) {
    if (activeCourseId == null || inflightRef.current) return;
    inflightRef.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    if (!idemRef.current) {
      idemRef.current = crypto.randomUUID();
    }
    const key = idemRef.current;
    try {
      const res = await claimCoursePath(activeCourseId, path, key);
      const opts = await refreshClaimOptions();
      setClaimOptions(opts);
      if ("checkout_url" in res && res.checkout_url) {
        if (!openWhopCheckout(res.checkout_url)) {
          setError("Checkout unavailable.");
        }
        return;
      }
      if (res.already_claimed) {
        setMessage("Certificate claimed");
      } else {
        setMessage("Certificate claimed.");
      }
      idemRef.current = null;
      await refreshLists();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const body = (err as { body?: { error?: string; reason_code?: string } })?.body;
      if (status === 409 && body?.error === "claim_in_progress") {
        // 409: no CL1 re-fetch; keep key for user retry (N5).
        setError("Still working on it. Try again in a few seconds.");
      } else if (status === 503 && body?.error === "claim_in_progress") {
        // 503: exactly one delayed CL1 re-fetch; clear on unmount (CQ S1).
        setError("Still working on it. Try again in a few seconds.");
        if (lockRefetchTimerRef.current != null) {
          clearTimeout(lockRefetchTimerRef.current);
        }
        lockRefetchTimerRef.current = setTimeout(() => {
          lockRefetchTimerRef.current = null;
          void refreshClaimOptions().catch(() => undefined);
        }, 1500);
      } else if (body?.error === "idempotency_key_mismatch") {
        setError("That request changed. Please start the claim again.");
        idemRef.current = null;
      } else if (body?.error === "claim_ineligible") {
        // 402/403: one CL1 re-fetch (claimCoursePath also invalidates).
        try {
          await refreshClaimOptions();
        } catch {
          /* keep prior */
        }
        setError(null);
        idemRef.current = null;
      } else if (body?.error === "course_not_found") {
        setError("Course not found.");
        idemRef.current = null;
      } else if (body?.error === "invalid_course_price") {
        setError("This course can't be claimed right now.");
        idemRef.current = null;
      } else if (status === 502) {
        // Item 13: one CL1 re-fetch after CL2 502; never retry the POST.
        try {
          await refreshClaimOptions();
        } catch {
          /* keep prior */
        }
        setError("Something went wrong. Check your claim status.");
        idemRef.current = null;
      } else {
        setError("Claim failed.");
        idemRef.current = null;
      }
    } finally {
      inflightRef.current = false;
      setBusy(false);
    }
  }

  const coach = ltv?.foundations_coach;
  const activeCourse =
    claimOptions && activeCourseId != null
      ? claimOptions.courses.find((c) => c.course_id === activeCourseId) ?? null
      : null;

  return (
    <DashboardLayout
      title="My Courses & Certificates"
      description="Claim certificates with subscription LTV, credit prepay, or buy outright."
    >
      {activeCourse && claimOptions ? (
        <ClaimScreen
          course={activeCourse}
          options={claimOptions}
          busy={busy}
          message={message}
          error={error}
          onClaim={(p) => void onClaimPath(p)}
          onBack={() => {
            setActiveCourseId(null);
            setError(null);
            setMessage(null);
            idemRef.current = null;
          }}
        />
      ) : (
        <>
          {error ? <p className="account-error">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          {ltv ? <LtvVisualizer ltv={ltv} /> : null}
          {coach ? <FoundationsCoachCard coach={coach} /> : null}

          <div className="account-course-grid">
            {courses.map((course) => {
              const cost = formatUsdFromCents(course.course_price_cents);
              return (
                <article key={String(course.id)} className="account-course-card">
                  <h2 style={{ fontSize: "1.2rem", marginBottom: "0.35rem" }}>
                    {course.title ?? "Course"}
                  </h2>
                  <p className="account-muted">
                    Listed value{" "}
                    <span
                      className="account-mono"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {cost}
                    </span>
                    {" · "}
                    {course.completed
                      ? "Completed"
                      : `${course.progress_percent}% complete`}
                    {course.certificate_claimed ? " · Claimed" : null}
                  </p>
                  {course.certificate_claimed ? (
                    course.certificate_url ? (
                      <p>
                        <a href={course.certificate_url} rel="noreferrer">
                          View certificate
                        </a>
                      </p>
                    ) : (
                      <p className="account-muted">Certificate claimed.</p>
                    )
                  ) : (
                    <button
                      type="button"
                      className="account-btn"
                      data-testid={
                        course.id != null ? `claim-certificate-${course.id}` : undefined
                      }
                      onClick={() => void openClaim(course)}
                    >
                      Claim Certificate
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
