import { describe, expect, it } from "vitest";
import config from "./visual-diff.masks.json";

type Box = { x: number; y: number; w: number; h: number };

function unionArea(boxes: Box[]): number {
  const cells = new Set<string>();
  for (const b of boxes) {
    const x0 = Math.floor(b.x);
    const y0 = Math.floor(b.y);
    const x1 = Math.ceil(b.x + b.w);
    const y1 = Math.ceil(b.y + b.h);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) cells.add(`${x},${y}`);
    }
  }
  return cells.size;
}

function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function assertMc1(
  boxes: Box[],
  viewportW: number,
  pageH: number,
  maxFraction: number,
  maxBoxH: number,
): { ok: boolean; fraction: number; reason?: string } {
  for (const b of boxes) {
    if (b.h > maxBoxH) return { ok: false, fraction: 0, reason: "box_too_tall" };
  }
  const area = unionArea(boxes);
  const denom = viewportW * pageH;
  const fraction = denom === 0 ? 0 : area / denom;
  if (fraction > maxFraction) return { ok: false, fraction, reason: "union_over_cap" };
  return { ok: true, fraction };
}

describe("T-E-34 / MC-1 mask-area cap (rev1.0.10)", () => {
  it("pins config constants", () => {
    expect(config.pixelThreshold).toBe(0.1);
    expect(config.maxDiffPixelRatio).toBe(0.02);
    expect(config.retries).toBe(0);
    expect(config.runToRunSpreadPointsMax).toBe(0.2);
    expect(config.maskAreaCap.maxUnionFraction).toBe(0.1);
    expect(config.maskAreaCap.maxSingleBoxHeightPx["1280"]).toBe(800);
    expect(config.maskAreaCap.maxSingleBoxHeightPx["390"]).toBe(844);
  });

  it("passes a small locator-style mask box", () => {
    const r = assertMc1([{ x: 0, y: 5000, w: 200, h: 24 }], 1280, 6000, 0.1, 800);
    expect(r.ok).toBe(true);
    expect(r.fraction).toBeLessThanOrEqual(0.1);
  });

  it("fails a planted oversize mask (box taller than viewport)", () => {
    const r = assertMc1([{ x: 0, y: 0, w: 1280, h: 900 }], 1280, 6000, 0.1, 800);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("box_too_tall");
  });

  it("fails union over cap with short boxes", () => {
    const boxes: Box[] = [];
    for (let i = 0; i < 20; i++) boxes.push({ x: 0, y: i * 50, w: 1280, h: 40 });
    const r = assertMc1(boxes, 1280, 2000, 0.1, 800);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("union_over_cap");
    expect(r.fraction).toBeGreaterThan(0.1);
  });
});

describe("T-E-36 / P-E-M1 + SI-E17 no year mask", () => {
  it("pins forbid selectors", () => {
    expect(config.maskMustNotIntersect.selectors).toEqual(
      expect.arrayContaining([
        "input",
        "select",
        "textarea",
        "button",
        "a",
        "[role=alert]",
        "[aria-live]",
        ".grecaptcha-badge",
        "[data-nav-auth]",
      ]),
    );
  });

  it("fails a planted mask over the nav auth control", () => {
    const mask: Box = { x: 1100, y: 8, w: 80, h: 40 };
    const navAuth: Box = { x: 1120, y: 12, w: 48, h: 32 };
    expect(boxesIntersect(mask, navAuth)).toBe(true);
  });

  it("masks array is empty (no year mask; SI-E17)", () => {
    expect(config.masks).toEqual([]);
    expect(JSON.stringify(config)).not.toMatch(/data-visual/);
  });
});

describe("LR-E6 kept section exclusions (7 incl Membership)", () => {
  it("lists all seven named kept sections", () => {
    expect(config.sectionExclusions["X-9"]).toEqual(
      expect.arrayContaining([
        "#impact",
        "#playbook",
        "#affiliation",
        "#about",
        "#gap",
        "#network",
        "#membership-section",
      ]),
    );
    expect(config.sectionExclusions["X-9"]).toHaveLength(7);
  });
});
