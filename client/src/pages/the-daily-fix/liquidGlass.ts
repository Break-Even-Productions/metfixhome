/**
 * Thin wrapper so MealPhoto can dynamic-import LiquidGlass without pulling
 * the library into the main App chunk, and so tests can mock this module.
 */
export type LiquidGlassHandle = { destroy: () => void };

export type LiquidGlassInitOptions = {
  root: HTMLElement;
  glassElements: HTMLElement[];
  defaults?: Record<string, unknown>;
};

export async function initLiquidGlass(options: LiquidGlassInitOptions): Promise<LiquidGlassHandle> {
  const { LiquidGlass } = await import("@ybouane/liquidglass");
  return LiquidGlass.init(options);
}
