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

vi.mock("./liquidGlass", () => ({
  initLiquidGlass: vi.fn(async () => ({ destroy: vi.fn() })),
}));
vi.mock("./authHost", () => ({
  isAuthUiHost: () => true,
}));

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
    // Settle microtasks so a mutant logged-out POST would have fired.
    await waitFor(() => {
      const posts = fetchImpl.mock.calls.filter(
        (c) => ((c[1] as RequestInit | undefined)?.method ?? "GET") === "POST",
      );
      expect(posts).toHaveLength(0);
    });
  });

  it("C4.3 CommentThread POST uses CSRF header and JSON body keys", () => {
    const src = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(src).toMatch(/X-CSRF-Token/);
    expect(src).toMatch(/application\/json/);
    expect(src).toMatch(/date:\s*dateIso/);
    expect(src).toMatch(/type:\s*commentType/);
    expect(src).toMatch(/\bcontent\b/);
    expect(src).toMatch(/parent_comment_id/);
    expect(src).not.toMatch(/headers:.*Authorization/);
  });

  it("C4.4 CommentThread disables submit while posting", () => {
    const src = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(src).toMatch(/setPosting\(true\)/);
    expect(src).toMatch(/disabled=\{\s*posting/);
    expect(src).toMatch(/postLocked|isLocked\(`reply:/);
  });

  it.each([
    {
      label: "(a) 503 unavailable",
      post: async () =>
        new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
      getFail: false,
    },
    {
      label: "(b) 201 missing id",
      post: async () =>
        new Response(JSON.stringify({ comment: { content: "x", timestamp: "t" } }), {
          status: 201,
        }),
      getFail: false,
    },
    {
      label: "(c) TypeError reject",
      post: async () => {
        throw new TypeError("Failed to fetch");
      },
      getFail: false,
    },
    {
      label: "(d) sync throw",
      post: () => {
        throw new TypeError("sync boom");
      },
      getFail: false,
    },
    {
      label: "(e) refetch GET fails",
      post: async () =>
        new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
      getFail: true,
    },
  ])("CT-P1 $label → 1 POST + 1 bypass GET; no retry", async ({ post, getFail }) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const src = readFileSync(path.join(import.meta.dirname, "CommentThread.tsx"), "utf8");
    expect(src).toContain("We couldn't confirm your comment. Check the thread before posting again.");
    expect(src).toMatch(/bypassCache: true/);
    expect(src).not.toMatch(/setTimeout\(\(\) => \{?\s*void\s+postComment/);
    expect(src).not.toMatch(/setTimeout\(\(\) => postComment/);

    invalidateCommentsCache("2025-02-10");
    // Prime Map so a non-bypass GET would be 0 network — CT-P1 must bypass.
    await fetchDailyFixComments("2025-02-10", undefined, {
      fetchImpl: (async () =>
        new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] } }), {
          status: 200,
        })) as unknown as typeof fetch,
    });

    let posts = 0;
    let bypassGets = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrf: "c" }), { status: 200 });
      }
      if (u.includes("/api/daily-fix/comments") && method === "POST") {
        posts += 1;
        return post();
      }
      if (u.includes("/api/daily-fix/comments") && method === "GET") {
        bypassGets += 1;
        expect(init?.cache === "no-store" || init?.cache === "reload").toBe(true);
        if (getFail) {
          throw new TypeError("Failed to fetch");
        }
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
    await waitFor(() =>
      expect(
        screen.getByText("We couldn't confirm your comment. Check the thread before posting again."),
      ).toBeTruthy(),
    );
    await waitFor(() => expect(bypassGets).toBe(1));
    expect(posts).toBe(1);
    expect(bypassGets).toBe(1);
    expect(
      screen.getByText("We couldn't confirm your comment. Check the thread before posting again.")
        .textContent,
    ).toBe("We couldn't confirm your comment. Check the thread before posting again.");
    expect((screen.getByPlaceholderText(/Share a thought/i) as HTMLTextAreaElement).value).toBe(
      "retry-check",
    );
    // No optimistic comment row — composer keeps the typed text, thread has no new item.
    expect(document.querySelectorAll(".df-comment-item, .df-comment").length).toBe(0);

    // Drop the retry-tick setInterval so runAllTimers can flush without looping;
    // any mutant setTimeout retry would still fire and bump POST/GET counts.
    cleanup();
    await act(async () => {
      vi.runAllTimers();
    });
    expect(posts).toBe(1);
    expect(bypassGets).toBe(1);
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

  it("C6.1 loadMe single-flights one /api/auth/me across mount/navigate/focus/10min", async () => {
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
    // Mount/navigate/focus/10min behavioural flow lives in page.mount.test.tsx (C6.1).
    const mount = readFileSync(path.join(import.meta.dirname, "page.mount.test.tsx"), "utf8");
    expect(mount).toMatch(/C6\.1/);
    expect(mount).toMatch(/\/api\/auth\/me/);

    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes("/api/auth/me")) {
        return new Response(
          JSON.stringify({ signed_in: true, public_name: "Jane", moderator: false }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);
    const { loadMe, refreshMeAfterAuthChange } = await import("@/lib/session");
    // App-load single-flight.
    await Promise.all([loadMe(), loadMe()]);
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/api/auth/me"))).toHaveLength(
      1,
    );
    // Navigate / focus / 10 min must not refetch (cached).
    window.dispatchEvent(new Event("focus"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    await loadMe();
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/api/auth/me"))).toHaveLength(
      1,
    );
    // After login/logout → exactly 1 more.
    await refreshMeAfterAuthChange();
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/api/auth/me"))).toHaveLength(
      2,
    );
  });

  it("C6.2 comments start before day resolves; Map-cache; navigate-back in page.mount", async () => {
    const page = readFileSync(path.join(import.meta.dirname, "TheDailyFixPage.tsx"), "utf8");
    // Closer-day waits for loaded day (not source-regex-only for C6.2).
    expect(page).toMatch(/route\.kind === "today" && allowCloser/);
    expect(page).toMatch(/loadedCommentIso/);
    const comments = readFileSync(path.join(import.meta.dirname, "comments.ts"), "utf8");
    expect(comments).toMatch(/const commentsCache = new Map/);
    const mount = readFileSync(path.join(import.meta.dirname, "page.mount.test.tsx"), "utf8");
    expect(mount).toMatch(/expect\(isos\)\.not\.toContain\(TODAY\)/);
    expect(mount).toMatch(/byDate/);
    // Real navigate-back (0 new comment GETs) lives in page.mount C6.2.
    expect(mount).toMatch(/C6\.2[\s\S]*navigate/);
    expect(mount).toMatch(/commentGets/);

    invalidateCommentsCache();
    let resolveDay!: (v: Response) => void;
    const dayPending = new Promise<Response>((r) => {
      resolveDay = r;
    });
    let commentsStarted = false;
    let dayResolved = false;
    const fetchImpl = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/daily-fix/comments")) {
        commentsStarted = true;
        expect(dayResolved).toBe(false);
        return new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] } }), {
          status: 200,
        });
      }
      if (u.includes("/api/daily-fix")) {
        return dayPending;
      }
      if (u.includes("/api/auth/me")) {
        return new Response(JSON.stringify({ signed_in: false }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    // Behavioural: comments request starts before the day response resolves.
    const a = fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(commentsStarted).toBe(true);
    dayResolved = true;
    resolveDay(
      new Response(
        JSON.stringify({
          date: "2025-02-10",
          belly: {},
          body: {},
          brain: {},
        }),
        { status: 200 },
      ),
    );
    await a;
    const b = fetchDailyFixComments("2025-02-10", undefined, { fetchImpl });
    await b;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
