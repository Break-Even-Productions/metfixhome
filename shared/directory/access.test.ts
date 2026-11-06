import { describe, expect, it } from "vitest";
import { mayViewCoachDirectory } from "./access";

describe("mayViewCoachDirectory", () => {
  it("allows an affiliate badge or an active foundations coach", () => {
    expect(mayViewCoachDirectory({ badges: { affiliate: true } })).toBe(true);
    expect(mayViewCoachDirectory({ badges: { affiliate: "owner" } })).toBe(true);
    expect(
      mayViewCoachDirectory({
        badges: { affiliate: false },
        foundations_coach: {
          seminar_checked_in: true,
          granted_at: "2026-01-15T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("rejects signed-out shapes, empty badges, and expired coaches", () => {
    expect(mayViewCoachDirectory(null)).toBe(false);
    expect(mayViewCoachDirectory({ badges: { affiliate: "none" } })).toBe(false);
    expect(
      mayViewCoachDirectory({
        foundations_coach: {
          seminar_checked_in: true,
          granted_at: "2010-01-15T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });
});
