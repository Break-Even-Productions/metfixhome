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
      <h2 id="account-tools-heading" className="account-section-title">
        MetFix tools
      </h2>
      <div className="account-tool-grid">
        {METFIX_APP_TOOLS.map((tool) => {
          const open = unlocked && tool.href != null;
          const available = unlocked && tool.href == null;
          const state = open ? "open" : available ? "available" : "locked";
          const status = open ? "Open" : available ? "No web page yet" : "Locked";
          const detail = open
            ? tool.summary
            : available
              ? `${tool.summary} Available with your membership.`
              : "Included with MetFix Pro.";
          const body = (
            <>
              <span className="account-tool__status">{status}</span>
              <span className="account-tool__title">{tool.title}</span>
              <span className="account-tool__detail">{detail}</span>
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
          return (
            <article
              key={tool.id}
              className={
                available ? "account-tool account-tool--available" : "account-tool account-tool--locked"
              }
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
