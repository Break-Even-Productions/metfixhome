/**
 * @vitest-environment jsdom
 * Standalone body buttons vs inline text links.
 */
import { describe, expect, it } from "vitest";

const SELECTOR = "div.library-reader-body div > a";

describe("standalone body link selector", () => {
  it("matches a div-wrapped link and skips links inside text", () => {
    document.body.innerHTML = `
      <div class="library-reader-body">
        <p>Members can view the full video <a id="inline" href="/video">here</a> (members only).</p>
        <p><em>Source: <a id="cite" href="https://example.com/doi">doi</a>.</em></p>
        <ul><li>See the <a id="list" href="/list">notes</a>.</li></ul>
        <div><a id="button" href="/video"><span>Full Video (members only)</span></a></div>
      </div>
    `;
    const ids = [...document.querySelectorAll(SELECTOR)].map((el) => el.id);
    expect(ids).toEqual(["button"]);
  });
});
