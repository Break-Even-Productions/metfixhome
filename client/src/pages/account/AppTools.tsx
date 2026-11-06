import { Link } from "wouter";
import { basePath } from "@/const";
import type { CanonicalSubscriptionTier } from "@shared/account/tiers";
import {
  METFIX_APP_TOOLS,
  metfixToolsUnlocked,
  toolUnlocked,
  type AppTool,
  type AppToolLink,
} from "./metfixAppTools";

type Props = {
  tier: CanonicalSubscriptionTier;
};

function linkHref(
  item: { href: string | null; proOnly?: boolean },
  unlocked: boolean,
): string | null {
  if (!item.href) return null;
  if (item.proOnly && !unlocked) return "/join";
  return item.href;
}

function ToolLinks({
  links,
  tier,
}: {
  links: readonly AppToolLink[];
  tier: CanonicalSubscriptionTier;
}) {
  return (
    <ul className="account-tool__links">
      {links.map((link) => {
        const open = toolUnlocked(link, tier) && link.href != null;
        const available = toolUnlocked(link, tier) && link.href == null;
        const href = linkHref(link, toolUnlocked(link, tier));
        if (href) {
          return (
            <li key={link.id}>
              <Link
                href={basePath(href)}
                className={
                  open
                    ? "account-tool__sublink"
                    : "account-tool__sublink account-tool__sublink--locked"
                }
                data-tool={link.id}
                data-state={open ? "open" : "locked"}
              >
                <span>{link.title}</span>
                {!open ? <span className="account-tool__submeta">Pro</span> : null}
              </Link>
            </li>
          );
        }
        return (
          <li key={link.id}>
            <span
              className="account-tool__sublink account-tool__sublink--shell"
              data-tool={link.id}
              data-state={available ? "available" : "locked"}
            >
              <span>{link.title}</span>
              <span className="account-tool__submeta">
                {available ? "No web page yet" : "Pro"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function toolClassName(
  open: boolean,
  available: boolean,
  unlocked: boolean,
  hasLinks: boolean,
): string {
  return [
    "account-tool",
    open ? "account-tool--open" : null,
    available ? "account-tool--available" : null,
    !unlocked ? "account-tool--locked" : null,
    hasLinks ? "account-tool--pillar" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Faded fork + knife watermark for the Belly pillar (not a stomach). */
function BellyForkKnifeMark() {
  return (
    <svg
      className="account-tool__watermark"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function ToolCard({ tool, tier }: { tool: AppTool; tier: CanonicalSubscriptionTier }) {
  const unlocked = toolUnlocked(tool, tier);
  const open = unlocked && tool.href != null;
  const available = unlocked && tool.href == null;
  const state = open ? "open" : available ? "available" : "locked";
  const status = unlocked ? "Included" : "Locked";
  const href = linkHref(tool, unlocked);
  const hasLinks = Array.isArray(tool.links) && tool.links.length > 0;
  const className = [
    toolClassName(open, available, unlocked, hasLinks),
    tool.id === "belly" ? "account-tool--belly" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const header = (
    <>
      {tool.id === "belly" ? <BellyForkKnifeMark /> : null}
      <span className="account-tool__status">{status}</span>
      <div className="account-tool__row">
        <span className="account-tool__title">{tool.title}</span>
      </div>
      <span className="account-tool__detail">{tool.summary}</span>
    </>
  );

  // Pillar cards host nested links — never wrap the whole card in <a>.
  if (hasLinks) {
    return (
      <article className={className} data-tool={tool.id} data-state={state}>
        {header}
        <ToolLinks links={tool.links!} tier={tier} />
        {href ? (
          <Link href={basePath(href)} className="account-tool__action">
            {unlocked ? "Open" : "Unlock with Pro"}
          </Link>
        ) : unlocked ? (
          <span className="account-tool__action account-tool__action--muted">
            No web page yet
          </span>
        ) : (
          <Link
            href={basePath("/join")}
            className="account-tool__action account-tool__action--cta"
          >
            Unlock with Pro
          </Link>
        )}
      </article>
    );
  }

  const footer = open ? (
    <span className="account-tool__action">Open</span>
  ) : available ? (
    <span className="account-tool__action account-tool__action--muted">
      No web page yet
    </span>
  ) : (
    <span className="account-tool__action account-tool__action--cta">
      Unlock with Pro
    </span>
  );

  if (href) {
    return (
      <Link
        href={basePath(href)}
        className={className}
        data-tool={tool.id}
        data-state={state}
      >
        {header}
        {footer}
      </Link>
    );
  }

  if (!unlocked) {
    return (
      <Link
        href={basePath("/join")}
        className={className}
        data-tool={tool.id}
        data-state={state}
      >
        {header}
        {footer}
      </Link>
    );
  }

  return (
    <article className={className} data-tool={tool.id} data-state={state}>
      {header}
      {footer}
    </article>
  );
}

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
      <div className="account-tool-grid account-tool-grid--bbb">
        {METFIX_APP_TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} tier={tier} />
        ))}
      </div>
    </section>
  );
}
