import { describe, expect, it } from "vitest";
import {
  formatAccessUntilLine,
  formatUtcDate,
  parseIsoInstantToUtcZ,
} from "./dates";

/** 1.2.9 N21: minutes over 14:00 fail at the regex (not a post-match oh/om check). */
const ISO_INSTANT_N21 =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(Z|([+-])(?:(0\d|1[0-3]):([0-5]\d)|14:00))$/;

describe("parseIsoInstantToUtcZ (CL-ACCESS-1 / 1.2.9 N21)", () => {
  it("accepts Z and ±offset; normalizes to Z", () => {
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00Z")).toBe("2027-09-02T12:00:00Z");
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00+00:00")).toBe("2027-09-02T12:00:00Z");
    expect(parseIsoInstantToUtcZ("2027-09-02T07:00:00-05:00")).toBe("2027-09-02T12:00:00Z");
    expect(parseIsoInstantToUtcZ("2027-09-02T17:30:00+05:30")).toBe("2027-09-02T12:00:00Z");
  });

  it("accepts leap day 2028-02-29; rejects non-leap 2027-02-29 and Feb 30", () => {
    expect(parseIsoInstantToUtcZ("2028-02-29T00:00:00Z")).toBe("2028-02-29T00:00:00Z");
    expect(parseIsoInstantToUtcZ("2027-02-29T00:00:00Z")).toBeNull();
    expect(parseIsoInstantToUtcZ("2027-02-30T00:00:00Z")).toBeNull();
  });

  it("rejects 24:00, -00:00; +14:01 fails at regex; accepts ±14:00", () => {
    expect(parseIsoInstantToUtcZ("2027-09-02T24:00:00Z")).toBeNull();
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00-00:00")).toBeNull();
    expect("2027-09-02T12:00:00+14:01").not.toMatch(ISO_INSTANT_N21);
    expect("2027-09-02T12:00:00+14:30").not.toMatch(ISO_INSTANT_N21);
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00+14:01")).toBeNull();
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00+14:30")).toBeNull();
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00+25:00")).toBeNull();
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00+0530")).toBeNull();
    expect(parseIsoInstantToUtcZ("2027-09-02T12:00:00.000Z")).toBeNull();
    expect("2027-09-02T14:00:00+14:00").toMatch(ISO_INSTANT_N21);
    expect("2027-09-02T10:00:00-14:00").toMatch(ISO_INSTANT_N21);
    expect(parseIsoInstantToUtcZ("2027-09-02T14:00:00+14:00")).toBe("2027-09-02T00:00:00Z");
    expect(parseIsoInstantToUtcZ("2027-09-02T10:00:00-14:00")).toBe("2027-09-03T00:00:00Z");
  });

  it("rejects truncated / malformed", () => {
    expect(parseIsoInstantToUtcZ("2027-09-02")).toBeNull();
    expect(parseIsoInstantToUtcZ("not-a-date")).toBeNull();
    expect(parseIsoInstantToUtcZ(null)).toBeNull();
  });
});

describe("formatAccessUntilLine (CL-T15)", () => {
  it("renders full Access until / Access ended forms in UTC", () => {
    expect(formatAccessUntilLine("2027-09-02T12:00:00Z", Date.parse("2026-01-01T00:00:00Z"))).toBe(
      "Access until Sep 2, 2027",
    );
    expect(formatAccessUntilLine("2025-01-05T00:00:00Z", Date.parse("2026-01-01T00:00:00Z"))).toBe(
      "Access ended Jan 5, 2025",
    );
    expect(formatUtcDate("2027-09-02T02:00:00Z")).toBe("Sep 2, 2027");
    expect(formatUtcDate("2027-09-02T00:30:00+05:30")).toBe("Sep 1, 2027");
  });
});
