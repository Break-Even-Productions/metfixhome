import { describe, expect, it } from "vitest";
import { ALLOWED_ATTR, ALLOWED_TAGS } from "./sanitizeConfig";
import { allowlistedImageUrl, sanitizeHtml, sanitizeHtmlString } from "./sanitize";

describe("sanitizeHtml (PS1–PS7)", () => {
  it("PS1: keeps allowed tags; unwraps others", () => {
    const html =
      "<p>a</p><h2>b</h2><h1>H1</h1><div>D<span>S</span></div><h5>h5</h5><u>u</u>";
    const out = sanitizeHtml(html);
    expect(out).toContain("<p>a</p>");
    expect(out).toContain("<h2>b</h2>");
    expect(out).not.toContain("<h1>");
    expect(out).not.toContain("<div>");
    expect(out).not.toContain("<span>");
    expect(out).toContain("H1");
    expect(out).toContain("D");
    expect(out).toContain("S");
    expect(out).toContain("h5");
    expect(out).toContain("u");
    for (const tag of ALLOWED_TAGS) {
      expect(ALLOWED_TAGS.includes(tag)).toBe(true);
    }
  });

  it("PS2: removes dangerous tags with content", () => {
    const cases = [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "svg",
      "math",
      "noscript",
      "template",
    ];
    for (const tag of cases) {
      const sentinel = `SENTINEL-${tag}`;
      const out = sanitizeHtml(`<p>ok</p><${tag}>${sentinel}</${tag}><p>end</p>`);
      expect(out).not.toContain(sentinel);
      expect(out).not.toContain(`<${tag}`);
      expect(out).toContain("<p>ok</p>");
    }
    expect(sanitizeHtml('<p>x</p><input type="text" value="SENTINEL-input">')).not.toContain(
      "SENTINEL-input",
    );
  });

  it("PS3: strips on*/style/class/id/data-* etc.", () => {
    const out = sanitizeHtml(
      `<p class="x" id="y" style="color:red" onclick="alert(1)" data-x="1" lang="en">t</p>` +
        `<a href="https://brokenscience.org/a" title="t" class="c" onclick="x">l</a>` +
        `<img src="https://brokenscience.org/a.jpg" alt="a" width="1" height="1" class="c" onerror="x">`,
    );
    expect(out).not.toMatch(/\son\w+/i);
    expect(out).not.toContain("style=");
    expect(out).not.toContain("class=");
    expect(out).not.toContain("id=");
    expect(out).not.toContain("data-");
    expect(out).toContain('title="t"');
    expect(out).toContain('alt="a"');
    expect(ALLOWED_ATTR.a).toEqual(["href", "title"]);
    expect(ALLOWED_ATTR.img).toEqual(["src", "srcset", "alt", "width", "height"]);
  });

  it("PS4: resolves hrefs, scheme check, external target/rel", () => {
    expect(sanitizeHtml('<a href="/rel">x</a>')).toContain(
      'href="https://brokenscience.org/rel"',
    );
    expect(sanitizeHtml('<a href="rel">x</a>')).toContain(
      'href="https://brokenscience.org/rel"',
    );
    expect(sanitizeHtml('<a href="#x">x</a>')).toContain(
      'href="https://brokenscience.org/#x"',
    );
    expect(sanitizeHtml('<a href="/rel">x</a>')).toContain('target="_blank"');
    expect(sanitizeHtml('<a href="/rel">x</a>')).toContain(
      'rel="noopener noreferrer nofollow"',
    );

    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "&#106;avascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "file:///etc/passwd",
    ]) {
      const out = sanitizeHtml(`<a href="${bad}">x</a>`);
      expect(out).not.toContain("href=");
      expect(out).toContain(">x</a>");
    }

    const mailto = sanitizeHtml('<a href="mailto:a@b.co">x</a>');
    expect(mailto).toContain('href="mailto:a@b.co"');
    expect(mailto).not.toContain("target=");
    expect(mailto).toContain('rel="noopener noreferrer nofollow"');

    const local = sanitizeHtml('<a href="https://metfix.org/x">x</a>');
    expect(local).toContain('href="https://metfix.org/x"');
    expect(local).not.toContain("target=");
    expect(local).toContain('rel="noopener noreferrer nofollow"');
  });

  it("PS5: img host allowlist, drop bad img, drop bad srcset, lazy/no-referrer", () => {
    const good = sanitizeHtml(
      '<img src="https://brokenscience.org/a.jpg" alt="a">',
    );
    expect(good).toContain('src="https://brokenscience.org/a.jpg"');
    expect(good).toContain('loading="lazy"');
    expect(good).toContain('referrerpolicy="no-referrer"');

    expect(sanitizeHtml('<img src="/wp-content/a.jpg">')).toContain(
      'src="https://brokenscience.org/wp-content/a.jpg"',
    );

    for (const bad of [
      "http://brokenscience.org/a.jpg",
      "https://cdn.brokenscience.org/a.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,xx",
      "https://u:p@brokenscience.org/a.jpg",
    ]) {
      expect(sanitizeHtml(`<img src="${bad}" alt="x">`)).not.toContain("<img");
    }

    const dropSrcset = sanitizeHtml(
      '<img src="https://brokenscience.org/a.jpg" srcset="https://cdn.brokenscience.org/b.jpg 2x" alt="a">',
    );
    expect(dropSrcset).toContain("<img");
    expect(dropSrcset).not.toContain("srcset=");

    const keepSrcset = sanitizeHtml(
      '<img src="https://brokenscience.org/a.jpg" srcset="https://brokenscience.org/b.jpg 2x" alt="a">',
    );
    expect(keepSrcset).toContain("srcset=");
    expect(keepSrcset).toContain("https://brokenscience.org/b.jpg");
  });

  it("PS6: removes comments and nested mXSS fixtures", () => {
    expect(sanitizeHtml("a<!-- x -->b")).toBe("ab");
    expect(sanitizeHtml("a<!--[if IE]>x<![endif]-->b")).toBe("ab");

    const nested = sanitizeHtml(
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p>',
    );
    expect(nested).not.toMatch(/onerror/i);
    expect(nested).not.toContain("<noscript");

    const svg = sanitizeHtml(
      "<svg><style><img src=x onerror=alert(1)></style></svg>",
    );
    expect(svg).not.toMatch(/onerror/i);
    expect(svg).not.toContain("<svg");
  });

  it("PS7: idempotent", () => {
    const samples = [
      '<p>Hi <a href="/x">link</a></p><img src="https://brokenscience.org/a.jpg" alt="a">',
      '<div><h1>T</h1><script>bad</script><p onclick="x">ok</p></div>',
      '<a href="javascript:alert(1)">x</a><a href="https://metfix.org/y">y</a>',
    ];
    for (const s of samples) {
      const once = sanitizeHtml(s);
      const twice = sanitizeHtml(once);
      expect(twice).toBe(once);
      expect(sanitizeHtmlString(once)).toBe(once);
    }
  });
});

describe("allowlistedImageUrl", () => {
  it("rejects lookalike hosts (PW43)", () => {
    expect(allowlistedImageUrl("https://brokenscience.org.evil.com/a.jpg")).toBeNull();
    expect(allowlistedImageUrl("https://evilbrokenscience.org/a.jpg")).toBeNull();
    expect(allowlistedImageUrl("https://www.brokenscience.org/a.jpg")).toBeNull();
    expect(allowlistedImageUrl("https://brokenscience.org./a.jpg")).toBeNull();
    expect(allowlistedImageUrl("https://brokenscience.org:443/a.jpg")).toBeNull();
  });
});

describe("sanitizeConfig export identity (PS9)", () => {
  it("exports stable allowlist objects", async () => {
    const a = await import("./sanitizeConfig");
    const b = await import("./sanitizeConfig");
    expect(a.ALLOWED_TAGS).toBe(b.ALLOWED_TAGS);
    expect(a.ALLOWED_ATTR).toBe(b.ALLOWED_ATTR);
    expect(a.ALLOWED_TAGS).toContain("figcaption");
  });
});
