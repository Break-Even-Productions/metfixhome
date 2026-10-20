import { describe, expect, it } from "vitest";
import { parseRetryAfter } from "./upstream";

describe("parseRetryAfter (AU26.11 / list r1.23)", () => {
  it("clamps all-digit values to 1..600", () => {
    expect(parseRetryAfter("0")).toBe(1);
    expect(parseRetryAfter("000")).toBe(1);
    expect(parseRetryAfter("1")).toBe(1);
    expect(parseRetryAfter("017")).toBe(17);
    expect(parseRetryAfter("17")).toBe(17);
    expect(parseRetryAfter("600")).toBe(600);
    expect(parseRetryAfter("601")).toBe(600);
    expect(parseRetryAfter("99999")).toBe(600);
    expect(parseRetryAfter("999999")).toBe(600);
    expect(parseRetryAfter("1000000")).toBe(600);
    expect(parseRetryAfter("1".repeat(30))).toBe(600);
    expect(parseRetryAfter("1".repeat(400))).toBe(600);
  });

  it("defaults missing / non-numeric / HTTP-date / decimal to 60", () => {
    expect(parseRetryAfter(null)).toBe(60);
    expect(parseRetryAfter(undefined)).toBe(60);
    expect(parseRetryAfter("")).toBe(60);
    expect(parseRetryAfter("abc")).toBe(60);
    expect(parseRetryAfter("1.5")).toBe(60);
    expect(parseRetryAfter("1e30")).toBe(60);
    expect(parseRetryAfter("+17")).toBe(60);
    expect(parseRetryAfter("0x11")).toBe(60);
    expect(parseRetryAfter("17abc")).toBe(60);
    expect(parseRetryAfter("-5")).toBe(60);
    expect(parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(60);
  });
});
