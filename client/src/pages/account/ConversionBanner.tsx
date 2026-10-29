import { safeBillingHref } from "@/lib/account";
import type { SubscriptionConversion } from "@/lib/account";

type Props = {
  conversion?: SubscriptionConversion | null;
};

export function ConversionBanner({ conversion }: Props) {
  if (!conversion || conversion.state !== "awaiting_checkout") return null;
  const href = safeBillingHref(conversion.purchase_url, "whop_only");
  if (!href) return null;
  const days =
    typeof conversion.trial_period_days === "number" ? conversion.trial_period_days : null;

  return (
    <aside className="account-conversion-banner" role="status">
      <div>
        <strong>Finish switching to Whop</strong>
        <p className="account-muted" style={{ margin: "0.35rem 0 0" }}>
          {days != null
            ? `Your prepaid period covers about ${days} more day${days === 1 ? "" : "s"} before Whop billing begins.`
            : "Complete checkout to finish migrating your subscription to Whop (Break Even Productions)."}
        </p>
      </div>
      <a href={href}>Continue to Whop checkout</a>
    </aside>
  );
}
