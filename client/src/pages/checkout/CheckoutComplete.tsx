import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  clearAccountCache,
  loadOverview,
  loadSubscriptions,
  type AccountSubscriptions,
} from "@/lib/account";
import { loadMe } from "@/lib/session";
import { tierDisplayLabel } from "@shared/account/tiers";
import "../account/account.css";

type CheckoutStatus = "succeeded" | "failed" | "canceled" | "pending";

function parseCheckoutStatus(raw: string | null): CheckoutStatus {
  const v = (raw ?? "").toLowerCase();
  if (v === "succeeded" || v === "success" || v === "paid") return "succeeded";
  if (v === "failed" || v === "declined") return "failed";
  if (v === "canceled" || v === "cancelled") return "canceled";
  return "pending";
}

export default function CheckoutComplete() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = useMemo(() => {
    if (typeof window === "undefined") return "pending" as CheckoutStatus;
    const params = new URLSearchParams(window.location.search);
    return parseCheckoutStatus(params.get("status") ?? params.get("payment"));
  }, []);

  usePageMeta({
    title: "Checkout complete — MetFix",
    description: "Your Whop subscription checkout return page.",
  });

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        clearAccountCache();
        const me = await loadMe({ signal: ac.signal });
        if (cancelled) return;
        if (me.status !== "signed_in") {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        const [su] = await Promise.all([
          loadSubscriptions({ signal: ac.signal, force: true }),
          loadOverview({ signal: ac.signal, force: true }),
        ]);
        if (cancelled) return;
        setSubs(su);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("We could not refresh your membership yet. Entitlements update after Whop confirms payment.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const headline =
    status === "succeeded"
      ? "Welcome to MetFix"
      : status === "failed"
        ? "Checkout did not complete"
        : status === "canceled"
          ? "Checkout canceled"
          : "Finishing checkout";

  const lede =
    status === "succeeded"
      ? "Thanks — Whop is confirming your subscription. Membership access updates when the payment webhook lands (usually within a minute)."
      : status === "failed"
        ? "Your card was not charged. You can try again from Billing, or manage an existing subscription in the billing portal."
        : status === "canceled"
          ? "No charge was made. Return to Billing whenever you are ready to start MetFix Pro or Organization Owner."
          : "If you just finished Whop checkout, hang tight — we refresh your account from Break Even Productions entitlements (not from this redirect alone).";

  return (
    <div className="account-shell">
      <main className="account-main" style={{ maxWidth: "40rem", margin: "0 auto", padding: "2.5rem 1.25rem" }}>
        <p className="account-muted" style={{ marginBottom: "0.75rem" }}>
          MetFix · Whop checkout
        </p>
        <h1 className="account-page-title">{headline}</h1>
        <p className="account-page-lede">{lede}</p>
        {error ? <p className="account-error">{error}</p> : null}

        {signedIn && subs ? (
          <section className="account-card" style={{ marginTop: "1.5rem" }}>
            <h2>Current membership</h2>
            <p className="account-mono">{tierDisplayLabel(subs.canonical_tier)}</p>
            <p className="account-muted" style={{ marginTop: "0.5rem" }}>
              {subs.items.length === 0
                ? "No active subscription rows yet — refresh Billing in a moment if you just paid."
                : `${subs.items.length} subscription${subs.items.length === 1 ? "" : "s"} on file.`}
            </p>
          </section>
        ) : null}

        <div className="account-course-card__actions" style={{ marginTop: "1.5rem" }}>
          <Link href={basePath("/account/billing")} className="account-btn">
            Go to Billing
          </Link>
          <Link href={basePath("/account")} className="account-btn account-btn--ghost">
            Account overview
          </Link>
          {signedIn === false ? (
            <Link href={basePath("/login?next=/checkout/complete")} className="account-btn account-btn--ghost">
              Sign in
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
