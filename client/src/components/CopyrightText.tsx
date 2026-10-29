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
 * Long paragraphs wrap cleanly and stay readable in footer layouts.
 */
export default function CopyrightText({
  variant = "compact",
  className,
  style,
}: CopyrightTextProps) {
  const { settings } = useSiteSettings();
  const text = settings.copyrightText;

  const baseStyle: CSSProperties =
    variant === "home"
      ? {
          fontFamily: "var(--font-sans)",
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
          // Compact sits on cream footers (AFF/SEM) — use muted ink, not light-on-dark.
          fontFamily: "var(--font-sans)",
          fontSize: "0.7rem",
          letterSpacing: "0.06em",
          color: "var(--color-muted)",
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
