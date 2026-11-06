import type { FoundationsCoachStatus } from "@shared/account/foundations-coach";

type Props = {
  coach: FoundationsCoachStatus;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SeminarBadges({ coach }: { coach: FoundationsCoachStatus }) {
  return (
    <div className="account-course-badges" aria-label="Seminar and Essentials status">
      {coach.seminar_checked_in ? (
        <span className="account-tag account-tag--seminar">Seminar checked in</span>
      ) : null}
      {coach.metfix_essentials_completed ? (
        <span className="account-tag account-tag--seminar">Essentials completed</span>
      ) : null}
      {coach.metfix_essentials_certificate_claimed ? (
        <span className="account-tag account-tag--claimed">Essentials certificate claimed</span>
      ) : null}
    </div>
  );
}

export function FoundationsCoachCard({ coach }: Props) {
  const expired =
    !coach.active &&
    coach.grant_reason != null &&
    coach.expires_at != null &&
    Date.parse(coach.expires_at) <= Date.now();

  return (
    <section className="account-card" aria-labelledby="foundations-coach-heading">
      <h2 id="foundations-coach-heading">Foundations Coach</h2>
      {coach.active ? (
        <>
          <span className="account-pill account-pill--accent">Foundations Coach · Active</span>
          <SeminarBadges coach={coach} />
          <p style={{ marginTop: "0.75rem" }}>
            Granted via{" "}
            {coach.grant_reason === "in_person_seminar"
              ? "in-person seminar check-in"
              : "MetFix Essentials certificate"}
            .
          </p>
          <p className="account-mono">
            Granted {formatDate(coach.granted_at)} · Expires {formatDate(coach.expires_at)}
          </p>
        </>
      ) : expired ? (
        <>
          <SeminarBadges coach={coach} />
          <p role="status">
            Foundations Coach expired on{" "}
            <span className="account-mono">
              {formatDate(coach.expires_at)}
            </span>
            . Renew by attending an in-person seminar or reclaiming MetFix Essentials.
          </p>
        </>
      ) : (
        <>
          <SeminarBadges coach={coach} />
          <p className="account-muted">Qualify through either path:</p>
          <ul className="account-checklist">
            <li data-done={coach.seminar_checked_in ? "true" : "false"}>
              [{coach.seminar_checked_in ? "x" : " "}] Attend an in-person seminar (checked in)
            </li>
            <li data-done={coach.metfix_essentials_completed ? "true" : "false"}>
              [{coach.metfix_essentials_completed ? "x" : " "}] Complete MetFix Essentials online
            </li>
            <li data-done={coach.metfix_essentials_certificate_claimed ? "true" : "false"}>
              [{coach.metfix_essentials_certificate_claimed ? "x" : " "}] Claim MetFix Essentials
              certificate
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
