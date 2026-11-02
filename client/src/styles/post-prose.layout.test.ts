/**
 * @vitest-environment jsdom
 *
 * Author-right layout (Ethan OQ-3 override): CSS contract for
 * `.post-reader-grid` + aside measure. Cheap source/computed checks —
 * not a pure visual-only change.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";


const prosePath = path.join(import.meta.dirname, "post-prose.css");
const prose = fs.readFileSync(prosePath, "utf8");

describe("post-prose author-right layout (PL13)", () => {
  it("defines a desktop grid with a 780px main column and 40px gap", () => {
    expect(prose).toMatch(/\.post-reader-grid\s*\{/);
    expect(prose).toMatch(/grid-template-columns:\s*1fr/);
    expect(prose).toMatch(/@media\s*\(min-width:\s*1024px\)/);
    expect(prose).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*780px\)\s+minmax\(14rem,\s*1fr\)/,
    );
    expect(prose).toMatch(/gap:\s*2\.5rem/);
    expect(prose).toMatch(/\.post-reader-aside/);
    expect(prose).toMatch(/\.post-author-card/);
    expect(prose).toMatch(/position:\s*sticky/);
  });

  it("keeps body measure 780px under the main column selectors", () => {
    expect(prose).toMatch(
      /\.posts-detail-content,\s*\.library-reader-body\s*\{[^}]*max-width:\s*780px/s,
    );
  });
});

describe("post-reader-grid computed style (jsdom)", () => {
  const styleEl = () => {
    const el = document.createElement("style");
    el.textContent = prose;
    document.head.appendChild(el);
    return el;
  };

  afterEach(() => {
    document.head.querySelectorAll("style").forEach((n) => n.remove());
    document.body.innerHTML = "";
  });

  it("is single-column by default; exposes two tracks in the lg rule text", () => {
    // jsdom does not evaluate @media; assert base computed + source lg rule.
    styleEl();
    document.body.innerHTML =
      '<div class="post-reader-grid"><div class="post-reader-main"></div><aside class="post-reader-aside"></aside></div>';
    const grid = document.querySelector(".post-reader-grid")!;
    const cs = getComputedStyle(grid);
    expect(cs.display).toBe("grid");
    expect(prose).toContain("minmax(0, 780px) minmax(14rem, 1fr)");
  });
});
