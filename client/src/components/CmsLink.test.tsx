/**
 * @vitest-environment jsdom
 * T-E-20 / TH-2 — Sanity CTA hrefs: strip javascript:/data:; keep rel on externals.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CmsLink, isSafeCmsHref } from "./CmsLink";

describe("CmsLink / T-E-20", () => {
  it("rejects javascript: and data: (incl. padded / mixed case)", () => {
    expect(isSafeCmsHref("javascript:alert(1)")).toBe(false);
    expect(isSafeCmsHref(" JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeCmsHref("data:text/html,x")).toBe(false);
    expect(isSafeCmsHref("https://metfix.org/x")).toBe(true);
    expect(isSafeCmsHref("/library")).toBe(true);
    expect(isSafeCmsHref("#network")).toBe(true);
  });

  it("renders no href for javascript:/data: fixtures", () => {
    const { rerender } = render(
      <CmsLink cta={{ label: "Bad JS", href: "javascript:alert(1)" }} />,
    );
    expect(screen.getByText("Bad JS").closest("a")).toBeNull();
    expect(screen.getByText("Bad JS").tagName).toBe("SPAN");

    rerender(<CmsLink cta={{ label: "Bad data", href: "data:text/html,x" }} />);
    expect(screen.getByText("Bad data").closest("a")).toBeNull();
  });

  it("external https gets target=_blank rel noopener noreferrer", () => {
    render(
      <CmsLink cta={{ label: "Out", href: "https://brokenscience.org/x/" }} />,
    );
    const a = screen.getByRole("link", { name: "Out" });
    expect(a.getAttribute("href")).toBe("https://brokenscience.org/x/");
    expect(a.getAttribute("target")).toBe("_blank");
    const rel = (a.getAttribute("rel") || "").split(/\s+/);
    expect(rel).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
  });
});
