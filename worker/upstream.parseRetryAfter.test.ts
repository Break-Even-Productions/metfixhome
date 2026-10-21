import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseRetryAfter } from "./upstream";

const REPO = process.cwd().endsWith("/client") ? join(process.cwd(), "..") : process.cwd();

describe("AU26.11 parseRetryAfter", () => {
  it("AU26.11 clamps all-digit values to 1..600", () => {
    expect(parseRetryAfter("0")).toBe(1);
    expect(parseRetryAfter("000")).toBe(1);
    expect(parseRetryAfter("0000")).toBe(1);
    expect(parseRetryAfter("1")).toBe(1);
    expect(parseRetryAfter("017")).toBe(17);
    expect(parseRetryAfter("0017")).toBe(17);
    expect(parseRetryAfter("0000017")).toBe(17);
    expect(parseRetryAfter("0000000")).toBe(1);
    expect(parseRetryAfter("17")).toBe(17);
    expect(parseRetryAfter("600")).toBe(600);
    expect(parseRetryAfter("601")).toBe(600);
    expect(parseRetryAfter("99999")).toBe(600);
    expect(parseRetryAfter("999999")).toBe(600);
    expect(parseRetryAfter("1000000")).toBe(600);
    expect(parseRetryAfter("123456789012345678901234567890")).toBe(600);
    expect(parseRetryAfter("1".repeat(30))).toBe(600);
    expect(parseRetryAfter("1".repeat(400))).toBe(600);
  });

  it("AU26.11 property: all-digit string equals integer clamp 1..600", () => {
    for (let n = 0; n <= 1200; n++) {
      const raw = String(n);
      const padded = n.toString().padStart(4, "0");
      const expectN = n < 1 ? 1 : n > 600 ? 600 : n;
      expect(parseRetryAfter(raw)).toBe(expectN);
      // Leading zeros: value is the integer (0017→17), unless 7+ digit form.
      if (padded.length < 7) expect(parseRetryAfter(padded)).toBe(expectN);
    }
    // Leading zeros stripped before length guard: seven zeros → "0" → 1.
    expect(parseRetryAfter("0000000")).toBe(1);
    // Seven significant digits still clamp to 600.
    expect(parseRetryAfter("1000000")).toBe(600);
  });

  it("AU26.11 defaults missing / non-numeric / HTTP-date / decimal to 60", () => {
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

  it("AU26.11 single parseRetryAfter definition in worker/**", () => {
    const root = join(REPO, "worker");
    const defs: string[] = [];
    const walk = (dir: string) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === "node_modules" || ent.name === "__fixtures__") continue;
          walk(p);
          continue;
        }
        if (!ent.name.endsWith(".ts")) continue;
        if (ent.name.endsWith(".test.ts") || ent.name.endsWith(".test-d.ts")) continue;
        const text = readFileSync(p, "utf8");
        if (/export\s+function\s+parseRetryAfter\b/.test(text) || /function\s+parseRetryAfter\b/.test(text)) {
          defs.push(p.replace(REPO + "/", ""));
        }
      }
    };
    walk(root);
    expect(defs).toEqual(["worker/upstream.ts"]);
  });

  it("AU26.11 shared parser wired through bsiFetch, login, and comment writes", () => {
    const upstream = readFileSync(join(REPO, "worker/upstream.ts"), "utf8");
    const login = readFileSync(join(REPO, "worker/auth/login.ts"), "utf8");
    const comments = readFileSync(join(REPO, "worker/comments.ts"), "utf8");
    expect(upstream).toMatch(
      /const retryAfter = raRaw != null \? parseRetryAfter\(raRaw\) : null;/,
    );
    expect(login).toMatch(/parseRetryAfter\(/);
    expect(comments).toMatch(/parseRetryAfter\(/);
  });

  it("AU26.11 return type is branded RetryAfterSeconds not bare number", () => {
    const upstream = readFileSync(join(REPO, "worker/upstream.ts"), "utf8");
    expect(upstream).toMatch(
      /export type RetryAfterSeconds = number & \{ readonly __brand: "RetryAfterSeconds" \};/,
    );
    expect(upstream).toMatch(
      /export function parseRetryAfter\(header: string \| null \| undefined\): RetryAfterSeconds \{/,
    );
  });
});
