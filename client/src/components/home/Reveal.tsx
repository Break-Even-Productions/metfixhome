import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "./motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

export function Reveal({ children, className, delay = 0, y = 36 }: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        variants={{
          hidden: { opacity: 0, y },
          show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.9, delay, ease: fadeUp.show.transition.ease },
          },
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
