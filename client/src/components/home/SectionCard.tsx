import type { ElementType, ReactNode, Ref } from "react";

const tones = {
  paper: "bg-paper text-ink",
  ink: "surface-ink bg-ink text-cream",
  cream: "bg-cream-2 text-ink",
} as const;

export function SectionCard({
  id,
  as: Tag = "section",
  tone = "paper",
  children,
  className = "",
  ref,
}: {
  id?: string;
  as?: ElementType;
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <Tag id={id} ref={ref} className={`section-card ${tones[tone]} ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionPad({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 py-12 md:px-8 md:py-16 lg:px-10 lg:py-20 ${className}`}>{children}</div>
  );
}
