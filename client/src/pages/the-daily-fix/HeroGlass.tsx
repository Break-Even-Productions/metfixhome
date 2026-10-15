import { useEffect, useState, type RefObject } from "react";
import { initLiquidGlass, type LiquidGlassHandle } from "./liquidGlass";

/** Same geometry as the `shapeSDF` asterisk in vite/asterisk-glass.ts, in a -1..1 box. */
function AsteriskFallback() {
  return (
    <svg className="df-hero-mark-fallback" viewBox="-1 -1 2 2" aria-hidden="true">
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} />
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} transform="rotate(45)" />
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} transform="rotate(-45)" />
      <rect x={-0.091} y={0} width={0.182} height={0.727} />
      <rect x={-0.091} y={-0.636} width={0.182} height={0.364} rx={0.091} />
    </svg>
  );
}

/**
 * Liquid glass over the hero video: the pillar bar and the MetFix asterisk.
 * Returns true once the glass is drawing, so callers can drop their fallbacks.
 */
export function useHeroGlass(
  rootRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  markRef: RefObject<HTMLElement | null>,
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    const mark = markRef.current;
    if (!root || !bar || !mark || typeof WebGLRenderingContext === "undefined") return;

    let cancelled = false;
    let instance: LiquidGlassHandle | null = null;
    void initLiquidGlass({
      root,
      glassElements: [bar, mark],
      defaults: { brightness: -0.3, blurAmount: 0.25, cornerRadius: 50 },
    })
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        instance = next;
        next.markChanged();
        setReady(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [rootRef, barRef, markRef]);

  return ready;
}

export function HeroMark({
  markRef,
  glassReady,
}: {
  markRef: RefObject<HTMLDivElement | null>;
  glassReady: boolean;
}) {
  return (
    <div ref={markRef} className="df-hero-mark" data-config='{"shape":1}' role="img" aria-label="MetFix">
      {glassReady ? null : <AsteriskFallback />}
    </div>
  );
}
