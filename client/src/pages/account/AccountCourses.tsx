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
    <div className="account-course-card">
      <h3 className="account-claim-path-title">{title}</h3>
      <p className="account-mono">
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
    <div>
      <button type="button" className="account-btn account-btn--ghost" onClick={onBack}>
        Back to courses
      </button>
      <h2 className="account-claim-title">{course.title}</h2>

      <p className="account-mono">
        {formatUsdFromCents(options.ltv.available_cents)} available
        {options.credit.balance_cents > 0 || options.credit.days_granted > 0
          ? ` · credit ${formatUsdFromCents(options.credit.balance_cents)} · ${options.credit.days_granted} days granted`
          : null}
      </p>
      {promo ? <p className="account-mono">{promo}</p> : null}

      {error ? <p className="account-error">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      {course.already_claimed ? (
        <div>
          <p>Certificate claimed</p>
          {access ? <p className="account-mono">{access}</p> : null}
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
  /** Last claim path that owns `idemRef` (errata d3 DR-7 / S-R4-1). */
  const lastClaimPathRef = useRef<ClaimPathId | null>(null);
  const inflightRef = useRef(false);
  const lockRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const claimRefreshAcRef = useRef<AbortController | null>(null);

  async function refreshLists() {
    const [lt, cs] = await Promise.all([
      loadLtvCertificates({ force: true }),
      loadCourses({ force: true }),
    ]);
    if (!mountedRef.current) return;
    setLtv(lt);
    setCourses(cs.items);
  }

  /** Background CL1 refresh — swallow failures; never clears Idempotency-Key (CQ B1). */
  function refreshClaimOptionsBackground() {
    claimRefreshAcRef.current?.abort();
    const ac = new AbortController();
    claimRefreshAcRef.current = ac;
    void loadClaimOptions({ force: true, signal: ac.signal })
      .then((opts) => {
        if (!mountedRef.current || ac.signal.aborted) return;
        setClaimOptions(opts);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    mountedRef.current = true;
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        await loadOverview({ signal: ac.signal });
        const [lt, cs] = await Promise.all([
          loadLtvCertificates({ signal: ac.signal }),
          loadCourses({ signal: ac.signal }),
        ]);
        if (cancelled || !mountedRef.current) return;
        setLtv(lt);
        setCourses(cs.items);
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load courses.");
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      ac.abort();
      claimRefreshAcRef.current?.abort();
      claimRefreshAcRef.current = null;
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
    const id = Number(course.id);
    try {
      // S2: use cached options when present — not a forced GET on every open.
      let opts = claimOptions;
      if (!opts) {
        opts = await loadClaimOptions();
        if (!mountedRef.current) return;
        setClaimOptions(opts);
      }
      if (!opts.courses.some((c) => c.course_id === id)) {
        setError("Course not found.");
        return;
      }
      if (!mountedRef.current) return;
      setActiveCourseId(id);
    } catch {
      if (!mountedRef.current) return;
      setError("Unable to load claim options.");
    }
  }

  function clearIdempotencyKey() {
    idemRef.current = null;
    lastClaimPathRef.current = null;
  }

  async function onClaimPath(path: ClaimPathId) {
    if (activeCourseId == null || inflightRef.current) return;
    inflightRef.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    // errata d5 DR-12 / DR-7: one key per attempt; different option → new key.
    // Transient 409 ClaimInProgressBody + 503 ClaimLockTimeoutBody keep the key.
    // Final HTTP (418/502/…) clears → same-option retry gets a NEW key.
    if (!idemRef.current || lastClaimPathRef.current !== path) {
      idemRef.current = crypto.randomUUID();
    }
    lastClaimPathRef.current = path;
    const key = idemRef.current;
    try {
      // B1 / S1: outcome from claim POST alone — no claim-options GET before redirect.
      const res = await claimCoursePath(activeCourseId, path, key);
      if ("checkout_url" in res && res.checkout_url) {
        // B1/S1/CL-T19: redirect from POST alone — no claim-options GET before/after.
        if (!openWhopCheckout(res.checkout_url)) {
          // N-R5-3: 200 with a bad body keeps the key — BSI replays the stored response.
          setError("Checkout unavailable.");
        }
        return;
      }
      // redeem_ltv (or already_claimed) success — single success copy (CQ nit).
      // errata d3 DR-7: clear key on final HTTP success so the next claim is a new attempt.
      setMessage("Certificate claimed");
      clearIdempotencyKey();
      refreshClaimOptionsBackground();
      void refreshLists().catch(() => undefined);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const body = (err as { body?: { error?: string; reason_code?: string } })?.body;
      if (status === 409 && body?.error === "claim_in_progress") {
        // errata d5 DR-12: 409 ClaimInProgressBody is transient → keep key.
        setError("Still working on it. Try again in a few seconds.");
      } else if (status === 503 && body?.error === "claim_in_progress") {
        // errata d5 DR-12: 503 ClaimLockTimeoutBody is transient → keep key.
        setError("Still working on it. Try again in a few seconds.");
        if (lockRefetchTimerRef.current != null) {
          clearTimeout(lockRefetchTimerRef.current);
        }
        lockRefetchTimerRef.current = setTimeout(() => {
          lockRefetchTimerRef.current = null;
          refreshClaimOptionsBackground();
        }, 1500);
      } else if (body?.error === "idempotency_key_mismatch") {
        setError("That request changed. Please start the claim again.");
        clearIdempotencyKey();
      } else if (body?.error === "claim_ineligible") {
        refreshClaimOptionsBackground();
        setError(null);
        clearIdempotencyKey();
      } else if (body?.error === "course_not_found") {
        setError("Course not found.");
        clearIdempotencyKey();
      } else if (body?.error === "invalid_course_price") {
        setError("This course can't be claimed right now.");
        clearIdempotencyKey();
      } else if (status === 502) {
        // Item 13: one background CL1 re-fetch after CL2 502; never retry POST.
        // DR-7 / D7_502: 502 is final → clear key so same-option retry is NEW.
        refreshClaimOptionsBackground();
        setError("Something went wrong. Check your claim status.");
        clearIdempotencyKey();
      } else if (typeof status === "number") {
        // B-R4-1 / DR-7 / D7final: clear on final HTTP (incl. 418); keep only when no status.
        setError("Claim failed.");
        clearIdempotencyKey();
      } else {
        // Thrown fetch / network error (no HTTP status) — keep key for retry.
        setError("Claim failed.");
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
            clearIdempotencyKey();
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
                  <h2 className="account-course-card-title">{course.title ?? "Course"}</h2>
                  <p className="account-muted">
                    Listed value <span className="account-mono">{cost}</span>
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
