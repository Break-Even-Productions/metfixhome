/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUBSTACK_ARCHIVE_URL } from "@/data/newsletter";
import { HomeResources } from "./HomeResources";

vi.mock("@/lib/substack", async () => {
  const actual = await vi.importActual<typeof import("@/lib/substack")>("@/lib/substack");
  return {
    ...actual,
    loadSubstackPosts: async () => [
      {
        title: "Sample Substack post",
        excerpt: "Excerpt from the archive",
        url: "https://letsstartwiththetruth.substack.com/p/sample",
        date: "2026-01-01T00:00:00.000Z",
        image: null,
      },
    ],
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe("HomeResources CTAs", () => {
  it("loads Substack posts, links archive, and opens newsletter modal", async () => {
    render(
      <HomeResources
        title="Let’s Start with the Truth"
        resourceLibrary={
          {
            subtext: "Should not render",
            fullLibraryCta: { label: "Full Library", href: "/library" },
            bottomCta: { label: "Access the Full Library", href: "/library" },
          } as never
        }
      />,
    );

    await waitFor(() => expect(screen.getByText("Sample Substack post")).toBeTruthy());
    expect(screen.queryByText("Should not render")).toBeNull();

    const card = screen.getByRole("link", { name: /Sample Substack post/i });
    expect(card.getAttribute("href")).toBe(
      "https://letsstartwiththetruth.substack.com/p/sample",
    );
    expect(card.getAttribute("target")).toBe("_blank");

    const archive = screen.getByRole("link", { name: /Read the archive/i });
    expect(archive.getAttribute("href")).toBe(SUBSTACK_ARCHIVE_URL);

    fireEvent.click(screen.getByRole("button", { name: /Sign up for the newsletter/i }));
    expect(screen.getByRole("dialog", { name: /What should we send you/i })).toBeTruthy();
  });
});
