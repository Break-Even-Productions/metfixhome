import { describe, expect, it } from "vitest";
import { baseAnglesForCount, itemTransform, norm180, planSpin, TARGET_ANGLE } from "./spin";

describe("wheel spin helpers", () => {
  it("spaces items evenly around the ring", () => {
    expect(baseAnglesForCount(0)).toEqual([]);
    expect(baseAnglesForCount(4)).toEqual([0, 90, 180, 270]);
  });

  it("keeps thumbs upright via counter-rotation", () => {
    expect(itemTransform(90, 200)).toBe(
      "translate(-50%, -50%) rotate(90deg) translate(200px) rotate(-90deg)",
    );
  });

  it("plans a multi-turn CCW spin toward the left pointer", () => {
    const angles = baseAnglesForCount(8);
    const plan = planSpin(0, angles, 0, {
      fullSpin: true,
      reduceMotion: false,
      random: () => 0,
    });
    expect(plan.delta).toBeLessThan(0);
    expect(Math.abs(plan.delta)).toBeGreaterThanOrEqual(5 * 360);
    const landed = (angles[0]! + plan.nextRotation) % 360;
    const normalized = ((landed % 360) + 360) % 360;
    expect(Math.abs(norm180(TARGET_ANGLE - normalized))).toBeLessThan(0.001);
    expect(plan.durationMs).toBeGreaterThanOrEqual(1600);
  });

  it("skips multi-turn travel when reduced motion is preferred", () => {
    const angles = baseAnglesForCount(6);
    const plan = planSpin(2, angles, 0, { fullSpin: true, reduceMotion: true });
    expect(Math.abs(plan.delta)).toBeLessThanOrEqual(180);
    expect(plan.durationMs).toBe(0);
  });
});
