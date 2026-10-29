/**
 * errata d6 DR-15 / DR-22 / DR-24 / DR-25 / DR-28: one shared stray-field stripper.
 * Runs at every BSI response boundary (CL1/CL2/CR1–CR3) before validators.
 * Logs key names only — never values.
 */

export type StrayFieldLog = {
  event: "stray_promo_field" | "stray_autoapply_field";
  key: string;
};

const PROMO_EXACT = new Set(["promo_state", "pending_promo_cents"]);

function isPromoKey(key: string): boolean {
  if (PROMO_EXACT.has(key)) return true;
  if (/^promo_/i.test(key)) return true;
  if (/_promo_/i.test(key)) return true;
  if (/_promo$/i.test(key)) return true;
  return false;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/**
 * Strip promo + auto-apply stray keys (DR-25 final list).
 * - promo: promo_state, pending_promo_cents, promo_* / *_promo_*
 * - auto-apply: top-level `credit`; balance_cents / days_granted under `credit`
 */
export function stripStrayFields(body: unknown): {
  body: unknown;
  strayKeys: StrayFieldLog[];
} {
  const strayKeys: StrayFieldLog[] = [];
  const seen = new Set<string>();

  function logOnce(event: StrayFieldLog["event"], key: string) {
    const id = `${event}:${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    strayKeys.push({ event, key });
  }

  function walk(node: unknown, underCredit: boolean): unknown {
    if (Array.isArray(node)) {
      return node.map((item) => walk(item, underCredit));
    }
    const obj = asRecord(node);
    if (!obj) return node;

    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isPromoKey(key)) {
        logOnce("stray_promo_field", key);
        continue;
      }
      if (!underCredit && key === "credit") {
        logOnce("stray_autoapply_field", "credit");
        // Still walk credit to log nested promo / balance / days key names.
        const creditObj = asRecord(value);
        if (creditObj) {
          for (const ck of Object.keys(creditObj)) {
            if (isPromoKey(ck)) logOnce("stray_promo_field", ck);
            else if (ck === "balance_cents" || ck === "days_granted") {
              logOnce("stray_autoapply_field", ck);
            }
          }
        }
        continue;
      }
      if (underCredit && (key === "balance_cents" || key === "days_granted")) {
        logOnce("stray_autoapply_field", key);
        continue;
      }
      out[key] = walk(value, underCredit || key === "credit");
    }
    return out;
  }

  return { body: walk(body, false), strayKeys };
}

/** Emit one console.warn JSON line per stray key (name only). */
export function emitStrayFieldLogs(strayKeys: StrayFieldLog[]): void {
  for (const entry of strayKeys) {
    console.warn(JSON.stringify(entry));
  }
}
