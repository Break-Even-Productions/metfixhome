import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadMember, type MemberSummary } from "@/lib/account";
import NotFound from "@/pages/NotFound";
import "./member-profile.css";

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;

export default function MemberProfilePage() {
  const [, params] = useRoute("/members/:memberId");
  const memberId = params?.memberId ?? "";
  const valid = POSITIVE_INT.test(memberId);
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [error, setError] = useState<"not_found" | "bad_id" | "load" | null>(
    valid ? null : "bad_id",
  );

  usePageMeta({
    title: member ? `${member.display_name} — MetFix` : "Member — MetFix",
    description: "MetFix member profile.",
  });

  useEffect(() => {
    if (!valid) return;
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const m = await loadMember(memberId, { signal: ac.signal });
        if (cancelled) return;
        setMember(m);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        const status = (err as { message?: string })?.message ?? "";
        if (status.includes(":404") || status.includes(":400")) {
          setError("not_found");
        } else {
          setError("load");
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [memberId, valid]);

  if (!valid || error === "bad_id" || error === "not_found") {
    return <NotFound />;
  }

  const pills: string[] = [];
  if (member?.badges.foundations_coach) pills.push("Foundations Coach");
  if (member?.badges.affiliate) pills.push("Affiliate");
  if (member?.badges.medical) pills.push("Medical Society");

  return (
    <div className="member-profile-page page-stack">
      <div className="section-card">
        {error === "load" ? <p className="account-error">Unable to load member.</p> : null}
        {member ? (
          <>
            <h1>{member.display_name}</h1>
            <div className="account-pills">
              {pills.map((p) => (
                <span
                  key={p}
                  className={
                    p === "Foundations Coach" ? "account-pill account-pill--accent" : "account-pill"
                  }
                >
                  {p}
                </span>
              ))}
            </div>
            {member.location ? <p className="account-muted">{member.location}</p> : null}
            {member.bio ? <p className="mp-bio">{member.bio}</p> : null}
          </>
        ) : (
          <p className="account-muted">Loading…</p>
        )}
      </div>
    </div>
  );
}
