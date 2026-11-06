/**
 * Dashboard hero liquid glass — same WebGL path as HomeHeroGlass / Daily Fix HeroGlass.
 * Glass elements (mark + stats bar) must be direct children of the root.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  initLiquidGlass,
  type LiquidGlassHandle,
} from "@/pages/the-daily-fix/liquidGlass";

/** Same geometry as vite/asterisk-glass.ts shapeSDF, in a -1..1 box. */
export function DashAsteriskFallback({ className = "dash-greet__mark-fallback" }: { className?: string }) {
  return (
    <svg className={className} viewBox="-1 -1 2 2" aria-hidden="true">
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} />
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} transform="rotate(45)" />
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} transform="rotate(-45)" />
      <rect x={-0.091} y={0} width={0.182} height={0.727} />
      <rect x={-0.091} y={-0.636} width={0.182} height={0.364} rx={0.091} />
    </svg>
  );
}

/** Returns true once liquid glass is drawing over the mark + stats bar. */
export function useDashHeroGlass(
  rootRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  markRef: RefObject<HTMLElement | null>,
  photoSrc: string,
) {
  const [ready, setReady] = useState(false);
  const instanceRef = useRef<LiquidGlassHandle | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    const mark = markRef.current;
    if (!root || !bar || !mark || typeof WebGLRenderingContext === "undefined") return;

    let cancelled = false;
    void initLiquidGlass({
      root,
      glassElements: [bar, mark],
      defaults: { brightness: -0.28, blurAmount: 0.28, cornerRadius: 18 },
    })
      .then((next) => {
        if (cancelled) {
          next.destroy();
          return;
        }
        instanceRef.current = next;
        next.markChanged();
        setReady(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      setReady(false);
    };
  }, [rootRef, barRef, markRef]);

  // Nested <img> swaps aren't observed by LiquidGlass — re-sample after load.
  useEffect(() => {
    if (!ready) return;
    const root = rootRef.current;
    const instance = instanceRef.current;
    if (!root || !instance) return;

    const img = root.querySelector("img");
    if (!img) return;

    const refresh = () => instance.markChanged(img);
    if (img.complete && img.naturalWidth > 0) {
      refresh();
      return;
    }
    img.addEventListener("load", refresh);
    return () => img.removeEventListener("load", refresh);
  }, [photoSrc, ready, rootRef]);

  return ready;
}
