import { describe, expect, it, vi } from "vitest";
import { emitStrayFieldLogs, stripStrayFields } from "./stripStrayFields";

describe("stripStrayFields (errata d6 DR-22/DR-24/DR-25)", () => {
  it("strips top-level credit + nested promo keys; logs names only", () => {
    const { body, strayKeys } = stripStrayFields({
      currency: "usd",
      ltv: { total_ltv_cents: 1, claimed_value_cents: 0, available_cents: 1 },
      credit: {
        balance_cents: 1300,
        days_granted: 12,
        promo_state: "waiting_to_apply",
        pending_promo_cents: 1300,
      },
      courses: [],
      promo_foo: {},
    });
    expect(body).toEqual({
      currency: "usd",
      ltv: { total_ltv_cents: 1, claimed_value_cents: 0, available_cents: 1 },
      courses: [],
    });
    const events = strayKeys.map((s) => `${s.event}:${s.key}`).sort();
    expect(events).toEqual(
      [
        "stray_autoapply_field:balance_cents",
        "stray_autoapply_field:credit",
        "stray_autoapply_field:days_granted",
        "stray_promo_field:pending_promo_cents",
        "stray_promo_field:promo_foo",
        "stray_promo_field:promo_state",
      ].sort(),
    );
    expect(JSON.stringify(strayKeys)).not.toMatch(/1300|12|waiting/);
  });

  it("emitStrayFieldLogs writes key names only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    emitStrayFieldLogs([{ event: "stray_promo_field", key: "promo_state" }]);
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "stray_promo_field", key: "promo_state" }),
    );
    warn.mockRestore();
  });
});
