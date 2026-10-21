/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOWED_ATTR,
  ALLOWED_TAGS,
} from "@shared/posts/sanitizeConfig";
import {
  SAFE_HTML_ALLOWED_ATTR,
  SAFE_HTML_ALLOWED_TAGS,
  SafeHtml,
} from "./SafeHtml";

afterEach(() => {
  cleanup();
});

describe("SafeHtml", () => {
  it("PS9: DOMPurify config imports the same allowlist objects by identity", () => {
    expect(SAFE_HTML_ALLOWED_TAGS).toBe(ALLOWED_TAGS);
    expect(SAFE_HTML_ALLOWED_ATTR).toBe(ALLOWED_ATTR);
  });

  it("PC13: strips script, on*, javascript: href, and non-https img", () => {
    const dirty =
      '<p>Hi</p><script>alert(1)</script>' +
      '<img src="https://evil.example/x.jpg" onerror="alert(1)">' +
      '<a href="javascript:alert(1)">x</a>' +
      '<img src="http://brokenscience.org/a.jpg">' +
      '<img src="https://cdn.brokenscience.org/a.jpg">' +
      '<img src="data:image/png;base64,xx">' +
      '<img src="https://brokenscience.org/wp-content/uploads/ok.jpg">';

    const { container } = render(<SafeHtml html={dirty} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute("src")).toBe(
      "https://brokenscience.org/wp-content/uploads/ok.jpg",
    );
    expect(imgs[0]!.getAttribute("loading")).toBe("lazy");
    expect(imgs[0]!.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("keeps allowed tags and https brokenscience images", () => {
    const html =
      '<p>Hello <strong>world</strong></p>' +
      '<a href="/rel">link</a>' +
      '<img src="/wp-content/uploads/a.jpg" alt="a">';
    const { container } = render(<SafeHtml html={html} />);
    expect(container.querySelector("p")?.textContent).toContain("Hello");
    expect(container.querySelector("strong")?.textContent).toBe("world");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://brokenscience.org/rel");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(a?.getAttribute("target")).toBe("_blank");
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "https://brokenscience.org/wp-content/uploads/a.jpg",
    );
  });

  it("PC12: is the only dangerouslySetInnerHTML consumer for posts HTML", () => {
    const { container } = render(<SafeHtml html="<p>x</p>" />);
    expect(container.querySelector("p")?.textContent).toBe("x");
  });
});
