/**
 * @vitest-environment jsdom
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";
import { JoinModal } from "./JoinModal";
import {
  dailyFixCommentsRequestUrl,
  fetchDailyFixComments,
  invalidateCommentsCache,
  mapDailyFixComments,
} from "./comments";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, hostname: "metfix.org", href: "https://metfix.org/" },
  });
});

afterEach(() => {
  cleanup();
  invalidateCommentsCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PR2 client gates C / CT / CC1", () => {
  it("C1.1 comments URL is same-origin Worker path without BFF env", () => {
    expect(dailyFixCommentsRequestUrl("2025-02-10")).toBe(
      "/api/daily-fix/comments?date=2025-02-10&type=all",
    );
    const commentsTs = readFileSync(path.join(import.meta.dirname, "comments.ts"), "utf8");
    expect(commentsTs).not.toMatch(/DAILY_FIX_BFF_URL/);
  });

  it("C2.1 comments GET uses Accept application/json only", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method ?? "GET").toBe("GET");
      expect(init?.headers).toEqual({ Accept: "application/json" });
      expect(init).not.toHaveProperty("credentials");
      expect(init).not.toHaveProperty("Authorization");
      return new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] } }), {
        status: 200,
      });
    });
    await fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
  });

  it("C3.1 mapDailyFixComments maps W7 fixture and blanks to Member", () => {
    const w7 = {
      comments: {
        belly: [
          {
            id: 1,
            user: { display_name: "Jane" },
            content: "hi",
            timestamp: "2026-10-04T12:00:00Z",
            replies: [],
          },
          {
            id: 2,
            user: { display_name: "  " },
            content: "x",
            timestamp: "2026-10-04T12:01:00Z",
            replies: [],
          },
        ],
        body: [],
        brain: [],
      },
      meta: { date: "2026-10-04", type: "all" },
    };
    const mapped = mapDailyFixComments(w7);
    expect(mapped?.[0]).toMatchObject({ author: "Jane", content: "hi", pillar: "belly" });
    expect(mapped?.[1]?.author).toBe("Member");
  });

  it("C4.1 comment UI status strings are exact", () => {
    const { rerender, unmount } = render(
      <CommentThread load={{ status: "loading" }} pillar="belly" />,
    );
    expect(screen.getByText("Loading comments…").textContent).toBe("Loading comments…");
    unmount();
    render(<CommentThread load={{ status: "unavailable" }} pillar="belly" />);
    expect(screen.getByText("Comments are unavailable right now.").textContent).toBe(
      "Comments are unavailable right now.",
    );
    unmount();
    render(<CommentThread load={{ status: "loaded", comments: [] }} pillar="belly" />);
    expect(screen.getByText("No comments yet.").textContent).toBe("No comments yet.");
  });

  it("C4.2 logged-out submit opens join modal with zero POSTs", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ signed_out: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchImpl);
    render(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        dateIso="2025-02-10"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Share a thought/i), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Post comment/i }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    const posts = fetchImpl.mock.calls.filter(
      (c) => ((c[1] as RequestInit | undefined)?.method ?? "GET") === "POST",
    );
    expect(posts).toHaveLength(0);
  });

  it("C4.3 CommentThread POST uses CSRF header and JSON body keys", () => {
    const src = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(src).toMatch(/X-CSRF-Token/);
    expect(src).toMatch(/application\/json/);
    expect(src).toMatch(/date: dateIso, type: commentType, content/);
    expect(src).not.toMatch(/headers:.*Authorization/);
  });

  it("C4.4 CommentThread disables submit while posting", () => {
    const src = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(src).toMatch(/setPosting\(true\)/);
    expect(src).toMatch(/disabled=\{posting \|\| postLocked\}/);
  });

  it("CT-P1 CommentThread refetches once with cache bypass after failed POST", async () => {
    const src = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(src).toContain("We couldn't confirm your comment. Check the thread before posting again.");
    expect(src).toMatch(/bypassCache: true/);
    expect(src).not.toMatch(/setTimeout\(\(\) => \{?\s*void\s+postComment/);
    expect(src).not.toMatch(/setTimeout\(\(\) => postComment/);
    expect(src).not.toMatch(/await postComment\(\);\s*\n\s*return;/);

    vi.useFakeTimers();
    let posts = 0;
    let gets = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "POST") {
        posts += 1;
        return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "GET") {
        gets += 1;
        return new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] } }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        dateIso="2025-02-10"
        viewerDisplayName="Member"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Share a thought/i), {
      target: { value: "retry-check" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Post comment/i }));
    await waitFor(() => expect(posts).toBe(1));
    await waitFor(() => expect(gets).toBe(1));
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });
    expect(posts).toBe(1);
    expect(gets).toBe(1);
    expect(
      screen.getByText("We couldn't confirm your comment. Check the thread before posting again.")
        .textContent,
    ).toBe("We couldn't confirm your comment. Check the thread before posting again.");
    expect((screen.getByPlaceholderText(/Share a thought/i) as HTMLTextAreaElement).value).toBe(
      "retry-check",
    );

    // Variant (e): refetch GET fails → still exactly one POST.
    cleanup();
    invalidateCommentsCache();
    posts = 0;
    gets = 0;
    const fetchFailGet = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "POST") {
        posts += 1;
        return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "GET") {
        gets += 1;
        return new Response("{}", { status: 503 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchFailGet);
    render(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        dateIso="2025-02-10"
        viewerDisplayName="Member"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Share a thought/i), {
      target: { value: "retry-check-e" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Post comment/i }));
    await waitFor(() => expect(posts).toBe(1));
    await waitFor(() => expect(gets).toBe(1));
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });
    expect(posts).toBe(1);
    expect(gets).toBe(1);
  });

  it("CT2 comment HTML renders as literal text without script execution", () => {
    const xss = '<img src=x onerror=alert(1)>';
    render(
      <CommentThread
        load={{
          status: "loaded",
          comments: [
            {
              id: 1,
              pillar: "brain",
              author: "A",
              content: xss,
              timestamp: null,
            },
          ],
        }}
        pillar="brain"
      />,
    );
    const root = document.querySelector(".df-comments")!;
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.textContent).toContain(xss);
    expect((window as unknown as { __x?: number }).__x).toBeUndefined();
  });

  it("C6.3 concurrent fetchDailyFixComments shares one GET", async () => {
    let resolve!: (v: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
    const fetchImpl = vi.fn(async () => pending);
    const a = fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
    const b = fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolve(
      new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] } }), {
        status: 200,
      }),
    );
    await Promise.all([a, b]);
  });

  it("C7.1 CommentThread has no name field or name state", () => {
    const thread = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(thread).not.toMatch(/useState.*name|setName/);
    expect(thread).not.toMatch(/not wired yet/);
    render(<CommentThread load={{ status: "loaded", comments: [] }} pillar="belly" />);
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    render(
      <CommentThread
        load={{ status: "loaded", comments: [] }}
        pillar="belly"
        viewerDisplayName="Jane"
      />,
    );
    expect(screen.getByText(/Signed in as Jane/i)).toBeTruthy();
  });

  it("C7.2 Google start uses location.assign when enabled", () => {
    const join = readFileSync(path.join(import.meta.dirname, "JoinModal.tsx"), "utf8");
    expect(join).toMatch(/\/api\/auth\/google\/start/);
    expect(join).toMatch(/window\.location\.assign/);
    render(<JoinModal open onClose={() => {}} googleEnabled />);
    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeTruthy();
  });

  it("C6.1 loadMe single-flights one /api/auth/me per app load", async () => {
    const sessionSrc = readFileSync(
      path.join(REPO_ROOT, "client/src/lib/session.ts"),
      "utf8",
    );
    expect(sessionSrc).toMatch(/let inflight/);
    expect(sessionSrc).toMatch(/let cached/);
    expect(sessionSrc).toMatch(/if \(!options\?\.force && cached/);
    expect(sessionSrc).toMatch(/if \(!options\?\.force && inflight\)/);
    const page = readFileSync(path.join(import.meta.dirname, "TheDailyFixPage.tsx"), "utf8");
    expect(page).toMatch(/void loadMe\(\)/);
    expect(page).not.toMatch(/loadMe\(\{\s*force:\s*true/);
    expect(page).toMatch(/void loadMe\(\)\.then\([\s\S]*?\}, \[\]\);/);

    vi.resetModules();
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("/api/auth/me")) {
        return new Response(JSON.stringify({ signed_in: false }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    const { loadMe } = await import("@/lib/session");
    await Promise.all([loadMe(), loadMe()]);
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/api/auth/me"))).toHaveLength(
      1,
    );
    await loadMe();
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/api/auth/me"))).toHaveLength(
      1,
    );
  });

  it("C6.2 comments fetch starts before day load and Map-caches by date", () => {
    const page = readFileSync(path.join(import.meta.dirname, "TheDailyFixPage.tsx"), "utf8");
    expect(page).toMatch(/loadedCommentIso \?\? fetchIso/);
    expect(page).not.toMatch(
      /const commentIso = load\.status === "loaded" \? load\.day\.date : null;/,
    );
    const comments = readFileSync(path.join(import.meta.dirname, "comments.ts"), "utf8");
    expect(comments).toMatch(/const commentsCache = new Map/);
    const mount = readFileSync(path.join(import.meta.dirname, "page.mount.test.tsx"), "utf8");
    expect(mount).toMatch(/fetchDailyFixComments/);
    expect(mount).toMatch(/toHaveBeenCalledTimes\(1\)/);
  });

  it("CC1 cloudflare-client.test.tsx matches main blob md5", () => {
    const rel = "client/src/pages/the-daily-fix/cloudflare-client.test.tsx";
    const md5 = createHash("md5")
      .update(readFileSync(path.join(REPO_ROOT, rel)))
      .digest("hex");
    expect(md5).toBe("6e22cfa939ef3c068606e62ad0eedc7f");
    execSync(`npx vitest run ${rel} -t "C2:|C5:|C6:"`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  });
});
