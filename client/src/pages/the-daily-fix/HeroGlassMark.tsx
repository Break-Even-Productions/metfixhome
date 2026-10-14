import { useEffect, useRef, useState, type RefObject } from "react";
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

/** Liquid-glass MetFix asterisk over the hero. `root` is what the glass refracts. */
export function HeroGlassMark({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const markRef = useRef<HTMLDivElement>(null);
  const [glassReady, setGlassReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const mark = markRef.current;
    if (!root || !mark || typeof WebGLRenderingContext === "undefined") return;

    let cancelled = false;
    let instance: LiquidGlassHandle | null = null;
    void initLiquidGlass({
      root,
      glassElements: [mark],
      defaults: { brightness: -0.3, blurAmount: 0.25, cornerRadius: 50 },
    })
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        instance = next;
        setGlassReady(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [rootRef]);

  return (
    <div ref={markRef} className="df-hero-mark" data-config='{"shape":1}' role="img" aria-label="MetFix">
      {glassReady ? null : <AsteriskFallback />}
    </div>
  );
}
