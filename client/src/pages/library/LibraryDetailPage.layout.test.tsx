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
});
