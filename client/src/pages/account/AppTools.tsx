import { Link } from "wouter";
import { basePath } from "@/const";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";
import { METFIX_APP_TOOLS, metfixToolsUnlocked } from "./metfixAppTools";

type Props = {
  tier: CanonicalSubscriptionTier;
};

export function AppTools({ tier }: Props) {
  const unlocked = metfixToolsUnlocked(tier);

  return (
    <section className="account-tools" aria-labelledby="account-tools-heading">
      <div className="account-tools__head">
        <div>
          <h2 id="account-tools-heading" className="account-section-title">
            MetFix tools
          </h2>
          <p className="account-tools__lede">
            {unlocked ? "Included with your membership." : "Included with MetFix Pro."}
          </p>
        </div>
        {!unlocked ? (
          <Link href={basePath("/join")} className="account-btn account-btn--accent account-tools__unlock">
            Unlock Pro
          </Link>
        ) : null}
      </div>
      <div className="account-tool-grid">
        {METFIX_APP_TOOLS.map((tool) => {
          const open = unlocked && tool.href != null;
          const available = unlocked && tool.href == null;
          const state = open ? "open" : available ? "available" : "locked";
          const status = open ? "Included" : available ? "Included" : "Locked";
          const detail = open
            ? tool.summary
            : available
              ? `${tool.summary} Available with your membership.`
              : tool.summary;
          const body = (
            <>
              <span className="account-tool__status">{status}</span>
              <div className="account-tool__row">
                <span className="account-tool__title">{tool.title}</span>
              </div>
              <span className="account-tool__detail">{detail}</span>
              {open ? (
                <span className="account-tool__action">Open</span>
              ) : available ? (
                <span className="account-tool__action account-tool__action--muted">
                  No web page yet
                </span>
              ) : (
                <span className="account-tool__action account-tool__action--cta">
                  Unlock with Pro
                </span>
              )}
            </>
          );
          if (open && tool.href) {
            return (
              <Link
                key={tool.id}
                href={basePath(tool.href)}
                className="account-tool account-tool--open"
                data-tool={tool.id}
                data-state={state}
              >
                {body}
              </Link>
            );
          }
          if (!unlocked) {
            return (
              <Link
                key={tool.id}
                href={basePath("/join")}
                className="account-tool account-tool--locked"
                data-tool={tool.id}
                data-state={state}
              >
                {body}
              </Link>
            );
          }
          return (
            <article
              key={tool.id}
              className="account-tool account-tool--available"
              data-tool={tool.id}
              data-state={state}
            >
              {body}
            </article>
          );
        })}
      </div>
    </section>
  );
}
