/**
 * @vitest-environment jsdom
 *
 * C6: keep ./liquidGlass mock in page mounts; prove the wrapper calls the package.
 */
import { describe, expect, it, vi } from "vitest";

const { packageInit, packageDestroy } = vi.hoisted(() => {
  const packageDestroy = vi.fn();
  const packageInit = vi.fn(async () => ({ destroy: packageDestroy }));
  return { packageInit, packageDestroy };
});

vi.mock("@ybouane/liquidglass", () => ({
  LiquidGlass: {
    init: packageInit,
  },
}));

describe("initLiquidGlass wrapper", () => {
  it("calls LiquidGlass.init and returns its destroy handle", async () => {
    const { initLiquidGlass } = await import("./liquidGlass");
    const root = document.createElement("div");
    const glass = document.createElement("div");
    const handle = await initLiquidGlass({
      root,
      glassElements: [glass],
      defaults: { brightness: -0.15 },
    });
    expect(packageInit).toHaveBeenCalledTimes(1);
    expect(packageInit).toHaveBeenCalledWith({
      root,
      glassElements: [glass],
      defaults: { brightness: -0.15 },
    });
    expect(handle.destroy).toBe(packageDestroy);
    handle.destroy();
    expect(packageDestroy).toHaveBeenCalledTimes(1);
  });
});
