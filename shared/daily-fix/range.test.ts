import { describe, expect, it } from "vitest";
import { missingIsoFromSearch, outOfRangeLocation } from "./range";

const TODAY = "2026-10-14";

describe("outOfRangeLocation", () => {
  it("leaves the first fix through today alone", () => {
    expect(outOfRangeLocation("2025-02-10", TODAY)).toBeNull();
    expect(outOfRangeLocation(TODAY, TODAY)).toBeNull();
  });

  it("sends future days to today, keeping other params", () => {
    expect(outOfRangeLocation("2026-10-17", TODAY, "?tab=brain&x=1")).toBe(
      "/the-daily-fix?tab=brain&x=1&missing=261017",
    );
  });

  it("sends days before the first fix to 250210, replacing a stale missing param", () => {
    expect(outOfRangeLocation("2024-12-31", TODAY, "?missing=999999")).toBe(
      "/the-daily-fix/250210?missing=241231",
    );
  });
});

describe("missingIsoFromSearch", () => {
  it("reads a real YYMMDD and ignores junk", () => {
    expect(missingIsoFromSearch("?tab=body&missing=261017")).toBe("2026-10-17");
    expect(missingIsoFromSearch("?missing=261399")).toBeNull();
    expect(missingIsoFromSearch("?missingx=261017")).toBeNull();
    expect(missingIsoFromSearch("")).toBeNull();
  });
});
