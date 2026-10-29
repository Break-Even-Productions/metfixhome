import type { CSSProperties } from "react";
import { useSiteSettings } from "@/hooks/useSanityContent";

type CopyrightTextProps = {
  /** Visual density for different footer layouts */
  variant?: "home" | "compact";
  className?: string;
  style?: CSSProperties;
};

/**
 * Renders Sanity-managed copyright text.
 * Year from frozen clock in visual runs (SI-E17) — no harness markup in production.
 */
export default function CopyrightText({
  variant = "compact",
  className,
  style,
}: CopyrightTextProps) {
  const { settings } = useSiteSettings();
  const year = new Date().getFullYear();
  const raw = settings.copyrightText;
  const text = raw.includes(String(year))
    ? raw
    : raw.replace(/©\s*\d{4}/, `© ${year}`).replace(/\b20\d{2}\b/, String(year));

  const baseStyle: CSSProperties =
    variant === "home"
      ? {
          fontFamily: "'DM Mono'",
          fontSize: "0.75rem",
          letterSpacing: "0.06em",
          color: "rgba(239,239,239,0.65)",
          textTransform: "uppercase",
          lineHeight: 1.65,
          maxWidth: "min(100%, 36rem)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          flex: "1 1 16rem",
          minWidth: 0,
        }
      : {
          fontFamily: "'DM Mono'",
          fontSize: "0.55rem",
          letterSpacing: "0.08em",
          color: "rgba(239,239,239,0.25)",
          textTransform: "uppercase",
          lineHeight: 1.6,
          maxWidth: "min(100%, 28rem)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          flex: "1 1 12rem",
          minWidth: 0,
        };

  return (
    <div className={className} style={{ ...baseStyle, ...style }}>
      {text}
    </div>
  );
}
