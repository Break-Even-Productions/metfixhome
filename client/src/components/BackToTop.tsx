import { useEffect, useRef, useState } from "react";
import "./back-to-top.css";

const R = 19.5;
const CIRC = 2 * Math.PI * R;
const SHOW_AFTER_PX = 280;
/** ~one long article / ~a few card rows — ring completes then flips color. */
const DEFAULT_CYCLE = 12;

type BackToTopProps = {
  /** Page scroll % (post detail). */
  mode?: "document" | "items";
  /** CSS selector for archive cards when mode=items. */
  itemSelector?: string;
  /** How many items fill one progress cycle before color flips. */
  cycleEvery?: number;
};

function MetfixAsterisk({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="mfx-btt-asterisk"
      width={size}
      height={size}
      viewBox="-1 -1 2 2"
      aria-hidden
    >
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} fill="currentColor" />
      <rect
        x={-0.727}
        y={-0.091}
        width={1.454}
        height={0.182}
        fill="currentColor"
        transform="rotate(45)"
      />
      <rect
        x={-0.727}
        y={-0.091}
        width={1.454}
        height={0.182}
        fill="currentColor"
        transform="rotate(-45)"
      />
      <rect x={-0.091} y={0} width={0.182} height={0.727} fill="currentColor" />
      <rect
        x={-0.091}
        y={-0.636}
        width={0.182}
        height={0.364}
        rx={0.091}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Cloudflare-style back-to-top with circular progress.
 * Archive (`items`): progress from cards scrolled past — stable under infinite load.
 * Post (`document`): classic page-height progress.
 */
export function BackToTop({
  mode = "document",
  itemSelector = ".library-card",
  cycleEvery = DEFAULT_CYCLE,
}: BackToTopProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const update = () => {
      raf.current = 0;
      const y = window.scrollY || document.documentElement.scrollTop;
      setVisible(y > SHOW_AFTER_PX);

      if (mode === "items") {
        const cards = document.querySelectorAll(itemSelector);
        let passed = 0;
        const mark = y + window.innerHeight * 0.35;
        for (const el of cards) {
          const top = (el as HTMLElement).offsetTop;
          if (top < mark) passed += 1;
          else break;
        }
        const cycle = Math.max(1, cycleEvery);
        const within = passed % cycle;
        setProgress(within / cycle);
        setColorIdx(Math.floor(passed / cycle) % 2);
        return;
      }

      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      setProgress(pct);
      setColorIdx(0);
    };

    const onScroll = () => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [mode, itemSelector, cycleEvery]);

  const offset = CIRC * (1 - progress);

  return (
    <button
      type="button"
      className="mfx-btt"
      data-visible={visible ? "true" : "false"}
      data-color={colorIdx === 0 ? "a" : "b"}
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <svg className="mfx-btt-ring" width="47" height="47" viewBox="0 0 47 47" aria-hidden>
        <circle className="mfx-btt-bg" cx="23.5" cy="23.5" r="23" />
        <circle
          className="mfx-btt-track"
          cx="23.5"
          cy="23.5"
          r={R}
          fill="none"
          strokeWidth="2.5"
        />
        <circle
          className="mfx-btt-progress"
          cx="23.5"
          cy="23.5"
          r={R}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform="rotate(-90 23.5 23.5)"
          style={{
            strokeDasharray: CIRC,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <span className="mfx-btt-face" aria-hidden>
        <svg className="mfx-btt-arrow" width="20" height="20" viewBox="0 0 256 256">
          <path
            fill="currentColor"
            d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"
          />
        </svg>
        <MetfixAsterisk size={18} />
      </span>
    </button>
  );
}
