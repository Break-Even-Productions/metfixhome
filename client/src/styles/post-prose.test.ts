import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("post-prose.css (PL1–PL3, PL7, PL8, PL11)", () => {
  const prose = fs.readFileSync(path.join(import.meta.dirname, "post-prose.css"), "utf8");

  it("shared body measure and DM Sans 16/26", () => {
    expect(prose).toMatch(/max-width:\s*680px/);
    expect(prose).toMatch(/"DM Sans"/);
    expect(prose).toMatch(/font-size:\s*16px/);
    expect(prose).toMatch(/line-height:\s*26px/);
    expect(prose).toMatch(/overflow-wrap:\s*anywhere/);
    expect(prose).toMatch(/margin:\s*0 0 16px/);
  });

  it("LB9: no invented h2/blockquote sizes under body selectors", () => {
    const bodyBlock = prose.match(
      /\.posts-detail-content,\s*\.library-reader-body\s*\{[^}]+\}/,
    )?.[0];
    expect(bodyBlock).toBeTruthy();
    expect(prose).not.toMatch(
      /\.posts-detail-content\s+h2|\.library-reader-body\s+h2|\.posts-detail-content\s+blockquote/,
    );
  });
});
