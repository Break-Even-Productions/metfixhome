/**
 * @vitest-environment jsdom
 * PL13 — author-right grid on /library/:type/:id
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import type { LibraryDetail } from "@shared/library";
import LibraryDetailPage from "./LibraryDetailPage";

function resource(partial: Partial<LibraryDetail> = {}): LibraryDetail {
  return {
    id: 42,
    type: "post",
    title: "Library Detail Title",
    excerpt: "Excerpt",
    date: "2026-01-15T00:00:00Z",
    image: null,
    permalink: null,
    author: "Emily Kaplan",
    categories: [],
    topics: [],
    content_types: [],
    access: {
      access: "full",
      has_content_access: false,
      user_has_access: true,
      has_preview: false,
      is_exclusive: false,
      show_same: 0,
      show_video_in_preview: false,
      access_group_labels: [],
    },
    content: "<p>Library body</p>",
    video: null,
    locked: false,
    ...partial,
  };
}

function mountAt(path: string) {
  window.history.replaceState({}, "", path);
  return render(
    <Router>
      <Route path="/library/:type/:id">
        <LibraryDetailPage />
      </Route>
    </Router>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("LibraryDetailPage author-right (PL13)", () => {
  it("renders post-reader-grid + AuthorAside when author is set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ resource: resource() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    mountAt("/library/post/42");
    expect(await screen.findByRole("heading", { name: "Library Detail Title" })).toBeTruthy();
    expect(document.querySelector(".post-reader-grid")).toBeTruthy();
    expect(document.querySelector(".library-reader--wide")).toBeTruthy();
    expect(screen.getByLabelText("About the author")).toBeTruthy();
    expect(
      screen.getByLabelText("About the author").textContent,
    ).toContain("Emily Kaplan");
    expect(screen.getByText("Library body")).toBeTruthy();
    expect(document.querySelector("footer.footer-mobile-pad")).toBeTruthy();
    expect(screen.getByRole("link", { name: "The Daily Fix" })).toBeTruthy();
    const aside = document.querySelector(".post-reader-aside");
    const comments = document.querySelector(".post-reader-comments");
    expect(aside && comments && Boolean(aside.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
  });

  it("TC11: ?from= mount does not call /api/library/filters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return new Response(JSON.stringify({ topics: [], categories: [], content_type_terms: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ resource: resource() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    mountAt("/library/post/42?from=topic:metabolic-health");
    expect(await screen.findByRole("heading", { name: "Library Detail Title" })).toBeTruthy();
    const filterCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/library/filters"),
    );
    expect(filterCalls).toHaveLength(0);
  });

  it("omits aside when author is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ resource: resource({ author: null }) }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    mountAt("/library/post/42");
    expect(await screen.findByRole("heading", { name: "Library Detail Title" })).toBeTruthy();
    expect(document.querySelector(".post-reader-grid")).toBeTruthy();
    expect(screen.queryByLabelText("About the author")).toBeNull();
  });

  it("renders Keep Learning below comments, excluding the current resource", async () => {
    const related = [
      resource({ id: 7, title: "Zone Two", topics: [] }),
      resource({ id: 8, title: "Pregnancy Guide", topics: [] }),
      resource({ id: 9, title: "Metabolic Flexibility", topics: [] }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/library/search") || url.includes("/api/library/popular")) {
          return new Response(
            JSON.stringify({
              resources: [resource({ topics: [] }), ...related],
              meta: { total: 4, count: 4, limit: 8, offset: 0, has_more: false },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            resource: resource({
              topics: [{ id: 3, name: "Metabolic Health", slug: "metabolic-health" }],
            }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    mountAt("/library/post/42");
    expect(await screen.findByRole("heading", { name: "Related Resources" })).toBeTruthy();
    expect(screen.getByText("Keep Learning")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse All" }).getAttribute("href")).toBe("/library");
    expect(screen.getByRole("heading", { name: "Zone Two" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pregnancy Guide" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Metabolic Flexibility" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Library Detail Title" })).toHaveLength(1);
    const discussion = document.querySelector(".post-detail-discussion");
    const keep = document.querySelector(".keep-learning");
    const footer = document.querySelector("footer.footer-mobile-pad");
    expect(
      discussion &&
        keep &&
        Boolean(discussion.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(
      keep &&
        footer &&
        Boolean(keep.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});
