/**
 * @vitest-environment jsdom
 *
 * Staging sync: /library/:type/:id must not swallow /library/search.
 * Static path + /library/topic|content-type|category/:slug stay ahead of the param route.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Route, Router, Switch } from "wouter";

afterEach(() => {
  cleanup();
});

function appRoutesSource(): string {
  return readFileSync(join(import.meta.dirname, "App.tsx"), "utf8");
}

function routePathIndex(src: string, path: string): number {
  const needle = `path={${JSON.stringify(path)}}`;
  return src.indexOf(needle);
}

describe("App library route precedence (staging ↔ main sync)", () => {
  it("registers /library/search before /library/:type/:id in App.tsx", () => {
    const src = appRoutesSource();
    const searchIdx = routePathIndex(src, "/library/search");
    const detailIdx = routePathIndex(src, "/library/:type/:id");
    expect(searchIdx).toBeGreaterThan(-1);
    expect(detailIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeLessThan(detailIdx);
  });

  it("registers taxonomy static segments before /library/:type/:id", () => {
    const src = appRoutesSource();
    const detailIdx = routePathIndex(src, "/library/:type/:id");
    for (const path of [
      "/library/topic/:slug",
      "/library/content-type/:slug",
      "/library/category/:slug",
    ] as const) {
      const idx = routePathIndex(src, path);
      expect(idx, path).toBeGreaterThan(-1);
      expect(idx, path).toBeLessThan(detailIdx);
    }
  });

  it("wouter Switch: /library/search matches search, not :type/:id", () => {
    window.history.replaceState(null, "", "/library/search");
    render(
      <Router>
        <Switch>
          <Route path="/library/search">
            {() => <div data-testid="library-search">search</div>}
          </Route>
          <Route path="/library/:type/:id">
            {() => <div data-testid="library-detail">detail</div>}
          </Route>
        </Switch>
      </Router>,
    );
    expect(screen.getByTestId("library-search").textContent).toBe("search");
    expect(screen.queryByTestId("library-detail")).toBeNull();
  });

  it("wouter Switch: /library/post/42 still hits :type/:id", () => {
    window.history.replaceState(null, "", "/library/post/42");
    render(
      <Router>
        <Switch>
          <Route path="/library/search">
            {() => <div data-testid="library-search">search</div>}
          </Route>
          <Route path="/library/:type/:id">
            {() => <div data-testid="library-detail">detail</div>}
          </Route>
        </Switch>
      </Router>,
    );
    expect(screen.getByTestId("library-detail").textContent).toBe("detail");
    expect(screen.queryByTestId("library-search")).toBeNull();
  });
});
