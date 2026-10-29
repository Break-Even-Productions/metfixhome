import { loadMe, peekMe } from "@/lib/session";
import { useJoinFlowOptional } from "@/contexts/JoinFlowContext";
import { useEffect, useState } from "react";
import { basePath } from "@/const";

/**
 * WJ18: locked-content upgrade prompt.
 * Signed out → open JoinFlow (or /join). Signed in → /account/billing (#21).
 */
export function UpgradePrompt({
  title = "Continue with MetFix",
  body = "This content is part of MetFix Membership. Start your free month or manage billing.",
}: {
  title?: string;
  body?: string;
}) {
  const join = useJoinFlowOptional();
  const [signedIn, setSignedIn] = useState(() => peekMe()?.status === "signed_in");

  useEffect(() => {
    let cancelled = false;
    void loadMe().then((me) => {
      if (!cancelled) setSignedIn(me.status === "signed_in");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (signedIn) {
    return (
      <div className="upgrade-prompt" data-testid="upgrade-prompt">
        <h2>{title}</h2>
        <p>{body}</p>
        <a className="library-btn library-btn-gold" href={basePath("/account/billing")}>
          Manage membership
        </a>
      </div>
    );
  }

  return (
    <div className="upgrade-prompt" data-testid="upgrade-prompt">
      <h2>{title}</h2>
      <p>{body}</p>
      {join ? (
        <button
          type="button"
          className="library-btn library-btn-gold"
          onClick={() => join.openJoinFlow()}
        >
          Start my free month
        </button>
      ) : (
        <a className="library-btn library-btn-gold" href={basePath("/join")}>
          Start my free month
        </a>
      )}
    </div>
  );
}
