import { Link } from "wouter";
import { basePath } from "@/const";
import type { CtaLink } from "@/lib/homeTypes";
import type { ReactNode } from "react";

/** Reject javascript:/data: (and whitespace-padded variants) — T-E-20 / TH-2. */
export function isSafeCmsHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  return !/^(?:javascript|data)\s*:/i.test(trimmed);
}

/** Renders an internal wouter Link or external <a> from Sanity CTA data. */
export function CmsLink({
  cta,
  className,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  cta: CtaLink;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  onMouseEnter?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const label = children ?? cta.label;
  const href = cta.href || "#";
  const safe = isSafeCmsHref(href);
  const isExternal = /^https?:\/\//.test(href) || href.startsWith("mailto:");
  const isHashOnly = href.startsWith("#");

  if (!safe) {
    return (
      <span className={className} style={style}>
        {label}
      </span>
    );
  }

  if (isExternal || isHashOnly) {
    return (
      <a
        href={href}
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={basePath(href)}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {label}
    </Link>
  );
}
