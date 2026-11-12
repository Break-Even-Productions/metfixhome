/** Pure helpers for the orbiting Daily Fix wheel (mirrors BSI spin-the-wheel.php). */

export const TARGET_ANGLE = 180; // left-side pointer
export const RING_INSET = 0.08;
export const ORBIT_RATIO = 0.5 - RING_INSET;
export const MIN_TURNS = 5;
export const EXTRA_TURNS_VARIANCE = 2;

export function itemTransform(angleDeg: number, radiusPx: number): string {
  return `translate(-50%, -50%) rotate(${angleDeg}deg) translate(${radiusPx}px) rotate(${-angleDeg}deg)`;
}

export function baseAnglesForCount(count: number): number[] {
  if (count <= 0) return [];
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => i * step);
}

/** Normalize to (−180, 180]. */
export function norm180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export type SpinPlan = {
  delta: number;
  nextRotation: number;
  durationMs: number;
};

/**
 * Plan a CCW multi-turn spin so `index` lands under the left pointer.
 * When `fullSpin` is false (thumb click) or reduced motion, land with minimal travel.
 */
export function planSpin(
  index: number,
  baseAngles: number[],
  currentRotation: number,
  opts: { fullSpin: boolean; reduceMotion: boolean; random?: () => number } = {
    fullSpin: true,
    reduceMotion: false,
  },
): SpinPlan {
  const itemAngle = baseAngles[index] ?? 0;
  const minimal = norm180(TARGET_ANGLE - (itemAngle + currentRotation));
  const rand = opts.random ?? Math.random;

  if (opts.reduceMotion || !opts.fullSpin) {
    const delta = minimal;
    return {
      delta,
      nextRotation: currentRotation + delta,
      durationMs: opts.reduceMotion ? 0 : Math.max(320, Math.abs(delta) * 4),
    };
  }

  const ccwMinimal = minimal > 0 ? minimal - 360 : minimal;
  const extraTurns = MIN_TURNS + Math.floor(rand() * (EXTRA_TURNS_VARIANCE + 1));
  const delta = ccwMinimal - extraTurns * 360;
  const perTurn = 550;
  const baseMs = 800;
  const durationMs = Math.max(1600, baseMs + (Math.abs(delta) / 360) * perTurn);
  return {
    delta,
    nextRotation: currentRotation + delta,
    durationMs,
  };
}

export function measureOrbitRadius(wheelWidthPx: number): number {
  const d = wheelWidthPx || 700;
  return Math.round(d * ORBIT_RATIO);
}
